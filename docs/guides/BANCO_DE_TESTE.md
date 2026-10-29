# Banco de teste do FlowLab (Supabase "FlowLab - test")

Projeto Supabase separado da produção, usado pelo dev server local e para ensaiar migrations antes de levá-las a produção.

| | Teste | Produção |
|---|---|---|
| Project ref | `eqzqkztgzcngnxmihdom` | `jqxeqmeikqclmmongclj` |
| URL da API | `https://eqzqkztgzcngnxmihdom.supabase.co` | `https://jqxeqmeikqclmmongclj.supabase.co` |
| Região do pooler | `aws-1-us-east-2` | `aws-0-sa-east-1` |
| Onde está configurado | `.env.local`, `.env.development.local` | `.env.prod.local`; é o projeto vinculado ao Supabase CLI (`supabase/.temp/project-ref`) |

## Acesso ao Postgres

**Transaction pooler** (porta 6543), para consultas e conexões da aplicação:

```
postgresql://postgres.eqzqkztgzcngnxmihdom:[SENHA]@aws-1-us-east-2.pooler.supabase.com:6543/postgres
```

**Session pooler** (mesmo host, porta 5432), para `supabase db push`/`migration list`, `pg_dump` e migrations longas. O transaction pooler não mantém sessão, o que quebra prepared statements e `SET` de sessão.

```
postgresql://postgres.eqzqkztgzcngnxmihdom:[SENHA]@aws-1-us-east-2.pooler.supabase.com:5432/postgres
```

A senha fica em `SUPABASE_TEST_SENHA`, no `.env` da raiz, que não é commitado (`*.env` no `.gitignore`). Se ela tiver `@`, `#`, `/` ou `%`, precisa entrar codificada para URL na connection string.

Exemplo, sem a senha aparecer no histórico do shell:

```bash
SENHA=$(grep -E '^SUPABASE_TEST_SENHA=' .env | cut -d= -f2-)
PGPASSWORD="$SENHA" psql "host=aws-1-us-east-2.pooler.supabase.com port=6543 dbname=postgres user=postgres.eqzqkztgzcngnxmihdom sslmode=require"
```

Para só ler, acrescente `options=-cdefault_transaction_read_only=on` à string de conexão.

A conta do Supabase CLI desta máquina (`~/.supabase/access-token`) **não** tem acesso ao projeto de teste pela Management API. Use a connection string.

## Estado do schema (29/10/2026)

O banco nasceu de um dump de produção. O histórico (`supabase_migrations.schema_migrations`) começa com `00000000000000 prod_baseline` e `00000000000001 fase5_cutover`, e as migrations do repositório foram aplicadas à mão depois disso. Só as aplicadas dessa forma aparecem registradas no histórico.

Em 29/10/2026 o schema `public` foi comparado objeto a objeto com produção (tabelas, colunas, funções, policies, triggers, índices e constraints) e igualado. Diferenças que ficaram de propósito:

- **`payment_request_guard` e `payment_request_autorizadores`**: o teste tem a versão do repositório (`20261027150000`, autorizador é o gestor do departamento). Produção está com a versão antiga (`20261020120000`), apesar de registrar a `20261027150000` como aplicada. Precisa ser conferido em produção.
- **UNIQUE `qa_ihq_solicitacoes_cod_requisicao_ihq_key`**: não existe no teste, porque os dados de teste têm códigos repetidos (97 linhas, 22 códigos).
- **Cargas de dados de produção não aplicadas**: `20261027150100_departamentos_gestores_carga` (usa colaboradores que não existem no teste; os departamentos do teste ficam sem gestor) e as correções de títulos, lotes e NFs com IDs de produção (`20261020120100`, `20261020150100`, `20261027180000`).
- **`20261026130000_custo_tabelas_associadas_unificacao`**: no teste rodou uma versão gerada a partir dos dados do próprio teste (`supabase/scripts/unificar-tabelas-associadas.ts` com `.scratch/controle-custos-tabela-associada/mapa-unificacao.json`), não o arquivo do repositório, que foi gerado com os dados de produção.
- **Tabelas que só existem no teste**: `app_usuarios`, `qa_registradores_cancer` e `qa_sincronizacoes`.
- **Constraints `*_check`**: aparecem como diferentes na comparação, mas só muda a forma do cast. O efeito é o mesmo.

## Como aplicar uma migration nova no teste

**Não use `supabase db push --db-url ...`.** O histórico do teste não bate com o repositório, então o CLI recusa o push ou tenta rodar todas as migrations desde o início.

Aplique com `psql`, numa transação, e registre no histórico:

1. Confira se a migration depende de objetos que o teste não tem.
2. Muitas migrations têm `BEGIN;`/`COMMIT;` próprios. Se você embrulhar o arquivo numa transação externa, o `COMMIT` dele fecha a sua e o resto roda gravando direto. Remova essas linhas numa cópia antes de embrulhar.
3. Ensaie terminando com `ROLLBACK`. Só depois rode com `COMMIT`.
4. Registre: `INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('<versão>', '<nome>') ON CONFLICT (version) DO NOTHING;`

Algumas funções do teste foram criadas pelo SQL Editor com quebras de linha `\r\n`. Uma migration que procura um trecho exato do corpo de uma função (`replace` em `pg_get_functiondef`) precisa aceitar `\n` e `\r\n`, como em `20261028150100_fat_permissoes_por_tela.sql`.

## Usuários de teste

Criados no projeto de teste para testar as permissões do Faturamento. Todos usam a senha `SUPABASE_TEST_USUARIOS_SENHA` do `.env`, e cada um tem um cargo próprio:

| E-mail | Cargo | Permissões |
|---|---|---|
| `teste.calendario.admin@flowlab.test` | Teste - Faturamento completo + Calendário | `canViewBilling`, `canManageBilling`, `canManageCalendarioEnvios` |
| `teste.calendario.cr@flowlab.test` | Teste - Só Contas a Receber | `canViewContasReceber` |
| `teste.calendario.ver@flowlab.test` | Teste - Só ver Calendário | `canViewCalendarioEnvios` |

`auth.admin.listUsers` falha neste projeto ("Database error finding users"). Para saber se um usuário existe, consulte `user_profiles` por e-mail.

## App local contra o banco de teste

`.env.local` aponta o Vite (`npm run dev`) para o projeto de teste. As rotas `/api/*` rodam em dev pelos plugins de `vite.config.ts`, que usam `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` de `.env.development.local` (também o projeto de teste) e o MySQL de backup do laboratório (`DB_*`).
