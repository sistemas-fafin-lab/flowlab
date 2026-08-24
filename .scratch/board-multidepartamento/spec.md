# Board (Kanban) multi-departamento

Status: ready-for-agent

Spec resultante de sessão de grilling com o usuário em 2026-08-21. Generaliza o
Kanban hoje exclusivo do time de TI (`src/components/IT/ITKanbanBoard.tsx`,
tabela `it_requests`) para que outros departamentos tenham seu próprio board
isolado, começando por "Transporte". O board de TI permanece como está —
sistema legado, intocado por esta spec.

## Problema

O Kanban de "Board" existe hoje só para o time de TI: a tela, a tabela
(`it_requests`) e a regra de acesso (RLS hardcoded para `department = 'TI'`)
são todas específicas de TI. O usuário quer dar a outros times (primeiro caso:
Transporte) um board próprio, com dados completamente isolados entre
departamentos — mas sem ter que repetir o trabalho de construir um módulo
inteiro do zero a cada novo departamento, nem inventar uma permission nova a
cada vez.

## Solução

Extrair a UI de Kanban (colunas + drag-and-drop) do componente de TI para um
componente compartilhado, e construir por trás dela uma infraestrutura de
board **genérica e reutilizável**: uma tabela de catálogo de boards, uma
tabela de cards genérica, e exatamente duas permissions novas e fixas
(`canManageBoard`, `canManageAllBoards`) que nunca precisam crescer conforme
departamentos são adicionados.

O board que um funcionário enxerga não é decidido por um campo de
"departamento" nem por uma permission por departamento — é decidido pelo
**cargo** (`custom_role`) do funcionário: cada cargo pode estar vinculado a,
no máximo, um board. Vários cargos podem apontar para o mesmo board (ex:
"Motorista" e "Supervisor de Transporte" ambos no board de Transporte).
Adicionar um departamento novo no futuro vira: uma linha nova na tabela de
boards + marcar os cargos certos (usando a UI de cargos que já existe hoje em
`UserManagement.tsx`) — nenhuma migration de permissão nova, nenhuma rota
nova, nenhum módulo novo por departamento.

## User Stories

1. Como funcionário com um cargo vinculado ao board de Transporte, quero abrir
   a tela "Board" e ver automaticamente o kanban do meu departamento, sem
   escolher nada.
2. Como funcionário com um cargo vinculado ao board de Transporte e com a
   permission `canManageBoard`, quero criar, editar, mover entre colunas e
   excluir cards do meu board.
3. Como funcionário com um cargo vinculado ao board de Transporte mas **sem**
   `canManageBoard`, quero conseguir ver o board (colunas e cards) mas não
   conseguir arrastar, editar ou excluir nada.
4. Como funcionário cujo cargo não está vinculado a nenhum board, ao acessar a
   tela "Board" diretamente pela URL, quero ver uma tela de acesso negado, e
   não um erro ou uma tela em branco.
5. Como administrador com a permission `canManageAllBoards`, quero ver e
   gerenciar os boards de **todos** os departamentos, não só o do meu cargo.
6. Como administrador com `canManageAllBoards` acessando a tela "Board" e
   tendo mais de um board disponível, quero um seletor (dropdown/abas) para
   trocar entre os boards dos diferentes departamentos.
7. Como funcionário comum que só enxerga um board (o do próprio cargo), quero
   cair direto nele, sem ver seletor nenhum.
8. Como responsável por cargos (via `UserManagement.tsx`), quero marcar
   `canManageBoard` em qualquer cargo existente usando a mesma tela de
   administração de cargos que já uso hoje para outras permissions.
9. Como responsável por cadastrar um board novo, quero que o processo seja
   inserir uma linha na tabela de catálogo de boards (via migration/SQL), sem
   depender de uma tela de administração dedicada — não há volume que
   justifique essa tela ainda.
10. Como funcionário do time de TI, quero que meu board e meu fluxo de
    trabalho continuem exatamente como estão hoje, sem nenhuma mudança de
    comportamento, campos ou permissões.
11. Como funcionário movendo um card entre colunas no board de Transporte,
    quero a mesma experiência de drag-and-drop que já existe no board de TI.
12. Como funcionário olhando um card, quero ver os mesmos campos genéricos
    (título, descrição, responsável, prazo, prioridade) independente do meu
    departamento.
13. Como responsável por cargos, ao trocar o board vinculado a um cargo (ex:
    mover o cargo "Supervisor" do board de Transporte para outro board no
    futuro), quero que todos os funcionários daquele cargo passem a ver o
    board novo automaticamente, sem trabalho extra por usuário.
