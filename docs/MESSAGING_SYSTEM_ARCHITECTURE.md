# Arquitetura do Sistema de Mensageria

> Contexto de referência gerado em 24/04/2026. Descreve o estado **atual** da implementação.

---

## 1. Visão Geral

O sistema de mensageria é um módulo independente (`src/modules/messaging/`) responsável pelo **envio automatizado de mensagens** a fornecedores no contexto do módulo de cotações. Ele é agnóstico ao canal de comunicação — suporta WhatsApp (via WA-HA), e tem slots para Email, SMS e API genérica.

**Escopo atual:** envio de convites de cotação para fornecedores via WhatsApp.  
**Escopo fora deste módulo:** o chat interno entre usuários do sistema (ex: `it_task_comments`) usa Supabase Realtime diretamente e **não** passa por este módulo.

---

## 2. Estrutura de Arquivos

```
src/modules/messaging/
├── index.ts                          # Barrel de exportações públicas
├── types/
│   └── index.ts                      # Todos os tipos TypeScript do módulo
├── providers/
│   └── WAHAProvider.ts               # Implementação do provedor WhatsApp HTTP API
├── services/
│   ├── MessagingService.ts           # Serviço central (singleton: messagingService)
│   └── MessageProcessor.ts          # Background job (singleton: messageProcessor)
└── components/
    ├── MessagingProviderSettings.tsx  # Admin UI: CRUD de provedores
    └── MessagingStatusPanel.tsx       # Admin UI: painel de status e logs
```

**Hook de integração React:**
```
src/hooks/useMessaging.ts             # Interface React para todo o módulo
```

---

## 3. Camadas da Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│  CAMADA DE UI (React)                                   │
│  MessagingProviderSettings  |  MessagingStatusPanel     │
└────────────────────┬────────────────────────────────────┘
                     │ useMessaging (hook)
┌────────────────────▼────────────────────────────────────┐
│  CAMADA DE APLICAÇÃO                                    │
│  MessagingService (singleton)                           │
│  ├─ initialize()          → carrega provedores ativos   │
│  ├─ sendMessage()         → envia via provedor          │
│  ├─ resendMessage()       → reenvia falhadas            │
│  ├─ processPendingMessages() → batch de pendentes       │
│  └─ processRetryQueue()   → retry de falhas             │
│                                                         │
│  MessageProcessor (singleton / background job)          │
│  ├─ start() / stop()      → controle do intervalo       │
│  ├─ ciclo de 30s          → processPending + retry      │
│  └─ ciclo de 5min         → health checks               │
└──────────┬────────────────────────┬────────────────────-┘
           │ IMessagingProvider     │ supabase client
┌──────────▼──────────┐   ┌────────▼──────────────────────┐
│  CAMADA DE PROVIDER │   │  BANCO DE DADOS (Supabase)    │
│  WAHAProvider       │   │  (ver seção 5)                │
│  ├─ initialize()    │   └───────────────────────────────┘
│  ├─ sendMessage()   │
│  ├─ checkHealth()   │
│  └─ dispose()       │
└─────────────────────┘
           │ HTTP (fetch)
┌──────────▼──────────┐
│  WA-HA (Docker)     │
│  POST /api/sendText │
└─────────────────────┘
```

---

## 4. Fluxo de Envio de Mensagem

```
1. UI / quotations module
      └─► useMessaging.sendMessage(input)
            └─► messagingService.sendMessage(input)
                  ├─ Busca/cria registro em quotation_messages (status: pending)
                  ├─ Atualiza status → 'sending'
                  ├─ Seleciona provedor ativo (por providerId ou o primeiro disponível)
                  ├─► WAHAProvider.sendMessage(recipient, body)
                  │         └─► POST {apiUrl}/api/sendText  (WA-HA Docker)
                  │               ├─ Sucesso → status: 'sent', salva provider_response
                  │               └─ Falha   → status: 'failed', agenda retry_queue
                  └─ Retorna SendMessageResult
```

**Retry automático:**
```
MessageProcessor (a cada 30s)
  ├─► processPendingMessages()  → mensagens com status 'pending'
  └─► processRetryQueue()       → lê message_retry_queue via RPC get_messages_for_retry
                                   └─► resendMessage() → limita por max_attempts (padrão: 3)
```

---

## 5. Schema do Banco de Dados

Migrations: `supabase/migrations/20260219130000_messaging_infrastructure.sql`

```
messaging_providers
├─ id             UUID PK
├─ code           VARCHAR(50) UNIQUE   ← identificador programático
├─ name           VARCHAR(100)
├─ type           ENUM (whatsapp | email | sms | api)
├─ config         JSONB                ← apiUrl, sessionName, token, etc.
├─ is_active      BOOLEAN
├─ health_status  ENUM (online | offline | error | unknown)
└─ last_health_check  TIMESTAMPTZ

message_templates
├─ id             UUID PK
├─ code           VARCHAR(50) UNIQUE   ← ex: 'quotation_invitation'
├─ provider_type  VARCHAR(30)
├─ body           TEXT                 ← suporta variáveis {{quotationCode}} etc.
└─ variables      JSONB[]

