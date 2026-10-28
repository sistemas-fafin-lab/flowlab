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

/** Último dia do mês de `data`. */
export function fimDoMes(data: string): string {
  return somarDias(`${somarDias(`${data.slice(0, 7)}-28`, 4).slice(0, 7)}-01`, -1);
}

/**
 * Os dias em que a janela termina no mês de `data` (dias fixos terminam em cada dia),
 * ou null para as janelas sem fim: "todos os dias" e "calendário do convênio".
 */
function finsDaJanela(janela: JanelaEnvio, data: string, feriados: readonly string[]): string[] | null {
  switch (janela.tipo) {
    case 'dias_corridos': {
      const ate = `${data.slice(0, 7)}-${String(janela.ate).padStart(2, '0')}`;
      const fim = fimDoMes(data);
      return [ate < fim ? ate : fim];
    }
    case 'dias_uteis': {
      const uteis = diasUteisDoMes(data, feriados);
      return [uteis[Math.min(janela.ate, uteis.length) - 1]];
    }
    case 'dias_fixos':
      return janela.dias.map((dia) => diaFixoAjustado(data, dia, feriados));
    case 'ultimo_dia_util':
      return [diasUteisDoMes(data, feriados).at(-1) as string];
    case 'todos_os_dias':
    case 'calendario_convenio':
      return null;
  }
}

/**
 * O último dia para enviar o agendamento sem estourar a janela, ou null quando não há
 * prazo. Dentro de uma janela, o fim dela; fora de todas, o fim da próxima janela do
 * mês; depois de todas, o próprio dia previsto.
 */
function prazoDoAgendamento(dataPrevista: string, janelas: readonly JanelaEnvio[], feriados: readonly string[]): string | null {
  const indice = janelaDaData(dataPrevista, janelas, feriados);
  const candidatas = indice === null ? janelas : [janelas[indice]];
  const fins: string[] = [];
  for (const janela of candidatas) {
    const daJanela = finsDaJanela(janela, dataPrevista, feriados);
    if (!daJanela) return null;
    fins.push(...daJanela.filter((fim) => fim >= dataPrevista));
  }
  return fins.length > 0 ? fins.reduce((a, b) => (a < b ? a : b)) : dataPrevista;
}

/**
 * A data prevista ou a de envio cai fora de todas as janelas da regra no mês do
 * agendamento. Regras com "todos os dias" ou "calendário do convênio" nunca caem.
 */
function foraDaJanelaDoMes(
  { dataPrevista, dataEnvio }: { dataPrevista: string; dataEnvio: string | null },
  janelas: readonly JanelaEnvio[],
  feriados: readonly string[],
): boolean {
  if (janelas.some((janela) => finsDaJanela(janela, dataPrevista, feriados) === null)) return false;
  const datas = dataEnvio ? [dataPrevista, dataEnvio] : [dataPrevista];
  return datas.some((data) => data.slice(0, 7) !== dataPrevista.slice(0, 7) || janelaDaData(data, janelas, feriados) === null);
}

/** Status de um Agendamento de envio (regras de status da spec). */
export type StatusAgendamento = 'pendente' | 'enviado' | 'atrasado' | 'fora_do_prazo';

export interface ClassificacaoAgendamento {
  status: StatusAgendamento;
  /** Selo cinza, só informativo: a data prevista ou a de envio cai fora de todas as janelas no mês. */
  foraDaJanela: boolean;
}

/**
 * Classifica o agendamento em `hoje`. Os painéis, o bloco Atrasados e o contador do
 * menu usam todos esta função; as telas não recalculam.
 */
