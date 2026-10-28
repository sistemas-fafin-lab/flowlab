// api/_lib/faturamento/calendarioEnvios.ts
// Calendário de envios do Faturamento (.scratch/faturamento-calendario-envios/spec.md).
// Módulo puro: não acessa banco nem relógio. Datas são 'YYYY-MM-DD' e os feriados
// entram por parâmetro. As funções de dia útil do recurso de glosa e da EVA ignoram
// feriados e ficam como estão; as do calendário moram aqui.

/** Janela em que o convênio aceita o envio. Uma Regra de envio tem uma ou mais. */
export type JanelaEnvio =
  | { tipo: 'dias_corridos'; de: number; ate: number } // "1 ao 15", "até o 19" (de = 1)
  | { tipo: 'dias_uteis'; de: number; ate: number } // "1º ao 5º dia útil", "15º e 16º"
  | { tipo: 'dias_fixos'; dias: number[] } // "dia 03 e 16"
  | { tipo: 'ultimo_dia_util' }
  | { tipo: 'todos_os_dias' }
  | { tipo: 'calendario_convenio' }; // datas lançadas à mão

/** Dia da semana de 'YYYY-MM-DD' (0 = domingo), sem depender do fuso do servidor. */
function diaDaSemana(data: string): number {
  return new Date(`${data}T00:00:00Z`).getUTCDay();
}

/** 'YYYY-MM-DD' somado de `dias` dias corridos. */
export function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Segunda a sexta e fora dos feriados. */
export function ehDiaUtil(data: string, feriados: readonly string[]): boolean {
  const semana = diaDaSemana(data);
  return semana !== 0 && semana !== 6 && !feriados.includes(data);
}

/** O primeiro dia útil depois de `data`: numa sexta, a segunda; na véspera de feriado, pula o feriado. */
export function proximoDiaUtil(data: string, feriados: readonly string[]): string {
  let dia = somarDias(data, 1);
  while (!ehDiaUtil(dia, feriados)) dia = somarDias(dia, 1);
  return dia;
}

/** Dias úteis do mês de `data`, em ordem. */
function diasUteisDoMes(data: string, feriados: readonly string[]): string[] {
  const dias: string[] = [];
  for (let dia = `${data.slice(0, 7)}-01`; dia.slice(0, 7) === data.slice(0, 7); dia = somarDias(dia, 1)) {
    if (ehDiaUtil(dia, feriados)) dias.push(dia);
  }
  return dias;
}

/** O dia `dia` do mês de `data`; se não é dia útil, o próximo dia útil. */
function diaFixoAjustado(data: string, dia: number, feriados: readonly string[]): string {
  const fixo = `${data.slice(0, 7)}-${String(dia).padStart(2, '0')}`;
  return ehDiaUtil(fixo, feriados) ? fixo : proximoDiaUtil(fixo, feriados);
}

function janelaContem(janela: JanelaEnvio, data: string, feriados: readonly string[]): boolean {
  switch (janela.tipo) {
    case 'dias_corridos': {
      const dia = Number(data.slice(8, 10));
      return dia >= janela.de && dia <= janela.ate;
    }
    case 'dias_uteis': {
      const ordem = diasUteisDoMes(data, feriados).indexOf(data) + 1;
      return ordem >= janela.de && ordem <= janela.ate;
    }
    case 'dias_fixos':
      return janela.dias.some((dia) => diaFixoAjustado(data, dia, feriados) === data);
    case 'ultimo_dia_util':
      return diasUteisDoMes(data, feriados).at(-1) === data;
    case 'todos_os_dias':
    case 'calendario_convenio':
      return true;
  }
}

/**
 * Índice da primeira janela da regra que contém `data`, ou null quando a data cai fora
 * de todas. "Todos os dias" e "calendário do convênio" aceitam qualquer data.
 */
export function janelaDaData(data: string, janelas: readonly JanelaEnvio[], feriados: readonly string[]): number | null {
  const indice = janelas.findIndex((janela) => janelaContem(janela, data, feriados));
  return indice === -1 ? null : indice;
}
