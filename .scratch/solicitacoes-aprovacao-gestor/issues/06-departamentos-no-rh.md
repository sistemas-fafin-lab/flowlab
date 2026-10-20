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

- [x] Levantamento (somente leitura) dos valores distintos de `colaboradores.departamento` em produção e mapeamento texto → departamento **aprovado pelo usuário**, com os aprovadores/responsáveis a confirmar.
- [x] Migration: `departamentos`, `colaboradores.departamento_id`, `departamento_responsaveis`, RLS (leitura aberta a autenticado; escrita com `canManageDepartamentos`), bloqueio de desativar com colaborador ativo.
- [x] Permissão `canManageDepartamentos` (grupo RH) em `src/utils/permissions.ts` e no banco; concedida ao cargo RH e admin.
- [x] Carga: departamentos do mapeamento, `departamento_id` de cada colaborador, Área técnica → aprovador Paulo Vítor, Louise responsável pelo dela e pelo da Raquel, demais conforme confirmado.
- [x] Aba "Departamentos" (criar, renomear, desativar, responsáveis, aprovador de SC, membros, pendência "sem departamento"); departamento como select na ficha.
- [x] Holerites da equipe: `colaborador_e_subordinado_do_usuario_atual` passa a usar `departamento_responsaveis` (policies inalteradas).
- [ ] Validado no projeto de teste (holerites: Louise vê a equipe da Raquel; responsável sem `canViewHoleritesEquipe` não vê).
- [ ] Depois de conferido: remover `colaboradores.gestor_id` (trigger de ciclo, uso na tela) e `colaboradores.departamento` (texto), e `rh_sync_colaborador` para de gravar o texto.

## Comments

**20/10/2026 — ordem das migrations.** A migration da issue 01
(`20261020220000_sc_aprovador_pelo_departamento.sql`) lê `departamentos` e
`colaboradores.departamento_id`. A desta issue precisa de timestamp menor que
`20261020220000` (ex.: `20261020215000_...`), senão a 01 aborta.

**20/10/2026 — schema, permissão, aba e holerites (sem a carga).**

- Migration `supabase/migrations/20261020215000_rh_departamentos.sql` (antes
  da 01): `departamentos` (nome único por `lower(btrim(nome))`, `ativo`,
  `aprovador_sc_id`), `colaboradores.departamento_id`,
  `departamento_responsaveis`; RLS com leitura aberta a autenticado e escrita
  com `canManageDepartamentos`. Triggers: desativar barrado com colaborador
  ativo; mudar `departamento_id` exige `canManageDepartamentos` (vindo do
  client) e departamento ativo. `canManageDepartamentos` vai para o cargo RH e
  o Administrador. `colaborador_e_subordinado_do_usuario_atual` passa a ler
  `departamento_responsaveis` (as policies ficam).
- Front: aba `/rh/departamentos` (criar, renomear, desativar/reativar,
  aprovador de SC, responsáveis, membros, pendência "sem departamento"); na
  ficha, o departamento vira select (só muda com a permissão). Lista e ficha
  mostram o departamento da FK; o texto `colaboradores.departamento` deixa de
  ser editado na tela.
- Validado num Postgres 18 local descartável, com esquema mínimo, aplicando
  06 (duas vezes) + 01 + 03: nome repetido barrado; desativar com ativo
  barrado e liberado depois de desligar; entrar em departamento inativo
  barrado; usuário só com `canViewColaboradores` não muda departamento nem cria
  departamento, mas edita outros campos e lê os departamentos; Louise (com
  `canViewHoleritesEquipe`, responsável pelos dois departamentos) vê a equipe
  da Raquel e não vê o Paulo; responsável sem a permissão não vê ninguém;
  definir o Paulo como aprovador leva a SC pendente do membro a ele (03).
- **Pendente:** o levantamento em produção foi negado ao agente (leitura de
  produção bloqueada). Falta o mapeamento texto → departamento aprovado pelo
  usuário e a migration de carga, com timestamp entre `20261020215000` e
  `20261020220000` (ex.: `20261020215100_rh_departamentos_carga.sql`).
  **Ordem de deploy:** o front novo mostra o departamento pela FK, então sem a
  carga todos aparecem "sem departamento" — subir o front junto com a carga.
- Review: a aba depende também de `canViewColaboradores` (RLS de
  `colaboradores`); a página avisa quando falta, e `definirDepartamento` trata
  UPDATE filtrado pelo RLS (0 linhas) como erro. Responsável pelo próprio
  departamento passa a ver os holerites dos colegas dele (consequência literal
  da spec: Louise é responsável pelo dela).
- Carga (`20261020215100_rh_departamentos_carga.sql`): levantamento feito pelo
  usuário em produção (55 ativos, 14 textos) e mapeamento aprovado em
  20/10/2026 — um departamento por texto, mesmo nome; "testando" (Transporte)
  fica sem departamento. Biologia Molecular (só o Paulo) fica separado. Só o
  decidido: Área técnica e Qualidade → aprovador Paulo; Financeiro → aprovador
  e responsável Louise Fontel; Faturamento → responsável Louise Fontel; RH e
  Copa/Limpeza → aprovador e responsável Suane. A lista de gestores do RH
  cobria só parte de Atendimento, TI, Transporte e Faturamento: o usuário
  preferiu deixar esses (e Biologia Molecular, Comercial, Diretoria, Equipe
  Médica, Estoque) vazios para o RH preencher na aba. Pessoas casadas pelo nome
  (falha se não houver exatamente um). Não testada localmente.
- Produção (jqx), 20/10/2026: 29 migrations de 20261009120000 a 20261020233000
  já estavam aplicadas pelo painel e só faltavam no histórico — conferidas
  pelo schema/dados e marcadas com `migration repair` (sem rodar SQL). As 9
  restantes (20261020150000 e 20261020215000…20261020235200) aplicadas com
  `db push --include-all`. Conferido: departamentos e aprovadores como acima;
  só "testando" sem departamento; SC da Ana Claudia (REQ868) → Paulo. A SC
  "Paulo Vitor" foi criada pelo usuário ligado à Cristina (Área técnica) —
  conferir se o vínculo usuário → colaborador está certo. Faltam os segredos
  do Vault e os aprovadores dos departamentos vazios (RH, pela aba).
