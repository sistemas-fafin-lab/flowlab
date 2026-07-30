# Sistema de Mensageria Automática - FASE 2

## 📋 Visão Geral

Sistema arquitetural para envio automático de mensagens WhatsApp aos fornecedores quando uma cotação é enviada. Implementação modular, segura e extensível que permite futura evolução para comunicação bidirecional.

## 🏗️ Arquitetura

### Componentes Principais

```
modules/messaging/
├── types/
│   └── index.ts              # Definições TypeScript completas
├── providers/
│   ├── WAHAProvider.ts       # Implementação WA-HA (WhatsApp)
│   └── [futuros]             # EmailProvider, SMSProvider, etc.
├── services/
│   ├── MessagingService.ts   # Serviço principal de envio
│   └── MessageProcessor.ts   # Worker para processamento em background
├── components/
│   └── MessagingStatusPanel.tsx  # UI de visualização de status
└── index.ts                  # Exports centralizados
```

### Banco de Dados

```sql
-- 5 Tabelas Principais:
messaging_providers        # Configuração de provedores (WA-HA, Email, etc)
message_templates          # Templates com variáveis substituíveis
quotation_messages         # Log de todas as mensagens enviadas
message_retry_queue        # Fila de retry para mensagens falhas
provider_health_logs       # Monitoramento de saúde dos provedores
```

## 🚀 Funcionalidades Implementadas

### ✅ 1. Integração Isolada com Backend

- **Interface Abstrata**: `IMessagingProvider` permite múltiplos provedores
- **WAHAProvider**: Implementação completa para WhatsApp HTTP API
- **Configuração Dinâmica**: Provedores gerenciados via banco de dados
- **Sem Dependências Cruzadas**: Sistema completamente isolado

### ✅ 2. Event-Driven: Envio Automático

```sql
-- Trigger automático quando quotation.status muda para 'sent_to_suppliers'
CREATE TRIGGER trigger_send_quotation_messages
  AFTER INSERT OR UPDATE OF status ON quotations
  FOR EACH ROW EXECUTE FUNCTION trigger_quotation_messages();
```

Quando uma cotação é "Enviada para Fornecedores":
- ✅ Busca fornecedores associados (com WhatsApp cadastrado)
- ✅ Cria registros automáticos em `quotation_messages` com status `pending`
- ✅ Worker processa fila a cada 30 segundos

### ✅ 3. Template Engine com Variáveis

Templates SQL renderizados via função:

```sql
SELECT render_message_template(
  'Olá {{supplier_name}}, nova cotação #{{quotation_code}}',
  '{"supplier_name": "Empresa XYZ", "quotation_code": "COT-2024-001"}'::jsonb
);
-- Resultado: "Olá Empresa XYZ, nova cotação #COT-2024-001"
```

Variáveis disponíveis:
- `{{supplier_name}}` - Nome do fornecedor
- `{{quotation_code}}` - Código da cotação
- `{{quotation_title}}` - Título da cotação
- `{{deadline}}` - Prazo de resposta
- `{{link}}` - Link para responder (futuro)

### ✅ 4. Logs Completos de Envio

Cada mensagem registra:
- ✅ Status (`pending`, `sending`, `sent`, `delivered`, `read`, `failed`)
- ✅ Timestamp de cada etapa (sent_at, delivered_at, read_at, failed_at)
- ✅ Contagem de tentativas (attempt_count / max_attempts)
- ✅ Resposta completa do provedor (provider_response JSON)
- ✅ Mensagens de erro detalhadas

### ✅ 5. Monitoramento de Sessões WA-HA

```typescript
// Health check automático a cada 5 minutos
const health = await wahaProvider.checkHealth();
// Valida: session.status === 'WORKING'
```

Logs armazenados em `provider_health_logs`:
- ✅ Status (healthy, degraded, unhealthy)
- ✅ Tempo de resposta (response_time_ms)
- ✅ Detalhes da sessão WA-HA
- ✅ Histórico completo

### ✅ 6. Retry Inteligente

Sistema de 3 camadas:

1. **Banco de Dados**: Fila `message_retry_queue` com scheduling
2. **Worker**: `MessageProcessor` processa retries automaticamente
3. **Configurável**: Delay personalizável (padrão: 5 minutos)

```typescript
// Retry automático após 5 minutos
await schedule_message_retry(messageId, 300);
```

### ✅ 7. Fundação para Comunicação Bidirecional

Arquitetura preparada para:
- 🔄 Webhooks de confirmação de entrega
- 🔄 Recebimento de respostas dos fornecedores
- 🔄 Atualização automática de status
- 🔄 Integração com sistema de propostas

## 🔧 Configuração

### 1. Executar Migration SQL

```bash
# Aplica estrutura completa do banco
supabase db push
```

### 2. Configurar Provedor WA-HA

```sql
INSERT INTO messaging_providers (name, type, config, is_active)
VALUES (
  'WhatsApp Principal',
  'whatsapp',
  '{
    "apiUrl": "http://localhost:3000",
    "apiKey": "seu-api-key-aqui",
    "sessionName": "default"
  }'::jsonb,
  true
);
```

### 3. Cadastrar Números WhatsApp nos Fornecedores

```sql
UPDATE suppliers
SET whatsapp = '+5511999999999'
WHERE id = 'supplier-uuid';
```