export function classificarAgendamento(
  agendamento: { dataPrevista: string; dataEnvio: string | null },
  regra: { janelas: readonly JanelaEnvio[] },
  feriados: readonly string[],
  hoje: string,
): ClassificacaoAgendamento {
  const foraDaJanela = foraDaJanelaDoMes(agendamento, regra.janelas, feriados);
  if (agendamento.dataEnvio) return { status: 'enviado', foraDaJanela };
  const prazo = prazoDoAgendamento(agendamento.dataPrevista, regra.janelas, feriados);
  if (prazo !== null && hoje > prazo) return { status: 'fora_do_prazo', foraDaJanela };
  if (hoje > agendamento.dataPrevista) return { status: 'atrasado', foraDaJanela };
  return { status: 'pendente', foraDaJanela };
}

/**
 * A lista "Pode enviar qualquer dia": as regras ativas com janela de "todos os dias",
 * que a equipe agenda no dia que escolher. Mantém a ordem recebida.
 */
export function regrasDeQualquerDia<R extends { janelas: readonly JanelaEnvio[]; ativo: boolean }>(regras: readonly R[]): R[] {
  return regras.filter((regra) => regra.ativo && regra.janelas.some((janela) => janela.tipo === 'todos_os_dias'));
}

const TIPOS_JANELA: readonly JanelaEnvio['tipo'][] = [
  'dias_corridos',
  'dias_uteis',
  'dias_fixos',
  'ultimo_dia_util',
  'todos_os_dias',
  'calendario_convenio',
];

/** Um mês tem no máximo 31 dias e 23 dias úteis. */
const MAXIMO_DIA_CORRIDO = 31;
export const MAXIMO_DIA_UTIL = 23;

const diaEntre = (valor: unknown, maximo: number): valor is number =>
  Number.isInteger(valor) && (valor as number) >= 1 && (valor as number) <= maximo;

/** Uma janela vinda do cadastro, só com os campos do tipo dela. */
function validarJanela(bruta: unknown): { janela: JanelaEnvio } | { erro: string } {
  const janela = (bruta && typeof bruta === 'object' ? bruta : {}) as Record<string, unknown>;
  const tipo = janela.tipo as JanelaEnvio['tipo'];
  if (!TIPOS_JANELA.includes(tipo)) return { erro: 'tipo de janela inválido.' };
  switch (tipo) {
    case 'dias_corridos':
    case 'dias_uteis': {
      const maximo = tipo === 'dias_uteis' ? MAXIMO_DIA_UTIL : MAXIMO_DIA_CORRIDO;
      const { de, ate } = janela;
      if (!diaEntre(de, maximo) || !diaEntre(ate, maximo)) {
        return { erro: `${tipo === 'dias_uteis' ? 'dias úteis' : 'dias corridos'} vão de 1 a ${maximo}.` };
      }
      if (de > ate) return { erro: `o início (${de}) passa do fim (${ate}).` };
      return { janela: { tipo, de, ate } };
    }
    case 'dias_fixos': {
      const dias = janela.dias;
      if (!Array.isArray(dias) || dias.length === 0) return { erro: 'informe ao menos um dia.' };
      if (!dias.every((dia) => diaEntre(dia, MAXIMO_DIA_CORRIDO))) {
        return { erro: `dias fixos vão de 1 a ${MAXIMO_DIA_CORRIDO}.` };
      }
      return { janela: { tipo, dias: [...new Set(dias as number[])].sort((a, b) => a - b) } };
    }
    default:
      return { janela: { tipo } };
  }
}

/**
 * As janelas de uma Regra de envio vindas do cadastro: ao menos uma, cada uma só com
 * os campos do tipo dela. A mensagem de erro diz qual janela está errada.
 */
export function validarJanelas(brutas: unknown): { janelas: JanelaEnvio[] } | { erro: string } {
  if (!Array.isArray(brutas) || brutas.length === 0) return { erro: 'Informe ao menos uma janela.' };
  const janelas: JanelaEnvio[] = [];
  for (const [i, bruta] of brutas.entries()) {
    const lida = validarJanela(bruta);
    if ('erro' in lida) return { erro: `Janela ${i + 1}: ${lida.erro}` };
    janelas.push(lida.janela);
  }
  return { janelas };
}
