// Exportação para Excel (RF16): lista de despesas no formato do modelo de
// importação (dá para reimportar) e o Mês a mês da competência. Só monta as
// matrizes; quem escreve o .xlsx é o componente.

import { FORMA_PAGAMENTO_ROTULO, NATUREZA_ROTULO, RECORRENCIA_ROTULO, SITUACAO_OCORRENCIA, TIPO_VALOR_ROTULO } from '../constants';
import { formatarCompetencia, partesCompetencia } from './competencia';
import type { LinhaDespesa } from './listaDespesas';
import { CABECALHOS_MODELO } from './modeloImportacao';
import type { OcorrenciaDoMes } from './situacao';

type Celula = string | number;

/** 'YYYY-MM-01' → '10/2026' (formato que o importador lê). */
const mesAno = (c: string | null): string => {
  if (!c) return '';
  const { ano, mes } = partesCompetencia(c);
  return `${String(mes).padStart(2, '0')}/${ano}`;
};

/** 'YYYY-MM-DD' → 'dd/mm/aaaa'. */
const dataBR = (iso: string | null): string => {
  if (!iso) return '';
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
};

const ouVazio = (v: string | number | null | undefined): Celula => (v === null || v === undefined ? '' : v);

/**
 * Despesas nas 24 colunas do modelo, valores como número. O valor exportado é
 * o valor base (o mesmo que a importação grava); reajustes não viajam na
 * planilha — ficam só no sistema.
 */
export function linhasExportacaoDespesas(
  linhas: readonly LinhaDespesa[],
  nomeCategoria: (id: string) => string,
  cnpjFornecedor: (id: string) => string | null,
): Celula[][] {
  return [
    CABECALHOS_MODELO,
    ...linhas.map(({ despesa: d }) => [
      d.descricao,
      nomeCategoria(d.categoriaId),
      d.fornecedorNome,
      ouVazio(d.fornecedorId ? cnpjFornecedor(d.fornecedorId) : null),
      d.valorBase,
      TIPO_VALOR_ROTULO[d.tipoValor],
      RECORRENCIA_ROTULO[d.recorrencia],
      mesAno(d.competenciaInicio),
      mesAno(d.competenciaFim),
      d.diaVencimento,
      FORMA_PAGAMENTO_ROTULO[d.formaPagamento],
      ouVazio(d.meioPagamentoDetalhe),
      d.autorizadoPor,
      dataBR(d.autorizadoEm),
      ouVazio(d.setor),
      NATUREZA_ROTULO[d.natureza],
      ouVazio(d.quantidade),
      ouVazio(d.unidade),
      ouVazio(d.numeroContrato),
      d.renovacaoAutomatica ? 'Sim' : 'Não',
      d.avisoRenovacaoDias,
      ouVazio(d.moedaOriginal),
      ouVazio(d.valorOriginal),
      ouVazio(d.observacoes),
    ]),
  ];
}

export const CABECALHOS_MES = [
  'Competência',
  'Despesa',
  'Categoria',
  'Fornecedor',
  'Vencimento',
  'Previsto (calculado)',
  'Previsto (com ajuste)',
  'Pago',
  'Pago em',
  'Situação',
  'Forma de pagamento',
  'Nota fiscal',
  'Motivo da dispensa',
  'Observação',
];

/** Mês a mês da competência, uma linha por cobrança, valores como número. */
export function linhasExportacaoMes(ocorrencias: readonly OcorrenciaDoMes[], nomeCategoria: (id: string) => string): Celula[][] {
  return [
    CABECALHOS_MES,
    ...ocorrencias.map((o) => [
      formatarCompetencia(o.competencia),
      o.despesa.descricao,
      nomeCategoria(o.despesa.categoriaId),
      o.despesa.fornecedorNome,
      dataBR(o.vencimento),
      o.previstoOriginal,
      o.valorPrevisto,
      ouVazio(o.lancamento?.valorPago),
      dataBR(o.lancamento?.pagoEm ?? null),
      SITUACAO_OCORRENCIA[o.situacao].rotulo,
      FORMA_PAGAMENTO_ROTULO[o.formaPagamento],
      ouVazio(o.lancamento?.notaFiscal),
      ouVazio(o.lancamento?.motivoDispensa),
      ouVazio(o.lancamento?.observacao),
    ]),
  ];
}
