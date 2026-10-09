// Ajuste da previsão de uma ocorrência (RF11, RN04 item 1, D6): "só este mês"
// grava no lançamento; "deste mês em diante" vira reajuste da despesa (RF03).

import { formatarCompetencia } from './competencia';
import { validarReajuste } from './reajustes';
import type { OcorrenciaDoMes } from './situacao';
import type { FormaPagamento, MotivoReajuste } from '../types';

export type EscopoAjuste = 'mes' | 'em_diante';

export interface AjusteInput {
  escopo: EscopoAjuste;
  valorPrevisto: number | null;
  /** 'YYYY-MM-DD'; só no escopo 'mes'. */
  vencimento: string | null;
  formaPagamento: FormaPagamento;
  observacao: string | null;
  /** Só no escopo 'em_diante' (o reajuste exige motivo). */
  motivo: MotivoReajuste;
}

export type ErrosAjuste = Partial<Record<'valorPrevisto' | 'vencimento' | 'escopo' | 'geral', string>>;

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

export function validarAjuste(input: AjusteInput, o: OcorrenciaDoMes): ErrosAjuste {
  const erros: ErrosAjuste = {};
  if (input.valorPrevisto === null || !Number.isFinite(input.valorPrevisto)) {
    erros.valorPrevisto = 'Informe o valor previsto.';
    return erros;
  }

  if (input.escopo === 'mes') {
    if (input.valorPrevisto < 0) erros.valorPrevisto = 'O valor não pode ser negativo.';
    if (!input.vencimento || !RE_DATA.test(input.vencimento)) erros.vencimento = 'Informe o vencimento.';
    const mudou =
      input.valorPrevisto !== o.valorPrevisto ||
      input.vencimento !== o.vencimento ||
      input.formaPagamento !== o.formaPagamento ||
      (input.observacao?.trim() || null) !== (o.lancamento?.observacao ?? null);
    if (Object.keys(erros).length === 0 && !mudou) erros.geral = 'Nada mudou em relação à previsão atual.';
    return erros;
  }

  // Deste mês em diante = reajuste com vigência nesta competência: mesmas regras do RF03.
  const errosReajuste = validarReajuste(
    { vigenteDesde: o.competencia, valor: input.valorPrevisto, motivo: input.motivo, quantidade: null, observacao: input.observacao },
    o.despesa,
  );
  if (errosReajuste.valor) erros.valorPrevisto = errosReajuste.valor;
  if (errosReajuste.vigenteDesde) erros.escopo = errosReajuste.vigenteDesde;
  if (!erros.valorPrevisto && !erros.escopo && input.valorPrevisto === o.previstoOriginal) {
    erros.geral = `O valor a partir de ${formatarCompetencia(o.competencia)} já é este.`;
  }
  return erros;
}

/** Colunas que o ajuste "só este mês" grava. */
export function camposAjuste(input: AjusteInput) {
  return {
    valor_previsto: input.valorPrevisto,
    vencimento: input.vencimento,
    forma_pagamento: input.formaPagamento,
    observacao: input.observacao?.trim() || null,
  };
}

/** Primeiro toque de uma ocorrência por ajuste: cria o lançamento como 'previsto' (RN15). */
export function linhaAjusteNovo(o: OcorrenciaDoMes, input: AjusteInput) {
  return {
    despesa_id: o.despesa.id,
    competencia: o.competencia,
    status: 'previsto' as const,
    ...camposAjuste(input),
  };
}
