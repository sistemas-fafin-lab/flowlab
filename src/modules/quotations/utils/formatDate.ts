const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const formatDate = (date?: string) => {
  if (!date) return '—';

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return '—';

  return parsed.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    // Datas sem horário (ex: "2026-01-10") são interpretadas pelo Date como
    // UTC; sem fixar UTC aqui, fusos negativos (ex: America/Sao_Paulo)
    // exibem o dia anterior.
    ...(DATE_ONLY_PATTERN.test(date) ? { timeZone: 'UTC' } : {}),
  });
};
