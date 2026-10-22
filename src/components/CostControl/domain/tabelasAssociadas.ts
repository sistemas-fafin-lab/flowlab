import type { Payor, TabelaAssociada } from '../../../hooks/useCostControl';
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

/** A fonte gravada numa tabela nova: a grafia já cadastrada nas tabelas da
 *  fonte, se houver — a digitada pode diferir só em maiúsculas/espaços. */
export function fonteDaNovaTabela(daFonte: TabelaAssociada[], fontePagadora: string): string {
  return daFonte[0]?.fontePagadora ?? fontePagadora.trim();
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

/** Por que o nome não serve para uma tabela da fonte (nova ou renomeada) — ou null se serve.
 *  Repetido = mesmo nome sem diferenciar maiúsculas nem espaços nas pontas
 *  (spec), contando as inativas: é o que impede nascer um "PART" ao lado de
 *  "Part". Ao renomear, `renomeandoId` é a própria tabela, que não conta. */
export function erroNomeTabela(
  nome: string,
  daFonte: TabelaAssociada[],
  renomeandoId: string | null = null
): string | null {
  const chave = nome.trim().toLowerCase();
  if (!chave) return 'Informe o nome da tabela.';
  const existente = daFonte.find(t => t.id !== renomeandoId && t.nome.trim().toLowerCase() === chave);
  if (!existente) return null;
  return `Já existe a tabela "${existente.nome}" nesta fonte pagadora${existente.ativa ? '' : ' (inativa)'}.`;
}

// Mesmos critérios do backend do orçamento (api/_lib/orcamentoParticular.ts):
// fonte "Particular" exata e tabela "particular" sem diferenciar maiúsculas.
const FONTE_PARTICULAR = 'Particular';
const TABELA_PARTICULAR = 'particular';

/** A Tabela Particular, de que o gerador de orçamento depende pelo nome: não
 *  pode ser renomeada, desativada nem excluída (ticket 03). Enquanto a
 *  unificação não roda, "PARTICULAR" também alimenta o orçamento — por isso
 *  também é protegida; depois da contração (ticket 07) o banco só aceita um
 *  nome "particular" na fonte. O banco aplica a mesma regra. */
export function tabelaProtegida(tabela: TabelaAssociada): boolean {
  return tabela.fontePagadora === FONTE_PARTICULAR && tabela.nome.trim().toLowerCase() === TABELA_PARTICULAR;
}

/** Quantas linhas de preço cada tabela tem (por id). Excluir só é permitido
 *  sem linhas — o banco garante pela FK restritiva; a tela usa a contagem
 *  para explicar antes de tentar. */
export function contarLinhasPorTabela(payors: Payor[]): Map<string, number> {
  const contagem = new Map<string, number>();
  payors.forEach(p => contagem.set(p.tabelaId, (contagem.get(p.tabelaId) ?? 0) + 1));
  return contagem;
}
