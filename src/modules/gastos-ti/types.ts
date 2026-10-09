// Tipos do módulo Gastos de TI (plano: docs/plans/gastos-ti/PLANO_GASTOS_TI.md §1 e §4)

/** OPEX = custeio recorrente; CAPEX = investimento (ativo comprado). */
export type NaturezaGasto = 'opex' | 'capex';

export interface CategoriaTI {
  id: string;
  nome: string;
  descricao: string | null;
  naturezaPadrao: NaturezaGasto;
  /** Posição na lista; define a cor nos gráficos (domain/coresCategorias). */
  ordem: number;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CategoriaTIInput {
  nome: string;
  descricao: string | null;
  naturezaPadrao: NaturezaGasto;
}

export type Recorrencia = 'unica' | 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual';

/** fixo = valor contratado; variavel = estimativa (cloud, telefonia, consumo de IA). */
export type TipoValor = 'fixo' | 'variavel';

export type FormaPagamento =
  | 'pix'
  | 'boleto'
  | 'cartao_corporativo'
  | 'debito_automatico'
  | 'transferencia'
  | 'outro';

/** Arquivo no bucket privado ti-gastos-anexos (jsonb `anexos`). */
export interface Anexo {
  path: string;
  nome: string;
  tamanho: number;
  tipo: string;
  enviadoEm: string;
}

export type MotivoReajuste = 'reajuste_contratual' | 'renegociacao' | 'mudanca_quantidade' | 'outro';

/** Mudança de valor (e talvez de quantidade) a partir de uma competência (ti_despesa_reajustes, RF03). */
export interface Reajuste {
  id: string;
  vigenteDesde: string;
  valor: number;
  motivo: MotivoReajuste;
  /** Nova quantidade a partir de vigenteDesde; null = não mudou. */
  quantidade: number | null;
  observacao: string | null;
  createdAt: string;
}

export interface ReajusteInput {
  vigenteDesde: string | null;
  valor: number | null;
  motivo: MotivoReajuste;
  quantidade: number | null;
  observacao: string | null;
}

/** Competências são sempre 'YYYY-MM-01' (texto, nunca Date — RNF07). */
export interface Despesa {
  id: string;
  descricao: string;
  categoriaId: string;
  natureza: NaturezaGasto;
  quantidade: number | null;
  unidade: string | null;
  fornecedorId: string | null;
  fornecedorNome: string;
  setor: string | null;
  responsavelId: string | null;
  responsavelNome: string | null;
  tipoValor: TipoValor;
  valorBase: number;
  recorrencia: Recorrencia;
  competenciaInicio: string;
  competenciaFim: string | null;
  diaVencimento: number;
  formaPagamento: FormaPagamento;
  meioPagamentoDetalhe: string | null;
  moedaOriginal: string | null;
  valorOriginal: number | null;
  numeroContrato: string | null;
  renovacaoAutomatica: boolean;
  avisoRenovacaoDias: number;
  autorizadoPor: string;
  autorizadoEm: string | null;
  observacoes: string | null;
  anexos: Anexo[];
  reajustes: Reajuste[];
  createdAt: string;
  updatedAt: string;
}

/** Orçamento anual de uma categoria (ti_orcamentos, RF23). Dividido igualmente pelos 12 meses (RN13). */
export interface Orcamento {
  id: string;
  ano: number;
  categoriaId: string;
  valorAnual: number;
  observacao: string | null;
}

/** previsto = ocorrência ajustada e ainda não paga (issue 07); pago; dispensado (não houve cobrança). */
export type StatusLancamento = 'previsto' | 'pago' | 'dispensado';

/** Uma ocorrência que alguém tocou (ti_lancamentos, RN15). Ocorrência sem lançamento é previsão pura. */
export interface Lancamento {
  id: string;
  despesaId: string;
  competencia: string;
  status: StatusLancamento;
  /** Previsto do mês já com o ajuste (o original sai da despesa + reajustes). */
  valorPrevisto: number;
  vencimento: string;
  formaPagamento: FormaPagamento;
  valorPago: number | null;
  pagoEm: string | null;
  notaFiscal: string | null;
  motivoDispensa: string | null;
  observacao: string | null;
  anexos: Anexo[];
  createdAt: string;
  updatedAt: string;
}

export interface BaixaInput {
  valorPago: number | null;
  /** 'YYYY-MM-DD' */
  pagoEm: string | null;
  formaPagamento: FormaPagamento;
  notaFiscal: string | null;
  observacao: string | null;
}

/** O que o formulário entrega para gravar (já normalizado por domain/validacaoDespesa). */
export interface DespesaInput {
  descricao: string;
  categoriaId: string;
  natureza: NaturezaGasto;
  quantidade: number | null;
  unidade: string | null;
  fornecedorId: string | null;
  fornecedorNome: string;
  setor: string | null;
  responsavelId: string | null;
  tipoValor: TipoValor;
  valorBase: number | null;
  recorrencia: Recorrencia;
  competenciaInicio: string | null;
  competenciaFim: string | null;
  diaVencimento: number | null;
  formaPagamento: FormaPagamento;
  meioPagamentoDetalhe: string | null;
  moedaOriginal: string | null;
  valorOriginal: number | null;
  numeroContrato: string | null;
  renovacaoAutomatica: boolean;
  avisoRenovacaoDias: number | null;
  autorizadoPor: string;
  autorizadoEm: string | null;
  observacoes: string | null;
}
