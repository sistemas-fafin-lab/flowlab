# rh-solicitacao-alteracao-dados Specification

## Purpose
O colaborador mantém os próprios dados pessoais pelo Meu perfil, sem aprovação do RH. Até 06/11/2026 a edição virava uma solicitação que o RH aprovava ou recusava; esse fluxo foi retirado (`20261106130000_rh_dados_pessoais_edicao_direta`).

## Requirements
### Requirement: Edição de dados pessoais pelo colaborador
No Meu perfil, o colaborador vinculado SHALL poder entrar em modo de edição dos seus dados pessoais e alterar: nacionalidade, UF de nascimento, cidade de nascimento, cor/raça, gênero, estado civil, data de nascimento, nome da mãe e nome do pai. Nome completo e CPF MUST permanecer bloqueados, com cadeado e a dica "Para corrigir, fale com o RH." Cada campo alterado SHALL ser marcado como "Alterado", e o rodapé SHALL mostrar a quantidade de campos alterados com as ações Cancelar e "Salvar alterações" (desabilitada sem alterações).

#### Scenario: Entrar em edição
- **WHEN** o colaborador clica em Editar na aba Dados pessoais
- **THEN** os campos editáveis viram entradas, nome e CPF ficam com cadeado e o subtítulo passa a "Altere os campos permitidos e salve."

#### Scenario: Cancelar edição
- **WHEN** o colaborador altera campos e clica em Cancelar
- **THEN** os valores voltam aos atuais e nada é gravado

#### Scenario: Data de nascimento futura
- **WHEN** o colaborador informa data de nascimento futura e tenta salvar
- **THEN** a gravação é bloqueada com mensagem de validação

### Requirement: Gravação direta
Ao salvar, o sistema SHALL gravar na hora apenas os campos que diferem dos valores atuais, sem passar pelo RH, e exibir "Seus dados pessoais foram atualizados.". Se a gravação falhar, o formulário MUST permanecer em edição com os valores preenchidos, a mensagem de erro e "Tentar novamente".

#### Scenario: Salvar com sucesso
- **WHEN** o colaborador altera estado civil de Solteiro(a) para Casado(a) e clica em "Salvar alterações"
- **THEN** o estado civil passa a Casado(a) imediatamente, sem notificação ao RH

### Requirement: Histórico
Cada gravação SHALL ficar registrada em `colaborador_solicitacoes_alteracao` com status `aprovada`, quem alterou, a data e a lista "campo: de → para", sem gerar aviso para o colaborador.

#### Scenario: Registro da alteração
- **WHEN** o colaborador salva uma alteração de estado civil
- **THEN** é criado um registro com `{ campo: "estado_civil", de: "solteiro", para: "casado" }`, `solicitado_por` e `decidido_por` iguais ao colaborador

### Requirement: Integridade no banco
A gravação SHALL ocorrer somente pela RPC `rh_atualizar_meus_dados_pessoais`. O colaborador MUST NOT conseguir alterar dados de outro colaborador; a RPC MUST recalcular os valores anteriores no servidor, validar os valores e aceitar somente os campos editáveis. O RH continua editando a ficha inteira com `canManageColaboradores`.

#### Scenario: Campo não permitido
- **WHEN** a RPC recebe uma alteração de CPF ou nome
- **THEN** a RPC rejeita a gravação inteira
