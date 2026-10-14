// Datas da EVA: tudo trafega como dia "YYYY-MM-DD" (RN02). "Hoje" e os instantes reais
// (updated_at, comentários) usam o fuso de Brasília; o PRAZO dos cards usa o dia escolhido
// no Board, sem converter fuso (ver diaDoPrazo). Nenhuma função aqui lê o relógio:
// quem chama passa `hoje` (RN06). Este arquivo também é importado pela api/ e pela
// VPS, então não pode depender de nada do navegador.

export type Dia = string; // 'YYYY-MM-DD'

const FUSO = 'America/Sao_Paulo';
const MS_DIA = 24 * 60 * 60 * 1000;

const formatadorDia = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Dia (em Brasília) de um instante ISO, ou de um Date. Um 'YYYY-MM-DD' puro passa direto. */
export function diaSP(instante: string | Date): Dia {
  if (typeof instante === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(instante)) return instante;
  const data = typeof instante === 'string' ? new Date(instante) : instante;
  return formatadorDia.format(data);
}

/**
 * Dia do PRAZO de um card. Não converte fuso: o ITTaskDrawer (único lugar que grava
 * it_requests.due_date) salva o dia escolhido como meia-noite UTC
 * (`new Date('2026-10-20').toISOString()`) e lê de volta com `split('T')[0]`. Converter
 * para Brasília jogaria o prazo para o dia anterior (21h). Instantes reais
 * (updated_at, comentários) continuam usando `diaSP`.
 */
export function diaDoPrazo(dueDate: string): Dia {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return dueDate;
  return new Date(dueDate).toISOString().slice(0, 10);
}

/** Dia de hoje em Brasília. Só para a borda (hooks/handlers) — as regras recebem `hoje`. */
export function hojeSP(agora: Date = new Date()): Dia {
  return diaSP(agora);
}

function paraUTC(dia: Dia): number {
  const [a, m, d] = dia.split('-').map(Number);
  return Date.UTC(a, m - 1, d);
}

function deUTC(ms: number): Dia {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Dias de `de` até `ate` (positivo quando `ate` é depois). */
export function diferencaDias(de: Dia, ate: Dia): number {
  return Math.round((paraUTC(ate) - paraUTC(de)) / MS_DIA);
}

export function somarDias(dia: Dia, n: number): Dia {
  return deUTC(paraUTC(dia) + n * MS_DIA);
}

/** 0 = domingo … 6 = sábado. */
export function diaDaSemana(dia: Dia): number {
  return new Date(paraUTC(dia)).getUTCDay();
}

/** Segunda a sexta. Feriados ficam de fora na v1. */
export function ehDiaUtil(dia: Dia): boolean {
  const d = diaDaSemana(dia);
  return d >= 1 && d <= 5;
}

export function proximoDiaUtil(dia: Dia): Dia {
  let proximo = somarDias(dia, 1);
  while (!ehDiaUtil(proximo)) proximo = somarDias(proximo, 1);
  return proximo;
}

/** Segunda-feira da semana de `dia` (a semana começa na segunda). */
export function inicioDaSemana(dia: Dia): Dia {
  const d = diaDaSemana(dia);
  return somarDias(dia, d === 0 ? -6 : 1 - d);
}

/** "24/10" */
export function formatarDiaMes(dia: Dia): string {
  const [, m, d] = dia.split('-');
  return `${d}/${m}`;
}

export const pluralDias = (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`;
