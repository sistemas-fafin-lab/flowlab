// Seção "Biologia Molecular" da aba Indicadores — requisições com
// `secao_lis = 'biologia_molecular'` (PCR/Captura Híbrida/Painel de
// Hibridização, ver bdLabQualidade.ts). As 4 métricas gerais reaproveitam o
// cálculo compartilhado de requisicoesIndicadores.ts — ver o cabeçalho de lá
// para o racional. `calcularTatPorTipoExame` é próprio desta seção (issue 07
// — .scratch/qualidade-riscos-indicadores/issues/07-indicadores-biologia-
// molecular-tat-por-exame.md): quebra o TAT médio por `exameTipoNomeLis`
// (PCR vs. Captura Híbrida), por isso a resposta desta seção não reaproveita
// mais o tipo genérico `IndicadorSecaoRequisicaoResposta`.

import type { IndicadorBiologiaMolecularResposta, IndicadorTatPorTipoExame } from '../types';
import { agregarIndicadorSecao, diasEntre, mediaTatDias, type LinhaIndicadorSecaoRequisicao } from './requisicoesIndicadores.js';

export type { LinhaIndicadorSecaoRequisicao };

export interface LinhaIndicadorBiologiaMolecular extends LinhaIndicadorSecaoRequisicao {
  exameTipoNomeLis: string | null;
}

/**
 * Agrupa por `exameTipoNomeLis`, reaproveitando o cálculo de TAT por linha
 * (`diasEntre`, coleta → liberação). Um tipo de exame sem nenhum laudo
 * liberado no período não entra no resultado (R4 — nunca vira barra
 * zerada). Ordenado por volume de laudos liberados, maior primeiro.
 */
export function calcularTatPorTipoExame(
  linhas: readonly LinhaIndicadorBiologiaMolecular[],
): IndicadorTatPorTipoExame[] {
  const porTipo = new Map<string, { somaTat: number; contagemTat: number; laudosLiberados: number }>();

  for (const linha of linhas) {
    if (!linha.exameTipoNomeLis || linha.dtaLiberacao === null) continue;

    const grupo = porTipo.get(linha.exameTipoNomeLis) ?? { somaTat: 0, contagemTat: 0, laudosLiberados: 0 };
    grupo.laudosLiberados++;
    if (linha.dtaColeta) {
      grupo.somaTat += diasEntre(linha.dtaColeta, linha.dtaLiberacao);
      grupo.contagemTat++;
    }
    porTipo.set(linha.exameTipoNomeLis, grupo);
  }

  return [...porTipo.entries()]
    .map(([exameTipoNomeLis, grupo]) => ({
      exameTipoNomeLis,
      tatMedioDias: mediaTatDias(grupo.somaTat, grupo.contagemTat),
      laudosLiberados: grupo.laudosLiberados,
    }))
    .filter((item): item is IndicadorTatPorTipoExame => item.tatMedioDias !== null)
    .sort((a, b) => b.laudosLiberados - a.laudosLiberados);
}

export function agregarBiologiaMolecular(
  periodo: { inicio: string; fim: string },
  linhas: readonly LinhaIndicadorBiologiaMolecular[],
): IndicadorBiologiaMolecularResposta {
  return {
    ...agregarIndicadorSecao(periodo, 'biologia_molecular', linhas),
    secao: 'biologia_molecular',
    tatPorTipoExame: calcularTatPorTipoExame(linhas),
  };
}
