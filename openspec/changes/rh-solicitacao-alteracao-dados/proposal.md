## Why

Hoje só o RH altera o cadastro, e o colaborador precisa pedir fora do sistema (mensagem, e-mail) quando muda de estado civil ou percebe um dado errado. O protótipo em `.design-sync/modulo_rh/` prevê que o próprio colaborador edite seus dados pessoais no Meu perfil e que as alterações só valham depois da aprovação do RH, mantendo o RH como responsável pelo cadastro.

Proposta 4 de 4 do módulo RH. **Depende de `rh-ficha-colaborador`** (tabela `colaborador_dados_pessoais`, `canManageColaboradores`, modal do RH) **e de `rh-meu-perfil`** (tela Meu perfil).

## What Changes

- Nova tabela `colaborador_solicitacoes_alteracao` (alterações em `jsonb`, status pendente/aprovada/recusada/cancelada, motivo, autor e data da decisão) com no máximo **uma pendente por colaborador**.
- RPCs atômicas para solicitar, cancelar, decidir (aprovar aplica as mudanças em `colaborador_dados_pessoais`) e dispensar o aviso de resultado.
- Meu perfil, aba Dados pessoais: botão **Editar** → modo de edição com marcação de campos alterados e "Enviar para aprovação". Nome completo e CPF ficam bloqueados (cadeado, "Para corrigir, fale com o RH.").
- Meu perfil: banner "Alteração em análise pelo RH" com antes → depois e "Cancelar solicitação"; banner de resultado (aprovada/recusada com motivo) dispensável; ponto laranja na aba enquanto há pendência.
- Modal do RH: banner "Solicitação de alteração pendente" na seção Dados pessoais com antes → depois, **Aprovar alteração** e **Recusar** (motivo opcional, enviado ao colaborador); ponto na aba Dados pessoais.
- Lista de Colaboradores: badge "Alteração pendente" ao lado do nome.
- Notificações no sino (`user_notifications`): ao RH (usuários com `canManageColaboradores`) quando chega uma solicitação; ao colaborador quando é decidida.

## Capabilities

### New Capabilities
- `rh-solicitacao-alteracao-dados`: solicitação de alteração de dados pessoais pelo colaborador, com aprovação ou recusa pelo RH e notificações.

### Modified Capabilities
(nenhuma — specs das propostas anteriores ainda não arquivadas.)

## Impact

- **Banco**: migration com a tabela, índice único parcial, RLS e as RPCs `SECURITY DEFINER`; inserção em `user_notifications` pelas RPCs.
- **Frontend**: `MeuPerfilPage` (edição e banners), `DadosPessoaisSection`/leitura (modo edição do colaborador), `ColaboradorDetalheModal` (banner de decisão), `ColaboradoresPage` (badge), `useColaboradores` (flag de pendência), novo hook `useSolicitacaoAlteracao`.
- **Fora do escopo**: e-mail, alteração de dados cadastrais, nome ou CPF pelo colaborador, anexo de comprovante, histórico navegável de solicitações.
