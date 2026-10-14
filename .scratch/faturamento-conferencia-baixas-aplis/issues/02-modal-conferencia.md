# 02 — Modal "Conferir baixas com o apLIS"

**What to build:** o botão no cabeçalho da página Contas a Receber e o modal
que lista as divergências da rota da 01. Ver `../spec.md` — seção "Frontend".

**Blocked by:** 01

**Status:** done (não testado no navegador)

- [x] Botão "Conferir baixas com o apLIS" ao lado de "Atualizar do apLIS",
      visível com `canViewBilling`, com o aviso "dados do apLIS até ontem"
- [x] Modal no padrão do `AtualizarAplisModal`: seções por tipo com contagem e
      total da diferença; colunas título, operadora, emissão, lotes (com status
      no apLIS), recebido no sistema, glosado, recebido no apLIS, diferença,
      último recebimento no apLIS
- [x] Ação "Abrir título" em cada linha, abrindo o `EditarTituloModal`; ao
      fechar depois de salvar, a conferência é refeita
- [x] Exportar a lista em CSV (`;`, UTF-8 com BOM, valores em pt-BR)
- [x] Estado vazio ("nenhuma divergência"), carregando e erro da réplica
- [x] Segue a identidade visual do Flow LAB (skill `flowlab-identity`)

## Comments

- 14/10 — implementado (`ConferenciaAplisModal.tsx`, `utils/conferenciaAplis.ts`
  com teste vitest, `buscarTitulo` no `useContasReceber`). Decisões além da issue:
  - o `EditarTituloModal` só corrige lançamentos existentes — não lança baixa
    nova. Por isso cada linha tem também **"Lançar baixa"** (abre o
    `BaixaModal`); salvar em qualquer um dos dois refaz a conferência;
  - as ações da linha só aparecem com `canManageBilling` (os dois modais
    escrevem; mesmo critério do "Editar" da lista). A conferência em si e o
    aviso "dados do apLIS até ontem" ficam visíveis com `canViewBilling`;
  - seção extra `lote-ausente` (vem da rota da 01), cards-resumo por tipo no
    topo, botão "Refazer" e, na coluna do último recebimento, "desde DD/MM"
    quando o primeiro recebimento é de outro dia;
  - totais na tela em valor absoluto (o tipo diz o sentido); no CSV a
    diferença vai com sinal (apLIS − sistema).
  - Não testado no navegador: depende de login e da réplica do apLIS.
