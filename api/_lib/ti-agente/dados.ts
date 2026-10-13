// Leituras e avisos que a EVA faz no banco pelo servidor (service role).
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LinhaChamadaIA } from './ia/gerarEstruturado.js';
import type { CardCtx, ContextoExtracao, MembroCtx, ProjetoCtx, SprintCtx } from './extracao.js';

const PAGINA = 1000;

type Pagina<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

export async function lerTudo<T>(consulta: (de: number, ate: number) => Pagina<T>): Promise<T[]> {
  const linhas: T[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await consulta(de, de + PAGINA - 1);
    if (error) throw new Error(error.message);
    linhas.push(...(data ?? []));
    if (!data || data.length < PAGINA) return linhas;
  }
}

const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? '';

/**
 * Membros que a EVA conhece. Enquanto a aba Membros estiver vazia, usa as pessoas do
 * departamento TI (com o nome e o primeiro nome como apelidos), para as primeiras
 * análises já saírem com responsável.
 */
export async function lerMembros(db: SupabaseClient): Promise<MembroCtx[]> {
  const { data: membros, error } = await db
    .from('ti_agente_membros')
    .select('user_id, apelidos, perfil:user_profiles!ti_agente_membros_user_id_fkey(name, deleted_at)')
    .eq('ativo', true);
  if (error) throw new Error(error.message);
  type Perfil = { name: string; deleted_at: string | null } | null;
  // Duas FKs para user_profiles (user_id e updated_by): o embed precisa do nome da FK.
  const ativos = (membros ?? []).filter((m) => {
    const p = m.perfil as unknown as Perfil;
    return p && !p.deleted_at;
  });
  if (ativos.length > 0) {
    return ativos.map((m) => {
      const nome = (m.perfil as unknown as { name: string }).name;
      return { id: m.user_id as string, nome, apelidos: (m.apelidos as string[]) ?? [] };
    });
  }
  const { data: ti, error: e2 } = await db.from('user_profiles').select('id, name').eq('department', 'TI').is('deleted_at', null);
  if (e2) throw new Error(e2.message);
  return (ti ?? []).map((p) => ({ id: p.id as string, nome: p.name as string, apelidos: [primeiroNome(p.name as string)].filter(Boolean) }));
}

/** Contexto da extração: membros, cards abertos, projetos e sprints ativas/planejadas. */
export async function lerContexto(db: SupabaseClient): Promise<ContextoExtracao> {
  const [membros, cards, projetos, sprints] = await Promise.all([
    lerMembros(db),
    lerTudo<CardCtx>((de, ate) =>
      db.from('it_requests')
        .select('id, codigo, title, kanban_status, priority, assigned_to, due_date, project_id')
        .eq('kanban_hidden', false)
        .neq('kanban_status', 'done')
        .not('status', 'in', '(resolved,cancelled)')
        .order('codigo')
        .range(de, ate) as unknown as Pagina<CardCtx>),
    lerTudo<ProjetoCtx>((de, ate) => db.from('it_projects').select('id, name').order('name').range(de, ate) as unknown as Pagina<ProjetoCtx>),
    lerTudo<SprintCtx>((de, ate) =>
      db.from('it_sprints').select('id, project_id, name, start_date, end_date, status').in('status', ['active', 'planned']).range(de, ate) as unknown as Pagina<SprintCtx>),
  ]);
  return { membros, cards: cards.map((c) => ({ ...c, assigned_to: c.assigned_to ?? [] })), projetos, sprints };
}

/** Registro de uso da IA (RN14). */
export function registradorDeChamadas(db: SupabaseClient) {
  return async (linha: LinhaChamadaIA) => {
    const { error } = await db.from('ti_agente_chamadas_ia').insert(linha);
    if (error) throw new Error(error.message);
  };
}

/** Ids dos gestores da EVA ativos: cargo com canApproveAgenteTI ou role admin. */
export async function lerGestores(db: SupabaseClient): Promise<string[]> {
  const { data: cargos, error } = await db.from('custom_roles').select('id').contains('permissions', ['canApproveAgenteTI']);
  if (error) throw new Error(error.message);
  const ids = (cargos ?? []).map((c) => c.id as string);
  const filtro = ids.length ? `role.eq.admin,custom_role_id.in.(${ids.join(',')})` : 'role.eq.admin';
  const { data: pessoas, error: e2 } = await db.from('user_profiles').select('id').is('deleted_at', null).or(filtro);
  if (e2) throw new Error(e2.message);
  return (pessoas ?? []).map((p) => p.id as string);
}

export async function avisarGestores(db: SupabaseClient, aviso: { titulo: string; conteudo: string; link: string; tipo?: string }) {
  const gestores = await lerGestores(db);
  if (gestores.length === 0) return;
  await db.from('user_notifications').insert(
    gestores.map((id) => ({ user_id: id, title: aviso.titulo, content: aviso.conteudo, module: 'IT', type: aviso.tipo ?? 'info', link: aviso.link })),
  );
}
