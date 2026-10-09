// Gasto avulso (RF14): cobrança fora da previsão, registrada direto no Mês a
// mês. Vira uma despesa de recorrência única na competência aberta.

import { competenciaDaData, formatarCompetencia } from './competencia';
import { normalizarDespesa } from './validacaoDespesa';
import type { DespesaInput, FormaPagamento, NaturezaGasto } from '../types';

export interface GastoAvulsoInput {
  descricao: string;
  categoriaId: string;
  natureza: NaturezaGasto;
  fornecedorId: string | null;
  fornecedorNome: string;
  valor: number | null;
  /** 'YYYY-MM-DD', dentro da competência. */
  vencimento: string;
  formaPagamento: FormaPagamento;
  autorizadoPor: string;
  autorizadoEm: string | null;
  observacoes: string | null;
}

/** O vencimento define o dia da despesa única, então precisa cair no mês aberto. */
export function validarVencimentoNoMes(vencimento: string, competencia: string): string | null {
  if (!vencimento) return 'Informe o vencimento.';
  if (competenciaDaData(vencimento) !== competencia) return `O vencimento precisa ser em ${formatarCompetencia(competencia)}.`;
  return null;
}

/** Despesa única na competência, já normalizada para validarDespesa e para gravar. */
export function despesaDoAvulso(input: GastoAvulsoInput, competencia: string): DespesaInput {
  return normalizarDespesa({
    descricao: input.descricao,
    categoriaId: input.categoriaId,
    natureza: input.natureza,
    quantidade: null,
    unidade: null,
    fornecedorId: input.fornecedorId,
    fornecedorNome: input.fornecedorNome,
    setor: null,
    responsavelId: null,
    tipoValor: 'fixo',
    valorBase: input.valor,
    recorrencia: 'unica',
    competenciaInicio: competencia,
    competenciaFim: null,
    diaVencimento: input.vencimento ? Number(input.vencimento.slice(8, 10)) : null,
    formaPagamento: input.formaPagamento,
    meioPagamentoDetalhe: null,
    moedaOriginal: null,
    valorOriginal: null,
    numeroContrato: null,
    renovacaoAutomatica: false,
    avisoRenovacaoDias: 30,
    autorizadoPor: input.autorizadoPor,
    autorizadoEm: input.autorizadoEm,
    observacoes: input.observacoes,
  });
}
