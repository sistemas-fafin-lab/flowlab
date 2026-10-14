# 07 — E-mail de rejeição para o comprador

**What to build:** quando o gestor do pedido rejeita uma cotação, o
comprador (quem criou a cotação) recebe um e-mail (template novo
`quotation_manager_rejected`) dizendo que ela voltou para "Em análise", com
código, título, quem rejeitou, o comentário da rejeição e um link para a
lista de cotações. A aprovação pelo gestor não gera aviso ao comprador.
Envio em melhor esforço — falha no e-mail nunca desfaz a rejeição.

Ver spec: `.scratch/cotacoes-aprovacao-gestor/spec.md` (Implementation
Decisions — E-mails/`quotation_manager_rejected`).

**Blocked by:** 01 — Prefactor: testes da máquina de estados e builders de propostas/itens compartilhados; 03 — Etapa do gestor: caminho principal.

**Status:** done

- [x] Migration cria o template `quotation_manager_rejected` em `email_notification_templates`.
- [x] Builder puro do e-mail de rejeição: destinatário é o criador da cotação; comentário e quem rejeitou presentes e escapados.
- [x] Rejeição na etapa do gestor (pelo gestor ou por admin no lugar dele) dispara o e-mail ao comprador.
- [x] Aprovação do gestor não dispara e-mail ao comprador.
- [x] Comprador sem e-mail → nenhum envio; falha de envio não reverte a rejeição.
- [x] Testes do builder no padrão dos testes de notificação existentes.
