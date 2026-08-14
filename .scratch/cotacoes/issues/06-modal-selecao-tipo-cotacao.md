# Modal de seleção de tipo: Contratação ou Compras

Status: ready-for-agent

Blocked by: 05

## Onde

- Referência de padrão visual: `src/components/RequestManagement.tsx`,
  modal de seleção SC/SM (linhas ~1370-1439: diálogo centralizado com
  cards, `handleTypeSelection`).
- Novo componente, ex.
  `src/modules/quotations/components/QuotationTypeSelectionModal.tsx`.
- Ponto de entrada de "Nova Cotação" em
  `src/modules/quotations/components/QuotationManagementPage.tsx` (onde
  hoje `CreateQuotationModal` é aberto direto).

## O que fazer

Antes de abrir o `CreateQuotationModal`, mostrar um modal pedindo ao
usuário para escolher o tipo de cotação: **Contratação** ou **Compras**.
Mesmo padrão visual do modal de tipo SC/SM já existente em
`RequestManagement.tsx` — diálogo centralizado, cards com cor/ícone e
descrição curta de cada opção.

A escolha define:
- O valor de `quotationType` passado para `CreateQuotationModal` (que
  agora precisa aceitar essa prop e gravar em `quotation_type`, ver
  `05-schema-quotations-dual-type`).
- Qual fonte de import fica disponível na etapa de Itens:
  - Compras → import de `requests` (SC/SM), fluxo atual.
  - Contratação → import de `maintenance_requests` (ver
    `07-import-contratacao-manutencao`).

## Critérios de aceite

- Clicar em "Nova Cotação" abre o modal de seleção de tipo antes de
  qualquer outra coisa.
- Escolher "Compras" abre o `CreateQuotationModal` com o comportamento
  atual, sem regressão.
- Escolher "Contratação" abre o `CreateQuotationModal` com
  `quotationType = 'contratacao'` (a etapa de import de manutenção em si é
  entregue no ticket 07 — aqui só precisa propagar o tipo corretamente).
