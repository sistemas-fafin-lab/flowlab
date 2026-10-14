// Ponto único de integração da EVA com o backend (handoff: services/evaService.ts).
// O Início lê direto do Supabase, protegido pela RLS de it_requests, it_projects e
// it_sprints. O chat e a cobrança passam pelas rotas /api/ti/agente-perguntar e
// /api/ti/agente-cobrar; a fila do WhatsApp é lida só por gestores (D24).
import { supabase } from '../../../lib/supabase';
import type { ITRequest } from '../../../components/IT/ITKanbanBoard';
import type { EvaView, PropostaEva } from '../types';
import type { MensagemFila } from '../domain/whatsapp';
import { chamarEva } from './agenteApi';
import { somarDias, type Dia } from '../domain/datas';
import type { CardTI, ColunaKanban, StatusChamado } from '../domain/demandas';
import type { ProjetoTI, SprintTI } from '../domain/projetos';
import type { PessoaTI } from '../domain/inicio';

/** O PostgREST corta cada resposta em 1000 linhas. */
const TAMANHO_PAGINA = 1000;
/** Concluídos dos últimos 14 dias bastam para "Concluídas na semana" e as tasks do dia. */
const DIAS_CONCLUIDOS = 14;

const CAMPOS_CARD =
  'id, codigo, title, priority, status, kanban_status, assigned_to, due_date, kanban_hidden, project_id, sprint_id, updated_at, created_at';

export interface DadosInicio {
  hoje: Dia;
  cards: CardTI[];
  projetos: ProjetoTI[];
  sprints: SprintTI[];
  pessoas: PessoaTI[];
}

type Pagina<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** Linha de it_requests com os joins que o Board usa para montar o ITTaskDrawer. */
type LinhaCardCompleto = ITRequest & {
  requester?: { name: string; email: string } | null;
  project?: { id: string; name: string; color: string } | null;
  sprint?: { id: string; name: string; status: string } | null;
};

async function lerTudo<T>(consulta: (de: number, ate: number) => Pagina<T>): Promise<T[]> {
  const linhas: T[] = [];
  for (let de = 0; ; de += TAMANHO_PAGINA) {
    const { data, error } = await consulta(de, de + TAMANHO_PAGINA - 1);
    if (error) throw new Error(error.message);
    linhas.push(...(data ?? []));
    if (!data || data.length < TAMANHO_PAGINA) return linhas;
  }
}

/**
 * UPDATE em it_requests conferindo se a linha mudou. A RLS de UPDATE só libera admin
 * ou department = 'TI' e, quando nega, o PostgREST devolve 0 linhas sem erro — sem
 * esta conferência a tela mostraria "concluído" sem nada ter mudado.
 */
async function atualizarCard(id: string, mudanca: { kanban_status: ColunaKanban; status: StatusChamado }): Promise<void> {
  const { data, error } = await supabase.from('it_requests').update(mudanca).eq('id', id).select('id');
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error('Sem permissão para alterar este card.');
}

function normalizarCard(r: CardTI): CardTI {
  return { ...r, assigned_to: r.assigned_to ?? [], kanban_hidden: !!r.kanban_hidden };
}

