# Remoção de Usuários - Guia de Operação

Este documento descreve como remover o cadastro de uma pessoa no FlowLab, o que
acontece com os dados dela e como desfazer. Todas as operações são funções no
banco, executadas pelo SQL Editor do Supabase.

## 📋 Visão Geral

Não existe "excluir usuário" no FlowLab — existe **remoção lógica** (soft delete).

O motivo é estrutural: `it_requests.requested_by`, `it_projects.created_by` e
`quotation_approvals.approver_id` referenciam `user_profiles` com
`ON DELETE RESTRICT`. Qualquer pessoa que já tenha aberto um chamado, criado um
projeto ou aprovado uma cotação **não pode** ser apagada sem destruir esse
histórico — o banco recusa o `DELETE`.

A remoção lógica resolve isso: bloqueia o acesso e anonimiza os dados pessoais,
mantendo os registros operacionais intactos e o vínculo por UUID.

## 🗄️ Estrutura no Banco

### Colunas em `user_profiles`

```sql
deleted_at       TIMESTAMPTZ   -- NULL = ativo; preenchido = removido
deleted_snapshot JSONB         -- dados originais, usados para restaurar
is_active        BOOLEAN GENERATED ALWAYS AS (deleted_at IS NULL) STORED
```

`is_active` é **coluna gerada**: deriva de `deleted_at`, então não há como as duas
divergirem. Nunca escreva nela.

### View `active_user_profiles`

```sql
CREATE VIEW public.active_user_profiles
WITH (security_invoker = true) AS
SELECT * FROM public.user_profiles WHERE deleted_at IS NULL;
```

O `security_invoker = true` é obrigatório: sem ele a view roda com privilégios do
owner, ignora o RLS de `user_profiles` e expõe e-mail e CPF de todo mundo para
`anon` (os default privileges do Supabase concedem `SELECT` em views novas).

> ⚠️ A aplicação ainda **não** usa essa view. `UserManagement.tsx` lê
> `user_profiles` direto, então usuários removidos aparecem na listagem como
> "Usuário Removido". Trocar para a view é uma melhoria pendente.

### Controle de acesso

Todas as funções são `SECURITY DEFINER` com `SET search_path = public` e chamam
`assert_can_manage_users()`, que:

1. libera conexão direta ao banco (SQL Editor, psql) — sem JWT na requisição;
2. libera `service_role`;
3. exige a permissão `canManageUsers` para qualquer chamada via PostgREST.

Os grants são `REVOKE ALL ... FROM PUBLIC, anon` + `GRANT EXECUTE ... TO authenticated`.

> ⚠️ O `REVOKE ... FROM PUBLIC` **não basta** no Supabase: o
> `ALTER DEFAULT PRIVILEGES ... GRANT ALL ON FUNCTIONS TO anon` dá um grant
> explícito para `anon` em toda função nova, e grant explícito só sai com
> `REVOKE ... FROM anon`.

## 🔧 Funções

### `soft_delete_user(p_user_id UUID) → TEXT`

Remove o cadastro. Em uma transação:

| Alvo | O que faz |
|---|---|
| `auth.users` | `banned_until = 'infinity'`, senha zerada, e-mail vira `deleted_<uuid>@deleted.flowlab.local` |
| `auth.sessions` / `auth.refresh_tokens` | apagados — derruba quem já estava logado |
| `auth.identities` | e-mail anonimizado |
| `user_profiles` | nome vira "Usuário Removido"; CPF, departamento e cargo customizado zerados; `deleted_at` preenchido; snapshot gravado |
| `user_whitelist` | `activity = false` no CPF (impede recadastro pela tela) |
| `user_notifications`, `user_approval_limits` | apagados (dados transitórios) |
| chamados, projetos, aprovações, comentários, anexos | **preservados** |

O bloqueio de login é no **servidor** (`banned_until`), não na interface: o
GoTrue recusa a autenticação antes de emitir token.

Recusa a operação se o alvo for você mesmo, já estiver removido, ou for o último
administrador ativo.

### `soft_delete_user_by_cpf(p_cpf TEXT) → TEXT`

