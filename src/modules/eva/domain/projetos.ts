// Situação dos projetos de TI deduzida dos cards e da sprint (D4, RN05, D27).
// it_projects não tem status, responsável nem prazo: tudo sai daqui.
import { diaSP, diferencaDias, type Dia } from './datas';
import { estaAberto, estaAtrasado, estaConcluido, estaVisivel, venceEmBreve, type CardTI } from './demandas';

export interface ProjetoTI {
  id: string;
  name: string;
  color: string | null;
}

export interface SprintTI {
  id: string;
  project_id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: 'planned' | 'active' | 'completed';
}

export type SituacaoProjeto = 'late' | 'at_risk' | 'on_track' | 'no_deadline';

export interface ResumoProjeto {
  id: string;
  nome: string;
  cor: string | null;
  sprint: SprintTI | null;
  emAndamento: boolean;
  /** Feitos e total da sprint ativa, ou do projeto quando não há sprint ativa. */
  feitos: number;
  total: number;
  /** O maior entre o fim da sprint ativa e o maior prazo dos cards abertos. */
  prazo: Dia | null;
  situacao: SituacaoProjeto;
}

/** Dias de antecedência que já põem o projeto em Atenção (RN05). */
export const DIAS_ATENCAO = 3;
/** Pontos percentuais de atraso do progresso contra o tempo da sprint (D27). */
export const FOLGA_RITMO = 0.2;

/**
 * Fração da sprint já decorrida, de 0 a 1, ou null sem datas.
 * No dia do início vale 0; no dia do fim, 1.
 */
export function tempoDecorrido(sprint: SprintTI, hoje: Dia): number | null {
  if (!sprint.start_date || !sprint.end_date) return null;
  const inicio = diaSP(sprint.start_date);
  const fim = diaSP(sprint.end_date);
  const duracao = diferencaDias(inicio, fim);
  if (duracao <= 0) return null;
  return Math.min(1, Math.max(0, diferencaDias(inicio, hoje) / duracao));
}

export function resumirProjeto(projeto: ProjetoTI, cards: CardTI[], sprints: SprintTI[], hoje: Dia): ResumoProjeto {
  const doProjeto = cards.filter((c) => c.project_id === projeto.id && estaVisivel(c));
  const abertos = doProjeto.filter(estaAberto);
  const sprint = sprints.find((s) => s.project_id === projeto.id && s.status === 'active') ?? null;

  const base = sprint ? doProjeto.filter((c) => c.sprint_id === sprint.id) : doProjeto;
  const feitos = base.filter(estaConcluido).length;
  const total = base.length;

  const prazos = abertos.map((c) => (c.due_date ? diaSP(c.due_date) : null)).filter((d): d is Dia => d !== null);
  if (sprint?.end_date) prazos.push(diaSP(sprint.end_date));
  const prazo = prazos.length ? prazos.sort().pop()! : null;

  const fimSprint = sprint?.end_date ? diaSP(sprint.end_date) : null;
  const abertosNaSprint = sprint ? abertos.filter((c) => c.sprint_id === sprint.id) : [];

  let situacao: SituacaoProjeto;
  if (abertos.some((c) => estaAtrasado(c, hoje)) || (fimSprint !== null && fimSprint < hoje && abertosNaSprint.length > 0)) {
    situacao = 'late';
  } else if (
    abertos.some((c) => venceEmBreve(c, hoje, DIAS_ATENCAO)) ||
    (fimSprint !== null && abertosNaSprint.length > 0 && diferencaDias(hoje, fimSprint) <= DIAS_ATENCAO) ||
    estaForaDoRitmo(sprint, feitos, total, hoje)
  ) {
    situacao = 'at_risk';
  } else {
    situacao = prazo ? 'on_track' : 'no_deadline';
  }

  return {
    id: projeto.id,
    nome: projeto.name,
    cor: projeto.color,
    sprint,
    emAndamento: sprint !== null || abertos.length > 0,
    feitos,
    total,
    prazo,
    situacao,
  };
}

/** D27 — o progresso está mais de 20 pontos atrás do tempo já decorrido da sprint. */
export function estaForaDoRitmo(sprint: SprintTI | null, feitos: number, total: number, hoje: Dia): boolean {
  if (!sprint || total === 0) return false;
  const decorrido = tempoDecorrido(sprint, hoje);
  if (decorrido === null) return false;
  return decorrido - feitos / total > FOLGA_RITMO;
}

const ORDEM_SITUACAO: Record<SituacaoProjeto, number> = { late: 0, at_risk: 1, on_track: 2, no_deadline: 3 };

/** Projetos em andamento, dos mais urgentes para os mais tranquilos. */
export function projetosEmAndamento(projetos: ProjetoTI[], cards: CardTI[], sprints: SprintTI[], hoje: Dia): ResumoProjeto[] {
  return projetos
    .map((p) => resumirProjeto(p, cards, sprints, hoje))
    .filter((r) => r.emAndamento)
    .sort((a, b) => ORDEM_SITUACAO[a.situacao] - ORDEM_SITUACAO[b.situacao] || a.nome.localeCompare(b.nome, 'pt-BR'));
}
