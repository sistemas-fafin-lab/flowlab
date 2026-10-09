// Alertas FinOps e renovações (RF20, RF21, RN11, RN12, RN17). Calculados na
// leitura, sem notificação; `hoje` sempre como argumento (RN14).

import { formatCurrency } from '../../../utils/paymentUtils';
import { formatarCompetencia, partesCompetencia, ultimoDiaDoMes } from './competencia';
import { equivalenteMensal, situacaoDespesa } from './recorrencia';
import type { OcorrenciaDoMes } from './situacao';
import type { Despesa } from '../types';

/** RN11: pago acima do previsto original em mais de 10% gera alerta. */
export const TOLERANCIA_DESVIO = 0.1;
/** Janela do card de renovações. */
export const JANELA_RENOVACOES_DIAS = 90;

export type SeveridadeAlerta = 'alta' | 'media' | 'baixa';
export type TipoAlerta =
  | 'vencida'
  | 'acima_do_previsto'
  | 'renovacao_manual'
  | 'renovacao_automatica'
  | 'fora_da_recorrencia'
  | 'orcamento';

export interface Alerta {
  chave: string;
  tipo: TipoAlerta;
  severidade: SeveridadeAlerta;
  despesaId: string;
  titulo: string;
  detalhe: string;
  /** Para ordenar dentro da mesma severidade: o mais urgente primeiro. */
  data: string;
}

export interface Renovacao {
  despesa: Despesa;
  /** Último dia da última competência ('YYYY-MM-DD'). */
  termino: string;
  dias: number;
  /** Equivalente mensal × 12 na última competência. */
  anualizado: number;
  automatica: boolean;
}

export const ORDEM_SEVERIDADE: SeveridadeAlerta[] = ['alta', 'media', 'baixa'];

/** Junta listas de alertas mantendo a ordem por severidade e data. */
export function ordenarAlertas(alertas: readonly Alerta[]): Alerta[] {
  return [...alertas].sort(
    (a, b) => ORDEM_SEVERIDADE.indexOf(a.severidade) - ORDEM_SEVERIDADE.indexOf(b.severidade) || a.data.localeCompare(b.data),
  );
}

const formatarData = (iso: string): string => {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
};

/** Dias corridos de `hoje` até `data` (negativo se já passou). Em UTC, sem horário de verão. */
export function diasAte(hoje: string, data: string): number {
  return Math.round((Date.parse(`${data}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)) / 86_400_000);
}

/** Fim do contrato: último dia da competência final. Sem fim (ou cobrança única), não há renovação. */
export function terminoDaDespesa(d: Despesa): string | null {
  if (!d.competenciaFim || d.recorrencia === 'unica') return null;
  const { ano, mes } = partesCompetencia(d.competenciaFim);
  return `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDiaDoMes(ano, mes)).padStart(2, '0')}`;
}

/** Despesas que terminam ou renovam nos próximos `janelaDias`, do mais próximo para o mais distante. */
export function renovacoesProximas(despesas: readonly Despesa[], hoje: string, janelaDias = JANELA_RENOVACOES_DIAS): Renovacao[] {
  return despesas
    .flatMap((d) => {
      const termino = terminoDaDespesa(d);
      if (!termino) return [];
      const dias = diasAte(hoje, termino);
      if (dias < 0 || dias > janelaDias) return [];
      const fim = d.competenciaFim as string;
      return [{ despesa: d, termino, dias, anualizado: (equivalenteMensal(d, fim) ?? 0) * 12, automatica: d.renovacaoAutomatica }];
    })
    .sort((a, b) => a.dias - b.dias || a.despesa.descricao.localeCompare(b.despesa.descricao, 'pt-BR'));
}

/**
 * Os alertas da §8.4. `ocorrencias` deve ser a janela dos últimos meses até o
 * mês atual (com os filtros já aplicados): é dela que saem vencidas, desvios
 * e lançamentos fora da recorrência.
 */
export function calcularAlertas(
  ocorrencias: readonly OcorrenciaDoMes[],
  despesas: readonly Despesa[],
  hoje: string,
  tolerancia = TOLERANCIA_DESVIO,
): Alerta[] {
  const alertas: Alerta[] = [];

  for (const o of ocorrencias) {
    const mes = formatarCompetencia(o.competencia);
    if (o.situacao === 'vencida') {
      alertas.push({
        chave: `vencida:${o.chave}`,
        tipo: 'vencida',
        severidade: 'alta',
        despesaId: o.despesa.id,
        titulo: `${o.despesa.descricao} (${mes}) vencida sem baixa`,
        detalhe: `Venceu em ${formatarData(o.vencimento)} · ${formatCurrency(o.valorPrevisto)}`,
        data: o.vencimento,
      });
    }
    const pago = o.lancamento?.valorPago;
    // RN11: contra o previsto ORIGINAL — ajustar a previsão no mês não esconde o desvio.
    if (o.situacao === 'paga' && pago !== null && pago !== undefined && o.previstoOriginal > 0 && pago > o.previstoOriginal * (1 + tolerancia)) {
      const percentual = ((pago - o.previstoOriginal) / o.previstoOriginal) * 100;
      alertas.push({
        chave: `acima:${o.chave}`,
        tipo: 'acima_do_previsto',
        severidade: 'media',
        despesaId: o.despesa.id,
        titulo: `${o.despesa.descricao} (${mes}) pago acima do previsto`,
        detalhe: `Pago ${formatCurrency(pago)}, previsto ${formatCurrency(o.previstoOriginal)} (+${percentual.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%)`,
        data: o.lancamento?.pagoEm ?? o.vencimento,
      });
    }
    if (o.foraDaRecorrencia) {
      alertas.push({
        chave: `fora:${o.chave}`,
        tipo: 'fora_da_recorrencia',
        severidade: 'baixa',
        despesaId: o.despesa.id,
        titulo: `${o.despesa.descricao} (${mes}) fora da recorrência`,
        detalhe: 'A despesa mudou e não tem mais cobrança neste mês. Mantenha ou exclua o lançamento no Mês a mês.',
        data: o.vencimento,
      });
    }
  }

  // RN12: dentro da antecedência configurada em cada despesa.
  const atual = hoje.slice(0, 7) + '-01';
  for (const r of renovacoesProximas(despesas, hoje)) {
    if (r.dias > r.despesa.avisoRenovacaoDias || situacaoDespesa(r.despesa, atual) === 'encerrada') continue;
    const quando = r.dias === 0 ? 'hoje' : `em ${r.dias} ${r.dias === 1 ? 'dia' : 'dias'}`;
    alertas.push(
      r.automatica
        ? {
            chave: `renova:${r.despesa.id}`,
            tipo: 'renovacao_automatica',
            severidade: 'media',
            despesaId: r.despesa.id,
            titulo: `${r.despesa.descricao} renova sozinha ${quando}`,
            detalhe: `Hora de renegociar ou cancelar · ${formatCurrency(r.anualizado)}/ano`,
            data: r.termino,
          }
        : {
            chave: `termina:${r.despesa.id}`,
            tipo: 'renovacao_manual',
            severidade: 'alta',
            despesaId: r.despesa.id,
            titulo: `${r.despesa.descricao} termina ${quando}`,
            detalhe: `Não renova sozinha: decida renovar ou encerrar · ${formatCurrency(r.anualizado)}/ano`,
            data: r.termino,
          },
    );
  }

  return ordenarAlertas(alertas);
}
