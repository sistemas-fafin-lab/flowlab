Status: done
Type: feature

# Auditoria (motivo, data, responsável) nas exceções de operadora

## Onde

`operadoras.is_clinica_parceira` (issue 16, `ClinicasParceirasModal.tsx`),
`operadoras.nf_apos_pagamento` (issue 31, `RegraNfModal.tsx`),
`operadoras.is_considerada_meta` (issue 36, `ConsideradaMetaModal.tsx`).

## Contexto

O levantamento de requisitos pede um mecanismo de exceção/desconsideração
"controlada", com motivo, data e responsável. Já existem três flags booleanas
por operadora com exatamente esse padrão de UI (toggle simples num modal de
gestão, gate `canManageBilling`), mas nenhuma delas registra **por quê** nem
**quem** mudou o valor — só o estado atual (`true`/`false`), sem histórico.
Se uma operadora for des-whitelistada por engano (ou por um motivo que depois
ninguém lembra), não há como saber quando isso aconteceu nem reverter com
segurança.

## Investigação adicional (2026-09-03)

- **Já existe no repo exatamente o padrão genérico que a primeira pergunta
  de triagem cogitava**: o módulo de cotações tem `quotation_audit_logs`
  (`supabase/migrations/20260219120000_expand_quotations_module.sql:175-194`)
  — tabela append-only (`action`, `performed_by`, `performed_by_name`,
  `performed_at`, `details JSONB`, `metadata JSONB`), com RLS permitindo só
  `INSERT`/`SELECT` (comentário explícito: "Audit logs should not be updated
  or deleted"). Não precisa desenhar um mecanismo novo do zero — dá pra
  clonar essa estrutura para operadoras.
- **Os 3 toggles hoje são `UPDATE` direto do client contra `operadoras`**
  (`useContasReceber.ts:513-566`, funções `marcarClinicaParceira`,
  `alternarNfAposPagamento`, `marcarConsideradaMeta`), sem nenhum handler de
  API no meio — a RLS de `canManageBilling` já é o único gate. Isso importa
  para a implementação: a captura de motivo/auditoria também precisa
  acontecer no client (uma segunda chamada Supabase logo após o `UPDATE` com
  sucesso), não há um handler de back-end existente para estender.

## Decisões (grilling com o usuário, 2026-09-03)

- **Tabela genérica**, seguindo o mesmo padrão de `quotation_audit_logs`,
  compartilhada pelas 3 flags atuais (`is_clinica_parceira`,
  `nf_apos_pagamento`, `is_considerada_meta`) e por flags futuras do mesmo
  tipo.
- **Motivo obrigatório só ao desativar** (valor novo = `false`, ex.: tirar
  uma operadora da whitelist de meta ou da lista de clínicas parceiras).
  Ativar uma flag não exige motivo.

## Decisão assumida (não perguntada ao usuário — revisar se o setor discordar)

- **Sem tela de visualização dedicada nesta entrega**: o histórico fica
  persistido para consulta futura (SQL/Supabase Studio), sem UI de leitura.
  Vira issue própria se o setor pedir uma tela depois de o mecanismo estar
  em produção.

## O que fazer

1. Nova tabela `operadoras_audit_logs` (mesmo shape de `quotation_audit_logs`,
   trocando `quotation_id` por `operadora_id`): `id`, `operadora_id`,
   `campo` (`is_clinica_parceira` | `nf_apos_pagamento` | `is_considerada_meta`),
   `valor_anterior BOOLEAN`, `valor_novo BOOLEAN`, `motivo TEXT` (nullable —
   só obrigatório na desativação, validado na UI), `performed_by UUID`,
   `performed_by_name TEXT`, `performed_at TIMESTAMPTZ DEFAULT NOW()`. RLS:
   `INSERT`/`SELECT` para quem tem `canManageBilling`/`canViewBilling`
   (mesmo padrão de `operadoras`), sem política de `UPDATE`/`DELETE`.
2. Nos 3 modais (`ClinicasParceirasModal.tsx`, `RegraNfModal.tsx`,
   `ConsideradaMetaModal.tsx`): ao desativar uma flag, pedir motivo (texto
   livre, obrigatório) antes de confirmar; ao ativar, seguir sem pedir nada
   (fluxo atual inalterado).
3. Nas 3 funções de `useContasReceber.ts` (`marcarClinicaParceira`,
   `alternarNfAposPagamento`, `marcarConsideradaMeta`): depois do `UPDATE`
   em `operadoras` ter sucesso, inserir uma linha em
   `operadoras_audit_logs` com o campo alterado, valores anterior/novo,
   motivo (se houver) e o usuário autenticado atual.

## Referência

Levantamento de requisitos com a usuária do setor (áudio transcrito,
2026-09-03), item "Exceções/'desconsiderar' itens" (P1).

## Implementação (2026-09-04)

Todos os itens do "O que fazer" implementados:

1. Migration `20260904090000_operadoras_audit_logs.sql` — tabela
   `operadoras_audit_logs` clonando o shape de `quotation_audit_logs`, RLS
   `SELECT`/`INSERT` gated em `canViewBilling`/`canManageBilling` (mesmo
   padrão de `operadoras`), sem policy de `UPDATE`/`DELETE`.
2. Os 3 modais (`ClinicasParceirasModal.tsx`, `RegraNfModal.tsx`,
   `ConsideradaMetaModal.tsx`) agora pedem motivo (texto livre, obrigatório)
   só ao desativar — a operadora fica "pendente" até o motivo ser
   preenchido; ativar segue direto, sem prompt. Lógica de estado/handlers
   extraída para `useDesativacaoComMotivo` (hook) e `MotivoDesativacaoBox`
   (componente), compartilhados pelos 3 modais em vez de triplicados.
3. `useContasReceber.ts`: `marcarClinicaParceira`, `alternarNfAposPagamento`
   e `marcarConsideradaMeta` agora aceitam `motivo?` e, depois do `UPDATE`
   em `operadoras` ter sucesso, inserem uma linha em
   `operadoras_audit_logs` via `registrarAuditoriaOperadora` (campo,
   valores anterior/novo, motivo, usuário autenticado). Uma falha nessa
   segunda chamada não desfaz nem esconde o sucesso do toggle — é reportada
   à parte ("Operadora atualizada, mas o registro de auditoria falhou: …").

Sem tela de leitura do histórico nesta entrega, conforme decisão assumida
registrada acima.
