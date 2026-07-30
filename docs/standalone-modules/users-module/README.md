# Módulo de Usuários e Permissões — Cópia isolada

Cópia autocontida do módulo de **gerenciamento de usuários, cargos (custom
roles) e permissões (RBAC)** extraído do FlowLab, para reaproveitamento em
outro projeto. A estrutura de pastas espelha `src/...` do projeto original,
então basta colar `src/` e `api/` deste diretório no projeto de destino sem
precisar editar imports.

> **Fora do escopo, de propósito:** a tela de **login** (email/senha, reset de
> senha) não está incluída aqui — este módulo assume que o usuário já está
> autenticado via Supabase Auth. Se precisar do fluxo de login, veja
> `docs/standalone-modules/auth-standalone/` no projeto original (já é uma cópia isolada da tela
> de `Auth.tsx` + sessão).

## O que está incluído

```
src/
  components/
    UserManagement.tsx   # Tela principal: CRUD de usuários, cargos (custom_roles),
                          # matriz de permissões e alçadas de aprovação por usuário
    NewUserForm.tsx       # Modal "Novo Usuário" (chama POST /api/users/create)
    Notification.tsx     # Toast de notificação usado pela tela
  hooks/
    useAuth.ts            # Sessão/perfil do usuário logado (Supabase Auth)
    useNotification.ts    # Estado de toast local
  utils/
    permissions.ts        # Catálogo de permissões (ALL_PERMISSION_KEYS), roles
                          # legadas, departamentos e helpers de RBAC (hasPermission)
    cpf.ts                # Máscara/validação de CPF (cadastro de usuário)
  lib/
    supabase.ts            # Cliente Supabase (frontend, anon key)
    database.types.ts      # Tipos gerados do banco (do FlowLab — ver nota abaixo)
  types.ts                 # UserRole, Department, UserProfile, CustomRole,
                            # RolePermissions (extraído de src/types/index.ts)

api/
  users/
    create.ts               # Endpoint Vercel: POST /api/users/create
  _lib/
    createUser.ts           # Orquestra o cadastro: whitelist → auth.admin.createUser
                            # → perfil → alias Google Workspace → e-mail de boas-vindas
    email.ts                # Envio via nodemailer + templates dinâmicos no Supabase
    googleWorkspace.ts      # Cria alias de e-mail no Google Workspace (Admin SDK)
    supabase.ts             # Cliente Supabase com service role (admin)

supabase/
  migrations/                # Schema necessário — ver ordem abaixo
```

## Dependências NPM necessárias

```json
{
  "@supabase/supabase-js": "^2.39.3",
  "framer-motion": "^12.38.0",
  "lucide-react": "^0.263.1",
  "react": "^18.3.1",
  "react-dom": "^18.3.1"
}
```

Para o endpoint de criação de usuário (`api/users/create.ts`), ambiente Vercel
Functions:

```json
{
  "nodemailer": "^8.0.6",
  "googleapis": "^173.0.0",
  "@vercel/node": "^5.1.14"
}
```

## Variáveis de ambiente

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...

# obrigatório para api/users/create.ts
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...

# e-mail de boas-vindas (senha temporária)
SMTP_HOST=...
SMTP_PORT=...
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=...

# opcional — convite do Slack incluído no e-mail de boas-vindas
SLACK_INVITE_URL=...

