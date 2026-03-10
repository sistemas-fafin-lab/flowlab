# FlowLab - Arquitetura Completa do Sistema

> Documento técnico de arquitetura - Atualizado em Março/2026

## 1. Visão Geral

O FlowLab é um sistema web de gestão empresarial integrada, focado em inventário, requisições, cotações e pagamentos. Construído com arquitetura moderna baseada em React e Supabase.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (SPA)                              │
│                    React 18 + TypeScript + Vite                     │
├─────────────────────────────────────────────────────────────────────┤
│                         BACKEND (BaaS)                              │
│                 Supabase (PostgreSQL + Auth + Storage)              │
├─────────────────────────────────────────────────────────────────────┤
│                      INTEGRAÇÕES EXTERNAS                           │
│                   WA-HA (WhatsApp HTTP API)                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Stack Tecnológica

### 2.1 Frontend
| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| React | 18.x | Framework UI |
| TypeScript | 5.x | Tipagem estática |
| Vite | 5.x | Build tool & dev server |
| TailwindCSS | 3.x | Estilização |
| Lucide React | - | Ícones |
| React Router | 6.x | Roteamento SPA |

### 2.2 Backend (Supabase)
| Componente | Propósito |
|------------|-----------|
| PostgreSQL | Banco de dados relacional |
| Supabase Auth | Autenticação (email/senha) |
| Supabase Storage | Armazenamento de arquivos |
| Row Level Security | Segurança a nível de linha |
| Edge Functions | Funções serverless (opcional) |

### 2.3 Integrações
| Serviço | Propósito |
|---------|-----------|
| WA-HA | API WhatsApp para mensagens a fornecedores |
| Docker | Container para WA-HA |

---

## 3. Estrutura de Diretórios

```
flowlab/
├── public/                    # Arquivos estáticos
├── docs/                      # Documentação
├── src/
│   ├── App.tsx               # Componente raiz + Rotas
│   ├── main.tsx              # Entry point
│   ├── index.css             # Estilos globais (Tailwind)
│   │
│   ├── components/           # Componentes de UI
│   │   ├── Auth.tsx                    # Autenticação
│   │   ├── Layout.tsx                  # Layout principal + navegação
│   │   ├── Dashboard.tsx               # Painel de métricas
│   │   ├── ProductList.tsx             # Lista de produtos
│   │   ├── AddProduct.tsx              # Cadastro de produtos
│   │   ├── MovementHistory.tsx         # Histórico movimentações
│   │   ├── RequestManagement.tsx       # Gestão de requisições (SC/SM)
│   │   ├── RequestHub.tsx              # Hub central de solicitações
│   │   ├── PaymentRequestManagement.tsx # Solicitações de pagamento
│   │   ├── SupplierManagement.tsx      # Gestão de fornecedores
│   │   ├── UserManagement.tsx          # Gestão de usuários
│   │   ├── ExpirationMonitor.tsx       # Monitor de validade
│   │   ├── ProductChangeLog.tsx        # Log de alterações
│   │   ├── RequestPeriodConfig.tsx     # Configuração de períodos
│   │   ├── PurchaseComparison.tsx      # Comparativo de compras
│   │   ├── RequestChat.tsx             # Chat de requisições
│   │   ├── MaintenanceRequest/         # Módulo de manutenção
│   │   │   ├── MaintenanceRequestManagement.tsx
│   │   │   ├── MaintenanceRequestForm.tsx
│   │   │   └── services/
│   │   └── [modais e utilitários]
│   │
│   ├── modules/              # Módulos de domínio
│   │   ├── index.ts
│   │   │
│   │   ├── messaging/        # Sistema de mensageria
│   │   │   ├── index.ts
│   │   │   ├── types/
│   │   │   │   └── index.ts            # Types de mensagens
│   │   │   ├── providers/
│   │   │   │   └── WAHAProvider.ts     # Provider WhatsApp
│   │   │   ├── services/
│   │   │   │   ├── MessagingService.ts # Serviço principal
│   │   │   │   └── MessageProcessor.ts # Processador de fila
│   │   │   └── components/
│   │   │       ├── MessagingProviderSettings.tsx
│   │   │       └── MessagingStatusPanel.tsx
│   │   │
│   │   └── quotations/       # Sistema de cotações
│   │       ├── index.ts
│   │       ├── types/
│   │       │   └── index.ts            # Types de cotações
│   │       ├── hooks/
│   │       ├── workflow/
│   │       │   ├── index.ts
│   │       │   └── stateMachine.ts     # Máquina de estados
│   │       └── components/
│   │           ├── QuotationManagementPage.tsx
│   │           ├── QuotationList.tsx
│   │           ├── QuotationDrawer.tsx
│   │           ├── CreateQuotationModal.tsx
│   │           ├── AddProposalModal.tsx
│   │           ├── ProposalComparison.tsx
│   │           ├── ApprovalTimeline.tsx
│   │           ├── AuditLogTimeline.tsx
│   │           ├── MetricsDashboard.tsx
│   │           └── StatusStepper.tsx
│   │
│   ├── hooks/                # React Hooks customizados
│   │   ├── useAuth.ts                  # Autenticação
│   │   ├── useInventory.ts             # Operações de inventário
│   │   ├── useMessaging.ts             # Sistema de mensagens
│   │   ├── usePaymentRequest.ts        # Solicitações de pagamento
│   │   ├── useMaintenanceRequest.ts    # Solicitações de manutenção
│   │   ├── useNotification.ts          # Notificações
│   │   └── useDialog.ts                # Diálogos/modais
│   │
│   ├── lib/                  # Configurações de libs
│   │   ├── supabase.ts                 # Cliente Supabase
│   │   └── database.types.ts           # Types gerados do DB
│   │
│   ├── types/                # Tipos TypeScript globais
│   │   └── index.ts
│   │
│   └── utils/                # Utilitários
│       ├── permissions.ts              # Sistema de permissões
│       ├── paymentUtils.ts             # Utilitários de pagamento
│       └── mockData.ts                 # Dados de teste
│
├── supabase/
│   ├── migrations/           # Migrações SQL
│   └── scripts/              # Scripts auxiliares
│
├── docker-compose.yaml       # Configuração Docker
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── .env                      # Variáveis de ambiente
```

