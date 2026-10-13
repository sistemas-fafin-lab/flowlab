// Helpers de texto e data da interface da EVA (do handoff). As respostas fixas do
// protótipo saíram: o chat real entra na issue 16 (ação `agente-perguntar`).

export function formatTodayLabel(date = new Date()): string {
  const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'America/Sao_Paulo' }).format(date).replace('-feira', '');
  const rest = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' }).format(date);
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${rest}`;
}

export function greetingFor(date = new Date()): string {
  const h = Number(new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hour12: false, timeZone: 'America/Sao_Paulo' }).format(date));
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function nowHHmm(date = new Date()): string {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(date);
}
