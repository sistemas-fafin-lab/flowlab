# 04 — Definir gestor (hierarquia) do colaborador

**What to build:** RH atribui um gestor a um colaborador diretamente na sua ficha. Isso só
entrega o cadastro do vínculo de hierarquia (não o organograma nem RBAC por hierarquia,
que ficam para depois) — mas de forma consistente o suficiente para ser a base desses
recursos futuros.

**Blocked by:** 01 — Colaboradores: schema, backfill e listagem

**Status:** done

- [ ] Campo "Gestor" no cadastro do colaborador — busca/seleciona outro colaborador
      existente para preencher `gestor_id`.
- [ ] Bloqueia auto-referência direta (colaborador não pode ser gestor de si mesmo).
- [ ] Bloqueia ciclos na cadeia de gestores (ex.: A tem B como gestor, B não pode ter A
      como gestor, direta ou indiretamente).
- [ ] Vínculo salvo aparece na ficha do colaborador (nome do gestor).

## Comments

14/10/2026 — conferido no código: implementado (o status estava desatualizado).