---

## 4. Arquitetura de Módulos

### 4.1 Diagrama de Módulos

```
┌─────────────────────────────────────────────────────────────────────┐
│                            APP.TSX                                  │
│                    (Rotas + Autenticação)                           │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
            ▼               ▼               ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │  INVENTÁRIO  │ │  REQUISIÇÕES │ │  FINANCEIRO  │
    ├──────────────┤ ├──────────────┤ ├──────────────┤
    │ • Produtos   │ │ • SC/SM      │ │ • Pagamentos │
    │ • Estoque    │ │ • Manutenção │ │ • Cotações   │
    │ • Moviment.  │ │ • Aprovações │ │ • Aprovações │
    │ • Validade   │ │ • Chat       │ │ • Limites    │
    └──────────────┘ └──────────────┘ └──────────────┘
            │               │               │
            └───────────────┼───────────────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
            ▼               ▼               ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │ FORNECEDORES │ │  MENSAGERIA  │ │   USUÁRIOS   │
    ├──────────────┤ ├──────────────┤ ├──────────────┤
    │ • Cadastro   │ │ • WhatsApp   │ │ • RBAC       │
    │ • Contatos   │ │ • Templates  │ │ • Perfis     │
    │ • Histórico  │ │ • Fila       │ │ • Permissões │
    └──────────────┘ └──────────────┘ └──────────────┘
```

### 4.2 Módulo de Mensageria (Detalhado)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    MESSAGING MODULE                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐ │
│  │  useMessaging   │───▶│ MessagingService│───▶│ MessageProcessor│ │
│  │     (Hook)      │    │   (Service)     │    │   (Processor)   │ │
│  └─────────────────┘    └────────┬────────┘    └─────────────────┘ │
│                                  │                                  │
│                                  ▼                                  │
│                    ┌─────────────────────────┐                     │
│                    │    IMessagingProvider   │                     │
│                    │      (Interface)        │                     │
│                    └───────────┬─────────────┘                     │
│                                │                                    │
│              ┌─────────────────┼─────────────────┐                 │
│              ▼                 ▼                 ▼                 │
│     ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│     │ WAHAProvider │  │ EmailProvider│  │  SMSProvider │          │
│     │  (WhatsApp)  │  │   (Futuro)   │  │   (Futuro)   │          │
│     └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │     WA-HA (Docker)      │
                    │   WhatsApp HTTP API     │
                    │   localhost:3000        │
                    └─────────────────────────┘
