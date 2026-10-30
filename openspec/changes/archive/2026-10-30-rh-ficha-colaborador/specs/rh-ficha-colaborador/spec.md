## ADDED Requirements

### Requirement: Permissão de gestão de colaboradores
O sistema SHALL ter a chave `canManageColaboradores` (grupo RH), exigida para qualquer escrita na ficha do colaborador (dados cadastrais, dados pessoais, vínculo de usuário e gestor). A chave `canViewColaboradores` SHALL conceder apenas leitura. O banco MUST impor essa regra via RLS, independentemente da UI.

#### Scenario: Usuário só com visualização abre a ficha
- **WHEN** um usuário com `canViewColaboradores` e sem `canManageColaboradores` abre o modal de um colaborador
- **THEN** todas as seções são exibidas sem botões Editar, Vincular, Desvincular ou Alterar gestor

#### Scenario: Escrita direta sem permissão de gestão
- **WHEN** um usuário sem `canManageColaboradores` tenta um UPDATE em `colaboradores` ou um INSERT/UPDATE em `colaborador_dados_pessoais`
- **THEN** o banco rejeita a operação pela RLS

#### Scenario: Cargos padrão recebem a chave
- **WHEN** a migration é aplicada
- **THEN** os cargos Administrador e RH passam a ter `canManageColaboradores`

### Requirement: Dados pessoais do colaborador
O sistema SHALL armazenar, por colaborador (relação 1:1), os dados pessoais: nacionalidade (Brasileira, Brasileira naturalizada, Estrangeira), UF de nascimento (27 UFs), cidade de nascimento, cor/raça (Branca, Preta, Parda, Amarela, Indígena, Não declarar), gênero (Masculino, Feminino, Não declarar), estado civil (Solteiro(a), Casado(a), União estável, Divorciado(a), Separado(a), Viúvo(a)), data de nascimento, nome da mãe e nome do pai. Todos os campos SHALL ser opcionais. A leitura SHALL ser permitida a `canViewColaboradores` e ao próprio colaborador vinculado; a escrita, somente a `canManageColaboradores`.

#### Scenario: Colaborador sem dados pessoais cadastrados
- **WHEN** o RH abre a ficha de um colaborador que ainda não tem registro de dados pessoais
- **THEN** a seção Dados pessoais exibe os campos vazios ("—") e permite preencher e salvar, criando o registro

#### Scenario: Data de nascimento futura
- **WHEN** o RH informa uma data de nascimento posterior a hoje e clica em Salvar
- **THEN** o sistema bloqueia o salvamento e exibe a mensagem de validação no campo

#### Scenario: Valor fora do domínio
- **WHEN** uma escrita tenta gravar estado civil, cor/raça, gênero, nacionalidade ou UF fora das listas definidas
- **THEN** o banco rejeita a operação (CHECK constraint)

### Requirement: Nome, CPF e e-mail somente leitura
Os campos nome, CPF e e-mail do colaborador SHALL ser exibidos na ficha, mas MUST NOT ser editáveis por nenhum usuário pela interface do módulo RH.

#### Scenario: RH em modo de edição
- **WHEN** o RH entra em edição da seção Dados pessoais ou Dados cadastrais
- **THEN** nome, CPF e e-mail aparecem com indicador de cadeado e sem campo de entrada

### Requirement: Layout do modal do colaborador
O modal do colaborador SHALL exibir: cabeçalho com nome, badge de status (Ativo/Desligado) e a linha "Cargo · Departamento · Matrícula"; coluna esquerda com o card de resumo; coluna direita com as abas **Dados pessoais** e **Documentos**. A aba Dados pessoais SHALL empilhar, nesta ordem, as seções Dados cadastrais, Dados pessoais, Usuário do sistema e Gestor. Em telas estreitas (< 760px) o modal SHALL ocupar a tela inteira e o card de resumo SHALL ficar recolhido com o botão "Ver resumo completo".

#### Scenario: Abrir a ficha
- **WHEN** o RH clica em um colaborador na lista de Colaboradores
- **THEN** o modal abre na aba Dados pessoais com as quatro seções empilhadas

