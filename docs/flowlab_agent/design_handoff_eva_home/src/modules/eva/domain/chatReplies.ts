// Respostas fixas do protótipo. Ao plugar o LLM, evaService.ask() deixa de usar este arquivo.

export function cannedReply(question: string): string {
  const s = question.toLowerCase();
  if (/atras|cobr|venc/.test(s))
    return 'Hoje são 4 tasks atrasadas:\n• Migration de cultura avulsa · Bruno · 2 dias (crítica)\n• Template de recoleta · Diego · 3 dias\n• Regra de 24h do convênio · Ana · 1 dia\n• Seletor de convênios · você · 1 dia\n\nQuer que eu cobre Bruno e Ana agora pelo WhatsApp?';
  if (/reuni|granola|resumo|review/.test(s))
    return 'Sprint review de sexta, 10/10 (Granola):\n• Etapa B da recoleta foi adiada para o próximo sprint.\n• Templates de notificação AC precisam de aprovação até 17/10.\n• Marina vai enviar a lista de itens opcionais da conferência.\n\nCriei 3 cards no Backlog e atribuí os responsáveis.';
  if (/sobrecarreg|capacidade|quem|carga/.test(s))
    return 'Carga atual da equipe:\n• Ana: 9 cards abertos, 4 em Revisão\n• Carla: 6 cards\n• Bruno: 5 cards\n• Diego: 3 cards\n\nSugiro mover 2 revisões da Ana para o Diego.';
  if (/projeto|prazo|sprint/.test(s))
    return 'Notificações WhatsApp é o único projeto em risco: 35% concluído com 60% do sprint decorrido. O prazo foi ajustado para 07/11 depois do adiamento da Etapa B. Os demais estão no ritmo.';
  if (/whats|wa-ha|mensag|fila/.test(s))
    return 'Hoje enviei 6 mensagens pelo Wa-ha e tenho 2 agendadas (14:00 e 17:30). Uma falhou às 08:45 por queda de sessão; reconectei e reenviei às 08:52.';
  return 'Anotei. Vou acompanhar no board e aviso você pelo WhatsApp se algo mudar.';
}

export function formatTodayLabel(date = new Date()): string {
  const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(date).replace('-feira', '');
  const rest = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' }).format(date);
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${rest}`;
}

export function greetingFor(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function nowHHmm(date = new Date()): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export const pluralDias = (n: number) => `${n} ${n > 1 ? 'dias' : 'dia'}`;
