## ADDED Requirements

### Requirement: Edição de dados pessoais pelo colaborador
No Meu perfil, o colaborador vinculado SHALL poder entrar em modo de edição dos seus dados pessoais e alterar: nacionalidade, UF de nascimento, cidade de nascimento, cor/raça, gênero, estado civil, data de nascimento, nome da mãe e nome do pai. Nome completo e CPF MUST permanecer bloqueados, com cadeado e a dica "Para corrigir, fale com o RH." Cada campo alterado SHALL ser marcado como "Alterado", e o rodapé SHALL mostrar a quantidade de campos alterados com as ações Cancelar e "Enviar para aprovação" (desabilitada sem alterações).

#### Scenario: Entrar em edição
- **WHEN** o colaborador clica em Editar na aba Dados pessoais
- **THEN** os campos editáveis viram entradas, nome e CPF ficam com cadeado e o subtítulo passa a "Altere os campos permitidos e envie para aprovação do RH."

#### Scenario: Cancelar edição
- **WHEN** o colaborador altera campos e clica em Cancelar
- **THEN** os valores voltam aos atuais e nenhuma solicitação é criada

#### Scenario: Data de nascimento futura
- **WHEN** o colaborador informa data de nascimento futura e tenta enviar
- **THEN** o envio é bloqueado com mensagem de validação no campo

### Requirement: Envio da solicitação
Ao enviar, o sistema SHALL registrar uma solicitação pendente contendo apenas os campos que diferem dos valores atuais, com o valor anterior e o novo de cada um. Os dados atuais MUST continuar valendo até a aprovação. O colaborador MUST NOT ter mais de uma solicitação pendente.

#### Scenario: Envio com sucesso
- **WHEN** o colaborador altera estado civil de Solteiro(a) para Casado(a) e clica em "Enviar para aprovação"
- **THEN** é criada uma solicitação pendente com essa única alteração e é exibido o toast "Solicitação enviada com sucesso! O RH vai analisar as alterações."

#### Scenario: Segunda solicitação
- **WHEN** já existe uma solicitação pendente do colaborador
- **THEN** o botão Editar fica desabilitado com a dica "Aguarde a análise da solicitação em andamento", e o banco rejeita uma nova pendente

#### Scenario: Falha no envio
- **WHEN** o envio falha por erro do servidor
- **THEN** o formulário permanece em edição com os valores preenchidos e exibe "Não foi possível enviar sua solicitação." com "Tentar novamente"

### Requirement: Acompanhamento pelo colaborador
Enquanto houver solicitação pendente, o Meu perfil SHALL exibir o banner "Alteração em análise pelo RH" com a data de envio, a lista "Campo: antes → depois", o aviso "Os dados atuais continuam valendo até a aprovação." e o botão "Cancelar solicitação"; cada campo afetado SHALL mostrar "Em análise: <novo valor>"; a aba Dados pessoais SHALL ter um indicador de pendência.

#### Scenario: Cancelar solicitação
- **WHEN** o colaborador clica em "Cancelar solicitação"
- **THEN** a solicitação passa a cancelada, o banner some e é exibido "Solicitação cancelada — Seus dados continuam como estavam."

### Requirement: Decisão pelo RH
Usuários com `canManageColaboradores` SHALL ver, na seção Dados pessoais do modal do colaborador, o banner "Solicitação de alteração pendente" com autor, data/hora de envio e a lista "Campo: antes → depois", e as ações "Aprovar alteração" e "Recusar". Recusar SHALL pedir motivo opcional ("Motivo da recusa (opcional, enviado ao colaborador)") com "Voltar" e "Confirmar recusa". Aprovar SHALL aplicar as alterações nos dados pessoais de forma atômica com a mudança de status. Uma solicitação já decidida ou cancelada MUST NOT poder ser decidida.

#### Scenario: Aprovar
- **WHEN** o RH clica em "Aprovar alteração"
- **THEN** os dados pessoais do colaborador passam a ter os novos valores, a solicitação fica aprovada e é exibido "Alteração aprovada com sucesso!"

#### Scenario: Recusar com motivo
- **WHEN** o RH clica em Recusar, escreve "Envie a certidão de casamento ao RH." e confirma
- **THEN** a solicitação fica recusada com o motivo, os dados não mudam e é exibido "Alteração recusada — O colaborador será notificado da recusa."

#### Scenario: Decisão concorrente
- **WHEN** o colaborador cancela a solicitação enquanto o RH está com o modal aberto e o RH clica em Aprovar
- **THEN** a operação é rejeitada com a mensagem "Esta solicitação não está mais pendente." e o modal recarrega

#### Scenario: Usuário só com visualização
- **WHEN** um usuário com `canViewColaboradores` sem `canManageColaboradores` abre a ficha com pendência
- **THEN** o banner é exibido sem as ações Aprovar e Recusar

### Requirement: Resultado para o colaborador
Após a decisão, o Meu perfil SHALL exibir um banner dispensável: "Alteração aprovada pelo RH — Seus dados foram atualizados em <data>." ou "Alteração recusada pelo RH — Sua solicitação foi analisada em <data>." seguido de "Motivo: <motivo>" quando houver. Dispensado, o banner MUST NOT reaparecer. Uma nova solicitação SHALL substituir o aviso anterior.

#### Scenario: Dispensar resultado
- **WHEN** o colaborador fecha o banner de resultado
- **THEN** o banner não aparece mais em acessos seguintes

### Requirement: Indicador de pendência na lista
A lista de Colaboradores SHALL exibir o badge "Alteração pendente" ao lado do nome de cada colaborador com solicitação pendente.

#### Scenario: Pendência na lista
- **WHEN** o RH abre RH › Colaboradores e há um colaborador com solicitação pendente
- **THEN** a linha desse colaborador mostra o badge "Alteração pendente"

### Requirement: Notificações no sino
O sistema SHALL criar notificação em `user_notifications` (módulo RH): para cada usuário com `canManageColaboradores` quando uma solicitação é enviada, com link para a ficha do colaborador; e para o colaborador quando a solicitação é aprovada ou recusada, com link para `/meu-perfil`. Cancelamento MUST NOT gerar notificação.

#### Scenario: Nova solicitação
- **WHEN** um colaborador envia uma solicitação
- **THEN** cada usuário com `canManageColaboradores` recebe a notificação "Solicitação de alteração de <nome>"

#### Scenario: Decisão
- **WHEN** o RH recusa uma solicitação
- **THEN** o colaborador recebe a notificação "Sua alteração de dados foi recusada"

### Requirement: Integridade no banco
Criação, cancelamento, decisão e dispensa de aviso SHALL ocorrer somente por RPCs. O colaborador MUST NOT conseguir inserir ou alterar solicitações de outro colaborador nem decidir solicitações; a RPC de solicitação MUST recalcular os valores anteriores no servidor e aceitar somente os campos editáveis.

#### Scenario: Campo não permitido
- **WHEN** a RPC de solicitação recebe uma alteração de CPF ou nome
- **THEN** a RPC rejeita a solicitação inteira
