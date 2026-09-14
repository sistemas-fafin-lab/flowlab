# RH — Colaboradores (relação com usuários do sistema)

## Contexto

Ponto de partida do módulo de RH (ver `.scratch/rh-convenia-clone/` para o levantamento
completo de requisitos do Convenia, que serve de referência de longo prazo, não de escopo
imediato). Decisão: começar pela relação entre **usuários do sistema** (`user_profiles`) e
**colaboradores da empresa** (conceito que hoje não existe como entidade própria).

Confirmado com o usuário: todo `user_profile` existente é funcionário atual ou ex-funcionário
do laboratório — não há contas de terceiros/fornecedores. Isso permite backfill automático
1:1 sem etapa de triagem manual.

## Decisão de modelagem

`colaboradores` é uma entidade própria, não um alargamento de `user_profiles`:
- `user_profiles.id` é o `auth.users.id` — atrelado ao ciclo de vida de uma conta de login.
  No fluxo de admissão a pessoa existe antes de ter conta (às vezes nunca chega a ter).
- Mantém a separação de bounded context (RH vs. autenticação/acesso) já seguida pelo resto
  do sistema.

```sql
create table colaboradores (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid references user_profiles(id),  -- opcional, 1:1 quando existir

  nome text not null,
  email text,
  cpf text not null unique,

  departamento text,        -- texto livre v1, copiado de user_profiles.department
  cargo text,                -- texto livre v1, vazio no backfill (não existe hoje)

  data_admissao date,        -- NULL no backfill (sem dado real hoje), editável depois
  data_desligamento date,
  status text not null default 'ativo' check (status in ('ativo', 'desligado')),

  gestor_id uuid references colaboradores(id),  -- NULL no backfill, sem hierarquia hoje

  matricula text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index colaboradores_user_profile_id_uidx
  on colaboradores(user_profile_id) where user_profile_id is not null;
```

## Decisões já tomadas (não reabrir sem motivo novo)

- **Departamento/cargo**: texto livre no v1 (reaproveita `user_profiles.department`). Tabelas
  próprias (`departamentos`, `cargos`) ficam para uma fase futura, quando organograma for
  necessário de verdade.
- **`data_admissao`**: fica `NULL` no backfill — não existe dado confiável
  (`user_profiles.created_at` é "quando a conta foi criada no sistema", não "quando a pessoa
  foi contratada"). RH preenche manualmente depois.
- **Gestor/hierarquia**: não existe hoje em lugar nenhum do sistema. `gestor_id` nasce `NULL`
  para todo mundo; é a base para organograma e RBAC por hierarquia no futuro, mas isso é
  fora do escopo desta leva de tickets.

### Casos reais encontrados na inspeção de `user_profiles` (dump de produção)

- **Ex-funcionários têm o dado anonimizado nas colunas de topo**: ao excluir um usuário, o
  sistema zera `name`→"Usuário Removido", `email`→`deleted_*@deleted.flowlab.local`,
  `cpf`→`null`, `department`→`null`, e guarda o estado original em `deleted_snapshot`
  (JSONB). **Decisão**: o backfill recupera `nome`/`cpf`/`email`/`departamento` de
  `deleted_snapshot` quando `deleted_at is not null`, via `coalesce`:
  ```sql
  coalesce(nullif(cpf, ''), deleted_snapshot->>'cpf') as cpf,
  coalesce(nullif(name, ''), deleted_snapshot->>'name') as nome,
  coalesce(email, deleted_snapshot->>'profile_email', deleted_snapshot->>'email') as email,
  coalesce(department, deleted_snapshot->>'department') as departamento
  ```
  Sem isso, todo ex-funcionário desapareceria do cadastro de RH — justamente o histórico
  que a tela existe para mostrar.
- **CPFs inválidos/placeholder**: algumas contas de e-mail genérico de setor (ex.:
  `ti@laboratoriolab.com.br` "Tecnologia E Ai", `compraslab00421@gmail.com` "Setor De
  Compras - Lab", `sistemas.fafin.lab@gmail.com` "Sistemas Fafin") têm CPF sequencial óbvio
  (`00000000001`, `00000000002`, `00000000003`) — não representam uma pessoa física.
  **Decisão**: CPFs que falham na validação de dígito verificador (módulo 11, CLT/Portaria
  MTP 671/2021) são tratados como inválidos e ficam de fora do backfill automático, na mesma
  lista de tratamento manual usada para CPF nulo — não viram colaborador fictício.
- **Duplicidade de pessoa em duas contas** (ex.: "Cristiane Macedo Gama" com
  `bdr.labratorio.lab@gmail.com` sem CPF e `bdr.laboratorio.lab@gmail.com` com CPF — note a
  troca de "labratorio"/"laboratorio"; mesmo padrão em "Lucas Moreira"): a conta sem CPF (ou
  com CPF inválido) cai na mesma lista de tratamento manual acima; a conta com CPF válido
  segue o backfill normal. Não tentar deduplicar automaticamente por nome — arriscado demais
  para um script, fica para revisão humana do RH.

## Escopo desta leva de tickets

Ver `issues/`. Cobre: schema + backfill + listagem, edição de cadastro, vínculo/desvínculo
usuário↔colaborador, e atribuição de gestor. Não cobre (fica para depois): organograma,
RBAC por hierarquia de gestor, admissão/desligamento como workflow, férias, documentos,
tabelas próprias de departamento/cargo.
