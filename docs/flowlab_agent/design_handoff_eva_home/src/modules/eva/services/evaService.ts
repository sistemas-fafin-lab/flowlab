// Ponto único de integração da EVA. Hoje resolve com mocks; cada método indica onde plugar o backend.
import { EVA_MOCK_LATENCY } from '../constants';
import { cannedReply, nowHHmm, pluralDias } from '../domain/chatReplies';
import { SNAPSHOT_ME, SNAPSHOT_TEAM } from '../mocks';
import type { EvaHomeSnapshot, EvaView, OverdueTask, TeamMember, WaMessage } from '../types';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const evaService = {
  /**
   * TODO: montar a partir do Supabase
   *  - colunas: it_requests agrupado por kanban_status (ITKanbanBoard)
   *  - projetos: useITProjectDashboard (sprints/tasks)
   *  - fila: tabela de mensagens do módulo messaging (WAHAProvider)
   *  - insights: tabela eva_insights gerada pelo worker do agente
   */
  async getSnapshot(view: EvaView): Promise<EvaHomeSnapshot> {
    return view === 'me' ? SNAPSHOT_ME : SNAPSHOT_TEAM;
  },

  /** TODO: chamar o endpoint do agente (api/eva/ask) com contexto do board + resumos do Granola. */
  async ask(question: string): Promise<string> {
    await delay(EVA_MOCK_LATENCY);
    return cannedReply(question);
  },

  /** TODO: enviar via src/modules/messaging (MessagingService + WAHAProvider) e registrar na fila. */
  async sendCharge(task: OverdueTask, member: TeamMember): Promise<WaMessage> {
    const first = member.name.split(' ')[0];
    await delay(1500);
    return {
      id: `charge-${task.id}-${Date.now()}`,
      time: nowHHmm(),
      to: member.name,
      text: `${first}, a task “${task.title}” está atrasada há ${pluralDias(task.daysLate)}. Consegue atualizar o status?`,
      status: 'delivered',
    };
  },

  /** TODO: persistir aceite do insight (eva_insights.accepted_at) e disparar a ação no backend. */
  async acceptInsight(_insightId: string): Promise<void> {
    await delay(0);
  },
};
