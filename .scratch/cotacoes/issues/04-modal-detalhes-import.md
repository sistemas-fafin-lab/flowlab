# Modal de detalhes da solicitação ao importar em "Nova Cotação"

Status: done

## Onde

`src/modules/quotations/components/CreateQuotationModal.tsx`, bloco de
import na etapa "items" (linhas ~441-520: `showRequestPicker`,
`filteredRequests`, `handleImportFromRequest`).

## O que fazer

Hoje o picker de import mostra cards resumidos (tipo SC/SM, status, até 3
itens) e o clique já importa direto. Trocar para um fluxo em duas etapas:

1. Clicar no card abre um modal (`RequestImportDetailsModal` ou similar)
   mostrando todos os dados da solicitação: itens completos (não só os 3
   primeiros), solicitante, data, prioridade, justificativa/motivo
   completo.
2. O modal tem um botão "Importar esta solicitação" que executa o que
   `handleImportFromRequest` já faz hoje (populando `items` e fechando o
   picker).
3. O card na lista continua com o preview resumido — só o clique muda de
   comportamento (abre detalhes em vez de importar direto).

Este componente deve ser escrito de forma reaproveitável: o ticket
`07-import-contratacao-manutencao` vai precisar do mesmo modal adaptado
para o formato de dados de `maintenance_requests` (que não tem lista de
itens, e sim `descricao`/`local_ocorrencia`/`impacto_operacional`). Vale a
pena já projetar a interface do componente para aceitar os dois formatos
(ex.: um adapter/prop que descreve o que renderizar), mesmo que a
integração com manutenção só aconteça no ticket 07.

## Critérios de aceite

- Clicar num card do picker de import abre um modal com os dados completos
  da solicitação, sem importar nada ainda.
- O botão "Importar esta solicitação" dentro do modal reproduz exatamente
  o comportamento atual de `handleImportFromRequest`.
- Fechar o modal sem importar não altera os itens já adicionados na
  cotação.
