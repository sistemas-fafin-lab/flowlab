# 01 — Prefactor: regra de edição de informações na máquina de estados

**What to build:** preparar o terreno para a edição de informações sem mudar
nada visível ao usuário. A regra de status que hoje só permite editar a
cotação em rascunho é substituída por uma regra de edição das **informações
da cotação** (título, descrição, justificativa, prioridade, centro de custo,
prazo de entrega, prazo de resposta) que libera todos os status exceto
`cancelled` e `rejected`. A função de atualização do hook de cotações que só
altera o estado local, não grava no banco e não é chamada por nenhum
componente é removida, junto com o uso da regra antiga (inclusive o
`canEdit` das permissões por status).

Ver spec: `.scratch/cotacoes-edicao-informacoes/spec.md` (Implementation
Decisions — máquina de estados e hook; Testing Decisions — seam 1).

**Blocked by:** None — can start immediately.

**Status:** done

- [x] A regra antiga "só rascunho" deixa de existir; a nova regra de edição de informações está exportada pela máquina de estados.
- [x] Testes vitest da nova regra nos dez status: liberada em oito, bloqueada em `cancelled` e `rejected`.
- [x] A regra de itens (`canModifyItems`) continua igual e seus testes passam sem alteração.
- [x] A função de atualização que não grava no banco é removida do hook e da sua interface pública; nenhum componente quebra.
- [x] Typecheck e testes existentes do módulo de cotações passam.
