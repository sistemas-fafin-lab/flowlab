// Preset de período usado pelas telas de histórico legado (Faturas, Glosas) que
// filtram por intervalo de datas. `janelaDoPreset` traduz o preset num range ISO
// (periodoIni/periodoFim) — a mesma regra estava duplicada em FaturasDashboard.tsx
// e HistoricoGlosasLegado.tsx.

import { dayKey } from '../../../utils/datas';

export { dayKey };

export type PeriodoPreset = 'mes' | 30 | 90 | 'custom';

export interface JanelaPeriodo {
  periodoIni: string;
  periodoFim: string;
}

export function janelaDoPreset(
  preset: PeriodoPreset,
  agora: Date,
  custom?: { ini: string; fim: string },
): JanelaPeriodo {
  const hoje = new Date(agora);
  hoje.setHours(0, 0, 0, 0);

  if (preset === 'custom' && custom?.ini && custom?.fim) {
    let ini = custom.ini;
    let fim = custom.fim;
    if (ini > fim) [ini, fim] = [fim, ini];
    return { periodoIni: ini, periodoFim: fim };
  }

  if (preset === 'mes') {
    const primeiro = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    return { periodoIni: dayKey(primeiro), periodoFim: dayKey(hoje) };
  }

  const n = typeof preset === 'number' ? preset : 30;
  const inicio = new Date(hoje);
  inicio.setDate(hoje.getDate() - (n - 1));
  return { periodoIni: dayKey(inicio), periodoFim: dayKey(hoje) };
}

/**
 * Status STLOT de baixa frequência e sem prazo natural: um lote pode ficar meses
 * "parado" nesse status, então escondê-lo atrás do preset de período padrão (mês
 * atual/30/90 dias) engana o operador — ele lê "não tem" quando na verdade é "está
 * fora da janela". Hoje só Prejuízo (8); ver STLOT_LABELS em ../types.
 */
const STATUS_SEM_PRAZO = new Set<number>([8]);

/** Limite inferior artificial ao ignorar o período: nenhum lote real é anterior a isto. */
const DATA_MINIMA = '2000-01-01';

export interface JanelaEfetiva extends JanelaPeriodo {
  /** true quando o preset de período foi ignorado por causa do filtro de status. */
  ignorandoPeriodo: boolean;
}

/**
 * Como `janelaDoPreset`, mas ignora o preset padrão quando o status filtrado é um dos
 * `STATUS_SEM_PRAZO` — a menos que o usuário já tenha escolhido um período
 * personalizado, que continua valendo (é uma escolha explícita dele).
 */
export function janelaEfetiva(
  preset: PeriodoPreset,
  statusLote: number,
  agora: Date,
  custom?: { ini: string; fim: string },
): JanelaEfetiva {
  if (preset !== 'custom' && STATUS_SEM_PRAZO.has(statusLote)) {
    return { periodoIni: DATA_MINIMA, periodoFim: dayKey(agora), ignorandoPeriodo: true };
  }
  return { ...janelaDoPreset(preset, agora, custom), ignorandoPeriodo: false };
}
