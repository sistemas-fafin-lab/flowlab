// Ponto único de integração da EVA com o backend (handoff: services/evaService.ts).
// Fase 1: o Início lê direto do Supabase, protegido pela RLS de it_requests,
// it_projects e it_sprints. Chat, cobrança e comentários entram nas próximas fases
// (issues 14, 16 e 17) — até lá os métodos dizem isso em vez de devolver mock.
import { supabase } from '../../../lib/supabase';
import type { ITRequest } from '../../../components/IT/ITKanbanBoard';
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
};