```

### 4.3 Módulo de Cotações (Workflow)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    QUOTATION WORKFLOW                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │ DRAFT   │───▶│SENT_TO_      │───▶│  WAITING_    │              │
│  │(Rascunho│    │SUPPLIERS     │    │  RESPONSES   │              │
│  └─────────┘    └──────────────┘    └──────┬───────┘              │
│                                            │                       │
│                                            ▼                       │
│  ┌─────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │CANCELLED│◀──│UNDER_REVIEW  │◀───│  (Propostas  │              │
│  └─────────┘    │(Em Análise)  │    │  Recebidas)  │              │
│       ▲         └──────┬───────┘    └──────────────┘              │
│       │                │                                           │
│       │                ▼                                           │
│       │         ┌──────────────┐                                  │
│       │         │  AWAITING_   │                                  │
│       └─────────│  APPROVAL    │                                  │
│                 └──────┬───────┘                                  │
│                        │                                           │
│              ┌─────────┴─────────┐                                │
│              ▼                   ▼                                 │
│       ┌──────────┐        ┌──────────┐                            │
│       │ APPROVED │        │ REJECTED │                            │
│       └────┬─────┘        └──────────┘                            │
│            │                                                       │
│            ▼                                                       │
│  ┌─────────────────────┐                                          │
│  │ CONVERTED_TO_       │                                          │
│  │ PURCHASE            │                                          │
│  └─────────────────────┘                                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. Modelo de Dados

### 5.1 Diagrama ER (Simplificado)

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│   PROFILES   │       │   PRODUCTS   │       │  SUPPLIERS   │
├──────────────┤       ├──────────────┤       ├──────────────┤
│ id (PK)      │       │ id (PK)      │       │ id (PK)      │
│ email        │       │ name         │       │ name         │
│ name         │       │ code         │       │ cnpj         │
│ role         │       │ category     │       │ email        │
│ department   │       │ quantity     │       │ phone        │
│ created_at   │       │ unit_price   │       │ status       │
└──────────────┘       │ supplier_id ─┼───────┤              │
       │               │ status       │       └──────────────┘
       │               └──────────────┘              │
       │                      │                      │
       │                      │                      │
       ▼                      ▼                      ▼
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│   REQUESTS   │       │ STOCK_       │       │  QUOTATIONS  │
├──────────────┤       │ MOVEMENTS    │       ├──────────────┤
│ id (PK)      │       ├──────────────┤       │ id (PK)      │
│ type (SC/SM) │       │ id (PK)      │       │ code         │
│ status       │       │ product_id   │       │ title        │
│ priority     │       │ type         │       │ status       │
│ requested_by │       │ quantity     │       │ created_by   │
│ items (JSON) │       │ reason       │       └──────┬───────┘
└──────────────┘       │ unit_price   │              │
                       └──────────────┘              │
                                                     ▼
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│  PAYMENT_    │       │ MAINTENANCE_ │       │  QUOTATION_  │
│  REQUESTS    │       │ REQUESTS     │       │  PROPOSALS   │
├──────────────┤       ├──────────────┤       ├──────────────┤
│ id (PK)      │       │ id (PK)      │       │ id (PK)      │
│ codigo       │       │ codigo       │       │ quotation_id │
│ tipo         │       │ equipment    │       │ supplier_id  │
│ fornecedor   │       │ description  │       │ unit_price   │
│ valor_total  │       │ status       │       │ delivery_time│
│ status       │       │ priority     │       │ status       │
└──────────────┘       └──────────────┘       └──────────────┘

┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│  MESSAGING_  │       │  QUOTATION_  │       │  MESSAGE_    │
│  PROVIDERS   │       │  MESSAGES    │       │  TEMPLATES   │
├──────────────┤       ├──────────────┤       ├──────────────┤
│ id (PK)      │       │ id (PK)      │       │ id (PK)      │
│ code         │       │ quotation_id │       │ code         │
│ name         │       │ supplier_id  │       │ name         │
│ type         │       │ provider_id  │       │ provider_type│
│ config (JSON)│       │ status       │       │ subject      │
│ is_active    │       │ sent_at      │       │ body         │
└──────────────┘       └──────────────┘       └──────────────┘
```

### 5.2 Entidades Principais

#### Produtos
```typescript
interface Product {
  id: string;
  name: string;
  code: string;
  category: 'general' | 'technical';
  quantity: number;
  unit: string;
  unitPrice: number;
  totalValue: number;
  supplierId: string;
  expirationDate: string;
  location: string;
  minStock: number;
  status: 'active' | 'expired' | 'low-stock';
}
```

#### Requisições (SC/SM)
```typescript
interface Request {
  id: string;
  type: 'SC' | 'SM';              // Serviço ou Material
  items: RequestItem[];
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  priority: 'standard' | 'priority' | 'urgent';
  requestedBy: string;
  department: Department;
  receiver_signature?: string;    // Assinatura digital
}
```

