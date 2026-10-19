import { QuotationPriorityLabels, type Quotation } from '../types';
import { formatDate } from './formatDate';

/** Valores do formulário "Editar informações", como o usuário digitou. */
export interface QuotationInfoInput {
  title: string;
  description: string;
  justification: string;
  priority: string;
  costCenter: string;
  /** "aaaa-mm-dd" ou vazio. */
  deliveryDeadline: string;
  /** "aaaa-mm-dd" ou vazio. */
  responseDeadline: string;
}

export type QuotationPriority = Quotation['priority'];

const PRIORITIES: readonly string[] = ['low', 'medium', 'high', 'urgent'] satisfies QuotationPriority[];

/** As informações da cotação já validadas: textos aparados, opcionais vazios em nulo. */
export interface QuotationInfo {
  title: string;
  description: string | null;
  justification: string | null;
  priority: QuotationPriority;
  costCenter: string | null;
  deliveryDeadline: string | null;
  responseDeadline: string | null;
}

export type QuotationInfoValidation =
  | { ok: true; info: QuotationInfo }
  | { ok: false; error: string };

const trimToNull = (value: string | null | undefined): string | null => value?.trim() || null;

export function validateQuotationInfo(input: QuotationInfoInput): QuotationInfoValidation {
  if (!input.title.trim()) return { ok: false, error: 'Informe o título da cotação.' };
  if (!PRIORITIES.includes(input.priority)) {
    return { ok: false, error: 'Prioridade inválida: use baixa, média, alta ou urgente.' };
  }
  return {
    ok: true,
    info: {
      title: input.title.trim(),
      description: trimToNull(input.description),
      justification: trimToNull(input.justification),
      priority: input.priority as QuotationPriority,
      costCenter: trimToNull(input.costCenter),
      deliveryDeadline: trimToNull(input.deliveryDeadline),
      responseDeadline: trimToNull(input.responseDeadline),
    },
  };
}

/**
 * Coluna de `quotations` de cada campo. As chaves do diff são as colunas,
 * as mesmas que o trigger quotation_guard_info_edit grava em `details` do
 * histórico `info_edited`.
 */
export const QUOTATION_INFO_COLUMNS = {
  title: 'title',
  description: 'description',
  justification: 'justification',
  priority: 'priority',
  costCenter: 'cost_center',
  deliveryDeadline: 'deadline',
  responseDeadline: 'response_deadline',
} as const satisfies Record<keyof QuotationInfo, string>;

export type QuotationInfoColumn = (typeof QUOTATION_INFO_COLUMNS)[keyof QuotationInfo];

/** `{ coluna: { de, para } }` só com o que mudou; vazio = nada a salvar. */
export type QuotationInfoDiff = Partial<Record<QuotationInfoColumn, { de: string | null; para: string | null }>>;

/** Os sete campos, normalizados ou não (vazio, nulo e espaços nas pontas se equivalem no diff). */
export type QuotationInfoValues = Record<keyof QuotationInfo, string | null>;

export function diffQuotationInfo(current: QuotationInfoValues, next: QuotationInfoValues): QuotationInfoDiff {
  const diff: QuotationInfoDiff = {};
  for (const field of Object.keys(QUOTATION_INFO_COLUMNS) as (keyof QuotationInfo)[]) {
    // A cotação atual vem do banco como foi gravada (às vezes "" ou com espaços).
    const de = trimToNull(current[field]);
    const para = trimToNull(next[field]);
    if (de !== para) diff[QUOTATION_INFO_COLUMNS[field]] = { de, para };
  }
  return diff;
}

/** O que o formulário precisa da cotação (subconjunto de `Quotation`). */
export interface QuotationInfoSource {
  title: string;
  description?: string | null;
  justification?: string | null;
  priority: string;
  costCenter?: string | null;
  deliveryDeadline?: string | null;
  responseDeadline?: string | null;
}

// Os prazos são timestamptz no banco; o formulário usa só a data.
const dateOnly = (value: string | null | undefined): string => value?.slice(0, 10) ?? '';

/** Valores iniciais do formulário "Editar informações". */
export function quotationInfoInputFrom(quotation: QuotationInfoSource): QuotationInfoInput {
  return {
    title: quotation.title,
    description: quotation.description ?? '',
    justification: quotation.justification ?? '',
    priority: quotation.priority,
    costCenter: quotation.costCenter ?? '',
    deliveryDeadline: dateOnly(quotation.deliveryDeadline),
    responseDeadline: dateOnly(quotation.responseDeadline),
  };
}

const COLUMN_LABELS: Record<QuotationInfoColumn, string> = {
  title: 'Título',
  description: 'Descrição',
  justification: 'Justificativa',
  priority: 'Prioridade',
  cost_center: 'Centro de custo',
  deadline: 'Prazo de entrega',
  response_deadline: 'Prazo de resposta',
};

/** Valor exibido na linha do tempo; `full` só existe quando `text` foi cortado. */
export interface QuotationInfoChangeValue {
  text: string;
  full: string | null;
}

/** Uma linha "Campo: antes → depois" da entrada `info_edited`. */
export interface QuotationInfoChangeLine {
  label: string;
  de: QuotationInfoChangeValue;
  para: QuotationInfoChangeValue;
}

const EMPTY_VALUE = '—';
const MAX_CHANGE_TEXT = 120;

const displayText = (column: string, value: string): string => {
  if (column === 'priority') return QuotationPriorityLabels[value as QuotationPriority] ?? value;
  // Prazo gravado a partir de "aaaa-mm-dd": vale o dia, não o instante.
  if (column === 'deadline' || column === 'response_deadline') return formatDate(dateOnly(value));
  return value;
};

const formatChangeValue = (column: string, value: unknown): QuotationInfoChangeValue => {
  const raw = value == null ? '' : String(value).trim();
  if (!raw) return { text: EMPTY_VALUE, full: null };
  const text = displayText(column, raw);
  if (text.length <= MAX_CHANGE_TEXT) return { text, full: null };
  return { text: `${text.slice(0, MAX_CHANGE_TEXT)}…`, full: text };
};

/** Formata o `details` de uma entrada `info_edited` (`{ coluna: { de, para } }`) para a linha do tempo. */
export function formatQuotationInfoDetails(details: Record<string, unknown>): QuotationInfoChangeLine[] {
  return Object.entries(details).flatMap(([column, change]) => {
    if (typeof change !== 'object' || change === null) return [];
    const { de, para } = change as { de?: unknown; para?: unknown };
    return [
      {
        label: COLUMN_LABELS[column as QuotationInfoColumn] ?? column,
        de: formatChangeValue(column, de),
        para: formatChangeValue(column, para),
      },
    ];
  });
}
