# 01: Permissões do Faturamento por tela

**What to build:** o administrador consegue dar acesso a cada tela do Faturamento separadamente. Um usuário só com "Ver Contas a Receber" vê apenas Contas a Receber no menu e nas rotas; quem já tem "Visualizar Faturamento" (`canViewBilling`) continua vendo tudo, sem nova configuração. Decisão em `docs/adr/0001-permissoes-faturamento-por-tela.md`; spec em `.scratch/faturamento-calendario-envios/spec.md` (seção Permissões).

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Novas chaves na lista de permissões (com rótulo e grupo): `canViewFaturas`, `canViewContasReceber`, `canViewGlosas`, `canViewIndicadores`, `canViewCalendarioEnvios`, `canManageCalendarioEnvios`.
- [x] Rotas e itens de menu de Faturas, Contas a Receber, Glosas e Recursos e Indicadores aceitam `canViewBilling` **ou** a chave da tela; o item "Faturamento" do menu aparece se o usuário tiver qualquer uma e aponta para a primeira tela permitida.
- [x] Endpoints de leitura da API do Faturamento seguem a mesma regra da tela que os consome; as escritas de Contas a Receber continuam exigindo `canManageBilling`.
- [x] Usuário só com `canViewContasReceber` não abre as outras telas pela URL.
- [x] Usuário com `canViewBilling` não perde nenhum acesso (conferido nas 4 telas).
- [x] Teste da regra "chave geral ou chave da tela", no estilo dos testes de permissões existentes.
