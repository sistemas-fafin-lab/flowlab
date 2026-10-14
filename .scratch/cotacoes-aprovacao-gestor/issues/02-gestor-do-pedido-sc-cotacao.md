# 02 — Gestor do pedido na SC e na cotação

**What to build:** o sistema passa a saber quem é o gestor do pedido de cada
cotação, ainda sem mudar o fluxo de aprovação. Toda SC nova grava o id do
usuário que a criou (`requests.requested_by_user_id`, além do nome que já é
gravado). A cotação ganha o campo "Gestor do pedido"
(`quotations.requester_manager_id`). Ao enviar para aprovação, o comprador
vê o campo já preenchido — com quem criou a SC (Compras) ou com o
solicitante da manutenção (Contratação), quando existirem — e pode trocar
para qualquer usuário ativo. Sem gestor preenchido, o envio é bloqueado. O
envio continua indo para "Aguardando aprovação" como hoje (a etapa do
gestor entra no ticket 03).

Ver spec: `.scratch/cotacoes-aprovacao-gestor/spec.md` (Implementation
Decisions — Schema e Pré-preenchimento do gestor do pedido).

**Blocked by:** None — can start immediately.

**Status:** done

- [x] Migration adiciona `requests.requested_by_user_id` (uuid, FK `user_profiles`, nullable) e `quotations.requester_manager_id` (uuid, FK `user_profiles`, nullable). Sem backfill de SCs antigas.
- [x] Criar uma SC grava `requested_by_user_id` com o usuário logado.
- [x] Ao enviar uma cotação de Compras vinculada a uma SC nova, o campo "Gestor do pedido" vem preenchido com quem criou a SC.
- [x] Ao enviar uma cotação de Contratação, o campo vem preenchido com o solicitante da manutenção.
- [x] SC antiga (sem `requested_by_user_id`) ou cotação sem vínculo → campo vazio, comprador escolhe manualmente.
- [x] Envio para aprovação sem gestor preenchido é bloqueado com mensagem clara.
- [x] O gestor escolhido é persistido na cotação e exibido no detalhe da cotação.
- [x] O fluxo de aprovação atual (status, e-mail de alçada, decisão) não muda neste ticket.
