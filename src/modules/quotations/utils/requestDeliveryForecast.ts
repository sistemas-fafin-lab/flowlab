// Previsão de entrega de uma solicitação, derivada das cotações aprovadas dela:
// data do pedido (conversão em compra, ou a última aprovação) + prazo da
// proposta vencedora. Uma solicitação pode ter várias cotações (uma por
// produto), então vale a entrega mais tardia.

export const DELIVERY_FORECAST_QUOTATION_STATUSES = ['approved', 'converted_to_purchase'] as const;

export interface DeliveryForecastQuotationRow {
  request_id: string | null;
  status: string;
  selected_proposal_id: string | null;
  converted_to_purchase_at: string | null;
  quotation_approvals: { status: string; approved_at: string | null }[] | null;
  quotation_proposals: {
    id: string;
    is_winner: boolean | null;
    average_delivery_days: number | null;
    quotation_proposal_items: { delivery_days: number | null }[] | null;
  }[] | null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const orderDate = (row: DeliveryForecastQuotationRow): string | null => {
  if (row.converted_to_purchase_at) return row.converted_to_purchase_at;
  const approvedAt = (row.quotation_approvals ?? [])
    .filter(a => a.status === 'approved' && a.approved_at)
    .map(a => a.approved_at as string)
    .sort();
  return approvedAt[approvedAt.length - 1] ?? null;
};

const winnerDeliveryDays = (row: DeliveryForecastQuotationRow): number | null => {
  const winner = (row.quotation_proposals ?? []).find(
    p => p.id === row.selected_proposal_id || p.is_winner
  );
  if (!winner) return null;
  if (winner.average_delivery_days != null) return winner.average_delivery_days;
  const itemDays = (winner.quotation_proposal_items ?? [])
    .map(i => i.delivery_days)
    .filter((d): d is number => d != null);
  return itemDays.length > 0 ? Math.max(...itemDays) : null;
};

/** Retorna requestId → data prevista (YYYY-MM-DD). Sem dados suficientes, a solicitação fica de fora. */
export const computeRequestDeliveryForecast = (
  rows: DeliveryForecastQuotationRow[]
): Map<string, string> => {
  const forecast = new Map<string, string>();

  for (const row of rows) {
    if (!row.request_id) continue;
    if (!(DELIVERY_FORECAST_QUOTATION_STATUSES as readonly string[]).includes(row.status)) continue;

    const base = orderDate(row);
    const days = winnerDeliveryDays(row);
    if (!base || days == null) continue;

    const baseTime = new Date(base).getTime();
    if (Number.isNaN(baseTime)) continue;

    const date = new Date(baseTime + days * MS_PER_DAY).toISOString().slice(0, 10);
    const current = forecast.get(row.request_id);
    if (!current || date > current) forecast.set(row.request_id, date);
  }

  return forecast;
};
