# Schema: suportar dois tipos de cotação (Compras / Contratação) no banco

Status: ready-for-agent

## Onde

Nova migration em `supabase/migrations/`, seguindo o padrão de
`supabase/migrations/20260219120000_expand_quotations_module.sql` (estende
a tabela `quotations` existente, não recria nada).

Também: `src/modules/quotations/types/index.ts` (tipos `Quotation`,
`CreateQuotationInput`, `QuotationFilters`) e
`src/modules/quotations/hooks/useQuotation.ts` (mapeamento
camelCase ↔ snake_case).

## O que fazer

Adicionar as colunas necessárias para diferenciar cotações de Compras e de
Contratação, e para vincular uma cotação de Contratação a uma
`maintenance_request` (que é uma tabela separada de `requests`, então não
dá para reaproveitar a coluna `request_id` existente para os dois casos).

```sql
ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS quotation_type VARCHAR(20) NOT NULL DEFAULT 'compras'
    CHECK (quotation_type IN ('compras', 'contratacao')),
  ADD COLUMN IF NOT EXISTS maintenance_request_id UUID
    REFERENCES maintenance_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quotations_type ON quotations(quotation_type);
CREATE INDEX IF NOT EXISTS idx_quotations_maintenance_request
  ON quotations(maintenance_request_id);
```

- `request_id` (já existente) continua sendo o vínculo com `requests`
  (SC/SM), usado quando `quotation_type = 'compras'`.
- `maintenance_request_id` é a coluna nova, usada quando
  `quotation_type = 'contratacao'` e a cotação nasceu de um import de MNT.
- As duas colunas de vínculo são opcionais nos dois tipos — cobre criação
  manual sem import (ver decisão em `spec.md`).

No lado do app:
- `Quotation`, `CreateQuotationInput` (em `types/index.ts`) ganham
  `quotationType: 'compras' | 'contratacao'` e `maintenanceRequestId?: string`.
- `useQuotation.ts` passa a ler/gravar as novas colunas
  (`quotation_type`/`maintenance_request_id`) no mapeamento existente
  (ver linhas ~181, ~619, ~675 como referência de onde `request_id` já é
  tratado hoje).
- `QuotationFilters`/`QuotationList` (`QuotationManagementPage.tsx`) ganham
  filtro por `quotationType`, para o usuário conseguir separar as duas
  listas.

## Critérios de aceite

- Migration aplicada sem quebrar dados existentes (todas as cotações atuais
  ficam com `quotation_type = 'compras'` por causa do `DEFAULT`).
- `useQuotation.ts` lê/grava `quotationType` e `maintenanceRequestId` sem
  regressão no fluxo de Compras existente.
- Lista de cotações permite filtrar por tipo.

## Bloqueia

`06-modal-selecao-tipo-cotacao`, `07-import-contratacao-manutencao`
