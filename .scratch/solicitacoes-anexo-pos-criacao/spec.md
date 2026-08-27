# Anexar arquivo a uma Solicitação já existente

Pedido em 27/08/2026: hoje só é possível anexar arquivos a uma Solicitação
(módulo Almoxarifado, tela **Solicitações**) no momento da criação. Depois de
criada — ex.: `REQ755` — a visualização de detalhe mostra os anexos existentes
mas é somente leitura; não há como adicionar um novo anexo depois.

Motivou o pedido: precisou anexar manualmente (via Supabase Storage +
Table Editor, direto em produção) um comprovante numa solicitação já
aprovada, por falta dessa opção na UI.

## O que existe hoje

- **Criação com anexo**: `src/components/RequestManagement.tsx` — estado
  `attachments` (`:177`), seletor de arquivo múltiplo na seção "Anexos
  (Opcional)" do formulário "Nova Solicitação" (`:1267-1329`, aceita
  `.pdf,.png,.jpg,.jpeg`, até 10MB por arquivo).
- **Upload**: `src/hooks/useInventory.ts` → `addRequest` (`:722-777`). Para
  cada `File`, sobe para o bucket Supabase Storage `request-attachments`
  (`:733-735`, path `${timestamp}_${random}.${ext}`, sem pasta por
  solicitação), pega a URL pública (`:745-747`) e junta tudo em
  `attachmentsData: {url, name}[]`, que vai no `insert` de `requests`
  (`:765`).
- **Visualização (somente leitura)**: `RequestManagement.tsx:2010-2050+` —
  bloco "Anexos (n)" dentro do card de detalhe da solicitação. Imagens
  (`.png/.jpg/.jpeg`) abrem em lightbox (`openImageViewer`, `:493`); outros
  tipos viram link de download. **Não há botão de adicionar anexo aqui.**

## O que falta

Um botão "Adicionar anexo" na visualização de detalhe de uma solicitação já
existente, que:
1. Abra um seletor de arquivo (mesmas regras da criação: `.pdf,.png,.jpg,.jpeg`,
   até 10MB).
2. Faça upload para o bucket `request-attachments` (reaproveitando o padrão
   de `addRequest`).
3. Persista o novo item no array `attachments` da solicitação (`UPDATE
   requests SET attachments = ... WHERE id = ...`), sem sobrescrever os
   anexos já existentes.
4. Atualize a UI (lista local + refetch) sem precisar recarregar a página.

Ver ticket `issues/01-botao-adicionar-anexo.md` para o detalhamento.
