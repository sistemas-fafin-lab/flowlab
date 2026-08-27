Status: done
Type: task

# Botão "Adicionar anexo" na Solicitação já existente

## Onde

`src/components/RequestManagement.tsx`, bloco "Anexos (n)" da visualização de
detalhe de uma solicitação (`:2010-2050+`, dentro do card que renderiza
`request.attachments`).

## Problema

Anexar um arquivo/imagem a uma Solicitação só é possível no momento da
criação (formulário "Nova Solicitação", `:1267-1329` + `addRequest` em
`src/hooks/useInventory.ts:722-777`). Depois de criada, o card de detalhe só
lista os anexos existentes — não tem como adicionar mais nenhum. Motivou o
pedido: precisou anexar manualmente via Supabase Dashboard, direto em
produção, por falta dessa opção.

## O que fazer

1. **Nova função no hook**, em `src/hooks/useInventory.ts` (ao lado de
   `addRequest`/`updateRequestStatus`), ex. `addAttachmentToRequest(requestId:
   string, files: File[])`:
   - Para cada `File`, sobe pro bucket `request-attachments` — mesmo padrão
     de `addRequest:733-735` (`${Date.now()}_${random}.${ext}`, `cacheControl:
     '3600'`, `upsert: false`) e pega a URL pública (`:745-747`).
   - Busca a solicitação atual (ou usa o estado local) para pegar o array
     `attachments` já existente e faz `UPDATE requests SET attachments =
     [...existentes, ...novos] WHERE id = requestId` — **não pode
     sobrescrever** os anexos que já estavam lá.
   - Chama `fetchRequests()` (mesmo padrão de `addRequest:772`) pra
     atualizar a lista local depois do update.
   - Repassar os mesmos tratamentos de erro de `addRequest` (bucket não
     configurado, etc).
   - Exportar a função no retorno do hook (ao lado de `addRequest:1131`,
     `updateRequestStatus:1132`).

2. **UI no card de detalhe** (`RequestManagement.tsx:2010-2050+`):
   - Adicionar um botão "Adicionar anexo" (ícone `Paperclip`, mesma
     paleta roxa/rosa do bloco existente) próximo ao heading "Anexos (n)".
     Ele deve aparecer mesmo quando `request.attachments` estiver vazio (a
     condição atual `request.attachments && request.attachments.length > 0`
     em `:2011` esconde o bloco inteiro — vai precisar sempre renderizar o
     heading + botão, e só condicionar a listagem de itens).
   - Clique abre um `<input type="file" accept=".pdf,.png,.jpg,.jpeg"
     multiple>` (mesma regra de tipo/tamanho do formulário de criação,
     10MB por arquivo — reaproveitar a validação existente em
     `:446` se possível em vez de duplicar).
   - Ao selecionar, chama `addAttachmentToRequest`, mostra estado de
     loading no botão, e trata erro com o mesmo padrão de feedback usado
     no resto da tela (toast/alert existente).

## Fora de escopo

- Remover/substituir um anexo já existente (só adicionar).
- Mudar a lógica de upload/URL pública do fluxo de criação.

## Decisão em aberto (produto, não técnica)

Quem pode adicionar anexo depois de criada: qualquer um que já pode ver o
detalhe da solicitação (comportamento default sugerido, já que a
visualização hoje não tem restrição extra), ou só quem tem
`canApproveRequests` / é o solicitante original? Confirmar antes de
implementar se o default (sem restrição extra) não for óbvio.

## Critérios de aceite

- Abrir uma solicitação já existente (aprovada ou não) e conseguir anexar
  uma nova imagem/PDF sem perder os anexos que já estavam lá.
- Anexo novo aparece na lista imediatamente (sem reload manual da página) e
  sobrevive a um refresh.
- Mesmas validações de tipo/tamanho do formulário de criação.

## Referência

Pedido do usuário em 27/08/2026, motivado por precisar anexar manualmente
(via Supabase Dashboard) um comprovante na `REQ755` por falta dessa opção na
UI.

## Comments

Implementado em 27/08/2026. Decisão em aberto (quem pode adicionar anexo):
seguido o default sugerido no ticket — sem restrição extra além de já poder
ver o detalhe da solicitação, já que a tela hoje não tem restrição extra
nesse ponto. Sinalizar se o produto quiser restringir depois.
