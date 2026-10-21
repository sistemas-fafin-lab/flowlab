import type { TabelaAssociada } from '../../../hooks/useCostControl';
import { normalizar } from './busca';

// ═══════════════════════════════════════════════════════════════════════════════
// Escolha da tabela associada (.scratch/controle-custos-tabela-associada,
// ticket 02): na importação e no modal de linha a tabela vem da lista de
// cadastros da fonte pagadora, com "+ Nova tabela" no próprio campo.
// ═══════════════════════════════════════════════════════════════════════════════

/** Tabelas cadastradas da fonte — ativas e inativas. Mesma noção de "a fonte"
 *  de examesPorFontePagadora (normalizada). Fonte vazia não tem tabelas. */
export function tabelasDaFonte(tabelas: TabelaAssociada[], fontePagadora: string): TabelaAssociada[] {
  const fonte = normalizar(fontePagadora);
  if (!fonte) return [];
  return tabelas.filter(t => normalizar(t.fontePagadora) === fonte);
}

/** A tabela escolhida, se for da fonte digitada — trocar a fonte depois de
 *  escolher deixa o campo sem tabela (null). */
export function tabelaEscolhidaDaFonte(
  tabelas: TabelaAssociada[],
  fontePagadora: string,
  tabelaId: string | null
): TabelaAssociada | null {
  if (!tabelaId) return null;
  return tabelasDaFonte(tabelas, fontePagadora).find(t => t.id === tabelaId) ?? null;
}

/** O que o campo de escolha oferece: as tabelas ativas da fonte, em ordem
 *  alfabética. Inativa some da lista, a não ser a já escolhida na linha em
 *  edição — senão abrir a linha a deixaria sem tabela. */
export function opcoesDeTabela(daFonte: TabelaAssociada[], selecionadaId: string | null): TabelaAssociada[] {
  return daFonte
    .filter(t => t.ativa || t.id === selecionadaId)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
}

/** Por que o nome não serve para uma tabela nova da fonte — ou null se serve.
 *  Repetido = mesmo nome sem diferenciar maiúsculas nem espaços nas pontas
 *  (spec), contando as inativas: é o que impede nascer um "PART" ao lado de
 *  "Part". */
export function erroNomeNovaTabela(nome: string, daFonte: TabelaAssociada[]): string | null {
  const chave = nome.trim().toLowerCase();
  if (!chave) return 'Informe o nome da tabela.';
  const existente = daFonte.find(t => t.nome.trim().toLowerCase() === chave);
  if (!existente) return null;
  return `Já existe a tabela "${existente.nome}" nesta fonte pagadora${existente.ativa ? '' : ' (inativa)'}.`;
}
