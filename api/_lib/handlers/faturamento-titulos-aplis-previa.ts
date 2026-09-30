/**
 * API Route: GET /api/faturamento/titulos-aplis-previa
 *
 * Prévia do "Atualizar do apLIS" (.scratch/faturamento-titulos-automaticos/spec.md):
 * lotes fechados no apLIS a partir de uma data de corte que ainda não têm título.
 * Só leitura — a criação reaproveita titulo-criar, um lote por chamada.
 *
 * Elegibilidade:
 *   - DtaFechamento >= desde, STLOT fora de 5 Cancelado e 8 Prejuízo (bdLab);
 *   - fonte pagadora não Particular (particulares têm fluxo de pendências próprio);
 *   - nenhum vínculo em `nota_lote`, com título de QUALQUER status — inclusive
 *     cancelado. Diferente de fat_criar_titulo e da aba Faturas, que liberam lote
 *     de título cancelado: refaturar lote cancelado é decisão manual.
 *
 * Marcas por lote: `bloqueio: 'sem-valor'` (valor ≤ 0), `jaRecebidoAplis`
 * (STLOT 4/7), `semNf` (sem NF-e: a baixa vai exigir o número),
 * `emissaoMesAnterior` (criado num mês, fechado noutro) e `desvinculado` (último
 * registro do lote em notas_lote_audit_logs — elegível de novo, mas a tela o traz
 * desmarcado).
 *
 * `nfsAPreencher`: títulos não cancelados sem número da nota — de qualquer
 * origem e independentes da data de corte — em que TODOS os lotes têm NF-e no
 * apLIS. Mesma NF-e em todos → 'preenchivel'; mais de uma → 'divergente' (a
 * tela lista, mas não deixa marcar). Algum lote ainda sem NF-e → fora. O
 * preenchimento é da tela, por titulo-atualizar-numero-nota com somenteSeVazio;
 * o vencimento nunca muda (o do RPS erra o pagamento em 42 dias, mediana).
 *
 * Autorização: `Authorization: Bearer <access_token>` da sessão, exigindo
 * canManageBilling — a prévia só serve a quem vai criar.
 *
 * Query params:
 *   desde  YYYY-MM-DD — obrigatório, a partir de 01/09/2026
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { listarLotesFechadosDesde, nfesDosLotes } from '../faturamento/bdLab.js';
import type { LoteFaturamento } from '../faturamento/bdLab.js';
import { getSupabaseAdminClient } from '../supabase.js';

/** Lotes fechados antes disso foram tratados pelo backfill. Mesmo piso do campo
 *  da tela (PISO_CORTE_APLIS em src/modules/faturamento/utils/atualizarAplis.ts). */
const PISO_CORTE = '2026-09-01';

const DATA_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

/** STLOT Recebido e Recebido - parcial. */
const STATUS_RECEBIDO = [4, 7];

/** Ids por `.in()`: vai na URL do PostgREST, e 200 uuids passam do seguro. */
const LOTE_CONSULTA = 100;

interface Desvinculo {
  idNota: string;
  numeroNota: string | null;
  /** timestamptz do desvínculo. */
  em: string;
  motivo: string;
}

interface LotePrevia {
  lote: LoteFaturamento;
  bloqueio: 'sem-valor' | null;
  jaRecebidoAplis: boolean;
  semNf: boolean;
  emissaoMesAnterior: boolean;
  desvinculado: Desvinculo | null;
}

interface NfAPreencher {
  idNota: string;
  idsLote: number[];
  operadora: string;
  situacao: 'preenchivel' | 'divergente';
  /** Uma quando preenchível; as distintas quando divergente. */
  nfeNumeros: string[];
}

/** Título sem número e os `aplis_id` dos seus lotes. `completo` é falso quando
 *  algum lote não tem `aplis_id` (criado fora do apLIS): aí não há NF-e a
 *  conferir e o título fica fora da prévia. */
interface TituloSemNumero {
  idNota: string;
  operadora: string;
  idsLote: number[];
  completo: boolean;
}

/** Página do PostgREST (max-rows padrão do Supabase). */
const PAGINA_NOTAS = 1000;

class ErroSupabase extends Error {}

function primeiro(valor: string | string[] | undefined): string | undefined {
  if (Array.isArray(valor)) return valor[0];
  return valor;
}

/** YYYY-MM-DD que existe no calendário (recusa 2026-09-31). */
function dataValida(iso: string): boolean {
  if (!DATA_ISO_RE.test(iso)) return false;
  const [ano, mes, dia] = iso.split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
}

function emBlocos<T>(itens: T[]): T[][] {
  const blocos: T[][] = [];
  for (let i = 0; i < itens.length; i += LOTE_CONSULTA) blocos.push(itens.slice(i, i + LOTE_CONSULTA));
  return blocos;
}

