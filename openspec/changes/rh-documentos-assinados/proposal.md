## Why

Contratos, termos e aditivos assinados pelos colaboradores ficam hoje fora do FlowLab, sem um lugar onde o RH guarde e o colaborador consulte a própria cópia. O protótipo em `.design-sync/modulo_rh/` prevê um card "Documentos assinados" ao lado dos recibos. Foi decidido **não** implementar fluxo de assinatura eletrônica: o RH só envia o PDF já assinado.

Proposta 3 de 4 do módulo RH. **Depende de `rh-ficha-colaborador`** (aba Documentos do modal, `canManageColaboradores`) **e de `rh-meu-perfil`** (aba Documentos do Meu perfil).

## What Changes

- Nova tabela `colaborador_documentos` e bucket privado `colaborador-documentos` (somente PDF).
- Na ficha do colaborador (RH), aba Documentos: novo card "Documentos assinados" com "Enviar documento" (PDF + tipo + data de assinatura) e exclusão de documento enviado por engano, para quem tem `canManageColaboradores`.
- Tipo de documento por lista fixa (Contrato individual de trabalho, Termo de confidencialidade e proteção de dados (LGPD), Acordo de compensação de horas, Termo de responsabilidade por equipamentos, Adesão ao plano odontológico, Autorização de uso de imagem, Aditivo contratual, Termo de rescisão do contrato de trabalho) + "Outro" com nome livre.
- No Meu perfil, aba Documentos: card "Documentos assinados" com os 4 mais recentes e "Ver todos os documentos (N)"; o colaborador só visualiza e baixa os próprios.
- Sem status de assinatura (pendente/recusado/expirado): todo documento cadastrado é considerado assinado.

## Capabilities

### New Capabilities
- `rh-documentos-assinados`: cadastro pelo RH e consulta pelo colaborador de PDFs de documentos já assinados.

### Modified Capabilities
(nenhuma — specs das propostas 1 e 2 ainda não arquivadas.)

## Impact

- **Banco/Storage**: migration com `colaborador_documentos`, RLS, bucket `colaborador-documentos` e policies em `storage.objects`.
- **Frontend**: novos componentes em `src/modules/rh/components/documentos/` (card, lista completa, modal de envio), hook `useDocumentosColaborador`; integração na aba Documentos de `ColaboradorDetalheModal` e de `MeuPerfilPage`.
- **Fora do escopo**: assinatura eletrônica, prazo, recusa, envio em lote, notificação ao colaborador.
