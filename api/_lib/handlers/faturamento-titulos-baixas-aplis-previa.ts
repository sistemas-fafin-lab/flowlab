/**
 * API Route: GET /api/faturamento/titulos-baixas-aplis-previa
 *
 * Prévia das baixas do apLIS (.scratch/faturamento-baixas-automaticas-aplis/spec.md):
 * para cada título que a conferência aponta como `so-no-aplis` ou `aplis-maior`,
 * as baixas a lançar — uma por data de recebimento no apLIS, regra em
 * faturamento/baixasAplis.ts. `sistema-maior` e `lote-ausente` nunca geram baixa.
 * Título sem número da nota vai junto como `pulado: 'sem-nota'` (o
 * `fat_registrar_baixa` recusaria). Sem escrita: quem lança é o operador, ao
 * confirmar a prévia.
 *
 * Glosas (.scratch/faturamento-glosas-automaticas-aplis/spec.md): cada título
 * leva as glosas a lançar a partir do apLIS (`glosas`) ou o motivo de não haver
 * (`puladoGlosa`), regra em faturamento/glosasAplis.ts. Entra também o título sem
 * baixa a lançar — recebido batendo, `sistema-maior` ou `lote-ausente` — quando
 * tem saldo aberto (≥ R$ 1,00) e diferença no apLIS; fechado, ficaria na prévia
 * para sempre como pulado. As glosas já lançadas do apLIS (`glosas.origem`)
 * descontam da sugestão; cada glosa leva o `loteId` (uuid do lote no sistema)
 * que `fat_lancar_glosas_aplis` grava.
 *
 * Fonte do apLIS: MySQL de backup (`recebidosDosLotes`, `recebidosPorDataDosLotes`
 * e `diferencasDosLotes`), ~1 dia de atraso — `meta.dadoAte` diz até quando.
 * Falha na réplica → 502.
 *
 * Autorização: `Authorization: Bearer <access_token>` (canManageBilling). Títulos
 * e baixas são lidos com o cliente do usuário, para respeitar o RLS.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { diferencasDosLotes, recebidosDosLotes, recebidosPorDataDosLotes } from '../faturamento/bdLab.js';
import type { RecebidoLoteAplis, RecebidoLoteNaData } from '../faturamento/bdLab.js';
import { baixasSugeridas } from '../faturamento/baixasAplis.js';
import type { BaixaSistema, BaixaSugerida, RecebidoAplisNaData, TipoComBaixa } from '../faturamento/baixasAplis.js';
import { centavos, conferirTitulo, somaCentavos } from '../faturamento/conferenciaAplis.js';
import type { DivergenciaAplis, TipoDivergenciaAplis, TituloConferencia } from '../faturamento/conferenciaAplis.js';
import { glosasSugeridas } from '../faturamento/glosasAplis.js';
import type { GlosaSistema, GlosaSugerida, PuladoGlosa } from '../faturamento/glosasAplis.js';
import { ErroSupabase, titulosParaConferir, valorNumerico } from '../faturamento/titulosConferencia.js';
import type { TituloParaConferir } from '../faturamento/titulosConferencia.js';
import { getSupabaseUserClient } from '../supabase.js';

/** Ids por `.in()`: uuid de 36 caracteres → ~4 KB de URL por bloco. */
const BLOCO_IDS_NOTA = 100;

/** Saldo mínimo para um título sem baixa a lançar entrar na prévia pelas glosas. */
const SALDO_MINIMO_CENTAVOS = 100;

interface TituloPrevia {
  idNota: string;
  numeroNota: string | null;
  operadora: string;
  /** null: o recebido bate com o apLIS (o título está na prévia pela glosa). */
  tipo: TipoDivergenciaAplis | null;
  recebidoSistema: number;
  /** null quando algum lote não existe no apLIS (`lote-ausente`). */
  recebidoAplis: number | null;
  baixas: BaixaSugerida[];
  pulado: 'sem-nota' | null;
  /** Saldo do título depois das baixas sugeridas. */
  saldo: number;
  glosas: (GlosaSugerida & { loteId: string })[];
  puladoGlosa: PuladoGlosa | null;
}

type DivergenciaComBaixa = DivergenciaAplis & { tipo: TipoComBaixa; recebidoAplis: number };

function temBaixaSugerida(d: DivergenciaAplis | null): d is DivergenciaComBaixa {
  return d !== null && (d.tipo === 'so-no-aplis' || d.tipo === 'aplis-maior');
}

