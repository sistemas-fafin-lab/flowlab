# 06 — Departamentos no RH (aprovador de SC e responsáveis)

**What to build:** entidade `departamentos` (plana: nome, ativo,
`aprovador_sc_id` → colaborador), `colaboradores.departamento_id`
(nullable, um por pessoa) e `departamento_responsaveis` (N:N, independente
de onde a pessoa está). Permissão nova `canManageDepartamentos` e aba
"Departamentos" no RH. Holerites da equipe passam a seguir os
responsáveis. Carga inicial a partir do texto atual de
`colaboradores.departamento`, com mapeamento aprovado pelo usuário. Ver
spec, "Departamentos (schema)", "Holerites da equipe" e "Dados iniciais".

**Blocked by:** —

**Status:** ready-for-agent

- [ ] Levantamento (somente leitura) dos valores distintos de `colaboradores.departamento` em produção e mapeamento texto → departamento **aprovado pelo usuário**, com os aprovadores/responsáveis a confirmar.
- [ ] Migration: `departamentos`, `colaboradores.departamento_id`, `departamento_responsaveis`, RLS (leitura aberta a autenticado; escrita com `canManageDepartamentos`), bloqueio de desativar com colaborador ativo.
- [ ] Permissão `canManageDepartamentos` (grupo RH) em `src/utils/permissions.ts` e no banco; concedida ao cargo RH e admin.
- [ ] Carga: departamentos do mapeamento, `departamento_id` de cada colaborador, Área técnica → aprovador Paulo Vítor, Louise responsável pelo dela e pelo da Raquel, demais conforme confirmado.
- [ ] Aba "Departamentos" (criar, renomear, desativar, responsáveis, aprovador de SC, membros, pendência "sem departamento"); departamento como select na ficha.
- [ ] Holerites da equipe: `colaborador_e_subordinado_do_usuario_atual` passa a usar `departamento_responsaveis` (policies inalteradas).
- [ ] Validado no projeto de teste (holerites: Louise vê a equipe da Raquel; responsável sem `canViewHoleritesEquipe` não vê).
- [ ] Depois de conferido: remover `colaboradores.gestor_id` (trigger de ciclo, uso na tela) e `colaboradores.departamento` (texto), e `rh_sync_colaborador` para de gravar o texto.

## Comments

**20/10/2026 — ordem das migrations.** A migration da issue 01
(`20261020220000_sc_aprovador_pelo_departamento.sql`) lê `departamentos` e
`colaboradores.departamento_id`. A desta issue precisa de timestamp menor que
`20261020220000` (ex.: `20261020215000_...`), senão a 01 aborta.
