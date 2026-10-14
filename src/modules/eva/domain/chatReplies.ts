// Helpers de texto e data da interface da EVA (do handoff). As respostas fixas do
// protótipo saíram: quem responde é a ação `agente-perguntar` (issue 16).
import { diaSP, formatarDiaMes } from './datas';

/** Mensagem do handoff quando os dois provedores falham. */
export const FALHA_CHAT = 'Não consegui consultar o board agora. Tente novamente em alguns segundos.';
/** O servidor só olha as últimas 6 (RN17); mandar mais é desperdício. */
export const HISTORICO_ENVIADO = 6;

/** Abertura do drawer, sem IA: saudação + o que a EVA leu (issue 16). */
export function mensagemInicial(nome: string, ultimaReuniaoEm: string | null, date = new Date()): string {
  const lido = ultimaReuniaoEm
    ? `Li o board e a última reunião (${formatarDiaMes(diaSP(new Date(ultimaReuniaoEm)))}).`
    : 'Li o board.';
  return `${greetingFor(date)}${nome ? `, ${nome}` : ''}. ${lido} Pergunte sobre cards, atrasos e projetos, ou peça uma mudança: eu preparo a proposta e nada muda sem aprovação.`;
}

/** As últimas mensagens da conversa, no formato da ação (sem a abertura e sem falhas). */
export function historicoParaEnvio(mensagens: { from: 'eva' | 'me'; text: string; falhou?: boolean }[]) {
  return mensagens
    .filter((m) => !m.falhou)
    .slice(-HISTORICO_ENVIADO)
    .map((m) => ({ de: m.from === 'me' ? ('eu' as const) : ('eva' as const), texto: m.text }));
}

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
