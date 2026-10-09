// Baixa, baixa em lote e dispensa de ocorrências (RF12, RF13): validação e as
// linhas gravadas em ti_lancamentos por upsert em (despesa_id, competencia).

import type { OcorrenciaDoMes } from './situacao';
import type { BaixaInput } from '../types';

export type ErrosBaixa = Partial<Record<keyof BaixaInput, string>>;

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

export function validarBaixa(input: BaixaInput, hoje: string): ErrosBaixa {
  const erros: ErrosBaixa = {};
  if (input.valorPago === null || !Number.isFinite(input.valorPago)) erros.valorPago = 'Informe o valor pago.';
  else if (input.valorPago < 0) erros.valorPago = 'O valor pago não pode ser negativo.';
  if (!input.pagoEm || !RE_DATA.test(input.pagoEm)) erros.pagoEm = 'Informe a data do pagamento.';
  else if (input.pagoEm > hoje) erros.pagoEm = 'A data do pagamento não pode ser futura.';
  return erros;
}

export function validarMotivoDispensa(motivo: string): string | null {
  return motivo.trim() ? null : 'Informe por que não houve cobrança (ex.: carência, suspensão).';
}

/**
 * O mínimo de uma ocorrência para gravar o lançamento. `OcorrenciaDoMes`
 * satisfaz; o gasto avulso (issue 08) monta um à mão para a despesa recém-criada.
 */
export type OcorrenciaParaGravar = Pick<OcorrenciaDoMes, 'competencia' | 'valorPrevisto' | 'vencimento' | 'formaPagamento'> & {
  despesa: { id: string };
};

/** Colunas que vêm da ocorrência — a previsão do mês (já ajustada, se havia ajuste). */
const base = (o: OcorrenciaParaGravar) => ({
  despesa_id: o.despesa.id,
  competencia: o.competencia,
  valor_previsto: o.valorPrevisto,
  vencimento: o.vencimento,
});

const textoOuNull = (t: string | null): string | null => t?.trim() || null;

/** Baixa individual (cria ou atualiza o lançamento da ocorrência). */
export function linhaBaixa(o: OcorrenciaParaGravar, input: BaixaInput) {
  return {
    ...base(o),
    status: 'pago' as const,
    forma_pagamento: input.formaPagamento,
    valor_pago: input.valorPago,
    pago_em: input.pagoEm,
    nota_fiscal: textoOuNull(input.notaFiscal),
    observacao: textoOuNull(input.observacao),
    motivo_dispensa: null,
  };
}

/**
 * Baixa em lote: valor pago = previsto, na mesma data. Não manda nota_fiscal
 * nem observacao — num upsert, coluna omitida não é sobrescrita, então o que
 * já estava num ajuste anterior fica.
 */
export function linhaBaixaEmLote(o: OcorrenciaDoMes, pagoEm: string) {
  return {
    ...base(o),
    status: 'pago' as const,
    forma_pagamento: o.formaPagamento,
    valor_pago: o.valorPrevisto,
    pago_em: pagoEm,
    motivo_dispensa: null,
  };
}

export function linhaDispensa(o: OcorrenciaDoMes, motivo: string) {
  return {
    ...base(o),
    status: 'dispensado' as const,
    forma_pagamento: o.formaPagamento,
    valor_pago: null,
    pago_em: null,
    motivo_dispensa: motivo.trim(),
  };
}

/** Ocorrências que entram numa baixa em lote: não pagas nem dispensadas. */
export function podeDarBaixa(o: OcorrenciaDoMes): boolean {
  return o.situacao === 'vencida' || o.situacao === 'a_vencer';
}

/**
 * O que "desfazer" faz com o lançamento (RN15):
 * - baixa/dispensa de uma ocorrência que tinha ajuste → volta para 'previsto',
 *   mantendo o ajuste (desfazer o pagamento não pode apagar a previsão mexida);
 * - qualquer outro caso (sem ajuste, ou desfazer o próprio ajuste) → apaga a
 *   linha, e a ocorrência volta a seguir a despesa.
 */
export function acaoAoDesfazer(o: OcorrenciaDoMes): 'voltar_para_previsto' | 'apagar' | 'nada' {
  if (!o.lancamento) return 'nada';
  if (o.lancamento.status !== 'previsto' && o.ajustada) return 'voltar_para_previsto';
  return 'apagar';
}
