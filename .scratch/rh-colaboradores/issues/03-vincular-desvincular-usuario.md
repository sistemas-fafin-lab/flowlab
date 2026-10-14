# 03 — Vincular/desvincular colaborador a um usuário do sistema

**What to build:** RH consegue ligar um colaborador (que não tem conta de login, ex.:
cadastrado durante um processo de admissão futuro, antes de ganhar acesso ao sistema) a um
`user_profile` existente, e também desfazer um vínculo feito por engano — tudo pela tela de
colaborador, sem precisar mexer direto no banco.

**Blocked by:** 01 — Colaboradores: schema, backfill e listagem

**Status:** done

- [ ] Ação "Vincular usuário" no colaborador sem conta: busca/seleciona um `user_profile`
      existente e cria o vínculo (`user_profile_id`).
- [ ] Regra de no máximo 1 colaborador por conta é respeitada — tentar vincular um
      `user_profile` que já está vinculado a outro colaborador é bloqueado com mensagem
      clara.
- [ ] Ação "Desvincular" remove o vínculo sem apagar o colaborador nem o usuário.
- [ ] Listagem (01) reflete o vínculo/desvínculo imediatamente.

## Comments

14/10/2026 — conferido no código: implementado (o status estava desatualizado).