export const evaService = {
  /**
   * Tudo o que o Início precisa: cards abertos + concluídos recentes (paginando),
   * projetos, sprints ativas/planejadas e o nome de quem aparece nos cards.
   */
  async carregarDadosInicio(hoje: Dia, usuarioId: string): Promise<DadosInicio> {
    const desde = somarDias(hoje, -DIAS_CONCLUIDOS);
    const [cards, projetos, sprints] = await Promise.all([
      lerTudo<CardTI>((de, ate) =>
        supabase
          .from('it_requests')
          .select(CAMPOS_CARD)
          .eq('kanban_hidden', false)
          .neq('status', 'cancelled')
          .or(`kanban_status.neq.done,updated_at.gte.${desde}`)
          .order('id')
          .range(de, ate) as unknown as Pagina<CardTI>,
      ),
      lerTudo<ProjetoTI>((de, ate) =>
        supabase.from('it_projects').select('id, name, color').order('name').range(de, ate) as unknown as Pagina<ProjetoTI>,
      ),
      lerTudo<SprintTI>((de, ate) =>
        supabase
          .from('it_sprints')
          .select('id, project_id, name, start_date, end_date, status')
          .in('status', ['active', 'planned'])
          .range(de, ate) as unknown as Pagina<SprintTI>,
      ),
    ]);

    const normalizados = cards.map(normalizarCard);
    const ids = Array.from(new Set([usuarioId, ...normalizados.flatMap((c) => c.assigned_to)].filter(Boolean)));
    const pessoas = ids.length
      ? await lerTudo<PessoaTI>((de, ate) =>
          supabase.from('user_profiles').select('id, name').in('id', ids).range(de, ate) as unknown as Pagina<PessoaTI>,
        )
      : [];

    return { hoje, cards: normalizados, projetos, sprints, pessoas };
  },

  /** O card completo, no mesmo formato que o Board entrega ao ITTaskDrawer. */
  async carregarCardCompleto(id: string, nomes: Record<string, string>): Promise<ITRequest> {
    const { data, error } = await supabase
      .from('it_requests')
      .select('*, requester:user_profiles!requested_by(name, email), project:it_projects!project_id(id,name,color), sprint:it_sprints!sprint_id(id,name,status)')
      .eq('id', id)
      .single();
    if (error) throw new Error(error.message);
    const r = data as unknown as LinhaCardCompleto;
    return {
      ...r,
      assigned_to: r.assigned_to ?? [],
      requester_name: r.requester?.name,
      requester_email: r.requester?.email,
      assignee_names: (r.assigned_to ?? []).map((u: string) => nomes[u]).filter(Boolean),
      project_name: r.project?.name ?? null,
      project_color: r.project?.color ?? null,
      sprint_name: r.sprint?.name ?? null,
    } as ITRequest;
  },

  /** Conclui o card com a mesma regra do Board: coluna "done" + status "resolved". */
  async concluirCard(id: string): Promise<void> {
    await atualizarCard(id, { kanban_status: 'done', status: 'resolved' });
  },

  /** Volta o card para onde estava (desfazer) ou, sem histórico, para "em andamento". */
  async reabrirCard(id: string, anterior?: { kanban_status: ColunaKanban; status: StatusChamado }): Promise<void> {
    await atualizarCard(id, anterior ?? { kanban_status: 'in_progress', status: 'in_progress' });
  },

  /** Marca o envio do e-mail de resolução, para respeitar o intervalo mínimo do Board. */
  async registrarEmailDeStatus(id: string): Promise<void> {
    await supabase.from('it_requests').update({ last_status_email_at: new Date().toISOString() }).eq('id', id);
  },

  /** Chat (issue 16): pergunta à EVA. As propostas voltam sem nada aplicado (D28). */
  ask: (pergunta: string, visao: EvaView, historico: { de: 'eva' | 'eu'; texto: string }[]) =>
    chamarEva<RespostaEva>('agente-perguntar', { pergunta, visao, historico }),

  /**
   * Botão Cobrar/Lembrar (D22): põe a cobrança na fila; o script da VPS envia em até 1 min.
   * Fora do horário de cobrança (dia útil, 7h às 20h), ela vai agendada (`agendadaPara`).
   */
  sendCharge: (cardId: string) =>
    chamarEva<{ modo: 'cobrar' | 'lembrar'; destinatarios: string[]; agendadaPara: string | null }>('agente-cobrar', { card_id: cardId }),

  /** Cobranças enviadas hoje. Só a contagem (D24): qualquer um com canManageIT vê o número. */
  async cobrancasHoje(): Promise<number> {
    const { data, error } = await supabase.rpc('ti_agente_cobrancas_hoje');
    if (error) throw new Error(error.message);
    return (data as number | null) ?? 0;
  },

  /** Fila do WhatsApp dos últimos dias, para gestores (D24, RLS de ti_agente_mensagens). */
  async lerFila(desde: Date): Promise<MensagemFila[]> {
    const { data, error } = await supabase
      .from('ti_agente_mensagens')
      .select('id, membro_id, direcao, tipo, texto, card_ids, status, erro, created_at, enviada_em, proxima_tentativa_em, chat_id_destino, membro:ti_agente_membros(user_id, perfil:user_profiles!ti_agente_membros_user_id_fkey(name))')
      .gte('created_at', desde.toISOString())
      .order('created_at', { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    type Membro = { user_id: string; perfil: { name: string } | null } | null;
    return (data ?? []).map((m) => {
      const { membro, ...resto } = m as unknown as Omit<MensagemFila, 'membro_user_id' | 'membro_nome'> & { membro: Membro };
      return { ...resto, card_ids: resto.card_ids ?? [], membro_user_id: membro?.user_id ?? null, membro_nome: membro?.perfil?.name ?? null };
    });
  },

  /** Quem tem WhatsApp com adesão (só gestores leem ti_agente_membros): habilita o botão Cobrar. */
  async membrosComWhatsapp(): Promise<string[]> {
    const { data, error } = await supabase.from('ti_agente_membros').select('user_id').eq('ativo', true).eq('recebe_cobranca', true).not('whatsapp', 'is', null);
    if (error) throw new Error(error.message);
    return (data ?? []).map((m) => m.user_id as string);
  },
};

/** O que `agente-perguntar` devolve (api/_lib/ti-agente/chat.ts, RespostaChat). */
export interface RespostaEva {
  resposta: string;
  cardsCitados: string[];
  propostas: Omit<PropostaEva, 'id' | 'estado' | 'erro'>[];
  nomes: Record<string, string>;
  provedor: 'claude' | 'gemini';
}