#### Scenario: Fechar o modal
- **WHEN** o usuário pressiona ESC ou clica fora do modal sem edição em andamento
- **THEN** o modal fecha

### Requirement: Edição por seção
A edição na ficha SHALL ser feita por seção, com botão Editar no cabeçalho da seção e ações Cancelar/Salvar. Apenas uma seção SHALL estar em edição por vez. Cancelar SHALL descartar as alterações; Salvar com sucesso SHALL exibir toast de confirmação; falha ao salvar SHALL manter os dados preenchidos e exibir mensagem de erro.

#### Scenario: Tentar editar duas seções
- **WHEN** a seção Dados cadastrais está em edição
- **THEN** os botões Editar das demais seções e a ação de alterar gestor ficam desabilitados

#### Scenario: Falha ao salvar
- **WHEN** o salvamento falha por erro do servidor
- **THEN** a seção permanece em edição com os valores digitados e exibe "Não foi possível salvar as alterações. Tente novamente."

### Requirement: Dados cadastrais
A seção Dados cadastrais SHALL exibir matrícula, cargo, departamento, data de admissão, status e, quando houver, data de desligamento. Matrícula, cargo, departamento e data de admissão SHALL ser editáveis com `canManageColaboradores`; o departamento SHALL continuar exigindo também `canManageDepartamentos`. A data de admissão MUST NOT ser futura. Status e data de desligamento SHALL ser somente leitura.

#### Scenario: Admissão futura
- **WHEN** o RH informa data de admissão posterior a hoje
- **THEN** o salvamento é bloqueado com mensagem de validação

### Requirement: Card de resumo do colaborador
O sistema SHALL ter um card de resumo reutilizável com avatar (iniciais), nome, cargo e linhas com ícone para Departamento, Data de admissão, Gestor (nome), CPF (mascarado, marcado como somente leitura) e E-mail. O card MUST NOT exibir remuneração, centro de custo nem atalho para holerite. Campos vazios SHALL exibir "—" (gestor vazio: "Sem gestor definido").

#### Scenario: Colaborador sem gestor
- **WHEN** o card é exibido para um colaborador sem gestor
- **THEN** a linha Gestor mostra "Sem gestor definido"

### Requirement: Vínculo de usuário e gestor
As seções Usuário do sistema e Gestor SHALL manter o comportamento atual (vincular/desvincular usuário disponível; definir gestor sem auto-referência, sem desligados e sem ciclo), passando a exigir `canManageColaboradores` para as ações.

#### Scenario: Candidatos a gestor
- **WHEN** o RH abre a edição de gestor
- **THEN** a lista exclui o próprio colaborador, colaboradores desligados (exceto o gestor atual) e qualquer subordinado na cadeia

### Requirement: Recibos de pagamento na ficha
A aba Documentos do modal SHALL listar os recibos de pagamento (holerites) do colaborador para quem tem `canManageHolerites` ou `canViewAllHolerites`, agrupados por ano em ordem decrescente, com busca por mês ou ano (sem acento, aceita nome do mês ou "MM/AAAA"), filtro de ano, ações Visualizar e Baixar via link assinado, e "Limpar filtros" quando a busca não retorna resultado. Holerite cujo arquivo não existe no storage SHALL aparecer com ações desabilitadas e a mensagem "Arquivo não encontrado. Reenvie este holerite pela tela Holerites."

#### Scenario: Colaborador sem holerites
- **WHEN** o RH abre a aba Documentos de um colaborador sem holerites
- **THEN** é exibido "Nenhum holerite foi enviado para este colaborador. Os recibos aparecem aqui após o envio pela tela Holerites."

#### Scenario: Usuário sem permissão de holerites
- **WHEN** um usuário com `canViewColaboradores` mas sem permissão de holerites abre a ficha
- **THEN** a aba Documentos não é exibida

#### Scenario: Busca sem resultado
- **WHEN** a busca "março 2019" não encontra recibos
- **THEN** a lista mostra "Nenhum recibo encontrado para os filtros aplicados." com o link "Limpar filtros"
