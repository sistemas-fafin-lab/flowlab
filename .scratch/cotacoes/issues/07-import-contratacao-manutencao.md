# Import de solicitação de manutenção em cotação de Contratação

Status: done

Blocked by: 05, 06, 04

## Onde

- `src/modules/quotations/components/CreateQuotationModal.tsx` (etapa
  "items", onde hoje só existe import de `requests`)
- `src/components/MaintenanceRequest/*` / `src/hooks/useMaintenanceRequest.ts`
  (fonte de dados das MNT)
- Modal de detalhes de import criado em `04-modal-detalhes-import`
  (reaproveitar/adaptar para o formato de `maintenance_requests`)

## O que fazer

Quando `quotationType === 'contratacao'` (ver `06-modal-selecao-tipo-cotacao`),
a etapa de Itens do `CreateQuotationModal` oferece import de uma
`maintenance_request` em vez de uma `request` (SC/SM). O import é opcional
— dá para seguir sem importar nada, preenchendo tudo manualmente, igual ao
fluxo de Compras hoje.

Como `maintenance_requests` **não tem lista de itens** (só `descricao`,
`local_ocorrencia`, `impacto_operacional`, `department`, `codigo`), o
import pré-preenche:

- Título: `Contratação - {codigo da MNT}`
- Descrição/Justificativa: `descricao` + `impacto_operacional` da MNT
- Departamento: `department` da MNT
- `maintenance_request_id`: setado com o id da MNT importada

A lista de itens da cotação (o que precisa ser contratado — mão de obra,
peça, serviço) **não é derivada da MNT** — o usuário monta manualmente na
etapa de Itens, exatamente como já acontece hoje quando nenhuma solicitação
é importada.

O picker de MNT reaproveita o modal de detalhes de import
(`04-modal-detalhes-import`), adaptado: em vez de listar itens, mostra
local da ocorrência, descrição completa e impacto operacional antes de
confirmar o import.

## Critérios de aceite

- Em uma cotação `contratacao`, a etapa de Itens oferece buscar/importar
  uma `maintenance_request`.
- Importar preenche Título/Descrição/Justificativa/Departamento conforme
  especificado acima e grava `maintenance_request_id`.
- A lista de itens fica vazia após o import — o usuário adiciona
  manualmente o que precisa ser contratado.
- Criar uma cotação de Contratação sem importar nada continua funcionando
  (fluxo 100% manual).