quotation_messages
├─ id             UUID PK
├─ quotation_id   FK → quotations
├─ supplier_id    FK → suppliers
├─ provider_id    FK → messaging_providers (nullable)
├─ template_id    FK → message_templates (nullable)
├─ recipient      VARCHAR(255)         ← número de telefone ou email
├─ body           TEXT                 ← mensagem renderizada
├─ status         ENUM (pending | sending | sent | failed | delivered | read)
├─ attempt_count  INTEGER (default 0)
├─ max_attempts   INTEGER (default 3)
├─ provider_response  JSONB            ← resposta raw do WA-HA
└─ error_message  TEXT

message_retry_queue
├─ id             UUID PK
├─ message_id     FK → quotation_messages (UNIQUE)
├─ next_retry_at  TIMESTAMPTZ
└─ priority       INTEGER

provider_health_logs
├─ id             UUID PK
├─ provider_id    FK → messaging_providers
├─ status         ENUM (healthy | degraded | unhealthy)
├─ response_time_ms  INTEGER
└─ details        JSONB
```

**Views/RPCs utilizadas:**
- `quotation_message_status` — view de stats agregados por cotação
- `get_messages_for_retry()` — RPC que retorna itens maduros da retry queue

---

## 6. Provedor WA-HA (WhatsApp HTTP API)

**O que é:** container Docker auto-hospedado que expõe uma REST API para o WhatsApp Web.  
**Repositório:** https://github.com/devlikeapro/waha

**Configuração necessária (armazenada em `config` JSONB):**
| Campo | Obrigatório | Descrição |
|---|---|---|
| `apiUrl` | ✅ | URL base do container, ex: `http://localhost:3000` |
| `sessionName` | ✅ | Nome da sessão WA-HA, ex: `quotations_001` |
| `token` | ⬜ | API Key para autenticação (`X-Api-Key` header) |

**Endpoints utilizados:**
- `POST /api/sendText` — envia mensagem de texto
- `GET /api/sessions/{sessionName}` — verifica status da sessão (health check)

**Formato de destinatário:** `5511999999999@c.us` (DDI + DDD + número, sem `+`)

---

## 7. Ciclo de Vida do MessageProcessor

O `MessageProcessor` é um **singleton** que roda no cliente (browser). É iniciado manualmente pela UI (`MessagingProviderSettings`) ou pode ser iniciado automaticamente no boot da aplicação.

```
messageProcessor.start()
  ├─ Inicializa MessagingService (carrega provedores do DB)
  ├─ setInterval(processMessages, 30_000ms)
  │     ├─ processPendingMessages()   → até 10 mensagens por ciclo
  │     └─ processRetryQueue()        → todas com next_retry_at <= now()
  │         (delay de 2s entre envios para evitar rate limiting)
  └─ setInterval(performHealthChecks, 300_000ms)
        └─ Para cada provedor ativo: WAHAProvider.checkHealth()
              └─ Persiste resultado em provider_health_logs

messageProcessor.stop()
  └─ clearInterval() → para todos os ciclos
```

**Estado exposto via `getStatus()`:**
```ts
{ running: boolean; intervalMs: number }
```

---

## 8. Interface React (useMessaging)

O hook `useMessaging` é a **única interface pública** do módulo para componentes React. Ele encapsula toda a lógica de estado e delegação:

```ts
// Envio
sendMessage(input: SendMessageInput): Promise<SendMessageResult>
resendMessage(messageId: string): Promise<SendMessageResult>

// Consulta
getMessageStatus(messageId: string): Promise<QuotationMessage>
getQuotationMessages(quotationId: string): Promise<QuotationMessage[]>
getQuotationStats(quotationId: string): Promise<MessagingStats>

// Provedores (CRUD)
providers: MessagingProvider[]          // estado reativo
loadProviders()
createProvider(data)
updateProvider(id, data)
deleteProvider(id)
testProviderConnection(id)

// Saúde
checkProviderHealth(providerId): Promise<HealthLog | null>
getAllProviderHealth(): Promise<{ provider, health }[]>

// Processador
startProcessor()
stopProcessor()
getProcessorStatus(): { running, intervalMs }
```

---

## 9. Tipos de Status de Mensagem

```
pending  →  sending  →  sent  →  delivered  →  read
                    ↘  failed  →  [retry_queue]  →  sending (retry)
                                                  ↘  failed (max_attempts atingido)
```

---

## 10. Limitações e Decisões de Design Conhecidas

| Aspecto | Situação atual |
|---|---|
| **Execução do processor** | Roda no browser (client-side). Não persiste entre reloads ou abas fechadas. |
| **Provedores implementados** | Apenas `WAHAProvider` (WhatsApp). Email/SMS/API são stubs no enum. |
| **Autenticação do WA-HA** | Token é armazenado em plaintext no JSONB `config`. Não há criptografia em nível de aplicação. |
| **Templates** | Apenas `quotation_invitation` está em produção. Renderização via `render_message_template()` (PL/pgSQL). |
| **Webhook de entrega** | Estrutura `WAHAWebhookPayload` tipada, mas **não há endpoint de recebimento** implementado no frontend. |
| **Rate limiting** | Delay fixo de 2s entre mensagens no processador. Sem controle de quota por provedor. |
| **Realtime** | Não usa Supabase Realtime. Consulta por polling (hook + interval manual na UI). |
