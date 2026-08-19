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
 * Status STLOT cuja data de referência natural não é `DtaCriacao` do lote, então
 * filtrar por período de criação esconde lotes que estão nesse status agora.
 * - Prejuízo (8): baixa frequência, sem prazo natural — pode ficar meses parado.
 * - Recebido - parcial (7): verificado no banco em 2026-08-19 — 0 lotes desse
 *   status nos últimos 30 dias e só 50 de 1072 nos últimos 90; o lote leva
 *   semanas/meses após a criação para a operadora processar o pagamento parcial,
 *   então "criado neste mês" e "já está parcial" quase nunca coincidem — o preset
 *   padrão fica praticamente sempre vazio para este status, o mais comum da lista.
 * Ver STLOT_LABELS em ../types.
 */
const STATUS_SEM_PRAZO = new Set<number>([7, 8]);

/** Statuses cujo preset de período fixo (mês atual/30/90 dias) é ignorado — ver `janelaEfetiva`.
 * Exportado para a UI desabilitar esses botões em vez de deixá-los clicáveis sem efeito. */
export function statusIgnoraPeriodo(statusLote: number): boolean {
  return STATUS_SEM_PRAZO.has(statusLote);
}

export interface JanelaEfetiva extends JanelaPeriodo {
  /** true quando o preset de período foi ignorado por causa do filtro de status. */
  ignorandoPeriodo: boolean;
}

export interface OpcoesJanelaEfetiva {
  /** Filtro "protocolos duplicados" (issue 10) — verificado no banco em 2026-08-19:
   *  42 grupos de duplicidade real (excluindo protocolo em formato de data), 128
   *  lotes, o mais recente criado em 03/07/2026 — 0 nos últimos 30 dias e 0 no mês
   *  atual. Mesmo problema do status 7/8: a data de criação do lote não tem relação
   *  com quando a duplicidade é notada, então o preset padrão fica sempre vazio. */
  somenteProtocoloDuplicado?: boolean;
}

/**
 * Como `janelaDoPreset`, mas ignora o preset padrão quando o status filtrado é um dos
 * `STATUS_SEM_PRAZO` ou quando o filtro "protocolos duplicados" está ativo — a menos
 * que o usuário já tenha escolhido um período personalizado, que continua valendo (é
 * uma escolha explícita dele).
 */
export function janelaEfetiva(
  preset: PeriodoPreset,
  statusLote: number,
  agora: Date,
  custom?: { ini: string; fim: string },
  opcoes?: OpcoesJanelaEfetiva,
): JanelaEfetiva {
  const ignora =
    preset !== 'custom' &&
    (STATUS_SEM_PRAZO.has(statusLote) || Boolean(opcoes?.somenteProtocoloDuplicado));
  if (ignora) {
    // "Ignorar o período" vira "ano atual inteiro", não "desde sempre": cobre a folga
    // de semanas/meses entre a criação do lote e o status/duplicidade aparecer, sem
    // devolver o histórico completo (2021+) numa consulta que devia ser rápida.
    const inicioAno = dayKey(new Date(agora.getFullYear(), 0, 1));
    return { periodoIni: inicioAno, periodoFim: dayKey(agora), ignorandoPeriodo: true };
  }
  return { ...janelaDoPreset(preset, agora, custom), ignorandoPeriodo: false };
}
