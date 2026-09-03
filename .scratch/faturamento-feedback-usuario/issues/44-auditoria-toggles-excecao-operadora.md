Status: needs-triage
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

## Perguntas para triagem

- Vale a pena um mecanismo genérico (ex.: tabela `operadoras_auditoria` com
  `campo`, `valor_anterior`, `valor_novo`, `motivo`, `usuario_id`,
  `created_at`, reaproveitável pelos 3 modais existentes e futuros), ou cada
  toggle deveria pedir motivo no próprio modal sem tabela de histórico?
- O motivo é obrigatório em toda mudança, ou só ao desativar (ex.: tirar uma
  operadora da whitelist de meta)?
- Precisa de tela para visualizar o histórico, ou só persistir o dado para
  consulta futura sob demanda (SQL direto)?

## O que fazer (após triagem)

Adicionar captura de motivo (texto livre) ao alternar qualquer uma das 3
flags, e registrar quem/quando num mecanismo de auditoria (escopo exato a
definir na triagem).

## Referência

Levantamento de requisitos com a usuária do setor (áudio transcrito,
2026-09-03), item "Exceções/'desconsiderar' itens" (P1).
