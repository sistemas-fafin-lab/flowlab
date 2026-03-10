# Arquitetura do Sistema de Mensageria - Diagramas

## Fluxo de Envio de Mensagens

```mermaid
sequenceDiagram
    participant U as Usuário
    participant UI as Interface React
    participant Q as Quotations Table
    participant T as Trigger SQL
    participant QM as quotation_messages
    participant W as MessageProcessor
    participant MS as MessagingService
    participant P as WAHAProvider
    participant WA as WA-HA API
    participant S as Fornecedor

    U->>UI: Clica "Enviar para Fornecedores"
    UI->>Q: UPDATE status = 'sent_to_suppliers'
    Q->>T: TRIGGER fired
    T->>QM: INSERT mensagens (status: pending)
    
    loop A cada 30 segundos
        W->>QM: SELECT * WHERE status = 'pending'
        W->>MS: processPendingMessages()
        MS->>QM: UPDATE status = 'sending'
        MS->>P: sendMessage(recipient, body)
        P->>WA: POST /sendText
        WA->>S: Envia WhatsApp
        
        alt Sucesso
            WA-->>P: 200 OK
            P-->>MS: success = true
            MS->>QM: UPDATE status = 'sent'
        else Falha
            WA-->>P: 500 Error
            P-->>MS: success = false
            MS->>QM: UPDATE status = 'failed'
            MS->>QM: INSERT retry_queue
        end
    end
```

## Arquitetura de Componentes

```mermaid
graph TB
    subgraph Frontend["Frontend - React"]
        UI[MessagingStatusPanel]
        ADMIN[MessagingProviderSettings]
        HOOK[useMessaging Hook]
    end

    subgraph Services["Services Layer"]
        MS[MessagingService]
        MP[MessageProcessor]
    end

    subgraph Providers["Provider Abstraction"]
        IPROV[IMessagingProvider Interface]
        WAHA[WAHAProvider]
        EMAIL[EmailProvider Future]
        SMS[SMSProvider Future]
    end

    subgraph Database["PostgreSQL Database"]
        MPROV[(messaging_providers)]
        TEMP[(message_templates)]
        QMSG[(quotation_messages)]
        RETRY[(message_retry_queue)]
        HEALTH[(provider_health_logs)]
    end

    subgraph External["External Services"]
        WAHAAPI[WA-HA Docker Container]
        WHATSAPP[WhatsApp Business]
    end

    UI --> HOOK
    ADMIN --> HOOK
    HOOK --> MS
    HOOK --> MP
    
    MS --> IPROV
    MP --> MS
    
    IPROV --> WAHA
    IPROV --> EMAIL
    IPROV --> SMS
    
    MS --> MPROV
    MS --> TEMP
    MS --> QMSG
    MS --> RETRY
    MP --> HEALTH
    
    WAHA --> WAHAAPI
    WAHAAPI --> WHATSAPP
    WHATSAPP --> FORNECEDOR[Fornecedor]
```

## Modelo de Dados

```mermaid
erDiagram
    quotations ||--o{ quotation_messages : "triggers creation"
    suppliers ||--o{ quotation_messages : "receives"
    messaging_providers ||--o{ quotation_messages : "sends via"
    message_templates ||--o{ quotation_messages : "uses"
    quotation_messages ||--o| message_retry_queue : "schedules retry"
    messaging_providers ||--o{ provider_health_logs : "monitors"

    quotations {
        uuid id PK
        varchar status
        timestamptz created_at
    }

    suppliers {
        uuid id PK
        varchar name
        varchar whatsapp
        varchar email
    }

    messaging_providers {
        uuid id PK
        varchar code UK
        varchar name
        varchar type
        jsonb config
        boolean is_active
        varchar health_status
        timestamptz last_health_check
    }

    message_templates {
        uuid id PK
        varchar code UK
        varchar name
        varchar provider_type
        varchar subject
        text body
        jsonb variables
        boolean is_active
    }

    quotation_messages {
        uuid id PK
        uuid quotation_id FK
        uuid supplier_id FK
        uuid provider_id FK
        uuid template_id FK
        varchar recipient
        text body
        varchar status
        int attempt_count
        int max_attempts
        timestamptz sent_at
        timestamptz delivered_at
        timestamptz read_at
        timestamptz failed_at
        text error_message
        jsonb provider_response
    }

    message_retry_queue {
        uuid id PK
        uuid message_id FK
        timestamptz retry_at
        int priority
    }

    provider_health_logs {
        uuid id PK
        uuid provider_id FK
        varchar status
        int response_time_ms
        jsonb details
        timestamptz created_at
    }
```

