# Cotações: fluxo dual (Compras / Contratação) + ajustes

Status: planejamento (não implementado)

## Contexto

O trabalho recém-commitado de alertar por email quando uma SC pede produto
sem estoque (`8d43b29`, `7141ed3`, `bceda90`, `5fcee7f`) vai ser **substituído**
por uma estratégia mais completa: em vez de um email de FYI solto, o sistema
passa a apoiar o fluxo real de compras/contratação através do módulo de
**Cotações**, com regra de alçada para aprovação.

Isso puxou uma reformulação maior do módulo de Cotações, detalhada abaixo.

## Decisões já tomadas (grilling session)

- O alerta antigo (`api/notifications/purchase-out-of-stock.ts` + trigger em
  `RequestManagement.tsx` + template `purchase_request_out_of_stock`) é
  **removido**. Nada automático acontece mais na criação de uma SC.
- A notificação por email passa a existir só quando uma cotação entra em
  **"Aguardando Aprovação"** — avisa os gestores com alçada suficiente.
- Cotação de tipo **Contratação** pode ser criada com ou sem import de uma
  solicitação de manutenção (MNT) — igual à flexibilidade que Compras já tem.
- Alçada: reaproveita o modelo genérico por valor já existente
  (`user_approval_limits` + `approval_level_config`), sem tabelas novas.
- Modal de detalhes ao importar: abre ao clicar no card, mostra tudo, tem
  botão "Importar esta solicitação".
- Cadastro de fornecedor no fluxo de cotação usa o **formulário completo**
  (mesmos campos de `SupplierManagement.tsx`), não uma versão reduzida.
- Sidemodal (`QuotationDrawer`) vira navegação **restrita de verdade**: as
  abas deixam de ser clicáveis livremente e passam a ser indicadores de
  progresso; navegação é por botões Voltar/Avançar.
- Prazo de pagamento do PIX usa a mesma mecânica do boleto (dias após
  emissão).
- O rename "Prazo de Entrega" → "Prazo de Entrega / Fornecimento" afeta só o
  campo geral da cotação — o campo por-item da proposta continua como está.
- **Centro de Custo fica fora de escopo por enquanto** — depende de
  alinhamento com o Marcos sobre a lista real de centros de custo. Hoje
  continua sendo o campo texto livre (`cost_center`) que já existe.

## Entrega em fases

### Fase 1 — Ajustes independentes (não dependem do Big Dev)

1. **Cadastro de fornecedor no fluxo de cotação**
   - Botão "Novo fornecedor" na etapa de Fornecedores do `CreateQuotationModal`
     e/ou na busca de fornecedores do `AddProposalModal`.
   - Abre um modal com o formulário completo hoje em `SupplierManagement.tsx`
     (nome, CNPJ, email, telefone, endereço, contato, produtos, status),
     reaproveitando `useInventory().addSupplier` — sem tabela nova.
   - Fornecedor recém-criado já entra selecionado na lista da cotação.

2. **Prazo de pagamento no PIX**
   - `AddProposalModal.tsx`: hoje o campo de dias só aparece quando
     `paymentMethod === 'boleto'` (estado `boletoDueDays`). Passa a aparecer
     também quando `paymentMethod === 'pix'`.
   - Mantém o nome interno `boletoDueDays` no tipo/DB para não gerar
     migração de dados — é só a condição de exibição na UI que muda. Label
     genérico: "Prazo para Pagamento (dias)".

