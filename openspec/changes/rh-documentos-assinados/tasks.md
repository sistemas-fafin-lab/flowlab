## 1. Pré-requisito

- [x] 1.1 Confirmar que `rh-ficha-colaborador` e `rh-meu-perfil` estão implementadas

## 2. Banco e storage

- [x] 2.1 Migration `<timestamp>_rh_documentos_assinados.sql`: tabela `colaborador_documentos` (D1) com CHECKs de tipo, `nome_outro` e `data_assinatura`
- [x] 2.2 Na mesma migration: RLS da tabela (D3)
- [x] 2.3 Na mesma migration: bucket `colaborador-documentos` (privado, PDF, 20 MB) e policies em `storage.objects` (D3)
- [x] 2.4 Aplicar no dev e validar: RH envia/exclui; colaborador lê só os próprios; usuário com `canViewHoleritesEquipe` sem chaves de colaborador não lê (validado com o usuário RH; colaborador comum e gestor de equipe pendentes — exigem outro login)

## 3. Dados

- [x] 3.1 `types.ts`: `DocumentoAssinado` e union de tipos; `utils/rotulosDocumentos.ts` com rótulos e lista de opções
- [x] 3.2 `documentosStorage.ts`: constante do bucket, upload, remoção e signed URL
- [x] 3.3 `hooks/useDocumentosColaborador.ts`: listar por colaborador (ordenado por `data_assinatura` desc), `enviar` (upload + insert + compensação) e `excluir` (storage + delete)
- [x] 3.4 Função pura de validação do formulário de envio (`utils/documentoEnvio.ts`) (PDF, tamanho, tipo, nome quando "Outro", data não futura) — com testes Vitest

## 4. Componentes

- [x] 4.1 `components/documentos/EnviarDocumentoModal.tsx`
- [x] 4.2 `components/documentos/DocumentosAssinadosCard.tsx` (`visao`, 4 recentes, "Ver todos (N)", Visualizar/Baixar, Excluir com confirmação)
- [x] 4.3 `components/documentos/DocumentosAssinadosLista.tsx` (modal de lista completa)
- [x] 4.4 Integrar o card na aba Documentos de `ColaboradorDetalheModal` (ao lado dos recibos) e de `MeuPerfilPage`

## 5. Verificação

- [x] 5.1 `npm test` e build sem erros
- [x] 5.2 Navegador: RH envia (inclusive "Outro"), visualiza, baixa e exclui; colaborador vê os próprios no Meu perfil; desktop e mobile, claro e escuro