### 4. Iniciar Worker de Processamento

```typescript
import { messageProcessor } from './modules/messaging';

// Inicia processamento automático
await messageProcessor.start();

// Status
const status = messageProcessor.getStatus();
console.log(status.running); // true
```

## 📱 Uso no Frontend

### Hook useMessaging

```typescript
import { useMessaging } from '../hooks/useMessaging';

function MyComponent() {
  const { sendMessage, getQuotationStats } = useMessaging();
  
  // Enviar manualmente
  const handleSend = async () => {
    const result = await sendMessage({
      quotationId: 'uuid',
      supplierId: 'uuid',
      recipient: '+5511999999999',
    });
  };
  
  // Obter estatísticas
  const stats = await getQuotationStats('quotation-uuid');
  console.log(stats.sentCount, stats.failedCount);
}
```

### Componente de Visualização

```tsx
import { MessagingStatusPanel } from '../modules/messaging';

<MessagingStatusPanel 
  quotationId={quotation.id}
  onResend={(messageId) => console.log('Reenviado:', messageId)}
/>
```

## 🔐 Segurança

- ✅ API Key WA-HA armazenada em `config` JSONB (criptografável)
- ✅ RLS (Row Level Security) habilitado em todas as tabelas
- ✅ Logs auditáveis com `created_by` e `updated_by`
- ✅ Validação de formato de número (servidor + cliente)
- ✅ Rate limiting implementável via worker delay

## 📊 Monitoramento

### View de Status por Cotação

```sql
SELECT * FROM quotation_message_status
WHERE quotation_id = 'uuid';
```

Retorna:
- Total de mensagens
- Contagem por status (sent, failed, pending, etc)
- Último envio/entrega

### Health Logs

```sql
SELECT * FROM provider_health_logs
WHERE provider_id = 'uuid'
ORDER BY created_at DESC
LIMIT 10;
```

## 🔄 Fluxo de Envio

```
1. Usuário clica "Enviar para Fornecedores"
   ↓
2. quotations.status = 'sent_to_suppliers'
   ↓
3. TRIGGER cria registros em quotation_messages (status: pending)
   ↓
4. MessageProcessor detecta mensagens pending (a cada 30s)
   ↓
5. MessagingService.sendMessage() para cada mensagem
   ↓
6. WAHAProvider.sendMessage() → API WA-HA
   ↓
7. Atualiza status: sent | failed
   ↓
8. Se failed: schedule_message_retry() → retry_queue
   ↓
9. MessageProcessor processa retry_queue (max 3 tentativas)
```

## 🛠️ Extensibilidade

### Adicionar Novo Provider

```typescript
// providers/EmailProvider.ts
export class EmailProvider implements IMessagingProvider {
  async initialize(): Promise<void> {
    // Setup SMTP, SendGrid, etc
  }
  
  async sendMessage(to: string, body: string, subject?: string): Promise<ProviderResponse> {
    // Implementação de envio de email
  }
  
  async checkHealth(): Promise<HealthCheckResult> {
    // Verificar conexão
  }
}
```

Depois registrar no banco:

```sql
INSERT INTO messaging_providers (name, type, config, is_active)
VALUES ('Email Principal', 'email', '{"smtpHost": "smtp.gmail.com", ...}'::jsonb, true);
```

## 📚 Próximos Passos

### Implementações Futuras

1. **Webhook Endpoint** para confirmações do WA-HA
```typescript
// POST /api/webhooks/waha
// Atualiza delivered_at, read_at baseado em message.ack
```

2. **Recebimento de Respostas**
```sql
-- Adicionar tabela inbound_messages
-- Parsear resposta do fornecedor → criar proposta automaticamente
```

3. **Email Provider**
```typescript
// Fallback quando WhatsApp indisponível
// Notificações administrativas
```

4. **SMS Provider**
```typescript
// Alertas críticos
// Autenticação 2FA
```

5. **Dashboard de Monitoramento**
```tsx
// Gráficos de taxa de entrega
// Alertas de provedores offline
// Analytics de tempo de resposta
```

## 🧪 Testing

```typescript
// Testar envio manual
import { messagingService } from './modules/messaging';

await messagingService.sendMessage({
  quotationId: 'uuid',
  supplierId: 'uuid',
  recipient: '+5511999999999',
  templateCode: 'quotation_invitation',
  variables: {
    supplier_name: 'Empresa Teste',
    quotation_code: 'COT-TEST-001',
  }
});
```

## 📝 Notas Técnicas

- **WA-HA v2024.x** requer Docker container rodando
- **Format phone**: +5511999999999 → 5511999999999@c.us (conversão automática)
- **Session validation**: Verifica `status: WORKING` antes de enviar
- **Idempotência**: Mensagens duplicadas evitadas por (quotation_id, supplier_id, status)
- **Atomic operations**: Triggers e funções SQL garantem consistência

## 🎯 FASE 2 - COMPLETA ✅

Todos os 7 requisitos arquiteturais implementados:

- ✅ Integração backend isolada (providers abstratos)
- ✅ Event-driven com trigger automático
- ✅ Template engine com variáveis
- ✅ Logs completos de envio
- ✅ Monitoramento de sessões
- ✅ Sistema de retry inteligente
- ✅ Preparado para evolução bidirecional

**Status**: Sistema pronto para uso em produção com WA-HA configurado.