3. **Rename "Prazo de Entrega" → "Prazo de Entrega / Fornecimento"**
   - Só o campo geral da cotação: label em `CreateQuotationModal.tsx`
     (linha ~412), em `PurchaseOrderModal.tsx` (linha ~272) e no PDF gerado
     por `generateQuotationPDF.ts` (linha ~137).
   - Campo por-item da proposta em `AddProposalModal.tsx` ("Prazo de
     Entrega (dias)") não muda.

4. **Modal de detalhes ao importar**
   - Hoje, dentro da etapa de Itens do `CreateQuotationModal`, o picker de
     import mostra cards resumidos (até 3 itens, status, tipo SC/SM).
   - Novo comportamento: clicar no card abre um modal com todos os itens,
     solicitante, justificativa completa e demais dados da solicitação, com
     um botão "Importar esta solicitação" que executa o que
     `handleImportFromRequest` já faz hoje.
   - O mesmo modal serve para o picker de solicitações de manutenção
     (Fase 2), adaptado ao formato de dados de `maintenance_requests`.

### Fase 2 — Big Dev: fluxo dual de tipo de cotação

**Seleção de tipo.** Novo modal inicial (mesmo padrão visual do modal
SC/SM de `RequestManagement.tsx`, linha ~1370: diálogo centralizado com
cards) perguntando **Contratação** ou **Compras** antes de abrir o
`CreateQuotationModal`. A escolha define a etapa de import.

- **Compras** → fluxo atual, sem mudanças (import de `requests` SC/SM).
- **Contratação** → import opcional de uma `maintenance_request`. Como MNT
  não tem lista de itens (só `descricao`, `local_ocorrencia`,
  `impacto_operacional`), o import pré-preenche:
  - Título: `Contratação - {codigo da MNT}`
  - Descrição/Justificativa: `descricao` + `impacto_operacional`
  - Departamento: `department` da MNT
  - Itens: usuário monta manualmente na etapa de Itens (igual ao fluxo sem
    import de hoje).

**Estrutura de banco (sugerida, estende o que já existe — não substitui):**

```sql
-- supabase/migrations/<data>_quotations_dual_type.sql

ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS quotation_type VARCHAR(20) NOT NULL DEFAULT 'compras'
    CHECK (quotation_type IN ('compras', 'contratacao')),
  ADD COLUMN IF NOT EXISTS maintenance_request_id UUID
    REFERENCES maintenance_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quotations_type ON quotations(quotation_type);
CREATE INDEX IF NOT EXISTS idx_quotations_maintenance_request
  ON quotations(maintenance_request_id);
```

- `request_id` (coluna já existente) continua sendo o vínculo com
  `requests` (SC/SM), usado quando `quotation_type = 'compras'`.
- `maintenance_request_id` é a nova coluna, usada quando
  `quotation_type = 'contratacao'` e a cotação nasceu de um import de MNT.
- Nenhuma das duas é obrigatória — cobre o caso de criação manual dos dois
  tipos.
- `QuotationFilters`/`QuotationList` ganham um filtro por `quotation_type`.

**Alçada.** Nenhuma tabela nova. `required_approval_level` continua sendo
calculado por valor total da cotação (`estimatedTotalAmount` /
`finalTotalAmount`) contra `approval_level_config`, independente de
`quotation_type`.

**Notificação por email na alçada.** Novo template em
`email_notification_templates` (ex.: slug `quotation_awaiting_approval`),
seguindo o padrão dos templates já existentes. Disparo: em
`useQuotation.ts`, no ponto onde o status muda para `awaiting_approval`
(hoje `onSubmitForApproval`), buscar os usuários com
`user_approval_limits_with_details.can_approve = true` e
`effective_max_amount >= valor da cotação`, e chamar
`/api/notifications/email` (endpoint genérico já existente) para cada um,
com link direto para a cotação. Não precisa de endpoint novo — diferente do
alerta de estoque removido, aqui o destinatário é dinâmico e já é dado
visível dentro do app (gestor responsável), então não há motivo para
manter o destinatário só no servidor como no padrão de
`purchase-out-of-stock.ts`.

**Remoção do alerta de estoque.** Deletar:
- `api/notifications/purchase-out-of-stock.ts`
- Trigger em `RequestManagement.tsx` (linhas ~509-526, o bloco `fetch`)
- Referência ao template `purchase_request_out_of_stock` (a migration que
  criou o template pode ficar no histórico; adicionar uma migration nova
  que desativa/remove o template, em vez de editar a antiga)
- `getOutOfStockItems`/`purchaseOutOfStock.ts` só se não sobrar nenhum outro
  uso depois da remoção do trigger (checar antes de apagar).

### Fase 3 — Sidemodal restritivo

- `QuotationDrawer.tsx`: as 5 abas (Visão Geral/Itens/Propostas/Aprovação/
  Histórico) deixam de ser clicáveis livremente. Viram indicadores de
  progresso read-only; a navegação passa a ser via botões **Voltar** /
  **Avançar** no rodapé, que só avançam quando a etapa atual está completa
  (ex.: não avança de Itens pra Propostas com a lista de itens vazia).
- Botão "Enviar via WhatsApp" (rodapé, linha ~654) encolhe — vira um botão
  menor/ícone com tooltip, mantendo a mesma ação, para abrir espaço pros
  botões de navegação.

## Issues

Quebrado em `.scratch/cotacoes/issues/`:

- **Fase 1** (independentes): `01-fornecedor-modal-completo`,
  `02-pix-prazo-pagamento`, `03-rename-prazo-entrega`,
  `04-modal-detalhes-import`
- **Fase 2** (Big Dev): `05-schema-quotations-dual-type` →
  `06-modal-selecao-tipo-cotacao` → `07-import-contratacao-manutencao`
  (bloqueado por 05, 06 e 04); `08-alcada-notificacao-email` →
  `09-remover-alerta-estoque` (bloqueado por 08)
- **Fase 3**: `10-sidemodal-restritivo`

## Fora de escopo (parked)

- **Centro de Custo**: continua como campo texto livre (`cost_center`) na
  tabela `quotations`. Criar a tabela dedicada fica pendente até alinhar
  com o Marcos a lista real de centros de custo — retomar como um ticket
  separado quando isso estiver definido.