/** Baixas que contam no recebido do título (mesmo filtro de `fat_recalcular_nota`). */
async function baixasDoSistema(
  supabase: SupabaseClient,
  idsNota: string[],
): Promise<Record<string, BaixaSistema[]>> {
  const porNota: Record<string, BaixaSistema[]> = {};
  for (let i = 0; i < idsNota.length; i += BLOCO_IDS_NOTA) {
    const { data, error } = await supabase
      .from('recebimentos')
      .select('nota_id, valor_recebido, data_receb')
      .in('nota_id', idsNota.slice(i, i + BLOCO_IDS_NOTA))
      .in('status', ['recebido', 'parcial']);
    if (error) throw new ErroSupabase(`recebimentos: ${error.message}`);
    for (const linha of (data ?? []) as { nota_id: string; valor_recebido: unknown; data_receb: string | null }[]) {
      if (!linha.data_receb) continue;
      (porNota[linha.nota_id] ??= []).push({ data: linha.data_receb, valor: valorNumerico(linha.valor_recebido) });
    }
  }
  return porNota;
}

/** Glosas que cada título já tem no sistema (qualquer status), com a origem e o lote. */
async function glosasDoSistema(
  supabase: SupabaseClient,
  idsNota: string[],
): Promise<Map<string, GlosaSistema[]>> {
  const porNota = new Map<string, GlosaSistema[]>();
  for (let i = 0; i < idsNota.length; i += BLOCO_IDS_NOTA) {
    const { data, error } = await supabase
      .from('glosas')
      .select('nota_id, origem, codigo_glosa, motivo, status, valor, lotes(aplis_id)')
      .in('nota_id', idsNota.slice(i, i + BLOCO_IDS_NOTA));
    if (error) throw new ErroSupabase(`glosas: ${error.message}`);
    for (const linha of (data ?? []) as unknown as {
      nota_id: string;
      origem: string | null;
      codigo_glosa: string | null;
      motivo: string | null;
      status: GlosaSistema['status'];
      valor: unknown;
      lotes: { aplis_id: string | null } | null;
    }[]) {
      const idLote = Number(linha.lotes?.aplis_id ?? NaN);
      const glosas = porNota.get(linha.nota_id) ?? [];
      glosas.push({
        origem: linha.origem === 'aplis' ? 'aplis' : null,
        idLote: Number.isInteger(idLote) ? idLote : null,
        codigo: linha.codigo_glosa,
        motivo: linha.motivo ?? '',
        status: linha.status,
        valor: valorNumerico(linha.valor),
      });
      porNota.set(linha.nota_id, glosas);
    }
  }
  return porNota;
}

/** Recebido no apLIS dos lotes do título; null se algum lote não existe lá. */
function recebidoAplisDoTitulo(idsLote: number[], porLote: Record<number, RecebidoLoteAplis>): number | null {
  if (idsLote.some((id) => !porLote[id])) return null;
  return idsLote.reduce((soma, id) => soma + centavos(porLote[id].recebido), 0) / 100;
}

/** Junta as datas dos lotes do título: dois lotes recebidos no mesmo dia = um depósito. */
function recebidoDoTituloPorData(
  idsLote: number[],
  porLote: Record<number, RecebidoLoteNaData[]>,
): RecebidoAplisNaData[] {
  const porData = new Map<string, { centavos: number; lotes: number[] }>();
  for (const idLote of idsLote) {
    for (const { data, valor } of porLote[idLote] ?? []) {
      const atual = porData.get(data) ?? { centavos: 0, lotes: [] };
      atual.centavos += centavos(valor);
      atual.lotes.push(idLote);
      porData.set(data, atual);
    }
  }
  return [...porData].map(([data, { centavos, lotes }]) => ({ data, valor: centavos / 100, lotes }));
}

