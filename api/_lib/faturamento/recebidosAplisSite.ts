// api/_lib/faturamento/recebidosAplisSite.ts
// Retrato do recebido dos lotes lido no SITE do apLIS
// (.scratch/faturamento-recebidos-aplis-site/spec.md): `faturamento-ajax.listarBaixa`
// com `Filtro[Lote]`, a lista da tela de Baixa, uma linha por requisição. É o
// mesmo dado de `fatrequisicaoprocedimento.ValorRecebido/DtaRecebido` do MySQL
// de backup, mas do minuto (conferido no lote 6912 em 18/11/2026).
//
// Captura: os lotes dos títulos não cancelados com saldo em aberto, do
// capturado há mais tempo ao mais recente, numa sessão só (~65 ms por lote,
// medido em 18/11). Para no orçamento de tempo; o resto vai na próxima.
// Grava em blocos pela RPC fat_gravar_recebidos_aplis_site (atômica por bloco).
//
// `listarBaixa` não é gravação, apesar do nome: só lista. O site não é contrato
// do fornecedor e pode mudar sem aviso — falha aqui deixa o banco valendo.

import type { SupabaseClient } from '@supabase/supabase-js';
import { ErroAplisSite, SessaoAplisSite } from '../aplisSite/sessao.js';
import { describeError } from '../errors.js';
import type { RetratoLote, RequisicaoRetrato } from './recebidosAplis.js';

const CAMINHO_FATURAMENTO = '/areas/faturamento/faturamento-ajax.php';
/** Lotes por gravação no Supabase. */
const BLOCO_GRAVACAO = 50;
/** Ids por `.in()` na leitura do retrato. */
const BLOCO_LEITURA = 500;
/** Página do PostgREST. */
const PAGINA = 1000;
/** Páginas de 100 requisições: o maior lote visto tem 100. Trava contra laço sem fim. */
const MAX_PAGINAS_LOTE = 20;

/** Filtros da tela de Baixa (HAR de 14/10/2026): todos vão, mesmo vazios. */
const FILTROS_VAZIOS = [
  'DtaIni', 'DtaFim', 'StatusFat', 'IdPrestador', 'IdFontePagadora', 'IdLocalOrigem',
  'IdConvenio', 'Paciente', 'CodBarra', 'Guia', 'IdGlosa', 'CodEvento',
] as const;

