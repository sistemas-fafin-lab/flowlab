# 02 — Editar cadastro do colaborador

**What to build:** a pessoa de RH abre um colaborador na listagem e edita os campos que
nascem vazios no backfill — cargo, data de admissão, matrícula — e ajusta o departamento
(texto livre) quando necessário. As mudanças persistem e aparecem de volta na listagem.

**Blocked by:** 01 — Colaboradores: schema, backfill e listagem

**Status:** ready-for-agent

- [ ] Tela/modal de edição do colaborador com campos: cargo, data de admissão, matrícula,
      departamento.
- [ ] Validação básica (ex.: data de admissão não pode ser futura; formato de data válido).
- [ ] Alterações respeitam a mesma permissão de RH usada na listagem (01).
- [ ] Alterações refletem imediatamente na tela de listagem.
