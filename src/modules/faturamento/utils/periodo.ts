// Preset de período usado pelas telas de histórico legado (Faturas, Glosas) que
// filtram por intervalo de datas. `janelaDoPreset` traduz o preset num range ISO
// (periodoIni/periodoFim) — a mesma regra estava duplicada em FaturasDashboard.tsx
// e HistoricoGlosasLegado.tsx.

export type PeriodoPreset = 'mes' | 30 | 90 | 'custom';

export interface JanelaPeriodo {
  periodoIni: string;
  periodoFim: string;
}

export const dayKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

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
