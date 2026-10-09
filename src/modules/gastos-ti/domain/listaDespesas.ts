// Linhas da aba Despesas: valores derivados, filtros, ordenação e totais (RF05).

import { competenciaDaData } from './competencia';
import {
  equivalenteMensal,
  proximaOcorrencia,
  quantidadeVigente,
  situacaoDespesa,
  valorVigente,
  type OcorrenciaPrevista,
  type SituacaoDespesa,
} from './recorrencia';
import type { Despesa, FormaPagamento, Recorrencia } from '../types';

export interface LinhaDespesa {
  despesa: Despesa;
  valorVigente: number;
  quantidadeVigente: number | null;
  equivalenteMensal: number | null;
  proxima: OcorrenciaPrevista | null;
  situacao: SituacaoDespesa;
}

export function montarLinhas(despesas: readonly Despesa[], hoje: string): LinhaDespesa[] {
  const atual = competenciaDaData(hoje) as string;
  return despesas.map((despesa) => ({
    despesa,
    valorVigente: valorVigente(despesa, atual),
    quantidadeVigente: quantidadeVigente(despesa.quantidade, despesa.reajustes, atual),
    equivalenteMensal: equivalenteMensal(despesa, atual),
    proxima: proximaOcorrencia(despesa, hoje),
    situacao: situacaoDespesa(despesa, atual),
  }));
}

export interface FiltrosDespesas {
  busca: string;
  categoriaId: string;
  situacao: SituacaoDespesa | '';
  recorrencia: Recorrencia | '';
  formaPagamento: FormaPagamento | '';
  setor: string;
  fornecedor: string;
  autorizadoPor: string;
}

export const FILTROS_VAZIOS: FiltrosDespesas = {
  busca: '',
  categoriaId: '',
  situacao: '',
  recorrencia: '',
  formaPagamento: '',
  setor: '',
  fornecedor: '',
  autorizadoPor: '',
};

/** Minúsculas, sem acento e sem espaços repetidos — para busca e comparação de nomes. */
export function chaveTexto(texto: string | null | undefined): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function filtrarLinhas(linhas: readonly LinhaDespesa[], filtros: FiltrosDespesas): LinhaDespesa[] {
  const termo = chaveTexto(filtros.busca);
  return linhas.filter(({ despesa: d, situacao }) => {
    if (filtros.categoriaId && d.categoriaId !== filtros.categoriaId) return false;
    if (filtros.situacao && situacao !== filtros.situacao) return false;
    if (filtros.recorrencia && d.recorrencia !== filtros.recorrencia) return false;
    if (filtros.formaPagamento && d.formaPagamento !== filtros.formaPagamento) return false;
    if (filtros.setor && d.setor !== filtros.setor) return false;
    if (filtros.fornecedor && chaveTexto(d.fornecedorNome) !== chaveTexto(filtros.fornecedor)) return false;
    if (filtros.autorizadoPor && chaveTexto(d.autorizadoPor) !== chaveTexto(filtros.autorizadoPor)) return false;
    if (!termo) return true;
    return [d.descricao, d.fornecedorNome, d.numeroContrato, d.autorizadoPor].some((campo) =>
      chaveTexto(campo).includes(termo),
    );
  });
}

export type ColunaOrdenacao = 'descricao' | 'categoria' | 'fornecedor' | 'valor' | 'equivalente' | 'proxima';
export type DirecaoOrdenacao = 'asc' | 'desc';

/**
 * Ordena sem mexer no array recebido. Vazios (despesa única sem equivalente
 * mensal, despesa sem próxima ocorrência) vão sempre para o fim, nas duas
 * direções — senão "maior primeiro" começaria pelos traços.
 */
export function ordenarLinhas(
  linhas: readonly LinhaDespesa[],
  coluna: ColunaOrdenacao,
  direcao: DirecaoOrdenacao,
  nomeCategoria: (id: string) => string,
): LinhaDespesa[] {
  const chave = (l: LinhaDespesa): string | number | null => {
    switch (coluna) {
      case 'descricao':
        return chaveTexto(l.despesa.descricao);
      case 'categoria':
        return chaveTexto(nomeCategoria(l.despesa.categoriaId));
      case 'fornecedor':
        return chaveTexto(l.despesa.fornecedorNome);
      case 'valor':
        return l.valorVigente;
      case 'equivalente':
        return l.equivalenteMensal;
      case 'proxima':
        return l.proxima?.vencimento ?? null;
    }
  };
  const sinal = direcao === 'asc' ? 1 : -1;
  return [...linhas].sort((a, b) => {
    const ka = chave(a);
    const kb = chave(b);
    if (ka === null && kb === null) return 0;
    if (ka === null) return 1;
    if (kb === null) return -1;
    const comparacao = typeof ka === 'number' && typeof kb === 'number' ? ka - kb : String(ka).localeCompare(String(kb), 'pt-BR');
    return comparacao * sinal || chaveTexto(a.despesa.descricao).localeCompare(chaveTexto(b.despesa.descricao), 'pt-BR');
  });
}

/** Custo recorrente mensal do recorte: equivalentes mensais das despesas ativas (RN06, sem a média das variáveis — essa entra com os lançamentos). */
export function custoRecorrenteMensal(linhas: readonly LinhaDespesa[]): number {
  return linhas.reduce((total, l) => (l.situacao === 'ativa' && l.equivalenteMensal ? total + l.equivalenteMensal : total), 0);
}

/**
 * Nomes distintos ignorando maiúsculas, acentos e espaços — mantém a primeira
 * grafia vista. Alimenta as sugestões de "autorizado por" (D3) e os filtros.
 */
export function nomesDistintos(nomes: readonly (string | null | undefined)[]): string[] {
  const vistos = new Map<string, string>();
  for (const nome of nomes) {
    const limpo = (nome ?? '').trim().replace(/\s+/g, ' ');
    if (limpo && !vistos.has(chaveTexto(limpo))) vistos.set(chaveTexto(limpo), limpo);
  }
  return [...vistos.values()].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
}
