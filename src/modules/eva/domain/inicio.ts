// Snapshot do Início da EVA (§12.1 do plano): de cards, projetos, sprints e pessoas,
// monta tudo o que a tela mostra numa visão (Equipe ou Minha visão). Puro, com `hoje`.
import type {
  DailyTask, EvaHomeSnapshot, EvaView, KanbanColumnSummary, OverdueTask, ProjectSummary, StatCardData, TeamMember,
} from '../types';
import { formatarDiaMes, type Dia } from './datas';
import {
  concluidoNaSemana, diasDeAtraso, diaVencimento, ehDoUsuario, estaAberto, estaAtrasado, estaConcluido, estaVisivel,
  ordenarAtrasados, resumoKanban, tasksDoDia, venceEmBreve, type CardTI,
} from './demandas';
import { projetosEmAndamento, type ProjetoTI, type ResumoProjeto, type SprintTI } from './projetos';
import { gradientePara, iniciais } from './pessoas';

export interface PessoaTI {
  id: string;
  name: string;
}

export interface EntradaInicio {
  visao: EvaView;
  usuarioId: string;
  hoje: Dia;
  cards: CardTI[];
  projetos: ProjetoTI[];
  sprints: SprintTI[];
  pessoas: PessoaTI[];
  /** Mensagens de cobrança enviadas hoje; null enquanto o WhatsApp não existe (antes da Fase 3). */
  cobrancasHoje?: number | null;
}

/** Janela de "vence em breve" do Início (RN03). */
export const DIAS_VENCE_EM_BREVE = 7;

const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

export function montarMembros(pessoas: PessoaTI[]): Record<string, TeamMember> {
  return Object.fromEntries(
    pessoas.map((p) => [p.id, { id: p.id, name: p.name, initials: iniciais(p.name), gradient: gradientePara(p.id) }]),
  );
}

function briefingEquipe(atrasados: CardTI[], vencendo: number, emRisco: number): string {
  const criticas = atrasados.filter((c) => c.priority === 'critical').length;
  const primeira =
    atrasados.length === 0
      ? 'Nenhuma task atrasada hoje.'
      : `Hoje há ${atrasados.length} ${plural(atrasados.length, 'task atrasada', 'tasks atrasadas')}` +
        (criticas > 0 ? `, ${criticas} ${plural(criticas, 'crítica', 'críticas')}.` : '.');
  const segunda =
    emRisco > 0
      ? `${emRisco} ${plural(emRisco, 'projeto pede', 'projetos pedem')} atenção.`
      : vencendo > 0
        ? `${vencendo} ${plural(vencendo, 'card vence', 'cards vencem')} nos próximos ${DIAS_VENCE_EM_BREVE} dias.`
        : '';
  return [primeira, segunda].filter(Boolean).join(' ');
}

function briefingPessoal(doDia: CardTI[], hoje: Dia, vencendo: number): string {
  const pendentes = doDia.filter(estaAberto);
  const atrasadas = pendentes.filter((c) => estaAtrasado(c, hoje)).length;
  const primeira =
    pendentes.length === 0
      ? 'Você não tem tasks pendentes para hoje.'
      : `Você tem ${pendentes.length} ${plural(pendentes.length, 'task', 'tasks')} para hoje` +
        (atrasadas > 0 ? `, ${atrasadas} ${plural(atrasadas, 'atrasada', 'atrasadas')}.` : '.');
  const segunda =
    vencendo > 0 ? `${vencendo} ${plural(vencendo, 'card seu vence', 'cards seus vencem')} nos próximos ${DIAS_VENCE_EM_BREVE} dias.` : '';
  return [primeira, segunda].filter(Boolean).join(' ');
}

function paraProjeto(r: ResumoProjeto, isMine: boolean): ProjectSummary {
  return {
    id: r.id,
    name: r.nome,
    sprint: r.sprint?.name ?? 'Sem sprint ativa',
    done: r.feitos,
    total: r.total,
    due: r.prazo ? formatarDiaMes(r.prazo) : '—',
    status: r.situacao,
    isMine,
  };
}