Mesma coisa, buscando pelo CPF. Normaliza a máscara (`123.456.789-00` funciona).

### `restore_user(p_user_id UUID) → TEXT`

Desfaz a remoção a partir do `deleted_snapshot`: devolve nome, e-mail, CPF,
departamento e cargo, reativa o CPF na whitelist e tira o `banned_until`.

**A senha não volta** — a pessoa precisa usar "Esqueci minha senha".

Recusa se o e-mail ou o CPF já tiverem sido tomados por outra conta.

### `list_deleted_users() → TABLE`

Lista os removidos com os dados originais do snapshot.

### `check_user_dependencies(p_user_id UUID) → TABLE`

Diagnóstico: conta os registros da pessoa em cada tabela e diz o que acontece com
eles. Rode antes de remover, se quiser saber o tamanho do histórico.

## 🚀 Uso

```sql
-- 1. achar a pessoa
SELECT id, name, email, cpf, role, deleted_at
  FROM user_profiles WHERE cpf = '00000000000';

-- 2. conferir o histórico (opcional)
SELECT * FROM check_user_dependencies('UUID');

-- 3. remover
SELECT soft_delete_user_by_cpf('00000000000');

-- 4. conferir
SELECT * FROM list_deleted_users();

-- 5. desfazer, se preciso
SELECT restore_user('UUID');
```

## ❓ Perguntas frequentes

**Dá para só desativar o CPF na `user_whitelist`?**
Bloqueia cadastro novo e login novo (`AuthContext.tsx:248-261`), mas é checagem no
**client**: o GoTrue autentica e emite o token, e só depois o app desloga sozinho.
Sessão já aberta continua funcionando, e o RLS não olha a whitelist. Para cortar
acesso de verdade, use `soft_delete_user`.

**O e-mail da pessoa pode ser reaproveitado?**
Sim. A remoção troca o e-mail em `auth.users` por um endereço `@deleted.flowlab.local`,
liberando o original para outra conta.

**E se eu precisar apagar fisicamente?**
Só é possível quando `check_user_dependencies` retorna 0 em `it_requests`,
`it_projects` e `quotation_approvals`:

```sql
DELETE FROM auth.users WHERE id = 'UUID';  -- cascateia user_profiles
```

Com qualquer registro sob RESTRICT o comando falha — use a remoção lógica.

## 🔗 Arquivos

| Arquivo | Conteúdo |
|---|---|
| `supabase/migrations/20260721120000_user_soft_delete.sql` | colunas, view e funções |
| `supabase/migrations/20260721130000_fix_signup_profile_trigger.sql` | correção do cadastro (perfil sem CPF) |
| `supabase/scripts/remover_usuario.sql` | `check_user_dependencies` + passo a passo |
| `supabase/scripts/prod-upgrade-user-soft-delete.sql` | pacote para colar no SQL Editor + checklist de conferência |

## 🩺 Correção relacionada: cadastro sem CPF

O trigger `on_auth_user_created` criava o perfil **sem CPF** e sem `ON CONFLICT`;
logo depois o `AuthContext.signUp` tentava inserir o perfil completo e levava
`23505` (PK duplicada), erro que só ia para `console.error`. Resultado: o cadastro
parecia dar certo e o perfil ficava sem CPF — e sem CPF o login é recusado em
`AuthContext.tsx:239`.

A migration `20260721130000` remove o trigger e deixa o client como único autor do
perfil no signup. Nada dependia dele: a política `"Allow users to insert their own
profile"` permite o insert, e o fluxo admin (`api/_lib/createUser.ts:161-178`) tem
fallback próprio.

Para conferir a saúde do cadastro:

```sql
SELECT count(*) FILTER (WHERE cpf IS NULL) AS sem_cpf, count(*) AS total
  FROM user_profiles WHERE deleted_at IS NULL;
```

Perfis sem CPF são pessoas que não conseguem entrar. Se `last_sign_in_at` for nulo
e não houver histórico, são contas fantasma — apagar em `auth.users` libera o
e-mail para um cadastro limpo.
