# 06 — E-mail da etapa do gestor e troca de gestor na etapa 1

**What to build:** o gestor do pedido é avisado por e-mail assim que uma
cotação entra na etapa dele. O e-mail (template novo
`quotation_awaiting_manager_approval`) traz o mesmo conteúdo do e-mail de
alçada — código, título, tipo, comprador, valor, itens e todas as propostas
com a vencedora destacada — e um botão para a tela "Minhas aprovações de
cotação". Além disso, o comprador pode trocar o gestor do pedido de uma
cotação já parada em "Aprovação do gestor": a troca fica registrada na
auditoria e o e-mail é enviado ao novo gestor. Envio em melhor esforço —
falha no e-mail nunca bloqueia o envio para aprovação nem a troca.

Ver spec: `.scratch/cotacoes-aprovacao-gestor/spec.md` (Implementation
Decisions — E-mails/`quotation_awaiting_manager_approval`,
Pré-preenchimento do gestor do pedido).

**Blocked by:** 01 — Prefactor: testes da máquina de estados e builders de propostas/itens compartilhados; 03 — Etapa do gestor: caminho principal; 05 — Tela "Minhas aprovações de cotação" e card na Home.

**Status:** done

- [x] Migration cria o template `quotation_awaiting_manager_approval` em `email_notification_templates`, no visual do `quotation_awaiting_approval`.
- [x] Builder puro do e-mail da etapa do gestor, reaproveitando os builders compartilhados de propostas e itens; link para a tela de aprovações do gestor via contrato de URL.
- [x] Enviar para aprovação dispara o e-mail para o gestor do pedido.
- [x] Na cotação em `awaiting_manager_approval`, quem tem acesso ao módulo de Cotações consegue trocar o gestor do pedido; a troca gera entrada de auditoria e dispara o e-mail para o novo gestor.
- [x] Gestor sem e-mail cadastrado não gera envio; falha de envio não reverte a mudança.
- [x] Testes do builder: destinatário é o gestor, todas as propostas presentes, vencedora destacada, link correto, gestor sem e-mail → nenhuma notificação, escape de HTML.
- [x] Validação manual: recebimento real do e-mail no envio e após troca de gestor. — Validado em 07–08/10: e-mail da etapa do gestor recebido no envio (C1, C2, C3, C4, C5) com propostas, vencedora e escape de HTML; troca de gestor registrada na auditoria (C2). E-mail ao novo gestor após a troca não foi conferido na caixa.
