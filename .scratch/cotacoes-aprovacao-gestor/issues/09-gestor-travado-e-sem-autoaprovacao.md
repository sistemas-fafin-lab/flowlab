# 09 — Gestor do pedido travado pela origem e sem autoaprovação

**What to build:** o comprador deixa de escolher livremente o gestor do
pedido. Quando a cotação tem origem conhecida — quem abriu a SC (Compras)
ou a solicitação de manutenção (Contratação), ativo e diferente do
comprador — esse é o gestor, sem troca possível (nem no envio, nem depois,
na etapa do gestor). Sem origem conhecida (SC antiga, cotação sem vínculo)
ou com o criador da origem inativo/desligado, o comprador escolhe, mas
nunca a si mesmo: o gestor não pode ser quem criou a cotação nem quem está
enviando/trocando. A regra vale no banco (trigger em `quotations`), não só
na tela — fecha a brecha de o comprador com alçada se colocar como gestor e
aprovar a própria cotação direto (dispensa da etapa 2).

Se quem abriu a origem é o próprio comprador, a origem não trava (seria
autoaprovação): cai na escolha manual, sem o comprador. Gestor travado e
indisponível → um admin decide no lugar dele (regra existente da etapa 1).

Decisão tomada com o usuário em 07/10, revisando a história 16 da spec
("trocar para qualquer usuário ativo").

**Blocked by:** 02, 06.

**Status:** done

- [x] Regra pura (gestor travado, gestores elegíveis, sugestão) com testes: origem conhecida trava; origem inativa ou igual ao comprador/usuário atual não trava; comprador e usuário atual nunca elegíveis; troca sem o gestor atual.
- [x] Modal de envio: gestor travado aparece fixo, com o motivo; sem trava, lista sem o comprador/usuário atual.
- [x] Modal de troca: com gestor travado, explica que não dá para trocar (admin pode decidir no lugar); sem trava, mesma lista sem comprador/usuário atual e sem o gestor atual.
- [x] Trigger no banco rejeita gestor = comprador/usuário atual e gestor diferente da origem travada, no envio e na troca; mensagem do trigger chega ao usuário.
- [x] Migration aplicada no projeto de teste e validada (envio e troca, casos permitidos e bloqueados). Validado com login real de usuários de teste: troca da origem travada bloqueada, comprador e outro usuário se escolhendo bloqueados, gestor da origem e escolha livre sem SC permitidos, origem desativada destrava. Os modais ainda precisam ser vistos no navegador (passos 1, 2 e 7 do roteiro).
