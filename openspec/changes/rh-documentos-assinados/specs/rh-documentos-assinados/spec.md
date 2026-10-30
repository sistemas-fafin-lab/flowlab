## ADDED Requirements

### Requirement: Envio de documento assinado pelo RH
Usuários com `canManageColaboradores` SHALL poder enviar, na aba Documentos da ficha do colaborador, um documento assinado informando: arquivo PDF (obrigatório, até 20 MB), tipo (obrigatório, da lista fixa ou "Outro") e data de assinatura (obrigatória, não futura). Quando o tipo for "Outro", o nome do documento SHALL ser obrigatório. O sistema MUST rejeitar arquivos que não sejam PDF.

#### Scenario: Envio com sucesso
- **WHEN** o RH seleciona um PDF, o tipo "Acordo de compensação de horas" e a data 10/01/2025 e confirma
- **THEN** o documento aparece no topo da lista de Documentos assinados do colaborador e é exibido o toast "Documento enviado com sucesso!"

#### Scenario: Tipo Outro sem nome
- **WHEN** o RH escolhe "Outro" e deixa o nome em branco
- **THEN** o envio é bloqueado com a mensagem "Informe o nome do documento."

#### Scenario: Arquivo que não é PDF
- **WHEN** o RH seleciona um arquivo .docx
- **THEN** o sistema recusa o arquivo com a mensagem "Envie o documento em PDF."

#### Scenario: Falha no upload
- **WHEN** o upload do arquivo falha
- **THEN** nenhum registro é criado e o modal de envio permanece aberto com os dados preenchidos e mensagem de erro

### Requirement: Exclusão de documento
Usuários com `canManageColaboradores` SHALL poder excluir um documento, após confirmação, removendo o registro e o arquivo do storage.

#### Scenario: Excluir documento enviado por engano
- **WHEN** o RH clica em Excluir em um documento e confirma
- **THEN** o documento some da lista do RH e do Meu perfil do colaborador, e o arquivo é removido do bucket

### Requirement: Listagem de documentos assinados
O card "Documentos assinados" SHALL exibir os 4 documentos mais recentes por data de assinatura (desc) com nome, "Assinado em dd/mm/aaaa", Visualizar e Baixar, e o botão "Ver todos os documentos (N)" que abre a lista completa. Visualizar e Baixar SHALL usar link assinado de curta duração.

#### Scenario: Colaborador sem documentos (RH)
- **WHEN** o RH abre a aba Documentos de um colaborador sem documentos
- **THEN** o card exibe "Contratos, termos e aditivos assinados pelo colaborador aparecerão aqui."

#### Scenario: Colaborador sem documentos (Meu perfil)
- **WHEN** o colaborador abre a aba Documentos sem documentos cadastrados
- **THEN** o card exibe "Contratos, termos e aditivos que você assinar aparecerão aqui."

### Requirement: Acesso aos documentos
A leitura dos documentos (registro e arquivo) SHALL ser permitida a quem tem `canViewColaboradores` ou `canManageColaboradores` e ao próprio colaborador vinculado. Escrita e exclusão SHALL exigir `canManageColaboradores`. O banco e o storage MUST impor essas regras via RLS; gestores de equipe (`canViewHoleritesEquipe`) MUST NOT ter acesso por essa chave.

#### Scenario: Colaborador tenta acessar documento de outro
- **WHEN** um colaborador sem permissões de RH solicita link assinado de um arquivo de outro colaborador
- **THEN** o storage nega o acesso

#### Scenario: Colaborador tenta enviar documento
- **WHEN** um colaborador sem `canManageColaboradores` tenta inserir em `colaborador_documentos` ou fazer upload no bucket
- **THEN** a operação é rejeitada pela RLS
