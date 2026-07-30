# Módulo de TI (Kanban / Projetos / Chamados) — Cópia isolada

Esta pasta é uma cópia autocontida do módulo de TI extraído do FlowLab, para
reaproveitamento em outro projeto. Os caminhos relativos entre os arquivos
foram preservados (mesma estrutura `src/...`), então basta colar a pasta
`src/` e `api/` deste diretório dentro do projeto de destino, sem precisar
editar imports.

## O que está incluído

```
src/
  components/
    IT/                     # Todo o módulo de TI: kanban, projetos, chamados, mindmap
      ITHubDashboard.tsx       # Hub/dashboard inicial do módulo
      ITKanbanBoard.tsx        # Quadro Kanban de chamados/tarefas
      ITProjectDashboard.tsx   # Dashboard de projeto (burndown, métricas)
      ITProjectManager.tsx     # CRUD de projetos e sprints
      ITRequestManagement.tsx  # Gestão de chamados (lista/triagem)
      ITRequests.tsx           # Ícone/entrada de menu de chamados de TI
      ITTaskDrawer.tsx         # Painel lateral de detalhe de tarefa/chamado
      KanbanPromoteModal.tsx   # Modal "promover chamado para o kanban"
      MindMapNodes.tsx         # Nós customizados do mapa mental (@xyflow/react)
      SLABadge.tsx             # Badge visual de status de SLA
      TestKanban.tsx           # Página de teste/demo do board
    Notification.tsx         # Toast de notificação usado pelo módulo
  pages/
    IT/
      ITProjectMindMap.tsx    # Página de mapa mental de projeto (React Flow)
  hooks/
    useAuth.ts                # Sessão/perfil do usuário (Supabase Auth)
    useDataCache.tsx          # Cache em memória com stale-time (Context)
    useITProjectDashboard.ts  # Dados agregados do dashboard de projeto
    useNotification.ts        # Estado de toast local
    useNotificationCenter.ts  # Central de notificações in-app + e-mail (realtime)
    useSlaStatus.ts           # Cálculo de status de SLA por prioridade
    useTheme.tsx               # Tema claro/escuro (Context)
  utils/
    appUrl.ts                 # URL pública do app (usada em links de e-mail)
    itSla.ts                  # Regras de cálculo de SLA
    permissions.ts             # Catálogo de permissões + helpers de RBAC
  lib/
    supabase.ts                # Cliente Supabase
    database.types.ts          # Tipos gerados do banco (do FlowLab — ver nota abaixo)
  types.ts                     # UserRole/Department/UserProfile (extraído de src/types/index.ts)

api/
  notifications/
    email.ts                  # Endpoint Vercel: POST /api/notifications/email
  _lib/
    email.ts                  # Envio via nodemailer + templates dinâmicos no Supabase
    supabase.ts                # Cliente Supabase com service role (admin)

supabase/
  migrations/                  # Schema necessário (tabelas, RPCs, RLS) — ver ordem abaixo
```

## Dependências NPM necessárias

```json
{
  "@supabase/supabase-js": "^2.39.3",
  "@xyflow/react": "^12.10.2",
  "framer-motion": "^12.38.0",
  "lucide-react": "^0.263.1",
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "react-router-dom": "^6.28.0"
}
```

Se for usar o endpoint de e-mail (`api/notifications/email.ts`), também precisa (ambiente Vercel Functions):

```json
{
  "nodemailer": "^8.0.6",
  "@vercel/node": "^5.1.14"
}
```

O CSS do React Flow é importado dentro de `ITProjectMindMap.tsx`
(`import '@xyflow/react/dist/style.css'`) — nenhuma configuração extra é
necessária além de instalar o pacote.

## Variáveis de ambiente

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...

# opcional — apenas se for usar o endpoint /api/notifications/email
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SMTP_HOST=...
SMTP_PORT=...
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=...

# opcional — usado em links dentro dos e-mails enviados
VITE_APP_URL=https://seu-app.vercel.app
```

## Banco de dados (Supabase)

Rode as migrations em `supabase/migrations/` **na ordem em que aparecem**
(o nome já é o timestamp). Elas criam:

- `it_requests` (chamados de TI, com tags, anexos, múltiplos responsáveis, SLA)
- `it_projects` e `it_sprints` (projetos e sprints do kanban)
- RPC de dashboard de projeto (`20260521000000_it_project_dashboard_rpc.sql`)
- `it_project_visions` (visão/objetivo do projeto, usado no mindmap)
- `user_notifications` (central de notificações in-app, usada por `useNotificationCenter`)
- `email_notification_templates` + templates específicos de TI
  (`it_ticket_resolved`, `it_ticket_status_changed`, `it_ticket_update` — este
  último já vem seedado na migration `20260428120000_email_notification_templates.sql`)

Todas essas tabelas assumem a existência de uma tabela de usuários/perfis
(`auth.users` do Supabase + uma tabela de perfis com `role`/`department`/
`permissions`, referenciada pelo `useAuth.ts`/`permissions.ts` deste módulo).
**Isso não está incluído aqui** porque pertence ao sistema de autenticação do
projeto original, não ao módulo de TI em si — adapte `useAuth.ts` à tabela de
perfis do projeto de destino se ela tiver um formato diferente.

## Pontos de acoplamento a revisar no projeto de destino

1. **`src/types.ts`** foi extraído de um arquivo `types/index.ts` bem maior
   (compartilhado por todos os módulos do FlowLab). Contém só o necessário
   para auth/RBAC (`UserRole`, `Department`, `UserProfile`). Ajuste os valores
   de `Department` se o novo projeto tiver departamentos diferentes.

2. **`src/utils/permissions.ts`** traz o catálogo completo de permissões do
   FlowLab (`ALL_PERMISSION_KEYS`), incluindo chaves de outros módulos. As
   chaves realmente usadas pelo módulo de TI são:
   - `canManageIT` — acesso ao hub, kanban, projetos e mindmap de TI
   - `canViewRequests` / `canAddRequests` / `canApproveRequests` — chamados
   Pode enxugar esse arquivo para conter só essas chaves, se preferir.

3. **`src/lib/database.types.ts`** é o arquivo de tipos gerado
   (`supabase gen types typescript`) do banco **original do FlowLab** — ele
   contém tipos de tabelas de outros módulos também. Assim que rodar as
   migrations no projeto de destino, regenere esse arquivo a partir do novo
   banco para manter os tipos corretos.

4. **`DataCacheProvider`** (de `useDataCache.tsx`) precisa envolver a árvore
   de componentes onde o módulo de TI for renderizado — `useNotificationCenter`
   depende do context dele. No FlowLab original isso é feito em `App.tsx`.

5. **Rotas de referência** (como estavam no `App.tsx` original — recrie no
   roteador do novo projeto):

   ```
   /it/dashboard         -> ITHubDashboard          (permissão: canManageIT)
   /it/projects          -> ITProjectDashboard (projectId=null)
   /it/projects/:id      -> ITProjectDashboard (projectId=id)
   /it/mindmap           -> ITProjectMindMap
   /it/kanban            -> ITKanbanBoard
   /requests/it          -> ITRequestManagement (permissão: canViewRequests)
   ```

6. **`api/notifications/email.ts`** é opcional — só é necessário se quiser
   que `useNotificationCenter().sendNotification({ sendEmail: true, ... })`
   também dispare e-mails. Sem ele, a central de notificações in-app
   continua funcionando normalmente (grava só no banco).
