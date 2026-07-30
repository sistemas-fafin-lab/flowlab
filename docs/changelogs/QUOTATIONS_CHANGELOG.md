# Alterações no Módulo de Cotações — Sessão 2026-04-28/29

## Navegação reversa de etapas

- Adicionadas transições reversas ao `VALID_TRANSITIONS` em `stateMachine.ts` para que cada status possa voltar ao seu antecessor lógico.
- Criado o mapa `BACKWARD_TRANSITIONS` que associa cada status ao seu status anterior (ex: `under_review → waiting_responses`).
- Criada a função exportada `getPreviousStatus(status)` que retorna o status anterior ou `null` para status sem predecessores.
- Criada a função `revertStatus(quotationId)` no hook `useQuotation` que persiste a regressão de status no Supabase antes de atualizar o estado local.
- Ao reverter de `awaiting_approval` para `under_review`, o `selected_proposal_id` é limpo e as propostas voltam ao status `submitted`.
- Adicionado botão "Voltar para [etapa anterior]" no rodapé do `QuotationDrawer`, visível apenas quando existe uma etapa anterior disponível e o usuário tem permissão.
- Conectado o `onRevert` prop no `QuotationManagementPage` chamando `revertStatus` e atualizando a lista após a ação.

## Histórico de movimentações (audit log)

- `addAuditLog` no `useQuotation` passou a fazer `INSERT` real na tabela `quotation_audit_logs` do Supabase, em vez de apenas atualizar o estado local.
- O `fetchQuotations` agora inclui `quotation_audit_logs (*)` no select para carregar o histórico persistido a cada atualização.
- Os registros de audit log são mapeados para o campo `auditLog` de cada cotação, ordenados cronologicamente.
- Adicionadas políticas RLS de `SELECT` e `INSERT` para `quotation_audit_logs` no script SQL consolidado (Bloco 5).

## Permissões granulares de cotação

- Adicionado `canRevert: boolean` à interface `QuotationPermissions` em `types/index.ts`.
- Os três blocos de retorno de `getPermissions` (admin, sem cotação, com cotação) foram atualizados para incluir o campo `canRevert`.
- Criado helper interno `hasPerm(key)` no `getPermissions` que consulta `userProfile.permissions`, com fallback para `canManageQuotations` (compatibilidade com cargos legados).
- Adicionado novo grupo **"Cotações"** com 8 chaves granulares ao catálogo `ALL_PERMISSION_KEYS` em `permissions.ts`: `canViewQuotations`, `canCreateQuotations`, `canAdvanceQuotation`, `canRevertQuotation`, `canSelectWinnerQuotation`, `canSubmitForApproval`, `canConvertQuotation` e `canCancelQuotation`.
- As permissões de `canSelectWinner`, `canConvertToPurchase`, `canCancel` e `canRevert` passaram a verificar também as chaves granulares do cargo, permitindo que usuários do tipo `requester` recebam acesso via cargo customizado.
- As novas chaves aparecem automaticamente no painel de **Gerenciar Cargos** do `UserManagement`, agrupadas sob "Cotações".

## Correção de bug — `cancelQuotation`

- A chamada `.update({ status: 'cancelled' })` foi restaurada na função `cancelQuotation` após ter sido removida acidentalmente durante uma edição anterior.
