// WhatsApp da EVA (issues 12, 14 e 15; plano §11): números, novas tentativas, confirmações
// de entrega e o "último contato" de cada card. Puro. Usado pela api/, pela VPS e pelo
// Início, então os imports levam ".js".
import { diaDaSemana, diaSP, formatarDiaMes, somarDias, type Dia } from './datas.js';

// ── Números ──────────────────────────────────────────────────────────────────

/**
 * Só os dígitos de um chatId do WhatsApp ("5561…@c.us"). Grupos, listas e LIDs não são telefone.
 * O JID de aparelho ("556199924986:1@s.whatsapp.net", do engine GOWS) perde o ":1".
 */
export function digitosDoChatId(chatId: string | null | undefined): string | null {
  if (!chatId) return null;
  const [usuario, dominio] = chatId.split('@');
  if (dominio && dominio !== 'c.us' && dominio !== 's.whatsapp.net') return null;
  const d = usuario.split(':')[0].replace(/\D/g, '');
  return d.length >= 10 ? d : null;
}

/**
 * Número brasileiro sem o 9º dígito: muitos celulares antigos têm o identificador do
 * WhatsApp sem ele (§3). 5561999924986 e 556199924986 são o mesmo número.
 */
function semNonoDigito(d: string): string {
  return d.length === 13 && d.startsWith('55') && d[4] === '9' ? d.slice(0, 4) + d.slice(5) : d;
}

export function mesmoNumero(a: string | null | undefined, b: string | null | undefined): boolean {
  const da = (a ?? '').replace(/\D/g, '');
  const db = (b ?? '').replace(/\D/g, '');
  if (!da || !db) return false;
  return da === db || semNonoDigito(da) === semNonoDigito(db);
}

export const chatIdDoNumero = (digitos: string) => `${digitos.replace(/\D/g, '')}@c.us`;

/** Id de grupo do WhatsApp ("1203…@g.us"): o único destino fora da lista de membros (D29). */
export const ehChatDeGrupo = (chatId: string | null | undefined): chatId is string => !!chatId && /^[\w.-]+@g\.us$/.test(chatId);

// ── Envio e novas tentativas (§11.2, passo 5) ────────────────────────────────

/** Atraso das novas tentativas, em minutos. Na 4ª falha, a mensagem fica "falhou". */
export const ATRASOS_REENVIO_MIN = [1, 5, 15];

export type DepoisDaFalha =
  | { status: 'pendente'; tentativas: number; proxima_tentativa_em: string }
  | { status: 'falhou'; tentativas: number };

export function depoisDaFalha(tentativasAntes: number, agora: number): DepoisDaFalha {
  const tentativas = tentativasAntes + 1;
  if (tentativas > ATRASOS_REENVIO_MIN.length) return { status: 'falhou', tentativas };
  return { status: 'pendente', tentativas, proxima_tentativa_em: new Date(agora + ATRASOS_REENVIO_MIN[tentativas - 1] * 60_000).toISOString() };
}

/** Uma mensagem parada na fila além disto não sai mais: depois de uma queda longa do WAHA, ela já não faz sentido. */
export const VALIDADE_FILA_MS = 12 * 60 * 60 * 1000;

/**
 * A mensagem venceu na fila? A cobrança da manhã só vale no próprio dia ("pendências de hoje");
 * as demais (cobrança manual, teste, confirmação) valem por 12 h, contadas da criação ou, se
 * ela foi agendada (horário de cobrança), da hora agendada.
 */
export function venceuNaFila(tipo: string, criadaEm: string, agora: number, agendadaPara: string | null = null): boolean {
  if (tipo === 'cobranca') return diaSP(criadaEm) !== diaSP(new Date(agora));
  const desde = Math.max(new Date(criadaEm).getTime(), agendadaPara ? new Date(agendadaPara).getTime() : 0);
  return agora - desde > VALIDADE_FILA_MS;
}

/** 1 a 3 s entre envios, para não parecer disparo em massa (§11.2, passo 4). */
export const intervaloEntreEnvios = (aleatorio = Math.random()) => 1000 + Math.round(aleatorio * 2000);

// ── Confirmações de entrega (RF26, §11.3 passo 5) ────────────────────────────

export type StatusSaida = 'pendente' | 'enviada' | 'entregue' | 'lida' | 'falhou';

/**
 * Novo status de uma mensagem de saída a partir do `ack` do WAHA (2 = entregue no aparelho,
 * 3 = lida, 4 = reproduzida). Nunca volta para trás: "lida" não vira "entregue". null = não muda.
 */
export function statusPeloAck(ack: number, atual: string): StatusSaida | null {
  if (ack >= 3 && (atual === 'enviada' || atual === 'entregue')) return 'lida';
  if (ack === 2 && atual === 'enviada') return 'entregue';
  return null;
}

/** O WAHA serializa ids como "true_5561…@c.us_3EB0…". A última parte identifica a mensagem. */
export function idCurtoWaha(id: string): string {
  return id.split('_').pop() ?? id;
}

// ── O que o Início mostra (D24: só gestores) ─────────────────────────────────

