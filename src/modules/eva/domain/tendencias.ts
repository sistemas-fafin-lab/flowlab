// Tendências da TI (D42, issue 31). Duas fontes:
// - a foto diária do painel de gestão (ti_agente_fotos, gravada às 18h), para o que não dá para
//   reconstruir depois: quantos estavam atrasados, abertos e na fila em cada dia;
// - as datas de resolução (resolved_at), para o que dá: entregas e tempo médio de resolução por
//   semana, já com histórico desde o primeiro dia.
// Pura; a api/ (NodeNext) importa: os imports levam ".js".
import { diaSP, ehDiaUtil, formatarDiaMes, inicioDaSemana, somarDias, type Dia } from './datas.js';
import type { PainelGestao } from './gestao.js';

// ── A foto do dia ────────────────────────────────────────────────────────────

export interface FotoDia {
  dia: Dia;
  abertos: number;
  atrasados: number;
  vencemHoje: number;
  parados: number;
  criticosAtrasados: number;
  /** Cards concluídos no dia. */
  entregas: number;
  naFila: number;
  foraDoPrazo: number;
  emAndamento: number;
  /** Chamados abertos e resolvidos no dia, e o tempo médio dos resolvidos. */
  chamadosAbertos: number;
  chamadosResolvidos: number;
  tempoMedioMs: number | null;
  pessoas: Record<string, { abertos: number; atrasados: number; concluidos: number }>;
}

/** A foto do painel do dia (o período do painel é só hoje). */
export function fotografar(p: PainelGestao): FotoDia {
  return {
    dia: p.hoje,
    abertos: p.kanban.abertos,
    atrasados: p.kanban.atrasados,
    vencemHoje: p.kanban.vencemHoje,
    parados: p.kanban.parados,
    criticosAtrasados: p.kanban.criticosAtrasados.length,
    entregas: p.entregas.periodo,
    naFila: p.chamados.naFila,
    foraDoPrazo: p.chamados.foraDoPrazo.length,
    emAndamento: p.chamados.emAndamento,
    chamadosAbertos: p.chamados.abertos,
    chamadosResolvidos: p.chamados.resolvidos,
    tempoMedioMs: p.chamados.tempoMedioMs,
    pessoas: Object.fromEntries(p.pessoas.map((x) => [x.id, { abertos: x.abertos, atrasados: x.atrasados, concluidos: x.concluidos }])),
  };
}

/** A foto mais recente até `dia`, incluso (no fim de semana não há foto: vale a de sexta). */
export function fotoAte(fotos: FotoDia[], dia: Dia): FotoDia | null {
  return fotos.filter((f) => f.dia <= dia).sort((a, b) => b.dia.localeCompare(a.dia))[0] ?? null;
}

export interface PontoDia { dia: Dia; rotulo: string; atrasados: number | null; abertos: number | null; naFila: number | null }

/** Os dias úteis dos últimos `dias` dias, com a foto de cada um (null onde não houve foto). */
export function seriePorDia(fotos: FotoDia[], hoje: Dia, dias = 30): PontoDia[] {
  const porDia = new Map(fotos.map((f) => [f.dia, f]));
  const pontos: PontoDia[] = [];
  for (let i = dias - 1; i >= 0; i -= 1) {
    const dia = somarDias(hoje, -i);
    if (!ehDiaUtil(dia)) continue;
    const f = porDia.get(dia);
    pontos.push({ dia, rotulo: formatarDiaMes(dia), atrasados: f?.atrasados ?? null, abertos: f?.abertos ?? null, naFila: f?.naFila ?? null });
  }
  return pontos;
}

// ── Por semana, pelas datas de resolução ────────────────────────────────────

/** Um it_request resolvido: card do Kanban (kanban_hidden = false) e/ou chamado de usuário (is_internal = false). */
export interface Resolvido { resolved_at: string; created_at: string; is_internal: boolean; kanban_hidden: boolean }

export interface PontoSemana {
  /** Segunda-feira da semana. */
  semana: Dia;
  rotulo: string;
  /** Cards do Kanban concluídos na semana. */
  entregas: number;
  /** Chamados de usuário resolvidos na semana e o tempo médio deles (abertura → resolução). */
  resolvidos: number;
  tempoMedioMs: number | null;
  /** A semana de hoje, que ainda não terminou. */
  atual: boolean;
}

/** As últimas `semanas` semanas, de segunda a domingo, da mais antiga à atual (que vai até hoje). */
export function seriePorSemana(resolvidos: Resolvido[], hoje: Dia, semanas = 8): PontoSemana[] {
  const atual = inicioDaSemana(hoje);
  const pontos: PontoSemana[] = [];
  for (let i = semanas - 1; i >= 0; i -= 1) {
    const semana = somarDias(atual, -7 * i);
    const fim = somarDias(semana, 6);
    const daSemana = resolvidos.filter((r) => { const d = diaSP(r.resolved_at); return d >= semana && d <= fim; });
    const chamados = daSemana.filter((r) => !r.is_internal);
    const soma = chamados.reduce((s, r) => s + Math.max(0, Date.parse(r.resolved_at) - Date.parse(r.created_at)), 0);
    pontos.push({
      semana,
      rotulo: formatarDiaMes(semana),
      entregas: daSemana.filter((r) => !r.kanban_hidden).length,
      resolvidos: chamados.length,
      tempoMedioMs: chamados.length ? soma / chamados.length : null,
      atual: i === 0,
    });
  }
  return pontos;
}
