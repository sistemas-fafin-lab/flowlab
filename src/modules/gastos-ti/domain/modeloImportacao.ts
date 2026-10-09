// Conteúdo do modelo de importação (plano §7.1) e do relatório de linhas que
// ficaram de fora. Só monta as matrizes (linhas × colunas); quem escreve o
// .xlsx é o componente, com a biblioteca xlsx.

import { FORMAS_PAGAMENTO, NATUREZAS, RECORRENCIAS, TIPOS_VALOR } from '../constants';
import { COLUNAS_MODELO, type LinhaImportada } from './importacao';

export const NOME_ARQUIVO_MODELO = 'modelo_importacao_gastos_ti.xlsx';
export const ABA_DESPESAS = 'Despesas';

export const CABECALHOS_MODELO = COLUNAS_MODELO.map((c) => c.cabecalho);

/**
 * Três despesas completas: assinatura mensal com licenças, cloud variável em
 * dólar e notebook parcelado em 10×. Ficam na aba Instruções, nunca na aba
 * Despesas, para não serem importadas por engano.
 */
export const EXEMPLOS_MODELO: (string | number)[][] = [
  ['Microsoft 365 Business Standard', 'SaaS e Assinaturas', 'Microsoft', '04.712.500/0001-07', '2.480,00', 'Fixo', 'Mensal', '10/2026', '', 10, 'Cartão corporativo', 'cartão final 1234', 'Diretoria', '01/09/2026', 'TI', 'OPEX', 40, 'licenças', 'CT-2026-01', 'Sim', 30, '', '', ''],
  ['AWS — conta de produção', 'Cloud e Hospedagem', 'Amazon Web Services', '', '3.200,00', 'Variável', 'Mensal', '10/2026', '', 5, 'Cartão corporativo', '', 'Gerência de TI', '', 'TI', 'OPEX', '', '', '', 'Não', '', 'USD', '600,00', 'Valor varia com o uso'],
  ['Notebook Dell Latitude (10x)', 'Hardware e Equipamentos', 'Dell', '', '650,00', 'Fixo', 'Mensal', '10/2026', '07/2027', 15, 'Boleto', '', 'Diretoria', '', 'TI', 'CAPEX', 1, 'notebook', '', 'Não', '', '', '', 'Parcelado em 10x'],
];

export function abaInstrucoes(): (string | number)[][] {
  return [
    ['Como preencher a aba Despesas'],
    ['Uma linha por despesa. Só a aba Despesas é lida na importação. Os valores aceitos de cada coluna estão na aba Listas.'],
    [],
    ['Coluna', 'Obrigatória', 'Formato aceito', 'Se vier vazia'],
    ...COLUNAS_MODELO.map((c) => [c.cabecalho, c.obrigatoria ? 'Sim' : 'Não', c.formato, c.seVazia]),
    [],
    ['Exemplos (copie para a aba Despesas, se quiser usá-los)'],
    CABECALHOS_MODELO,
    ...EXEMPLOS_MODELO,
  ];
}

/** Uma coluna por lista de valores aceitos; categorias e setores vêm do sistema no momento do download. */
export function abaListas(categoriasAtivas: readonly string[], setores: readonly string[]): string[][] {
  const colunas: [string, string[]][] = [
    ['Categorias', [...categoriasAtivas]],
    ['Recorrência', RECORRENCIAS.map((r) => r.rotulo)],
    ['Forma de pagamento', FORMAS_PAGAMENTO.map((f) => f.rotulo)],
    ['Tipo de valor', TIPOS_VALOR.map((t) => t.rotulo)],
    ['Natureza', NATUREZAS.map((n) => n.rotulo)],
    ['Setor', [...setores]],
    ['Renovação automática', ['Sim', 'Não']],
  ];
  const altura = Math.max(...colunas.map(([, valores]) => valores.length));
  return [
    colunas.map(([titulo]) => titulo),
    ...Array.from({ length: altura }, (_, i) => colunas.map(([, valores]) => valores[i] ?? '')),
  ];
}

/** Linhas que não entraram: com erro, ou desmarcadas na pré-visualização. */
export function abaRelatorio(linhas: readonly LinhaImportada[], selecionadas: ReadonlySet<number>): (string | number)[][] {
  return [
    ['Linha', 'Descrição', 'Situação', 'Motivo'],
    ...linhas
      .filter((l) => l.despesa === null || !selecionadas.has(l.numero))
      .map((l) => [
        l.numero,
        l.resumo.descricao,
        l.despesa === null ? 'Erro' : 'Não importada (desmarcada)',
        (l.despesa === null ? l.erros : l.avisos).join(' · ') || '—',
      ]),
  ];
}