# opcional — criação de alias corporativo no Google Workspace
# (se ausente, o cadastro segue normalmente e só pula essa etapa)
GOOGLE_SA_CLIENT_EMAIL=...
GOOGLE_SA_PRIVATE_KEY=...
GOOGLE_ADMIN_SUBJECT=...
GOOGLE_ALIAS_TARGET=...
GOOGLE_ALIAS_DOMAIN=...
```

## Banco de dados (Supabase)

Rode as migrations em `supabase/migrations/` **na ordem em que aparecem** (o
nome já é o timestamp). Elas criam:

- `user_whitelist` — CPFs autorizados a se cadastrar
- `user_profiles` — perfil do usuário (role legada, departamento, permissões)
  + trigger que cria o perfil automaticamente no signup (`auth.users` → `user_profiles`)
- `custom_roles` — cargos personalizáveis com permissões em JSONB (substitui a
  role legada fixa `admin`/`operator`/`requester`) + 3 cargos de sistema seedados
  (Administrador, Operador, Solicitante)
- `approval_level_config` + `user_approval_limits` — alçadas de aprovação
  configuráveis por usuário (usado na aba de aprovação de cotações/pagamentos)
- `notification_templates` — templates de e-mail dinâmicos (usado para o
  e-mail de boas-vindas `welcome_new_user`)
- Colunas extras em `user_profiles`: `telefone`, `data_nascimento`
- Políticas RLS e função `SECURITY DEFINER current_user_has_permission()` que
  evita recursão infinita ao checar permissão de admin dentro de uma policy
  da própria tabela `user_profiles`

**Não incluído de propósito** (específico da instância original do FlowLab,
não faz parte do schema genérico do módulo):
- `20260525120000_populate_user_whitelist.sql` — seed com CPFs/nomes reais de
  funcionários do Flow LAB
- `20260525130000_sync_user_profiles_cpf.sql` — migração pontual de dados reais
- `20260413120000_module_categories.sql` — categorias do menu lateral
  (pertence ao `Layout.tsx` da aplicação, não ao módulo de usuários/permissões)

## Pontos de acoplamento a revisar no projeto de destino

1. **`src/types.ts`** foi extraído de um `types/index.ts` bem maior,
   compartilhado por outros módulos do FlowLab. Ajuste os valores de
   `Department` para os departamentos do novo projeto.

2. **`src/utils/permissions.ts`** traz `ALL_PERMISSION_KEYS` com chaves de
   *todos* os módulos do FlowLab (produtos, cotações, TI, análises clínicas
   etc.), não só de usuários. Isso é proposital: é o catálogo que a tela
   `UserManagement.tsx` renderiza como matriz de permissões ao criar/editar um
   cargo. Edite essa lista para conter as permissões reais do novo projeto —
   a única chave que o próprio módulo de usuários exige é `canManageUsers`
   (protege a tela e o endpoint de criação).

3. **`src/lib/database.types.ts`** é o arquivo de tipos gerado
   (`supabase gen types typescript`) do banco **original do FlowLab**, com
   tipos de outras tabelas também. Regenere a partir do banco do novo projeto
   depois de rodar as migrations.

4. **Sistema de permissões duplo**: o módulo mantém compatibilidade entre a
   `role` legada (`admin`/`operator`/`requester`, coluna fixa) e o sistema
   novo de `custom_role_id` → `custom_roles.permissions` (JSONB). `hasPermission()`
   em `permissions.ts` sempre checa a lista de permissões resolvida
   (`userProfile.permissions`, montada em `useAuth.ts` a partir do cargo). Se
   o novo projeto não precisar de compatibilidade com roles legadas, dá para
   simplificar removendo a coluna `role` e os fallbacks — mas não é obrigatório.

5. **Rota de referência** (como estava no `App.tsx` original):

   ```
   /users -> UserManagement   (permissão: canManageUsers)
   ```

6. **Autorização do endpoint `/api/users/create`**: o chamador precisa
   enviar `Authorization: Bearer <access_token>` da sessão do admin logado
   (`supabase.auth.getSession()` no frontend). O backend verifica
   `role === 'admin'` ou `canManageUsers` antes de criar o usuário.

7. **Alias do Google Workspace e convite do Slack são best-effort**: se as
   variáveis de ambiente correspondentes não estiverem configuradas, o
   cadastro do usuário continua funcionando normalmente — essas etapas apenas
   são puladas e um aviso (`warnings[]`) volta na resposta da API.
