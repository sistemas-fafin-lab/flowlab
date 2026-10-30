## Why

O modal do colaborador no RH (`ColaboradorDetalheModal`) só cobre dados cadastrais mínimos (cargo, admissão, matrícula, departamento), vínculo de usuário e gestor. O RH pediu uma ficha mais completa — com dados pessoais (naturalidade, filiação, estado civil etc.) e acesso aos recibos de pagamento do colaborador — seguindo o protótipo em `.design-sync/modulo_rh/` (variação de modal **A** e de card **B**). Além disso, hoje quem só visualiza colaboradores (`canViewColaboradores`) também consegue editar a ficha, o que não é mais aceitável com dados pessoais sensíveis entrando no cadastro.

Esta é a proposta 1 de 4 do módulo RH (seguem `rh-meu-perfil`, `rh-documentos-assinados` e `rh-solicitacao-alteracao-dados`).

## What Changes

- Nova permissão `canManageColaboradores` (grupo RH): editar ficha, dados pessoais, vínculo de usuário e gestor. Concedida aos cargos Administrador e RH.
- **BREAKING**: `canViewColaboradores` passa a ser somente leitura — a policy de UPDATE em `colaboradores` passa a exigir `canManageColaboradores`. Cargos que hoje editam só com `canViewColaboradores` (ex.: "RH - Consulta") perdem a edição.
- Nova tabela 1:1 `colaborador_dados_pessoais` (nacionalidade, UF e cidade de nascimento, cor/raça, gênero, estado civil, data de nascimento, nome da mãe, nome do pai), com RLS própria.
- Modal do colaborador redesenhado (variação A): cabeçalho com nome, status e "Cargo · Departamento · Matrícula"; coluna esquerda com card de resumo (variação B); coluna direita com abas **Dados pessoais** (seções empilhadas: Dados cadastrais, Dados pessoais, Usuário do sistema, Gestor) e **Documentos** (recibos de pagamento).
- Card de resumo do colaborador (variação B, **sem** remuneração, **sem** centro de custo, **sem** atalho "Ver holerite"): avatar, nome, cargo e linhas com ícone para Departamento, Data de admissão, Gestor, CPF (somente leitura) e E-mail. Componente reutilizável pela proposta `rh-meu-perfil`.
- Edição por seção com modo explícito (Editar → Cancelar/Salvar), uma seção por vez; nome, CPF e e-mail permanecem somente leitura para todos.
- Aba Documentos do modal: recibos de pagamento do colaborador agrupados por ano, com busca por mês/ano, filtro de ano, visualizar/baixar e estado de arquivo indisponível.

## Capabilities

### New Capabilities
- `rh-ficha-colaborador`: ficha do colaborador na visão do RH — permissão de gestão, dados cadastrais, dados pessoais, vínculo de usuário, gestor, card de resumo e consulta de recibos de pagamento.

### Modified Capabilities
(nenhuma — `openspec/specs/` não tem specs de RH; esta é a primeira da área.)

## Impact

- **Banco**: nova migration com `colaborador_dados_pessoais` + RLS, troca da policy `colaboradores_update` para `canManageColaboradores`, concessão da chave aos cargos Administrador e RH.
- **Permissões**: `src/utils/permissions.ts` (nova chave no grupo RH) e `src/utils/permissions.test.ts` (`CHAVES_POSTERIORES`).
- **Frontend**: `src/modules/rh/components/ColaboradorDetalheModal.tsx` (reescrito), `sections/EditarCadastroSection.tsx`, `GestorSection.tsx`, `VinculoUsuarioSection.tsx` (gate por `canManageColaboradores`), nova seção de dados pessoais, novo `ColaboradorResumoCard`, nova lista de recibos reutilizável; `hooks/useColaboradores.ts` e novo hook de dados pessoais; `types.ts`.
- **Fora do escopo**: remuneração no card, centro de custo, documentos assinados, Meu perfil e solicitação de alteração pelo colaborador (propostas seguintes).