#### Solicitações de Pagamento
```typescript
interface PaymentRequest {
  id: string;
  codigo: string;
  tipoSolicitacao: 'PAGAMENTO' | 'REEMBOLSO' | 'ADIANTAMENTO';
  formaPagamento: 'PIX' | 'DINHEIRO' | 'BOLETO' | 'CAJU' | 'SOLIDES';
  valorTotal: number;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  fornecedor: string;
  cpfCnpj: string;
}
```

#### Cotações
```typescript
interface QuotationFull {
  id: string;
  code: string;
  title: string;
  status: QuotationStatus;
  items: QuotationItemFull[];
  proposals: SupplierProposal[];
  approvalFlow: ApprovalStep[];
  deadline: string;
  createdBy: string;
}
```

#### Provedores de Mensageria
```typescript
interface MessagingProvider {
  id: string;
  code: string;
  name: string;
  type: 'whatsapp' | 'email' | 'sms' | 'api';
  config: {
    apiUrl?: string;
    sessionName?: string;
    token?: string;
  };
  isActive: boolean;
  healthStatus: 'online' | 'offline' | 'error';
}
```

---

## 6. Sistema de Autenticação e Permissões

### 6.1 Roles (Papéis)

| Role | Descrição | Acesso |
|------|-----------|--------|
| `admin` | Administrador | Acesso total ao sistema |
| `operator` | Operador de estoque | Gestão de produtos e requisições |
| `requester` | Solicitante | Criar requisições próprias |

### 6.2 Departamentos

```typescript
type Department =
  | 'TRANSPORTE'
  | 'ESTOQUE'
  | 'FINANCEIRO'
  | 'FATURAMENTO'
  | 'AREA_TECNICA'
  | 'RH'
  | 'COMERCIAL'
  | 'TI'
  | 'MARKETING'
  | 'QUALIDADE'
  | 'COPA_LIMPEZA'
  | 'ATENDIMENTO'
  | 'DIRETORIA'
  | 'BIOLOGIA_MOLECULAR';
```

### 6.3 Matriz de Permissões

| Permissão | Admin | Operator | Requester |
|-----------|:-----:|:--------:|:---------:|
| canViewDashboard | ✅ | ❌ | ❌ |
| canManageProducts | ✅ | ✅ | ❌ |
| canViewProducts | ✅ | ✅ | ❌ |
| canAddProducts | ✅ | ✅ | ❌ |
| canEditProducts | ✅ | ✅ | ❌ |
| canDeleteProducts | ✅ | ✅ | ❌ |
| canViewMovements | ✅ | ✅ | ❌ |
| canAddMovements | ✅ | ✅ | ❌ |
| canViewRequests | ✅ | ✅ | ✅ |
| canAddRequests | ✅ | ✅ | ✅ |
| canApproveRequests | ✅ | ✅ | ❌ |
| canViewExpiration | ✅ | ✅ | ❌ |
| canViewChangelog | ✅ | ✅ | ❌ |
| canManageUsers | ✅ | ❌ | ❌ |
| canManageSuppliers | ✅ | ✅ | ❌ |
| canManageQuotations | ✅ | ✅ | ❌ |
| canConfigureRequestPeriods | ✅ | ✅ | ❌ |

---

## 7. Rotas da Aplicação

### 7.1 Rotas Públicas
| Rota | Componente | Descrição |
|------|------------|-----------|
| `/reset-password` | ResetPassword | Redefinição de senha |

### 7.2 Rotas Autenticadas
| Rota | Componente | Permissão |
|------|------------|-----------|
| `/` | Home | - |
| `/dashboard` | Dashboard | canViewDashboard |
| `/products` | ProductList | canViewProducts |
| `/add-product` | AddProduct | canAddProducts |
| `/movements` | MovementHistory | canViewMovements |
| `/requests` | RequestHub | canViewRequests |
| `/requests/purchases` | RequestManagement | canViewRequests |
| `/requests/payments` | PaymentRequestManagement | canViewRequests |
| `/requests/maintenance` | MaintenanceRequestManagement | canViewRequests |
| `/expiration` | ExpirationMonitor | canViewExpiration |
| `/changelog` | ProductChangeLog | canViewChangelog |
| `/users` | UserManagement | canManageUsers |
| `/suppliers` | SupplierManagement | canManageSuppliers |
| `/quotations` | QuotationManagementPage | canManageQuotations |
| `/request-periods` | RequestPeriodConfig | canConfigureRequestPeriods |
| `/messaging-settings` | MessagingProviderSettings | canManageUsers |

### 7.3 Menu de Navegação

