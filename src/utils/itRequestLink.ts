/**
 * Navegação para um chamado de TI específico.
 *
 * As notificações e emails do módulo apontavam para `/requests` (o hub de
 * solicitações), obrigando o usuário a caçar o chamado na lista. Há dois
 * caminhos para abrir o modal do chamado direto, porque o clique no sino e o
 * clique no botão do email têm restrições diferentes:
 *
 * - Sino (in-app): navega para `/requests/it` levando o código do chamado no
 *   `state` do react-router — a URL fica limpa. O código sai do próprio texto
 *   da notificação, então isso vale inclusive para as notificações antigas,
 *   gravadas quando o link ainda era '/requests'.
 * - Email: um link externo só carrega URL, então usa `?open=<id>`.
 *
 * Ambos são consumidos por `ITRequestManagement`.
 */
import { APP_BASE_URL } from './appUrl';

export type ITRequestTab = 'details' | 'chat';

/** Rota da lista de chamados de TI. */
export const IT_REQUESTS_PATH = '/requests/it';

/** Título das notificações de nova mensagem — abrem o modal já na aba do chat. */
export const IT_NEW_REPLY_TITLE = 'Nova resposta da TI';

/** Código do chamado (ex.: IT-089) como aparece no texto das notificações. */
const TICKET_CODE_RE = /IT-\d+/;

/** State enviado ao `ITRequestManagement` para abrir um chamado sem sujar a URL. */
export interface ITRequestNavState {
  /** Código do chamado (`it_requests.codigo`). */
  itTicketCode: string;
  itTab?: ITRequestTab;
}

/** Destino de navegação resolvido para uma notificação. */
export interface NotificationTarget {
  path: string;
  state?: ITRequestNavState;
}

interface NotificationLike {
  module: string;
  title: string;
  content: string;
  link: string | null;
}

/**
 * Para onde uma notificação deve navegar ao ser clicada.
 *
 * No módulo IT, o código citado no texto identifica o chamado e manda abrir o
 * modal — ignorando o `link` gravado, que nas linhas antigas é o hub genérico.
 * Nos demais casos, vale o `link` da própria notificação.
 */
export function resolveNotificationTarget(n: NotificationLike): NotificationTarget | null {
  if (n.module === 'IT') {
    const code = TICKET_CODE_RE.exec(n.content ?? '')?.[0];
    if (code) {
      return {
        path: IT_REQUESTS_PATH,
        state: {
          itTicketCode: code,
          itTab: n.title === IT_NEW_REPLY_TITLE ? 'chat' : 'details',
        },
      };
    }
  }
  return n.link ? { path: n.link } : null;
}

/** URL absoluta que abre um chamado de TI, para botões de email (`action_url`). */
export function itRequestUrl(requestId: string, tab: ITRequestTab = 'details'): string {
  const query = tab === 'chat' ? `?open=${requestId}&tab=chat` : `?open=${requestId}`;
  return `${APP_BASE_URL}${IT_REQUESTS_PATH}${query}`;
}