14. Como dois cargos diferentes do mesmo departamento (ex: "Motorista
    Transporte" e "Supervisor Transporte"), quero que ambos apontem para o
    mesmo board e enxerguem os mesmos cards, cada um com seu próprio nível de
    permissão (`canManageBoard` ou só visualização).
15. Como agente/desenvolvedor implementando um departamento futuro (ex: RH),
    quero que a única mudança de código necessária seja, na pior das
    hipóteses, uma linha na tabela de boards e o vínculo de cargos — nunca uma
    nova permission key, nova rota ou novo módulo.
16. Como funcionário sem `custom_role_id` nenhum (perfil sem cargo atribuído),
    quero ver a mesma tela de acesso negado da user story 4.

## Implementation Decisions

- **Módulo novo**: `src/modules/board/` (slug `board`), seguindo a estrutura
  padrão descrita em `/add-module` (`domain/`, `hooks/`, `components/`,
  `index.ts`). Rota única `/board`. TI (`src/components/IT/*`, `it_requests`)
  não é tocado nem migrado para este módulo — permanece 100% legado e
  independente.
- **Componente de UI compartilhado**: extrair a lógica de colunas +
  drag-and-drop de `ITKanbanBoard.tsx` para um componente apresentacional
  reutilizável (ex: `src/components/shared/KanbanBoard.tsx`), parametrizado
  por colunas/cards/callbacks de movimentação. `ITKanbanBoard.tsx` passa a
  consumir esse componente compartilhado para o board de TI; o novo módulo
  `board` consome o mesmo componente para os boards genéricos. Esta é a única
  peça de código de fato compartilhada entre TI e os novos boards — dados e
  regras de acesso permanecem completamente separados.
- **Schema (Supabase, nova migration)**:
  - `boards`: catálogo de boards — `id`, `slug`, `label`, `created_at`. Uma
    linha por departamento (v1: uma única linha, "transporte").
  - `custom_roles`: nova coluna `board_id` (FK nullable para `boards.id`).
    Um cargo aponta para no máximo um board; vários cargos podem apontar para
    o mesmo board.
  - `board_tickets`: tabela genérica de cards — `id`, `board_id` (FK),
    `title`, `description`, `responsible_id` (FK `user_profiles`),
    `due_date`, `priority`, `kanban_status` (mesmo conjunto de valores do
    enum já usado por `it_requests.kanban_status`: `backlog`/`todo`/
    `in_progress`/`review`/`done`), `created_by`, timestamps. Sem colunas
    específicas de departamento (nada de "veículo"/"rota" etc. no v1).
- **Permissions (`src/utils/permissions.ts` → `ALL_PERMISSION_KEYS`)**:
  exatamente duas chaves novas, agrupadas sob "Board":
  - `canManageBoard` — escrita (criar/editar/mover/excluir cards) no board do
    **próprio cargo**.
  - `canManageAllBoards` — leitura e escrita em **todos** os boards,
    independente do cargo.
  Nenhuma permission nova é criada por departamento adicionado — esse é o
  ponto central da generalização. Visualizar o próprio board não depende de
  nenhuma dessas duas permissions: depende só do cargo ter `board_id`
  preenchido (ver regra de acesso abaixo).
- **Regra de acesso (RLS + frontend)** — não é um simples check de permission
  string como os demais módulos (`canView<Modulo>`), é a combinação de duas
  condições:
  - **Ver** um `board_tickets` do board X: o cargo do usuário tem
    `board_id = X`, **ou** o usuário tem `canManageAllBoards`.
  - **Escrever** (criar/editar/mover/excluir) um `board_tickets` do board X: a
    condição de "ver" acima **e** o usuário tem `canManageBoard`, **ou** o
    usuário tem `canManageAllBoards` (que já dá escrita em qualquer board).
  Isso vale tanto para a policy de RLS quanto para o gate de rota no
  frontend — a rota `/board` não pode usar o padrão simples
  `<ProtectedRoute permission="canView...">` de outros módulos, precisa
  checar também `userProfile.customRole?.board_id`. Sinalizar isso
  explicitamente para quem implementar, é um desvio real do padrão usual do
  `/add-module`.
- **Resolução de qual board mostrar (frontend)**: ao entrar em `/board`, o
  hook do módulo determina a lista de boards visíveis ao usuário (o do
  próprio cargo, mais todos os boards se `canManageAllBoards`). Se a lista
  tiver exatamente 1 board, renderiza direto; se tiver mais de 1, mostra um
  seletor (dropdown ou abas) antes/junto do board.
- **Colunas do kanban**: mesmo template fixo para todos os boards (mesmo
  enum de `kanban_status` do TI), sem customização por departamento no v1.
- **Cadastro de um board novo**: manual, via migration/SQL (`INSERT` em
  `boards`), sem tela de administração dedicada. Vincular cargos ao board
  (`custom_roles.board_id`) e marcar `canManageBoard` nos cargos certos usa a
  UI de cargos que já existe (`UserManagement.tsx`) — nenhuma tela nova
  necessária para isso.
- **v1 concreto**: uma linha em `boards` para "transporte"; o usuário mesmo
  marca `canManageBoard` (e, via `board_id`, o vínculo ao board) nos cargos
  de Transporte que já existem no sistema.

## Testing Decisions

Um teste só vale a pena se testa comportamento observável, não detalhe de
implementação — seguindo o padrão já usado no projeto (`src/modules/*/domain/
*.test.ts`, `src/utils/permissions.test.ts`): lógica pura de negócio,
separada de React e Supabase, é o que fica em `domain/` e ganha teste
co-localizado.

- **Seam único e de maior valor**: uma função pura em
  `src/modules/board/domain/` (ex: `resolveBoardAccess`) que recebe o cargo
  do usuário (permissions + `board_id`) e devolve o que ele pode ver/fazer
  (`{ boardId, canView, canManage }` ou equivalente) — sem tocar Supabase ou
  React. É essa função que centraliza a regra de acesso descrita acima
  (cargo com `board_id` = view; `canManageBoard` = write; `canManageAllBoards`
  = bypass total), e é o seam mais alto possível para testar a parte que
  realmente tem lógica de decisão nesta feature.
- Cobrir nos testes: cargo sem `board_id` (sem acesso), cargo com `board_id`
  sem `canManageBoard` (view only), cargo com `board_id` e `canManageBoard`
  (view + manage), usuário com `canManageAllBoards` (acesso total
  independente do cargo), usuário sem `custom_role_id`.
- Prior art direto: `src/utils/permissions.test.ts` (testa `hasPermission`) e
  `src/modules/qualidade/domain/*.test.ts` (funções puras de regra de
  negócio testadas isoladamente).
- **Fora do escopo de teste automatizado**: a policy de RLS em si (o projeto
  não tem testes de RLS/pgTAP hoje — verificação é manual, como já é
  convenção) e o componente visual de Kanban extraído
  (`KanbanBoard.tsx`/drag-and-drop) — nenhum componente de UI tem teste
  automatizado hoje no projeto, então não introduzir esse precedente aqui.

## Out of Scope

- Migrar `it_requests`/o board de TI para o novo modelo genérico — decisão
  separada para outro momento, se fizer sentido.
- Colunas customizáveis por departamento (todos usam o mesmo template no v1).
- Campos de card específicos por departamento (ex: veículo/rota para
  Transporte) — só os campos genéricos no v1.
- Tela de administração para cadastrar boards novos — cadastro continua
  manual (SQL/migration) até haver volume que justifique.
- Um cargo vinculado a mais de um board (`custom_roles.board_id` é singular).
- Portar features específicas de TI (SLA, tags, sprints, mind map, etc.) para
  o board genérico — ficam exclusivas do módulo de TI.
- Notificações ou automações novas ligadas ao board genérico.

## Further Notes

- O padrão `/add-module` continua servindo de checklist geral (estrutura de
  pastas, onde registrar permissions, onde adicionar rota/sidebar), mas dois
  pontos deste módulo fogem do padrão descrito lá e merecem atenção de quem
  implementar: (1) só duas permissions no total, não um par `canView<Modulo>`/
  `canManage<Modulo>` por módulo; (2) o gate de acesso da rota depende de
  `custom_roles.board_id`, não só de uma permission string — o componente
  `<ProtectedRoute>` (ou o carregamento do módulo) provavelmente precisa de um
  ajuste pontual para suportar essa condição composta.
- Vale conferir, ao implementar, se `LEGACY_ROLE_PERMISSIONS` (mapeamento de
  roles legadas `admin`/`operator`/`requester` para permissions) precisa de
  ajuste para as duas chaves novas — pelo padrão documentado no
  `/add-module`, `admin` herda automaticamente todas as chaves de
  `ALL_PERMISSION_KEYS`, então `canManageAllBoards` deve chegar em `admin` de
  graça; vale só confirmar que isso é o comportamento desejado (todo admin
  legado enxerga todos os boards).
- O time de Transporte já tem cargos cadastrados hoje no sistema (usados para
  outras permissions) — o usuário confirmou que fará ele mesmo o trabalho de
  marcar `canManageBoard` e vincular `board_id` nesses cargos existentes,
  então a spec não prevê criação de cargo novo dedicado.
