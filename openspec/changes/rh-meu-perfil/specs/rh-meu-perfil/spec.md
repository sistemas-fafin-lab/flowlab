## ADDED Requirements

### Requirement: Acesso ao Meu perfil
O sistema SHALL ter a rota `/meu-perfil`, acessível a qualquer usuário autenticado, sem chave de permissão. O card do usuário no rodapé da sidebar (desktop e drawer mobile) SHALL ser clicável e navegar para `/meu-perfil`.

#### Scenario: Abrir pelo rodapé
- **WHEN** o usuário clica no card com seu nome no rodapé da sidebar
- **THEN** o sistema navega para `/meu-perfil`

#### Scenario: Usuário sem nenhuma permissão de RH
- **WHEN** um usuário sem chaves de RH acessa `/meu-perfil`
- **THEN** a tela é exibida normalmente com os dados do próprio colaborador

### Requirement: Conta sem colaborador vinculado
Quando a conta do usuário não está vinculada a nenhum colaborador, a tela SHALL exibir um estado vazio com a mensagem "Seu usuário não está vinculado a um cadastro de colaborador. Fale com o RH." e MUST NOT exibir card, abas ou dados.

#### Scenario: Conta genérica sem vínculo
- **WHEN** um usuário sem colaborador vinculado abre `/meu-perfil`
- **THEN** apenas o estado vazio é exibido

### Requirement: Layout do Meu perfil
A tela SHALL exibir o título "Meu perfil", o subtítulo "Consulte seus dados pessoais e documentos.", o card de resumo do colaborador (mesmo componente da ficha do RH) e as abas **Dados pessoais** e **Documentos**. A partir de 940px o card SHALL ficar fixo (sticky) à esquerda; abaixo disso SHALL ficar empilhado e recolhido, com o botão "Ver resumo completo"/"Ocultar resumo".

#### Scenario: Tela estreita
- **WHEN** a largura da tela é menor que 940px
- **THEN** o card aparece recolhido acima das abas, com o botão "Ver resumo completo"

### Requirement: Dados pessoais em modo leitura
A aba Dados pessoais SHALL exibir os dados pessoais do próprio colaborador nos quatro grupos (Identificação pessoal, Naturalidade, Informações pessoais, Filiação), somente leitura, com "—" para campos vazios. O colaborador MUST NOT conseguir ler dados pessoais de outro colaborador.

#### Scenario: Campos vazios
- **WHEN** o colaborador não tem nome do pai cadastrado
- **THEN** o campo Nome do pai exibe "—"

#### Scenario: Tentativa de ler outro colaborador
- **WHEN** um colaborador sem `canViewColaboradores` consulta `colaborador_dados_pessoais` de outro `colaborador_id`
- **THEN** a consulta não retorna linhas (RLS)

### Requirement: Recibos de pagamento no Meu perfil
A aba Documentos SHALL exibir o card "Recibos de pagamento" com os 4 recibos mais recentes e o botão "Ver todos os recibos (N)", que abre a lista completa agrupada por ano com busca por mês/ano, filtro de ano, Visualizar e Baixar. Recibo com arquivo ausente SHALL ter as ações desabilitadas e a mensagem "Arquivo indisponível no momento. Fale com o RH." O rodapé da aba SHALL exibir "Somente você e o RH têm acesso a estes documentos."

#### Scenario: Sem holerites
- **WHEN** o colaborador ainda não tem holerites
- **THEN** o card exibe "Seus holerites aparecem aqui assim que o RH os disponibilizar."

#### Scenario: Visualizar recibo
- **WHEN** o colaborador clica em Visualizar em um recibo
- **THEN** o PDF abre no visualizador usando link assinado de curta duração

### Requirement: Holerites fora do autoatendimento em RH
A rota `/rh/holerites` SHALL exigir `canManageHolerites`, `canViewAllHolerites` ou `canViewHoleritesEquipe` e MUST NOT exibir mais a seção "Meus holerites". O item "RH" da sidebar SHALL aparecer apenas para quem tem ao menos uma chave do grupo RH, e o subitem Holerites apenas para quem tem uma das três chaves de holerites.

#### Scenario: Colaborador comum acessa a rota antiga
- **WHEN** um usuário sem chaves de holerites acessa `/rh/holerites`
- **THEN** o sistema exibe acesso negado, e a sidebar não mostra o item RH para esse usuário
