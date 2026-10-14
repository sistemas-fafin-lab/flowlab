# 05 — Tela "Minhas aprovações de cotação" e card na Home

**What to build:** o gestor do pedido consegue aprovar mesmo sem acesso ao
módulo de Cotações. Uma tela nova, "Minhas aprovações de cotação" (rota
dentro do módulo de Cotações, ex. `/quotations/aprovacoes`), aberta a
qualquer usuário logado — sem exigir `canManageQuotations` — lista só as
cotações em "Aprovação do gestor" em que o usuário logado é o gestor do
pedido, e abre o mesmo modal-resumo de aprovação da etapa do gestor. Na
Home, um card "Cotações aguardando sua aprovação (gestor)", separado do card
de aprovações por alçada, aparece só quando o usuário tem ao menos uma
pendente e leva para essa tela. O caminho da tela entra no contrato de URL
do módulo de cotações.

Ver spec: `.scratch/cotacoes-aprovacao-gestor/spec.md` (Implementation
Decisions — Tela "Minhas aprovações de cotação", Card na Home, Contrato de
URL).

**Blocked by:** 03 — Etapa do gestor: caminho principal.

**Status:** done

- [x] Rota nova protegida só por login; usuário sem `canManageQuotations` consegue abri-la.
- [x] Lista apenas cotações `awaiting_manager_approval` com `requester_manager_id` = usuário logado; nenhuma outra cotação é exibida.
- [x] Cada item abre o modal-resumo de aprovação (todas as propostas, troca de vencedora, assinatura, rejeição com comentário) e a lista se atualiza após a decisão.
- [x] Estado vazio quando não há pendências.
- [x] Contrato de URL do módulo de cotações expõe o caminho da tela (com teste, no padrão do contrato existente).
- [x] Card na Home com a contagem das pendências do gestor, visível só quando > 0, linkando para a tela; o card de aprovações por alçada continua como está.
- [x] Validação manual com um usuário gestor sem permissão de Cotações. — Validado em 07–08/10 com o Gestor A (sem permissão de Cotações): card na Home com contagem, tela só com as cotações dele, /quotations negado. Corrigido no caminho (b06d055): o modal virava ação de alçada depois da decisão do gestor; agora fica só leitura.
