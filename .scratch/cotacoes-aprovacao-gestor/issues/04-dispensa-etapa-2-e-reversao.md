# 04 — Dispensa da etapa 2 por alçada do gestor e reversão

**What to build:** quando o gestor do pedido também tem alçada suficiente
para o valor da cotação, a aprovação dele já conclui a cotação: ela vai
direto para "Aprovada", ficam gravadas as duas aprovações (etapa do gestor e
etapa de alçada) em nome dele, com a mesma assinatura e o mesmo instante, a
auditoria registra "etapa 2 dispensada: gestor com alçada" e nenhum e-mail
de alçada é enviado. O valor considerado é o valor real no momento da
aprovação, já refletindo uma troca de vencedora feita no próprio modal. A
regra fica só na RPC; o client apenas reflete o desfecho devolvido.

Desfazer uma aprovação passa a ter dois casos: se houve aprovação real na
etapa de alçada, volta para "Aguardando aprovação" mantendo a aprovação do
gestor (como hoje); se a etapa de alçada foi dispensada, apaga as duas
aprovações e volta para "Aprovação do gestor".

Ver spec: `.scratch/cotacoes-aprovacao-gestor/spec.md` (Implementation
Decisions — RPC nova/aprovação, Reversão de aprovação, Auditoria).

**Blocked by:** 03 — Etapa do gestor: caminho principal.

**Status:** done

- [x] RPC da etapa do gestor, na aprovação, consulta a alçada do aprovador; se pode aprovar e o valor real cabe na alçada, grava também a linha de alçada (mesma assinatura e instante, marcada como dispensa) e muda o status para `approved`.
- [x] RPC devolve o desfecho (aprovada direto / seguiu para alçada / rejeitada); o client mostra a mensagem certa e não recalcula a regra.
- [x] Dispensa → nenhum e-mail de alçada; auditoria registra a dispensa.
- [x] Trocar a vencedora no modal para uma proposta acima da alçada do gestor faz a cotação seguir para `awaiting_approval`.
- [x] Máquina de estados: `awaiting_manager_approval → approved`; reversão de `approved` com dois destinos possíveis. Testes atualizados.
- [x] RPC atômica de reversão: com aprovação real de alçada → apaga só a linha de alçada e volta para `awaiting_approval`; com dispensa → apaga as duas linhas e volta para `awaiting_manager_approval`.
- [x] A timeline de aprovação mostra corretamente as duas linhas no caso de dispensa.
- [x] Validação manual no projeto de teste: gestor sem alçada, gestor com alçada, troca de vencedora acima da alçada, reversão nos dois casos — Validado em 07–08/10 no projeto de teste: gestor sem alçada → alçada (C1), gestor com alçada → aprovada direto com duas linhas e stage_waived (C4), troca de vencedora acima da alçada → alçada (C3), reversão com alçada real → awaiting_approval mantendo a linha manager (C1) e com dispensa → awaiting_manager_approval sem linhas (C4).
