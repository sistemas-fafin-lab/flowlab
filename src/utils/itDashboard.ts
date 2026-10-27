// ─── Números do painel no topo das Solicitações de TI ─────────────────────────
// Tudo é calculado sobre a lista que a tela já carregou: para a TI, todos os
// chamados; para os demais, só os próprios. Fila e andamento são o retrato de
// agora; resolvidos, tempo médio, série e tipos olham o período escolhido.

import { getSlaStatus, type ITKanbanColumnLike, type ITPriority, type ITStatusLike } from './itSla';

export type PeriodoDias = 7 | 30 | 90;

export interface ChamadoMetrica {
  status: ITStatusLike;
  priority: ITPriority;
  request_type: string;
  created_at: string;
  resolved_at?: string | null;
  kanban_status?: ITKanbanColumnLike | null;
  kanban_hidden?: boolean | null;
}

export interface ResumoChamados {
  /** Pendentes, ainda sem atendimento. */
  naFila: number;
  emAndamento: number;
  abertosNoPeriodo: number;
  resolvidosNoPeriodo: number;
  /** Média da abertura à resolução dos resolvidos no período; null sem nenhum. */
  tempoMedioResolucaoMs: number | null;
  /** Na fila e já fora do prazo para iniciar o atendimento (SLA). */
  inicioAtrasado: number;
}

const DIA_MS = 24 * 60 * 60 * 1000;

function inicioDoDia(data: Date): Date {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate());
}

function somarDias(data: Date, dias: number): Date {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate() + dias);
}

/** Primeiro instante do período: meia-noite de (dias - 1) dias atrás, contando hoje. */
export function inicioDoPeriodo(dias: number, agora = new Date()): Date {
  return somarDias(inicioDoDia(agora), -(dias - 1));
}

function resolvidoEm(c: ChamadoMetrica): Date | null {
  if (c.status !== 'resolved' || !c.resolved_at) return null;
  return new Date(c.resolved_at);
}

export function resumirChamados(chamados: ChamadoMetrica[], dias: PeriodoDias, agora = new Date()): ResumoChamados {
  const inicio = inicioDoPeriodo(dias, agora).getTime();
  let naFila = 0;
  let emAndamento = 0;
  let abertosNoPeriodo = 0;
  let resolvidosNoPeriodo = 0;
  let somaResolucaoMs = 0;
  let inicioAtrasado = 0;

  for (const c of chamados) {
    if (c.status === 'pending') {
      naFila++;
      const sla = getSlaStatus(c.created_at, c.priority, {
        status: c.status,
        kanbanStatus: c.kanban_status,
        kanbanHidden: c.kanban_hidden,
        now: agora,
      });
      if (sla.isOverdue) inicioAtrasado++;
    }
    if (c.status === 'in_progress') emAndamento++;
    if (new Date(c.created_at).getTime() >= inicio) abertosNoPeriodo++;

    const resolvido = resolvidoEm(c);
    if (resolvido && resolvido.getTime() >= inicio) {
      resolvidosNoPeriodo++;
      somaResolucaoMs += Math.max(0, resolvido.getTime() - new Date(c.created_at).getTime());
    }
  }

  return {
    naFila,
    emAndamento,
    abertosNoPeriodo,
    resolvidosNoPeriodo,
    tempoMedioResolucaoMs: resolvidosNoPeriodo > 0 ? somaResolucaoMs / resolvidosNoPeriodo : null,
    inicioAtrasado,
  };
}

export interface PontoSerie {
  /** dd/MM do primeiro dia do intervalo */
  rotulo: string;
  abertos: number;
  resolvidos: number;
}

/**
 * Abertos e resolvidos por intervalo: por dia até 30 dias, por semana em 90
 * (13 semanas, a última terminando hoje).
 */
export function serieAbertosResolvidos(chamados: ChamadoMetrica[], dias: PeriodoDias, agora = new Date()): PontoSerie[] {
  const passo = dias <= 30 ? 1 : 7;
  const total = Math.ceil(dias / passo);
  const hoje = inicioDoDia(agora);
  const inicios = Array.from({ length: total }, (_, i) => somarDias(hoje, -((total - 1 - i) * passo + (passo - 1))));
  const fim = somarDias(hoje, 1).getTime();

  const pontos: PontoSerie[] = inicios.map((d) => ({
    rotulo: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    abertos: 0,
    resolvidos: 0,
  }));

  const indice = (data: Date): number => {
    const t = data.getTime();
    if (t < inicios[0].getTime() || t >= fim) return -1;
    const diasDesdeInicio = Math.floor((inicioDoDia(data).getTime() - inicios[0].getTime()) / DIA_MS + 0.5);
    return Math.min(total - 1, Math.floor(diasDesdeInicio / passo));
  };

  for (const c of chamados) {
    const i = indice(new Date(c.created_at));
    if (i >= 0) pontos[i].abertos++;
    const resolvido = resolvidoEm(c);
    if (resolvido) {
      const j = indice(resolvido);
      if (j >= 0) pontos[j].resolvidos++;
    }
  }
  return pontos;
}

export interface FatiaTipo {
  tipo: string;
  total: number;
  /** ainda não resolvidos nem cancelados */
  emAberto: number;
}

/** Chamados abertos no período, por tipo, do maior para o menor. Tipos sem chamado ficam de fora. */
export function distribuicaoPorTipo(chamados: ChamadoMetrica[], dias: PeriodoDias, agora = new Date()): FatiaTipo[] {
  const inicio = inicioDoPeriodo(dias, agora).getTime();
  const porTipo = new Map<string, FatiaTipo>();
  for (const c of chamados) {
    if (new Date(c.created_at).getTime() < inicio) continue;
    const fatia = porTipo.get(c.request_type) ?? { tipo: c.request_type, total: 0, emAberto: 0 };
    fatia.total++;
    if (c.status === 'pending' || c.status === 'in_progress') fatia.emAberto++;
    porTipo.set(c.request_type, fatia);
  }
  return Array.from(porTipo.values()).sort((a, b) => b.total - a.total || a.tipo.localeCompare(b.tipo));
}

/** 40min, 5h, 2d 3h — para o tempo médio de resolução. */
export function formatarDuracao(ms: number): string {
  const minutos = Math.round(ms / 60000);
  if (minutos < 60) return `${Math.max(1, minutos)}min`;
  const horas = Math.round(ms / 3600000);
  if (horas < 24) return `${horas}h`;
  const dias = Math.floor(horas / 24);
  const resto = horas % 24;
  return resto ? `${dias}d ${resto}h` : `${dias}d`;
}
