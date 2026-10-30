# 0001: Permissões de visualização do Faturamento por tela

Data: 2026-10-28 · Status: aceito

## Contexto

Até aqui uma única permissão, `canViewBilling`, abria todas as telas do Faturamento (Faturas, Contas a Receber, Glosas e Recursos, Indicadores). As faturistas precisam ver só Contas a Receber e o novo Calendário de envios (`.scratch/faturamento-calendario-envios/spec.md`), e gerir o Calendário sem poder dar baixa ou editar títulos (`canManageBilling`).

## Decisão

- Cada tela do Faturamento ganha a sua chave de visualização: `canViewFaturas`, `canViewContasReceber`, `canViewGlosas`, `canViewIndicadores`, `canViewCalendarioEnvios`.
- `canViewBilling` continua existindo e vale como "todas as telas": rota e menu aceitam `canViewBilling` **ou** a chave da tela. Ninguém perde acesso.
- A escrita no Calendário tem chave própria, `canManageCalendarioEnvios`, independente de `canManageBilling`.

## Consequências

- Novos usuários do Faturamento podem receber acesso parcial; os existentes não precisam de migração.
- Toda tela nova do Faturamento precisa da sua chave e do "ou `canViewBilling`" na rota e no menu.
- Os endpoints da API seguem a mesma regra da tela que os consome.