export function montarSnapshot(e: EntradaInicio): EvaHomeSnapshot {
  const { visao, usuarioId, hoje } = e;
  const visiveis = e.cards.filter(estaVisivel);
  const daVisao = visao === 'me' ? visiveis.filter((c) => ehDoUsuario(c, usuarioId)) : visiveis;
  const nomeProjeto = new Map(e.projetos.map((p) => [p.id, p.name]));
  const projetoDe = (c: CardTI) => (c.project_id ? nomeProjeto.get(c.project_id) ?? 'Sem projeto' : 'Sem projeto');

  // Kanban
  const resumo = resumoKanban(daVisao, hoje);
  const columns: KanbanColumnSummary[] = resumo.map((r) => ({
    key: r.coluna,
    count: r.total,
    items: r.destaques.map((c) => ({ id: c.id, codigo: c.codigo, title: c.title, memberId: c.assigned_to?.[0] ?? null })),
  }));
  const totalCards = resumo.reduce((soma, r) => soma + r.total, 0);

  // Atrasadas
  const atrasados = ordenarAtrasados(daVisao, hoje);
  const overdue: OverdueTask[] = atrasados.map((c) => ({
    id: c.id,
    codigo: c.codigo,
    title: c.title,
    project: projetoDe(c),
    memberId: c.assigned_to?.[0] ?? null,
    daysLate: diasDeAtraso(c, hoje),
    priority: c.priority,
    lastChargeText: '',
    isMine: ehDoUsuario(c, usuarioId),
  }));

  // Projetos: na Minha visão, os que têm algum card meu
  const todos = projetosEmAndamento(e.projetos, visiveis, e.sprints, hoje);
  const meus = new Set(visiveis.filter((c) => ehDoUsuario(c, usuarioId) && c.project_id).map((c) => c.project_id as string));
  const projetosDaVisao = visao === 'me' ? todos.filter((r) => meus.has(r.id)) : todos;
  const projects = projetosDaVisao.map((r) => paraProjeto(r, meus.has(r.id)));
  const emRisco = projetosDaVisao.filter((r) => r.situacao === 'late' || r.situacao === 'at_risk').length;

  // Tasks do dia (sempre as do usuário, nas duas visões)
  const doDia = tasksDoDia(visiveis, usuarioId, hoje);
  const myTasks: DailyTask[] = doDia.map((c) => ({
    id: c.id,
    codigo: c.codigo,
    title: c.title,
    project: projetoDe(c),
    late: estaAtrasado(c, hoje),
    done: estaConcluido(c),
  }));
  const feitasHoje = myTasks.filter((t) => t.done).length;

  // "Vence nos próximos dias" exclui hoje: o que vence hoje já está nas tasks do dia.
  const vencendo = daVisao.filter((c) => venceEmBreve(c, hoje, DIAS_VENCE_EM_BREVE) && diaVencimento(c) !== hoje).length;
  const criticas = atrasados.filter((c) => c.priority === 'critical').length;
  const abertos = daVisao.filter(estaAberto).length;

  const stats: StatCardData[] =
    visao === 'me'
      ? [
          { key: 'open', label: 'Em aberto', value: abertos, hint: 'Cards atribuídos a você' },
          { key: 'overdue', label: 'Atrasadas', value: atrasados.length, hint: atrasados[0]?.title ?? 'Nada atrasado' },
          {
            key: 'today',
            label: 'Hoje',
            value: `${feitasHoje}/${myTasks.length}`,
            hint: myTasks.length === 0 ? 'Nada vence hoje' : 'Tasks do dia concluídas',
          },
          {
            key: 'projects',
            label: 'Projetos',
            value: projects.length,
            hint: projects.length === 0 ? 'Nenhum projeto seu em andamento' : emRisco > 0 ? `${emRisco} em risco` : 'Todos no prazo',
          },
        ]
      : [
          { key: 'open', label: 'Em aberto', value: abertos, hint: 'Backlog a Revisão' },
          {
            key: 'overdue',
            label: 'Atrasadas',
            value: atrasados.length,
            hint: atrasados.length === 0 ? 'Nada atrasado' : criticas > 0 ? `${criticas} ${plural(criticas, 'crítica', 'críticas')}` : 'Nenhuma crítica',
          },
          { key: 'done', label: 'Concluídas', value: visiveis.filter((c) => concluidoNaSemana(c, hoje)).length, hint: 'Nesta semana' },
          {
            key: 'charges',
            label: 'Cobranças',
            value: e.cobrancasHoje ?? '—',
            hint: e.cobrancasHoje == null ? 'WhatsApp ainda não ligado' : 'Enviadas hoje pela EVA',
          },
        ];

  return {
    briefing: visao === 'me' ? briefingPessoal(doDia, hoje, vencendo) : briefingEquipe(atrasados, vencendo, emRisco),
    stats,
    columns,
    totalCards,
    overdue,
    projects,
    myTasks,
    members: montarMembros(e.pessoas),
  };
}