```
📊 Dashboard
📦 Produtos
   ├── Lista de Produtos
   ├── Adicionar Produto
   ├── Controle de Validade
   └── Histórico de Alterações
📋 Movimentações
📝 Solicitações
🏢 Fornecedores
🧮 Cotações
👥 Usuários
⚙️ Sistema
   ├── Configurar Períodos
   └── Provedores de Mensagens
```

---

## 8. Integrações

### 8.1 WA-HA (WhatsApp HTTP API)

**Configuração:**
```env
VITE_WAHA_API_URL=http://localhost:3000
VITE_WAHA_SESSION_NAME=quotations_001
VITE_WAHA_API_KEY=sua_api_key
```

**Endpoints utilizados:**
| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/sessions/{session}` | GET | Status da sessão |
| `/api/sendText` | POST | Enviar mensagem |

**Formato de autenticação:**
```
Header: X-Api-Key: {token}
```

### 8.2 Supabase

**Serviços utilizados:**
- **Auth**: Autenticação de usuários
- **Database**: PostgreSQL com RLS
- **Storage**: Armazenamento de anexos e PDFs
- **Realtime**: Atualizações em tempo real (chat)

---

## 9. Migrações do Banco de Dados

Lista cronológica de migrações:

| Data | Arquivo | Descrição |
|------|---------|-----------|
| 2025-06-10 | nameless_dawn | Estrutura inicial |
| 2025-06-12 | withered_cliff | Ajustes de schema |
| 2025-06-16 | rough_breeze | Novas tabelas |
| 2025-06-16 | billowing_garden | Índices |
| 2025-06-18 | spring_night | Triggers |
| 2025-06-18 | old_summit | Views |
| 2025-07-07 | autumn_gate | Requisições |
| 2025-07-07 | broad_field | Movimentações |
| 2025-07-08 | heavy_pond | Fornecedores |
| 2025-10-01 | winter_mouse | Cotações v1 |
| 2025-12-05 | payment_requests | Pagamentos |
| 2025-12-05 | message_read_status | Status mensagens |
| 2025-12-08 | add_read_by | Read tracking |
| 2025-12-08 | add_attachment | Anexos pagamentos |
| 2025-12-09 | remove_email | Remove notif. email |
| 2025-12-12 | update_payment_methods | Métodos pagamento |
| 2025-12-15 | add_attachment_requests | Anexos requisições |
| 2026-02-12 | maintenance_requests | Manutenção |
| 2026-02-19 | expand_quotations | Cotações v2 |
| 2026-02-19 | messaging_infrastructure | Mensageria |
| 2026-02-19 | messaging_seed | Seed mensageria |
| 2026-02-20 | user_approval_limits | Limites aprovação |

---

## 10. Variáveis de Ambiente

```env
# Supabase
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...

# WA-HA (WhatsApp)
VITE_WAHA_API_URL=http://localhost:3000
VITE_WAHA_SESSION_NAME=quotations_001
VITE_WAHA_API_KEY=sua_api_key
```

---

## 11. Deploy e Infraestrutura

### 11.1 Desenvolvimento Local
```bash
npm install
npm run dev
```

### 11.2 Docker (WA-HA)
```bash
docker run -d \
  --name waha \
  -p 3000:3000 \
  -e WHATSAPP_API_KEY=sua_chave \
  -e WAHA_DASHBOARD_ENABLED=true \
  -v waha_sessions:/app/.sessions \
  devlikeapro/waha-plus
```

### 11.3 Produção (Vercel)
- Build: `npm run build`
- Output: `dist/`
- Configuração: `vercel.json`

---

## 12. Segurança

### 12.1 Implementações
- ✅ Row Level Security (RLS) em todas as tabelas
- ✅ Autenticação via Supabase Auth
- ✅ Tokens JWT para sessões
- ✅ CORS configurado
- ✅ Sanitização de inputs
- ✅ Mascaramento de dados sensíveis (tokens)

### 12.2 Boas Práticas
- Variáveis sensíveis apenas no `.env`
- Nenhuma credencial no código
- Logs de auditoria para ações críticas
- Assinatura digital para recebimentos

---

## 13. Considerações Finais

### Pontos Fortes
- Arquitetura modular e escalável
- Tipagem forte com TypeScript
- Sistema de permissões granular
- Integração WhatsApp para fornecedores
- Workflow completo de cotações

### Melhorias Futuras
- [ ] Provider de Email (SMTP)
- [ ] Provider de SMS
- [ ] Dashboard de métricas em tempo real
- [ ] App mobile (React Native)
- [ ] Integração com ERP
- [ ] Relatórios avançados com BI

---

*Documentação gerada em Março/2026*