function erroReplica(res: VercelResponse, erro: { status: number; mensagem: string }): void {
  res.status(erro.status).json({
    success: false,
    error: 'Não foi possível consultar os recebimentos no apLIS agora — tente novamente em alguns minutos. '
      + `(${erro.mensagem})`,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ success: false, error: 'Método não permitido' });
    return;
  }

  try {
    const token = tokenDoHeader(req.headers.authorization);
    const erroAuth = await autorizarFaturamento(token, 'canManageBilling');
    if (erroAuth) {
      res.status(erroAuth.status).json(erroAuth.payload);
      return;
    }
    const supabase = getSupabaseUserClient(token as string);

    let titulos: TituloParaConferir[];
    try {
      titulos = await titulosParaConferir(supabase);
    } catch (err) {
      if (!(err instanceof ErroSupabase)) throw err;
      console.error('[faturamento/titulos-baixas-aplis-previa] Supabase:', err.message);
      res.status(502).json({
        success: false,
        error: 'Não foi possível ler os títulos agora — tente novamente em alguns minutos.',
      });
      return;
    }

    const recebidos = await recebidosDosLotes(titulos.flatMap((t) => t.idsLote));
    if ('erro' in recebidos) {
      erroReplica(res, recebidos.erro);
      return;
    }

    const conferidos = titulos.map((titulo) => ({ titulo, divergencia: conferirTitulo(titulo, recebidos.porLote) }));
    const comBaixa = conferidos
      .map((c) => c.divergencia)
      .filter(temBaixaSugerida)
      .filter((d) => d.numeroNota);
    const idsLotePorNota = new Map(titulos.map((t) => [t.idNota, t.idsLote]));

    const porData = await recebidosPorDataDosLotes(comBaixa.flatMap((d) => idsLotePorNota.get(d.idNota) ?? []));
    if ('erro' in porData) {
      erroReplica(res, porData.erro);
      return;
    }

    const diferencas = await diferencasDosLotes(titulos.flatMap((t) => t.idsLote));
    if ('erro' in diferencas) {
      erroReplica(res, diferencas.erro);
      return;
    }
    const diferencasDoTitulo = (t: TituloConferencia) => t.idsLote.flatMap((id) => diferencas.porLote[id] ?? []);

    let baixasSistema: Record<string, BaixaSistema[]>;
    let glosasSistema: Map<string, GlosaSistema[]>;
    try {
      baixasSistema = await baixasDoSistema(
        supabase,
        comBaixa.filter((d) => d.tipo === 'aplis-maior').map((d) => d.idNota),
      );
      glosasSistema = await glosasDoSistema(
        supabase,
        titulos.filter((t) => diferencasDoTitulo(t).length > 0).map((t) => t.idNota),
      );
    } catch (err) {
      if (!(err instanceof ErroSupabase)) throw err;
      console.error('[faturamento/titulos-baixas-aplis-previa] Supabase:', err.message);
      res.status(502).json({
        success: false,
        error: 'Não foi possível ler as baixas e glosas dos títulos agora — tente novamente em alguns minutos.',
      });
      return;
    }

    const previa: TituloPrevia[] = [];
    for (const { titulo, divergencia } of conferidos) {
      const geraBaixa = temBaixaSugerida(divergencia);
      const baixas = geraBaixa && titulo.numeroNota
        ? baixasSugeridas({
          tipo: divergencia.tipo,
          recebidoSistema: divergencia.recebidoSistema,
          recebidoAplis: divergencia.recebidoAplis,
          recebidoAplisPorData: recebidoDoTituloPorData(titulo.idsLote, porData.porLote),
          baixasSistema: baixasSistema[titulo.idNota] ?? [],
        })
        : [];
      const saldoCentavos = centavos(titulo.valorTotal) - centavos(titulo.recebidoSistema)
        - centavos(titulo.glosadoSistema) - somaCentavos(baixas);
      const { glosas, puladoGlosa } = glosasSugeridas({
        tipo: divergencia?.tipo ?? null,
        temNota: titulo.numeroNota !== null,
        saldo: saldoCentavos / 100,
        glosasSistema: glosasSistema.get(titulo.idNota) ?? [],
        diferencas: diferencasDoTitulo(titulo),
      });
      const entraPelaGlosa = saldoCentavos >= SALDO_MINIMO_CENTAVOS && (glosas.length > 0 || puladoGlosa !== null);
      if (!geraBaixa && !entraPelaGlosa) continue;
      previa.push({
        idNota: titulo.idNota,
        numeroNota: titulo.numeroNota,
        operadora: titulo.operadora,
        tipo: divergencia?.tipo ?? null,
        recebidoSistema: titulo.recebidoSistema,
        recebidoAplis: divergencia ? divergencia.recebidoAplis : recebidoAplisDoTitulo(titulo.idsLote, recebidos.porLote),
        baixas,
        pulado: geraBaixa && !titulo.numeroNota ? 'sem-nota' : null,
        saldo: saldoCentavos / 100,
        glosas: glosas.map((glosa) => ({ ...glosa, loteId: titulo.idLoteSistema[glosa.idLote] })),
        puladoGlosa,
      });
    }
    // Ordem da conferência: o que entrou e não foi lançado nada primeiro, depois a
    // maior diferença; os títulos sem baixa a lançar no fim, pela maior glosa.
    const ordemTipo = (t: TituloPrevia) => (t.tipo === 'so-no-aplis' ? 0 : t.tipo === 'aplis-maior' ? 1 : 2);
    const diferencaRecebido = (t: TituloPrevia) => (ordemTipo(t) < 2 ? (t.recebidoAplis ?? 0) - t.recebidoSistema : 0);
    previa.sort((a, b) => ordemTipo(a) - ordemTipo(b)
      || diferencaRecebido(b) - diferencaRecebido(a)
      || somaCentavos(b.glosas) - somaCentavos(a.glosas));

    // Dado financeiro: não deixa ficar em cache de navegador nem de proxy.
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true, meta: { dadoAte: recebidos.dadoAte }, titulos: previa });
  } catch (err) {
    console.error('[faturamento/titulos-baixas-aplis-previa] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