/** Busca `tabela` filtrando `coluna` por `valores`, em blocos. Erro lança: sem
 *  a dedupe a prévia ofereceria lote já faturado. */
async function selecionarEm(
  supabase: SupabaseClient,
  tabela: string,
  colunas: string,
  coluna: string,
  valores: string[],
): Promise<Record<string, unknown>[]> {
  const linhas: Record<string, unknown>[] = [];
  for (const bloco of emBlocos(valores)) {
    const { data, error } = await supabase.from(tabela).select(colunas).in(coluna, bloco);
    if (error) throw new ErroSupabase(`${tabela}: ${error.message}`);
    linhas.push(...((data ?? []) as unknown as Record<string, unknown>[]));
  }
  return linhas;
}

/**
 * Situação de cada lote do apLIS no Contas a Receber: os que têm vínculo com
 * algum título (qualquer status) e, dos demais, o último desvínculo registrado.
 */
async function situacaoNoReceber(
  supabase: SupabaseClient,
  idsAplis: number[],
): Promise<{ comTitulo: Set<number>; desvinculos: Map<number, Desvinculo> }> {
  const comTitulo = new Set<number>();
  const desvinculos = new Map<number, Desvinculo>();
  if (idsAplis.length === 0) return { comTitulo, desvinculos };

  // `lotes` só tem linha para lote que já passou por algum título; lote sem
  // linha aqui nunca foi faturado.
  const linhasLote = await selecionarEm(supabase, 'lotes', 'id_lote, aplis_id', 'aplis_id', idsAplis.map(String));
  const aplisPorUuid = new Map<string, number>();
  for (const linha of linhasLote) aplisPorUuid.set(linha.id_lote as string, Number(linha.aplis_id));
  if (aplisPorUuid.size === 0) return { comTitulo, desvinculos };

  const uuids = [...aplisPorUuid.keys()];
  const vinculos = await selecionarEm(supabase, 'nota_lote', 'id_lote', 'id_lote', uuids);
  for (const vinculo of vinculos) {
    const aplis = aplisPorUuid.get(vinculo.id_lote as string);
    if (aplis !== undefined) comTitulo.add(aplis);
  }

  const semVinculo = uuids.filter((uuid) => !comTitulo.has(aplisPorUuid.get(uuid) as number));
  const auditoria = await selecionarEm(
    supabase,
    'notas_lote_audit_logs',
    'lote_id, nota_id, motivo, performed_at, notas(numero_nota)',
    'lote_id',
    semVinculo,
  );
  for (const registro of auditoria) {
    const aplis = aplisPorUuid.get(registro.lote_id as string);
    if (aplis === undefined) continue;
    const em = registro.performed_at as string;
    const atual = desvinculos.get(aplis);
    if (atual && atual.em >= em) continue;
    const nota = registro.notas as { numero_nota: string | null } | null;
    desvinculos.set(aplis, {
      idNota: registro.nota_id as string,
      numeroNota: nota?.numero_nota ?? null,
      em,
      motivo: registro.motivo as string,
    });
  }
  return { comTitulo, desvinculos };
}

/**
 * Títulos não cancelados com `numero_nota` vazio, de qualquer data. Número só
 * com espaços não entra aqui (o filtro do PostgREST não faz TRIM) — continua
 * sendo tratado como vazio pela RPC, só não é oferecido na prévia.
 */
async function titulosSemNumero(supabase: SupabaseClient): Promise<TituloSemNumero[]> {
  const titulos: TituloSemNumero[] = [];
  for (let offset = 0; ; offset += PAGINA_NOTAS) {
    const { data, error } = await supabase
      .from('notas')
      .select('id_nota, operadoras(nome), nota_lote(lotes(aplis_id))')
      .neq('status', 'cancelada')
      .or('numero_nota.is.null,numero_nota.eq.')
      .order('id_nota', { ascending: true })
      .range(offset, offset + PAGINA_NOTAS - 1);
    if (error) throw new ErroSupabase(`notas: ${error.message}`);
    const pagina = (data ?? []) as unknown as {
      id_nota: string;
      operadoras: { nome: string | null } | null;
      nota_lote: { lotes: { aplis_id: string | null } | null }[] | null;
    }[];
    for (const nota of pagina) {
      const vinculos = nota.nota_lote ?? [];
      const idsLote = vinculos
        .map((vinculo) => Number(vinculo.lotes?.aplis_id ?? NaN))
        .filter((id) => Number.isInteger(id) && id > 0);
      titulos.push({
        idNota: nota.id_nota,
        operadora: nota.operadoras?.nome ?? '—',
        idsLote,
        completo: vinculos.length > 0 && idsLote.length === vinculos.length,
      });
    }
    if (pagina.length < PAGINA_NOTAS) break;
  }
  return titulos;
}

