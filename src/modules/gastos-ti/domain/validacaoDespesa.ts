// Normalização e validação do cadastro de despesa (RF01, RN09, RN10).

import { ehCompetencia } from './competencia';
import type { DespesaInput } from '../types';

export type ErrosDespesa = Partial<Record<keyof DespesaInput, string>>;

const textoOuNull = (valor: string | null | undefined): string | null => {
  const t = (valor ?? '').trim().replace(/\s+/g, ' ');
  return t ? t : null;
};

/**
 * Deixa o input no formato que o banco aceita: textos sem espaços extras,
 * vazio → null, moeda em maiúsculas e sem competência final para despesa
 * única (a única ocorrência é a inicial). O CHECK do banco recusa texto com
 * espaço nas pontas, então isto não é cosmético.
 */
export function normalizarDespesa(input: DespesaInput): DespesaInput {
  return {
    ...input,
    descricao: textoOuNull(input.descricao) ?? '',
    fornecedorNome: textoOuNull(input.fornecedorNome) ?? '',
    autorizadoPor: textoOuNull(input.autorizadoPor) ?? '',
    unidade: textoOuNull(input.unidade),
    setor: textoOuNull(input.setor),
    meioPagamentoDetalhe: textoOuNull(input.meioPagamentoDetalhe),
    moedaOriginal: textoOuNull(input.moedaOriginal)?.toUpperCase() ?? null,
    numeroContrato: textoOuNull(input.numeroContrato),
    observacoes: (input.observacoes ?? '').trim() || null,
    competenciaFim: input.recorrencia === 'unica' ? null : input.competenciaFim,
    autorizadoEm: input.autorizadoEm || null,
  };
}

/** Erros por campo do input JÁ normalizado; objeto vazio = pode gravar. `hoje` = 'YYYY-MM-DD'. */
export function validarDespesa(input: DespesaInput, hoje: string): ErrosDespesa {
  const erros: ErrosDespesa = {};

  if (!input.descricao) erros.descricao = 'Informe a descrição.';
  else if (input.descricao.length > 200) erros.descricao = 'Use no máximo 200 caracteres.';

  if (!input.categoriaId) erros.categoriaId = 'Escolha a categoria.';
  if (!input.fornecedorNome) erros.fornecedorNome = 'Informe o fornecedor.';

  if (input.valorBase === null || !Number.isFinite(input.valorBase)) erros.valorBase = 'Informe o valor.';
  else if (input.valorBase <= 0) erros.valorBase = 'O valor precisa ser maior que zero.';

  if (!input.competenciaInicio || !ehCompetencia(input.competenciaInicio)) {
    erros.competenciaInicio = 'Informe o mês da primeira cobrança.';
  }
  if (input.competenciaFim) {
    if (!ehCompetencia(input.competenciaFim)) erros.competenciaFim = 'Mês final inválido.';
    else if (input.competenciaInicio && input.competenciaFim < input.competenciaInicio) {
      erros.competenciaFim = 'O mês final não pode ser antes do mês inicial.';
    }
  }

  if (input.diaVencimento === null || !Number.isInteger(input.diaVencimento)) {
    erros.diaVencimento = 'Informe o dia do vencimento.';
  } else if (input.diaVencimento < 1 || input.diaVencimento > 31) {
    erros.diaVencimento = 'O dia do vencimento vai de 1 a 31.';
  }

  if (!input.autorizadoPor) erros.autorizadoPor = 'Informe quem autorizou.';
  if (input.autorizadoEm && input.autorizadoEm > hoje) erros.autorizadoEm = 'A data da autorização não pode ser futura.';

  if (input.quantidade !== null && (!Number.isInteger(input.quantidade) || input.quantidade <= 0)) {
    erros.quantidade = 'A quantidade precisa ser um número inteiro maior que zero.';
  }
  if (input.moedaOriginal && !/^[A-Z]{3}$/.test(input.moedaOriginal)) {
    erros.moedaOriginal = 'Use o código de 3 letras (ex.: USD).';
  }
  if (input.valorOriginal !== null && (!Number.isFinite(input.valorOriginal) || input.valorOriginal <= 0)) {
    erros.valorOriginal = 'O valor original precisa ser maior que zero.';
  }
  if (input.valorOriginal !== null && !input.moedaOriginal) erros.moedaOriginal = 'Informe a moeda do valor original.';

  if (input.avisoRenovacaoDias === null || !Number.isInteger(input.avisoRenovacaoDias)) {
    erros.avisoRenovacaoDias = 'Informe a antecedência do aviso em dias.';
  } else if (input.avisoRenovacaoDias < 0 || input.avisoRenovacaoDias > 365) {
    erros.avisoRenovacaoDias = 'A antecedência vai de 0 a 365 dias.';
  }

  return erros;
}
