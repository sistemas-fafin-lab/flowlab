# 01 — Prefactor: testes da máquina de estados e builders de propostas/itens compartilhados

**What to build:** preparar o terreno para a etapa do gestor sem mudar nada
visível para o usuário. A máquina de estados de cotações (transições
válidas, transições por ação, reversão e os predicados de permissão por
status) ganha testes que travam o comportamento **atual**, para que a
inclusão do status `awaiting_manager_approval` nos tickets seguintes seja
feita sobre uma base coberta. A montagem da lista de propostas (todas, com a
vencedora destacada, via a anotação de propostas existente) e da lista de
itens, hoje privada ao e-mail de submissão, passa a ser um builder
compartilhado e exportado no domínio de cotações, reaproveitável pelo e-mail
da etapa do gestor, pelo e-mail de rejeição e pelo resumo diário.

Ver spec: `.scratch/cotacoes-aprovacao-gestor/spec.md` (Testing Decisions —
seams 1 e 2).

**Blocked by:** None — can start immediately.

**Status:** done

- [x] Testes vitest da máquina de estados cobrindo, para o comportamento atual: transições válidas e inválidas, transições por ação, status anterior na reversão, status terminais e os predicados de submissão, aprovação/rejeição e troca de vencedora.
- [x] Builders de lista de propostas e de lista de itens extraídos para um ponto compartilhado do domínio de cotações, com escape de HTML preservado.
- [x] O e-mail de submissão (`quotation_awaiting_approval`) passa a usar os builders compartilhados e gera exatamente as mesmas variáveis de antes — testes existentes da notificação de submissão continuam passando sem alteração de expectativa.
- [x] Testes próprios dos builders: todas as propostas presentes (inclusive rejeitadas), vencedora marcada, escape de HTML no nome do fornecedor e do item.