/** Cruza os títulos sem número com as NF-e dos lotes no apLIS. */
function montarNfsAPreencher(titulos: TituloSemNumero[], nfes: Record<number, string>): NfAPreencher[] {
  const nfs: NfAPreencher[] = [];
  for (const titulo of titulos) {
    const { idsLote } = titulo;
    // Algum lote sem apLIS ou sem NF-e: o número do título ainda não está decidido.
    if (!titulo.completo || idsLote.some((id) => !nfes[id])) continue;
    const nfeNumeros = [...new Set(idsLote.map((id) => nfes[id]))]
      .sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
    nfs.push({
      idNota: titulo.idNota,
      idsLote: [...idsLote].sort((a, b) => a - b),
      operadora: titulo.operadora,
      situacao: nfeNumeros.length === 1 ? 'preenchivel' : 'divergente',
      nfeNumeros,
    });
  }
  return nfs.sort((a, b) => a.operadora.localeCompare(b.operadora, 'pt-BR') || a.idsLote[0] - b.idsLote[0]);
}

function mensagemErroAplis(mensagem: string): string {
  return `Não foi possível ler os lotes do apLIS agora — tente novamente em alguns minutos. (${mensagem})`;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ success: false, error: 'Método não permitido' });
    return;
  }

  try {
    const erroAuth = await autorizarFaturamento(tokenDoHeader(req.headers.authorization), 'canManageBilling');
    if (erroAuth) {
      res.status(erroAuth.status).json(erroAuth.payload);
      return;
    }

    const q = req.query as Record<string, string | string[] | undefined>;
    const desde = primeiro(q.desde)?.trim() ?? '';
    if (!dataValida(desde)) {
      res.status(400).json({ success: false, error: 'Informe "desde" como uma data válida no formato YYYY-MM-DD.' });
      return;
    }
    // Comparação lexicográfica vale para YYYY-MM-DD.
    if (desde < PISO_CORTE) {
      res.status(400).json({ success: false, error: 'A data de corte não pode ser anterior a 01/09/2026.' });
      return;
    }

    const resultado = await listarLotesFechadosDesde(desde);
    if ('erro' in resultado) {
      res.status(resultado.erro.status).json({ success: false, error: mensagemErroAplis(resultado.erro.mensagem) });
      return;
    }

    const supabase = getSupabaseAdminClient();
    const candidatos = resultado.lotes.filter((item) => !item.particular).map((item) => item.lote);
    let situacao: Awaited<ReturnType<typeof situacaoNoReceber>>;
    let semNumero: TituloSemNumero[];
    try {
      [situacao, semNumero] = await Promise.all([
        situacaoNoReceber(supabase, candidatos.map((l) => l.idLote)),
        titulosSemNumero(supabase),
      ]);
    } catch (err) {
      if (!(err instanceof ErroSupabase)) throw err;
      console.error('[faturamento/titulos-aplis-previa] Supabase:', err.message);
      res.status(502).json({
        success: false,
        error: 'Não foi possível conferir os títulos já lançados — tente novamente em alguns minutos.',
      });
      return;
    }

    const idsSemNumero = semNumero.filter((t) => t.completo).flatMap((t) => t.idsLote);
    // Sem título a completar, nem abre outra conexão ao túnel.
    const nfes = idsSemNumero.length > 0 ? await nfesDosLotes(idsSemNumero) : { porLote: {} };
    if ('erro' in nfes) {
      res.status(nfes.erro.status).json({ success: false, error: mensagemErroAplis(nfes.erro.mensagem) });
      return;
    }

    const lotes: LotePrevia[] = candidatos
      .filter((candidato) => !situacao.comTitulo.has(candidato.idLote))
      .map((lote) => ({
        lote,
        bloqueio: lote.valor <= 0 ? 'sem-valor' : null,
        jaRecebidoAplis: STATUS_RECEBIDO.includes(lote.status),
        semNf: !lote.nfeNumero,
        emissaoMesAnterior: Boolean(lote.dtaCriacao && lote.dtaFechamento)
          && lote.dtaCriacao.slice(0, 7) !== lote.dtaFechamento.slice(0, 7),
        desvinculado: situacao.desvinculos.get(lote.idLote) ?? null,
      }));

    // Dado financeiro: não deixa ficar em cache de navegador nem de proxy.
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      success: true,
      desde,
      lotes,
      nfsAPreencher: montarNfsAPreencher(semNumero, nfes.porLote),
    });
  } catch (err) {
    console.error('[faturamento/titulos-aplis-previa] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
