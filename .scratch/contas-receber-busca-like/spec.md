# Busca de Títulos: `%`/`_` literais viram curinga

Achado pelo `/code-review` ao revisar o branch `main` (não relacionado ao
refactor do Candidato 1 de `docs/architecture/oportunidades-melhoria-arquitetura.md`
— aberto como ticket separado a pedido do usuário).

A busca por texto em `useContasReceber` (título/competência/observações) tenta
escapar `%` e `_` do termo digitado antes de montar o `.ilike()` via `.or()`
do PostgREST, mas o escape é descartado pelo parser do PostgREST antes de
chegar no Postgres — então um `%` ou `_` literal no termo de busca continua
se comportando como curinga do LIKE em vez de caractere literal.

Ver `.scratch/contas-receber-busca-like/issues/01-escape-like-postgrest.md`.
