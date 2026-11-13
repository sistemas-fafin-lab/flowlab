# 06: EVA na camada de operações (etapa 2)

**What to build:** a EVA passa a fazer as leituras e escritas pela mesma camada de permissões por agente, começando pelas escritas. A permissão efetiva é o que o agente pode ∩ o que o usuário pode, e o RLS fica como segunda barreira. Ver `../spec.md`, D14.

**Blocked by:** 01

**Status:** needs-triage

Ficou para depois no grilling de 13/11/2026. Antes de fatiar, fazer um grilling próprio sobre:

- o registro de operações tipadas;
- a permissão efetiva agente ∩ usuário;
- o uso do JWT do usuário com o RLS;
- as rotinas que continuam com a service_role.

- [ ] Inventário das escritas e leituras atuais da EVA.
