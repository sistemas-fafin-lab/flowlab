// Regras do reajuste datado (RF03, RN04). A vigência é sempre uma competência
// depois do início da despesa — no próprio mês inicial, o certo é corrigir o valor base.

import { competenciaDaData, ehCompetencia, formatarCompetencia, somarMeses } from './competencia';
import type { ReajusteInput } from '../types';

export type ErrosReajuste = Partial<Record<keyof ReajusteInput, string>>;

interface DespesaParaReajuste {
  competenciaInicio: string;
  competenciaFim: string | null;
  reajustes: readonly { id: string; vigenteDesde: string }[];
}

export function validarReajuste(input: ReajusteInput, despesa: DespesaParaReajuste, idEditando?: string): ErrosReajuste {
  const erros: ErrosReajuste = {};

  if (!input.vigenteDesde || !ehCompetencia(input.vigenteDesde)) {
    erros.vigenteDesde = 'Informe o mês a partir do qual o novo valor vale.';
  } else if (input.vigenteDesde <= despesa.competenciaInicio) {
    erros.vigenteDesde = `O reajuste precisa valer depois do mês inicial (${formatarCompetencia(despesa.competenciaInicio)}). Para mudar o valor desde o início, edite a despesa.`;
  } else if (despesa.competenciaFim && input.vigenteDesde > despesa.competenciaFim) {
    erros.vigenteDesde = `A despesa termina em ${formatarCompetencia(despesa.competenciaFim)}: o reajuste não teria efeito.`;
  } else if (despesa.reajustes.some((r) => r.id !== idEditando && r.vigenteDesde === input.vigenteDesde)) {
    erros.vigenteDesde = `Já existe um reajuste a partir de ${formatarCompetencia(input.vigenteDesde)}.`;
  }

  if (input.valor === null || !Number.isFinite(input.valor)) erros.valor = 'Informe o novo valor.';
  else if (input.valor <= 0) erros.valor = 'O valor precisa ser maior que zero.';

  if (input.quantidade !== null && (!Number.isInteger(input.quantidade) || input.quantidade <= 0)) {
    erros.quantidade = 'A quantidade precisa ser um número inteiro maior que zero.';
  }

  return erros;
}

/** Vigência sugerida: o mês seguinte ao atual, ou ao inicial se a despesa ainda não começou. */
export function vigenciaSugerida(competenciaInicio: string, hoje: string): string {
  const atual = competenciaDaData(hoje) as string;
  return somarMeses(competenciaInicio > atual ? competenciaInicio : atual, 1);
}

/** Variação entre dois valores; percentual null quando o anterior é zero. */
export function variacao(anterior: number, novo: number): { absoluta: number; percentual: number | null } {
  return { absoluta: novo - anterior, percentual: anterior === 0 ? null : ((novo - anterior) / anterior) * 100 };
}
