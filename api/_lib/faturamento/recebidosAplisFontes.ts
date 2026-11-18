// api/_lib/faturamento/recebidosAplisFontes.ts
// Busca as duas fontes do recebido do apLIS — retrato do site (Supabase) e
// MySQL de backup — e aplica a regra de recebidosAplis.ts. Usado pela
// conferência (titulos-conferencia-aplis) e pela prévia das baixas
// (titulos-baixas-aplis-previa). .scratch/faturamento-recebidos-aplis-site/spec.md

import type { SupabaseClient } from '@supabase/supabase-js';
import { describeError } from '../errors.js';
import { recebidosDosLotes, recebidosPorDataDosLotes } from './bdLab.js';
import type { RecebidoLoteAplis, RecebidoLoteNaData } from './bdLab.js';
import { combinarRecebidos, porDataDoRetrato } from './recebidosAplis.js';
import type { RetratoLote } from './recebidosAplis.js';
import { retratoDosLotes, ultimaCaptura } from './recebidosAplisSite.js';

/** O que a tela mostra sobre de onde veio o dado. */
export interface MetaFontes {
  /** Dado mais recente do banco de backup; null com o banco fora do ar. */
  dadoAte: string | null;
  /** Fim da última captura do site; null se nunca houve. */
  retratoSiteEm: string | null;
  bancoIndisponivel: boolean;
  /** Lotes cujo recebido veio do site. */
  lotesDoSite: number;
}

export interface RecebidosComFontes {
  porLote: Record<number, RecebidoLoteAplis>;
  doSite: Set<number>;
  semFonte: Set<number>;
  retratos: Map<number, RetratoLote>;
  meta: MetaFontes;
}

export type ErroFontes = { erro: { status: number; mensagem: string } };

/**
 * Recebido por lote pela fonte que vale. Erro só quando nenhuma das duas
 * responde: com o banco no ar e o retrato fora, segue só com o banco (como
 * antes); com o banco fora, só com o retrato.
 */
export async function recebidosComFontes(
  admin: SupabaseClient,
  idsLote: number[],
): Promise<RecebidosComFontes | ErroFontes> {
  const [banco, site] = await Promise.all([
    recebidosDosLotes(idsLote),
    Promise.all([retratoDosLotes(admin, idsLote), ultimaCaptura(admin)]).catch((err: unknown) => {
      console.error('[faturamento/recebidos-aplis] retrato do site:', describeError(err));
      return null;
    }),
  ]);
  const bancoOk = 'erro' in banco ? null : banco;
  if (!bancoOk && (!site || site[0].size === 0)) {
    return { erro: 'erro' in banco ? banco.erro : { status: 502, mensagem: 'sem fonte do apLIS' } };
  }

  const retratos = site?.[0] ?? new Map<number, RetratoLote>();
  const { porLote, doSite, semFonte } = combinarRecebidos({ idsLote, banco: bancoOk, retratos });
  return {
    porLote,
    doSite,
    semFonte,
    retratos,
    meta: {
      dadoAte: bancoOk?.dadoAte ?? null,
      retratoSiteEm: site?.[1] ?? null,
      bancoIndisponivel: !bancoOk,
      lotesDoSite: doSite.size,
    },
  };
}

/**
 * Recebido por data dos lotes: do retrato para os lotes que vieram do site, do
 * banco para os outros. Só consulta o banco se sobrar lote fora do retrato.
 */
export async function recebidosPorDataComFontes(
  idsLote: number[],
  fontes: Pick<RecebidosComFontes, 'doSite' | 'retratos'>,
): Promise<{ porLote: Record<number, RecebidoLoteNaData[]> } | ErroFontes> {
  const ids = [...new Set(idsLote)];
  const porLote: Record<number, RecebidoLoteNaData[]> = {};
  const doBanco: number[] = [];
  for (const id of ids) {
    const retrato = fontes.doSite.has(id) ? fontes.retratos.get(id) : undefined;
    if (retrato) {
      const datas = porDataDoRetrato(retrato);
      if (datas.length > 0) porLote[id] = datas;
    } else {
      doBanco.push(id);
    }
  }
  if (doBanco.length === 0) return { porLote };
  const banco = await recebidosPorDataDosLotes(doBanco);
  if ('erro' in banco) return banco;
  return { porLote: { ...porLote, ...banco.porLote } };
}
