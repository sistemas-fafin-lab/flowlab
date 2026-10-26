/**
 * API Route: GET /api/faturamento/titulos-baixas-aplis-previa
 *
 * Prévia das baixas do apLIS (.scratch/faturamento-baixas-automaticas-aplis/spec.md):
 * para cada título que a conferência aponta como `so-no-aplis` ou `aplis-maior`,
 * as baixas a lançar — uma por data de recebimento no apLIS, regra em
 * faturamento/baixasAplis.ts. `sistema-maior` e `lote-ausente` nunca geram baixa.
 * Título sem número da nota entra como qualquer outro (15/10: exceção, mas
 * aceita). Sem escrita: quem lança é o operador, ao confirmar a prévia.
 *
 * Só baixas: a parte de glosas saiu (.scratch/glosas-recursos-dashboard, issue
 * 13). A glosa do título vem da foto de Glosas e Recursos, e o saldo
 * (`notas.valor_saldo`) já desconta a glosa acatada.
 *
 * Fonte do apLIS: MySQL de backup (`recebidosDosLotes` e `recebidosPorDataDosLotes`),
 * ~1 dia de atraso — `meta.dadoAte` diz até quando.
 * Falha na réplica → 502.
 *
 * Autorização: `Authorization: Bearer <access_token>` (canManageBilling). Títulos
 * e baixas são lidos com o cliente do usuário, para respeitar o RLS.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { recebidosDosLotes, recebidosPorDataDosLotes } from '../faturamento/bdLab.js';
import type { RecebidoLoteNaData } from '../faturamento/bdLab.js';
import { baixasSugeridas } from '../faturamento/baixasAplis.js';
import type { BaixaSistema, BaixaSugerida, RecebidoAplisNaData, TipoComBaixa } from '../faturamento/baixasAplis.js';
import { centavos, conferirTitulo, somaCentavos } from '../faturamento/conferenciaAplis.js';
import type { DivergenciaAplis } from '../faturamento/conferenciaAplis.js';
import { ErroSupabase, titulosParaConferir, valorNumerico } from '../faturamento/titulosConferencia.js';
import type { TituloParaConferir } from '../faturamento/titulosConferencia.js';
import { getSupabaseUserClient } from '../supabase.js';

/** Ids por `.in()`: uuid de 36 caracteres → ~4 KB de URL por bloco. */
const BLOCO_IDS_NOTA = 100;

interface TituloPrevia {
  idNota: string;
  numeroNota: string | null;
  operadora: string;
  tipo: TipoComBaixa;
  recebidoSistema: number;
  recebidoAplis: number;
  baixas: BaixaSugerida[];
  /** Saldo do título depois das baixas sugeridas. */
  saldo: number;
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

    const comBaixa = titulos
      .map((titulo) => ({ titulo, divergencia: conferirTitulo(titulo, recebidos.porLote) }))
      .filter((c): c is { titulo: TituloParaConferir; divergencia: DivergenciaComBaixa } => temBaixaSugerida(c.divergencia));

    const porData = await recebidosPorDataDosLotes(comBaixa.flatMap((c) => c.titulo.idsLote));
    if ('erro' in porData) {
      erroReplica(res, porData.erro);
      return;
    }

    let baixasSistema: Record<string, BaixaSistema[]>;
    try {
      baixasSistema = await baixasDoSistema(
        supabase,
        comBaixa.filter((c) => c.divergencia.tipo === 'aplis-maior').map((c) => c.titulo.idNota),
      );
    } catch (err) {
      if (!(err instanceof ErroSupabase)) throw err;
      console.error('[faturamento/titulos-baixas-aplis-previa] Supabase:', err.message);
      res.status(502).json({
        success: false,
        error: 'Não foi possível ler as baixas dos títulos agora — tente novamente em alguns minutos.',
      });
      return;
    }

    const previa: TituloPrevia[] = comBaixa.map(({ titulo, divergencia }) => {
      const baixas = baixasSugeridas({
        tipo: divergencia.tipo,
        recebidoSistema: divergencia.recebidoSistema,
        recebidoAplis: divergencia.recebidoAplis,
        recebidoAplisPorData: recebidoDoTituloPorData(titulo.idsLote, porData.porLote),
        baixasSistema: baixasSistema[titulo.idNota] ?? [],
      });
      return {
        idNota: titulo.idNota,
        numeroNota: titulo.numeroNota,
        operadora: titulo.operadora,
        tipo: divergencia.tipo,
        recebidoSistema: titulo.recebidoSistema,
        recebidoAplis: divergencia.recebidoAplis,
        baixas,
        saldo: (centavos(titulo.saldoSistema) - somaCentavos(baixas)) / 100,
      };
    });
    // Ordem da conferência: o que entrou e não foi lançado nada primeiro, depois a
    // maior diferença.
    previa.sort((a, b) => (a.tipo === b.tipo ? 0 : a.tipo === 'so-no-aplis' ? -1 : 1)
      || (b.recebidoAplis - b.recebidoSistema) - (a.recebidoAplis - a.recebidoSistema));

    // Dado financeiro: não deixa ficar em cache de navegador nem de proxy.
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true, meta: { dadoAte: recebidos.dadoAte }, titulos: previa });
  } catch (err) {
    console.error('[faturamento/titulos-baixas-aplis-previa] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