/** "1.234,56" → 1234.56; vazio ou inválido → 0. */
export function numeroBr(texto: unknown): number {
  if (typeof texto === 'number') return Number.isFinite(texto) ? texto : 0;
  if (typeof texto !== 'string' || !texto.trim()) return 0;
  const n = Number(texto.trim().replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/** "13/11/2026" → "2026-11-13"; outro formato → null. */
export function dataBr(texto: unknown): string | null {
  if (typeof texto !== 'string') return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(texto.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

export interface RequisicaoSite extends RequisicaoRetrato {
  idRequisicao: number;
}

/** Uma linha de `listarBaixa`; null sem `IdRequisicao`. */
export function requisicaoDaLinha(linha: Record<string, unknown>): RequisicaoSite | null {
  const id = Number(linha.IdRequisicao);
  if (!Number.isInteger(id) || id <= 0) return null;
  return {
    idRequisicao: id,
    liquido: numeroBr(linha.VlrLiquido),
    recebido: numeroBr(linha.VlrRecebido),
    data: dataBr(linha.DtaRecebido),
  };
}

interface RespostaListarBaixa {
  sucesso?: boolean;
  msg?: string;
  dados?: { Requisicoes?: Record<string, unknown>[]; QtdPaginas?: number } | null;
}

/** Recusa do site para um lote (ex.: "Nº lote inválido"): pula o lote, não a captura. */
class LoteRecusado extends Error {}

/** As requisições de um lote, todas as páginas. */
export async function lerLote(sessao: SessaoAplisSite, idLote: number): Promise<RequisicaoSite[]> {
  const requisicoes: RequisicaoSite[] = [];
  for (let pagina = 1; pagina <= MAX_PAGINAS_LOTE; pagina += 1) {
    const form: [string, string][] = [
      ...FILTROS_VAZIOS.map((f): [string, string] => [`Filtro[${f}]`, '']),
      ['Filtro[Lote]', String(idLote)],
      ['Ordenar', '1'],
      ['Pagina', String(pagina)],
    ];
    const resp = await sessao.post(CAMINHO_FATURAMENTO, 'listarBaixa', form);
    const corpo = (await resp.json().catch(() => null)) as RespostaListarBaixa | null;
    if (!corpo) throw new ErroAplisSite('listarBaixa: resposta fora do formato JSON — o site mudou?');
    if (!corpo.sucesso) throw new LoteRecusado(corpo.msg || 'recusado pelo apLIS');
    for (const linha of corpo.dados?.Requisicoes ?? []) {
      const r = requisicaoDaLinha(linha);
      if (r) requisicoes.push(r);
    }
    if (pagina >= Number(corpo.dados?.QtdPaginas ?? 1)) return requisicoes;
  }
  throw new ErroAplisSite(`listarBaixa: lote ${idLote} com mais de ${MAX_PAGINAS_LOTE} páginas.`);
}

/**
 * `aplis_id` dos lotes dos títulos não cancelados com saldo em aberto, do
 * capturado há mais tempo (ou nunca) ao mais recente.
 */
export async function lotesParaCapturar(supabase: SupabaseClient): Promise<number[]> {
  const ids = new Set<number>();
  for (let offset = 0; ; offset += PAGINA) {
    const { data, error } = await supabase
      .from('notas')
      .select('id_nota, nota_lote(lotes(aplis_id))')
      .neq('status', 'cancelada')
      .gt('valor_saldo', 0)
      .order('id_nota', { ascending: true })
      .range(offset, offset + PAGINA - 1);
    if (error) throw new Error(`notas: ${error.message}`);
    const pagina = (data ?? []) as unknown as { nota_lote: { lotes: { aplis_id: string | null } | null }[] | null }[];
    for (const nota of pagina) {
      for (const { lotes } of nota.nota_lote ?? []) {
        const id = Number(lotes?.aplis_id ?? NaN);
        if (Number.isInteger(id) && id > 0) ids.add(id);
      }
    }
    if (pagina.length < PAGINA) break;
  }

  const capturado = new Map<number, string>();
  const lista = [...ids];
  for (let i = 0; i < lista.length; i += BLOCO_LEITURA) {
    const { data, error } = await supabase
      .from('fat_aplis_site_lotes')
      .select('aplis_lote_id, capturado_em')
      .in('aplis_lote_id', lista.slice(i, i + BLOCO_LEITURA));
    if (error) throw new Error(`fat_aplis_site_lotes: ${error.message}`);
    for (const l of (data ?? []) as { aplis_lote_id: number; capturado_em: string }[]) {
      capturado.set(Number(l.aplis_lote_id), l.capturado_em);
    }
  }
  // Nunca capturado ('') primeiro; depois do mais antigo ao mais recente.
  return lista.sort((a, b) => (capturado.get(a) ?? '').localeCompare(capturado.get(b) ?? '') || a - b);
}

export interface ResumoCaptura {
  previstos: number;
  lidos: number;
  /** Lotes que o site recusou (ex.: "Nº lote inválido"). */
  recusados: number;
  /** Faltou tempo: ficam para a próxima. */
  pendentes: number;
  /** Falha de sessão/site que interrompeu a captura (o que já foi lido fica gravado). */
  erro: string | null;
}

interface LoteLido {
  lote: number;
  capturadoEm: string;
  requisicoes: { id: number; liquido: number; recebido: number; data: string | null }[];
}

async function gravar(supabase: SupabaseClient, lotes: LoteLido[]): Promise<void> {
  if (lotes.length === 0) return;
  const { error } = await supabase.rpc('fat_gravar_recebidos_aplis_site', { p: lotes });
  if (error) throw new Error(`fat_gravar_recebidos_aplis_site: ${error.message}`);
}

/**
 * Lê no site os lotes com saldo em aberto e grava o retrato. Usa o cliente
 * admin (service_role): a RPC e as tabelas não têm política para usuário.
 */
export async function capturarRecebidosSite(
  supabase: SupabaseClient,
  opcoes: { origem: 'rotina' | 'botao'; usuarioId: string | null; orcamentoMs: number },
): Promise<ResumoCaptura> {
  const inicio = Date.now();
  const lotes = await lotesParaCapturar(supabase);
  const { data: captura, error: erroCaptura } = await supabase
    .from('fat_aplis_site_capturas')
    .insert({ origem: opcoes.origem, usuario_id: opcoes.usuarioId, lotes_previstos: lotes.length })
    .select('id')
    .single();
  if (erroCaptura) throw new Error(`fat_aplis_site_capturas: ${erroCaptura.message}`);

  const resumo: ResumoCaptura = { previstos: lotes.length, lidos: 0, recusados: 0, pendentes: 0, erro: null };
  let buffer: LoteLido[] = [];
  try {
    await SessaoAplisSite.com(async (sessao) => {
      for (const [i, lote] of lotes.entries()) {
        if (Date.now() - inicio > opcoes.orcamentoMs) {
          resumo.pendentes = lotes.length - i;
          break;
        }
        try {
          const requisicoes = await lerLote(sessao, lote);
          buffer.push({
            lote,
            capturadoEm: new Date().toISOString(),
            requisicoes: requisicoes.map((r) => ({ id: r.idRequisicao, liquido: r.liquido, recebido: r.recebido, data: r.data })),
          });
          resumo.lidos += 1;
        } catch (err) {
          if (!(err instanceof LoteRecusado)) throw err;
          resumo.recusados += 1;
          console.warn(`[faturamento/recebidos-aplis-site] lote ${lote} recusado: ${err.message}`);
        }
        if (buffer.length >= BLOCO_GRAVACAO) {
          await gravar(supabase, buffer);
          buffer = [];
        }
      }
    });
  } catch (err) {
    resumo.erro = describeError(err);
  }
  try {
    await gravar(supabase, buffer);
  } catch (err) {
    resumo.erro = resumo.erro ?? describeError(err);
  }

  const { error: erroFim } = await supabase
    .from('fat_aplis_site_capturas')
    .update({ terminada_em: new Date().toISOString(), lotes_lidos: resumo.lidos, erro: resumo.erro })
    .eq('id', (captura as { id: string }).id);
  if (erroFim) console.error('[faturamento/recebidos-aplis-site] fim da captura:', erroFim.message);
  return resumo;
}

/** Retrato dos lotes pedidos; lote nunca capturado fica fora do mapa. */
export async function retratoDosLotes(supabase: SupabaseClient, idsLote: number[]): Promise<Map<number, RetratoLote>> {
  const ids = [...new Set(idsLote)];
  const retratos = new Map<number, RetratoLote>();
  for (let i = 0; i < ids.length; i += BLOCO_LEITURA) {
    const bloco = ids.slice(i, i + BLOCO_LEITURA);
    const { data: lotes, error } = await supabase
      .from('fat_aplis_site_lotes')
      .select('aplis_lote_id, capturado_em')
      .in('aplis_lote_id', bloco);
    if (error) throw new Error(`fat_aplis_site_lotes: ${error.message}`);
    for (const l of (lotes ?? []) as { aplis_lote_id: number; capturado_em: string }[]) {
      retratos.set(Number(l.aplis_lote_id), { capturadoEm: l.capturado_em, requisicoes: [] });
    }
    // Lote tem até ~100 requisições: pagina pelo PostgREST.
    for (let offset = 0; ; offset += PAGINA) {
      const { data, error: erroReq } = await supabase
        .from('fat_aplis_site_recebidos')
        .select('aplis_lote_id, id_requisicao, valor_liquido, valor_recebido, data_recebido')
        .in('aplis_lote_id', bloco)
        .order('aplis_lote_id', { ascending: true })
        .order('id_requisicao', { ascending: true })
        .range(offset, offset + PAGINA - 1);
      if (erroReq) throw new Error(`fat_aplis_site_recebidos: ${erroReq.message}`);
      const linhas = (data ?? []) as {
        aplis_lote_id: number;
        valor_liquido: number | string;
        valor_recebido: number | string;
        data_recebido: string | null;
      }[];
      for (const r of linhas) {
        retratos.get(Number(r.aplis_lote_id))?.requisicoes.push({
          liquido: Number(r.valor_liquido),
          recebido: Number(r.valor_recebido),
          data: r.data_recebido,
        });
      }
      if (linhas.length < PAGINA) break;
    }
  }
  return retratos;
}

/** Fim da última captura que leu algum lote; null se nunca houve. */
export async function ultimaCaptura(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase
    .from('fat_aplis_site_capturas')
    .select('terminada_em')
    .not('terminada_em', 'is', null)
    .gt('lotes_lidos', 0)
    .order('terminada_em', { ascending: false })
    .limit(1);
  if (error) throw new Error(`fat_aplis_site_capturas: ${error.message}`);
  return ((data ?? []) as { terminada_em: string }[])[0]?.terminada_em ?? null;
}
