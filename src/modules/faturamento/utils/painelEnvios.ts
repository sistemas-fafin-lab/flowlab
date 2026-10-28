import type { AgendamentoEnvio, CalendarioEnvios, FeriadoEnvio, RegraEnvio } from '../types';

// O que as telas do Calendário de envios mostram a partir do GET: os agendamentos
// com o convênio da regra, por dia. Usado pela página do Calendário e pelos painéis
// compactos Hoje e Amanhã do Dashboard de Contas a Receber.

/** O que a tela mostra de um agendamento: o agendamento e o convênio da regra. */
export interface ItemAgendado {
  agendamento: AgendamentoEnvio;
  regra: RegraEnvio | undefined;
}

export interface CalendarioOrganizado {
  /** Por data prevista, em ordem alfabética do convênio. */
  porDia: Map<string, ItemAgendado[]>;
  /** Por data. */
  feriados: Map<string, FeriadoEnvio>;
  /** Na ordem do servidor (fora do prazo primeiro). */
  atrasados: ItemAgendado[];
  /** As regras de "Pode enviar qualquer dia", na ordem do servidor. */
  qualquerDia: RegraEnvio[];
}

/** `/faturamento/calendario#atrasados` (o indicador do Dashboard de Contas a Receber) rola até o bloco Atrasados. */
export const ANCORA_ATRASADOS = 'atrasados';

export const nomeConvenio = (item: ItemAgendado): string => item.regra?.convenio ?? 'Convênio removido';

export function organizarCalendario(calendario: CalendarioEnvios | null): CalendarioOrganizado {
  const regras = new Map((calendario?.regras ?? []).map((r) => [r.id, r]));
  const comRegra = (agendamento: AgendamentoEnvio): ItemAgendado => ({ agendamento, regra: regras.get(agendamento.regraId) });
  const porDia = new Map<string, ItemAgendado[]>();
  for (const agendamento of calendario?.agendamentos ?? []) {
    const lista = porDia.get(agendamento.dataPrevista) ?? [];
    lista.push(comRegra(agendamento));
    porDia.set(agendamento.dataPrevista, lista);
  }
  for (const lista of porDia.values()) lista.sort((a, b) => nomeConvenio(a).localeCompare(nomeConvenio(b), 'pt-BR'));
  return {
    porDia,
    feriados: new Map((calendario?.feriados ?? []).map((f) => [f.data, f])),
    atrasados: (calendario?.atrasados ?? []).map(comRegra),
    qualquerDia: (calendario?.podeEnviarQualquerDia ?? []).flatMap((id) => regras.get(id) ?? []),
  };
}
