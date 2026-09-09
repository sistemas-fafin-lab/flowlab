# 05 — Fontes Pagadoras: ordenação por coluna nas tabelas de resultado

**What to build:** as duas variantes da tabela de resultado (fontes
pagadoras de um exame, e exames de uma fonte pagadora — ticket 04) passam
a permitir ordenação clicável em qualquer coluna.

Contexto: resultado de sessão de grilling com o usuário em 2026-09-08. O
projeto já tem um componente de tabela genérico com esse padrão de
ordenação (`src/modules/qualidade/components/ui/TabelaExpansivel.tsx`),
mas o usuário optou por **não** reaproveitá-lo inteiro (traz filtro por
coluna e modal de expandir, que não foram pedidos) — construir uma versão
enxuta com o mesmo visual de ordenação (ícones ArrowUp/ArrowDown/
ArrowUpDown do lucide-react), sem os recursos extras.

- Clicar no cabeçalho de qualquer coluna (nas duas tabelas) cicla o estado
  de ordenação daquela coluna: crescente → decrescente → sem ordenação
  (volta pro padrão).
- Ícone no cabeçalho reflete o estado atual da coluna (seta pra cima,
  seta pra baixo, ou ícone neutro de "sem ordenação").
- Colunas de texto (Fonte Pagadora, Exame, Tabela Associada, TUSS) ordenam
  alfabeticamente; coluna de valor (Valor Cobrado) ordena numericamente.
- Ordenação inicial padrão, antes de qualquer clique, continua sendo Valor
  Cobrado crescente — igual ao comportamento atual — nas duas tabelas.
- Ordenar por uma coluna não afeta a seleção atual (exame ou fonte
  pagadora buscados continuam os mesmos, só a ordem das linhas muda).

**Blocked by:** 04 — precisa das duas tabelas de resultado já existindo.

**Status:** done

- [x] Clicar no cabeçalho de qualquer coluna, nas duas tabelas, ordena as
      linhas por aquela coluna
- [x] Clicar de novo no mesmo cabeçalho inverte a ordem (crescente ↔
      decrescente)
- [x] Um terceiro clique no mesmo cabeçalho remove a ordenação
      customizada, voltando ao padrão (Valor Cobrado crescente)
- [x] Ícone do cabeçalho reflete visualmente o estado de ordenação da
      coluna (crescente/decrescente/nenhum)
- [x] Colunas de texto ordenam alfabeticamente; coluna de valor ordena
      numericamente
- [x] Ao trocar a seleção (novo exame/fonte pagadora buscado), a
      ordenação volta ao padrão (Valor Cobrado crescente)
- [x] Nenhum filtro por coluna nem modal de expandir foi adicionado — só o
      controle de ordenação

## Comments

Implementação: lógica pura de ordenação extraída pra
`src/components/CostControl/domain/ordenacao.ts` (`alternarOrdenacao` +
`ordenar`, testados em `ordenacao.test.ts`). `PayorsScreen.tsx` ganhou
`CabecalhoOrdenavel` (ícones ArrowUp/ArrowDown/ArrowUpDown do
lucide-react) e extraiu as duas tabelas de resultado em
`TabelaFontesPagadoras`/`TabelaExamesDaFonte`, cada uma com seu próprio
estado de ordenação — resetado automaticamente ao trocar de seleção via
`key` (TUSS do exame / nome da fonte pagadora), sem precisar de
`useEffect`.

Revisão de código (single-list, via skill `code-review`) não achou
problemas introduzidos por esta mudança; um achado de segurança de tipos
no mapeamento coluna→valor foi corrigido trocando o if/else por
`Record<ColunaX, ...>` tipado. Achados fora do escopo desta issue
(bug pré-existente em `busca.ts` sobre TUSS duplicado, e mudanças
não relacionadas em `bdLab.ts`) foram deixados de fora — não fazem parte
deste ticket.