export interface MensagemFila {
  id: string;
  membro_id: string | null;
  /** user_id do membro, para ligar a mensagem aos responsáveis do card. */
  membro_user_id: string | null;
  membro_nome: string | null;
  direcao: 'saida' | 'entrada';
  tipo: 'cobranca' | 'cobranca_manual' | 'teste' | 'confirmacao' | 'recebida' | 'grupo';
  texto: string;
  /** Grupo da equipe (…@g.us): a mensagem não é de um membro (D29). */
  chat_id_destino?: string | null;
  card_ids: string[];
  status: string;
  erro: string | null;
  created_at: string;
  enviada_em: string | null;
  /** Agendada (horário de cobrança) ou próxima tentativa depois de uma falha. */
  proxima_tentativa_em?: string | null;
}

const ehCobranca = (m: MensagemFila) => m.direcao === 'saida' && (m.tipo === 'cobranca' || m.tipo === 'cobranca_manual');
const saiu = (m: MensagemFila) => m.status === 'enviada' || m.status === 'entregue' || m.status === 'lida';
const quando = (m: MensagemFila) => m.enviada_em ?? m.created_at;

const horaSP = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

/** "às 10:12" hoje; "ontem às 10:12"; "em 13/10 às 10:12" antes disso. */
export function quandoFoi(iso: string, hoje: Dia): string {
  const dia = diaSP(iso);
  if (dia === hoje) return `às ${horaSP(iso)}`;
  if (dia === somarDias(hoje, -1)) return `ontem às ${horaSP(iso)}`;
  return `em ${formatarDiaMes(dia)} às ${horaSP(iso)}`;
}

const NOME_DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/** Para o futuro: "hoje às 07:00", "amanhã às 07:00", "segunda (19/10) às 07:00". */
export function quandoSera(iso: string, hoje: Dia): string {
  const dia = diaSP(iso);
  if (dia === hoje) return `hoje às ${horaSP(iso)}`;
  if (dia === somarDias(hoje, 1)) return `amanhã às ${horaSP(iso)}`;
  return `${NOME_DIA[diaDaSemana(dia)]} (${formatarDiaMes(dia)}) às ${horaSP(iso)}`;
}

/** Coluna de horário da fila do Início: "10:12" hoje, "13/10" nos outros dias. */
export const horarioNaFila = (iso: string, hoje: Dia) => (diaSP(iso) === hoje ? horaSP(iso) : formatarDiaMes(diaSP(iso)));

export interface UltimoContato {
  /** "Cobrada às 10:12 · sem resposta", "Ainda não cobrada"… */
  texto: string;
  /** Houve cobrança manual dentro da janela de 4 h: o botão fica "Cobrada". */
  cobradaNaJanela: boolean;
  /** created_at da última cobrança manual, para a regra da janela. */
  ultimaManualEm: string | null;
  /** Última cobrança que saiu e ficou sem resposta (para o comentário da EVA). */
  semResposta: { desde: string; nome: string | null } | null;
}

/** Último contato da EVA sobre um card: a última cobrança que o cita e se o responsável respondeu depois. */
export function ultimoContato(
  cardId: string,
  responsaveis: string[],
  mensagens: MensagemFila[],
  agora: number,
  hoje: Dia,
  janelaMs: number,
): UltimoContato {
  const cobrancas = mensagens.filter((m) => ehCobranca(m) && m.card_ids.includes(cardId)).sort((a, b) => quando(b).localeCompare(quando(a)));
  const manual = cobrancas.find((m) => m.tipo === 'cobranca_manual' && m.status !== 'falhou') ?? null;
  const ultimaManualEm = manual?.created_at ?? null;
  const cobradaNaJanela = !!ultimaManualEm && agora - new Date(ultimaManualEm).getTime() < janelaMs;

  const ultima = cobrancas[0];
  if (!ultima) return { texto: 'Ainda não cobrada', cobradaNaJanela, ultimaManualEm, semResposta: null };
  if (ultima.status === 'pendente') {
    const agendada = ultima.proxima_tentativa_em && new Date(ultima.proxima_tentativa_em).getTime() > agora;
    return { texto: agendada ? `Cobrança agendada para ${quandoSera(ultima.proxima_tentativa_em!, hoje)}` : 'Cobrança na fila', cobradaNaJanela, ultimaManualEm, semResposta: null };
  }
  if (ultima.status === 'falhou') return { texto: `A cobrança ${quandoFoi(ultima.created_at, hoje)} falhou`, cobradaNaJanela, ultimaManualEm, semResposta: null };

  const enviadaEm = quando(ultima);
  const resposta = mensagens
    .filter((m) => m.direcao === 'entrada' && m.membro_user_id && responsaveis.includes(m.membro_user_id) && m.created_at > enviadaEm)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
  const base = `Cobrada ${quandoFoi(enviadaEm, hoje)}`;
  if (resposta) return { texto: `${base} · respondeu ${quandoFoi(resposta.created_at, hoje)}`, cobradaNaJanela, ultimaManualEm, semResposta: null };
  return {
    texto: `${base} · sem resposta`,
    cobradaNaJanela,
    ultimaManualEm,
    semResposta: saiu(ultima) ? { desde: enviadaEm, nome: ultima.membro_nome } : null,
  };
}