## Estados e Transições de Mensagens

```mermaid
stateDiagram-v2
    [*] --> pending: Trigger cria registro
    pending --> sending: MessageProcessor inicia
    sending --> sent: WA-HA retorna sucesso
    sending --> failed: WA-HA retorna erro
    
    failed --> retry_queue: Agendar retry
    retry_queue --> pending: Após delay (5min)
    
    sent --> delivered: Webhook confirmação
    delivered --> read: Fornecedor lê mensagem
    
    failed --> [*]: Max tentativas (3x)
    read --> [*]
    
    note right of retry_queue
        Até 3 tentativas
        Delay: 5 minutos
    end note
    
    note right of sent
        Sucesso na API
        Ainda não entregue
    end note
```

## Fluxo de Health Check

```mermaid
sequenceDiagram
    participant MP as MessageProcessor
    participant DB as Database
    participant WAHA as WAHAProvider
    participant API as WA-HA API

    loop A cada 5 minutos
        MP->>DB: SELECT * FROM messaging_providers WHERE is_active = true
        
        loop Para cada provider
            MP->>WAHA: checkHealth()
            WAHA->>API: GET /sessions/{sessionName}
            
            alt Session WORKING
                API-->>WAHA: {status: "WORKING"}
                WAHA-->>MP: {healthy: true, responseTime: 120}
                MP->>DB: INSERT provider_health_logs (status: 'healthy')
            else Session FAILED
                API-->>WAHA: {status: "FAILED"}
                WAHA-->>MP: {healthy: false, error: "Session failed"}
                MP->>DB: INSERT provider_health_logs (status: 'unhealthy')
            else Network Error
                API-->>WAHA: Connection refused
                WAHA-->>MP: {healthy: false, error: "Network error"}
                MP->>DB: INSERT provider_health_logs (status: 'unhealthy')
            end
            
            MP->>DB: UPDATE messaging_providers SET last_health_check = NOW()
        end
    end
```

## Deploy e Configuração

```mermaid
graph LR
    subgraph Dev["Development"]
        CODE[Código TypeScript]
        MIGR[Migrations SQL]
    end

    subgraph Supabase["Supabase Cloud"]
        PGDB[(PostgreSQL)]
        TRIGGERS[Triggers & Functions]
        RLS[Row Level Security]
    end

    subgraph Docker["Docker Container"]
        WAHA[WA-HA Service]
        WHATSAPP_SESSION[WhatsApp Session]
    end

    subgraph Frontend["Vercel/Netlify"]
        REACT[React App]
        WORKER[MessageProcessor]
    end

    CODE --> REACT
    MIGR --> PGDB
    
    REACT --> PGDB
    REACT --> WORKER
    
    WORKER --> PGDB
    WORKER --> WAHA
    
    WAHA --> WHATSAPP_SESSION
    WHATSAPP_SESSION --> WHATSAPP_API[WhatsApp Business API]
    
    TRIGGERS --> PGDB
    RLS --> PGDB
```

## Casos de Uso

```mermaid
graph TD
    START[Início]
    
    START --> UC1[UC1: Enviar Cotação]
    START --> UC2[UC2: Monitorar Envios]
    START --> UC3[UC3: Reenviar Falhas]
    START --> UC4[UC4: Configurar Provedores]
    START --> UC5[UC5: Health Check]
    
    UC1 --> A1[Usuário clica Enviar]
    A1 --> A2[Status muda para sent_to_suppliers]
    A2 --> A3[Trigger cria mensagens pending]
    A3 --> A4[Worker processa em background]
    A4 --> A5[Mensagens enviadas via WA-HA]
    
    UC2 --> B1[Acessar QuotationDrawer]
    B1 --> B2[Ver aba Mensagens]
    B2 --> B3[Status: Enviadas/Falhas/Pendentes]
    
    UC3 --> C1[Detectar mensagem failed]
    C1 --> C2[Clicar Reenviar]
    C2 --> C3[Incrementa attempt_count]
    C3 --> C4[Tenta novamente via WA-HA]
    
    UC4 --> D1[Admin acessa Settings]
    D1 --> D2[Vê lista de provedores]
    D2 --> D3[Atualiza config no banco]
    D3 --> D4[Testa health check]
    
    UC5 --> E1[Worker executa a cada 5min]
    E1 --> E2[Chama checkHealth em cada provider]
    E2 --> E3[Registra status em logs]
    E3 --> E4[Alerta se unhealthy]
```
