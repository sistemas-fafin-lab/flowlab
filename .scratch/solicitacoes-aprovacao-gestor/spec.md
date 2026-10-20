# Solicitações de Compra: aprovação pelo aprovador do departamento de quem pediu

Status: ready-for-agent

## Problem Statement

Hoje o "Aprovar" de uma Solicitação de Compra (SC) aparece para qualquer
pessoa cujo cargo tenha `canApproveRequests`, e essa pessoa vê as SCs de
todos os setores. O sistema nunca consulta quem responde por quem pediu.
Na prática, a Louise (Administrador) recebe para aprovar SCs que não são
dela — por exemplo a REQ868 (Qualidade, Ana Claudia) — e ela só aprova a
compra dos orçamentos (etapa de alçada da cotação), não o pedido.

A regra do laboratório é: o pedido vai para quem aprova pela área de quem
pediu; tudo da área técnica vai para o Paulo, mesmo que venha do time da
Eduarda Fabri.

Além disso, `canApproveRequests` mistura duas coisas: aprovar o pedido e o
operacional de Compras (iniciar cotação, finalizar, ver todos os setores),
que o comprador (Mateus) precisa. O Paulo, a Eduarda, a Suane e a Raquel
nem têm essa permissão.

O RH também não tem como dizer "quem responde por qual área": só existe
`colaboradores.gestor_id`, um gestor por pessoa, preenchido pessoa a pessoa
(levantamento de produção de 20/10/2026: 27 de 58 colaboradores sem
gestor), e o departamento é texto livre (`colaboradores.departamento`).

## Solution

O RH passa a cadastrar **departamentos** (entidade própria, plana, sem
hierarquia). Cada colaborador está em um departamento; cada departamento
tem um **aprovador de SC** e zero ou mais **responsáveis**.

- A aprovação da SC é do **aprovador do departamento de quem pediu**:
  definido uma vez por departamento, não pessoa a pessoa. A Área técnica
  inteira (inclusive o time da Eduarda) tem o Paulo como aprovador.
- Ser responsável por um departamento é independente de estar nele: a
  Louise responde pelo departamento dela e pelo da Raquel.
- Sem aprovador utilizável (departamento sem aprovador, colaborador sem
  departamento, aprovador indisponível, ou o próprio aprovador pedindo), a
  SC fica com o aviso "sem aprovador no RH" e quem tem `canApproveRequests`
  aprova no lugar, registrado no histórico.
- O aprovador aprova/rejeita na mesma lista de Solicitações, não precisa de
  `canApproveRequests`, e é avisado por e-mail e por um card na Home.
- Compras só inicia cotação/finaliza depois da aprovação.
- Quem aprovou a SC vira o **gestor do pedido travado** na cotação gerada
  a partir dela (etapa 1 de `.scratch/cotacoes-aprovacao-gestor/`).
- Os holerites da equipe passam a seguir os responsáveis do departamento,
  e `colaboradores.gestor_id` deixa de existir.

A Solicitação de Material (SM) não muda.

## User Stories

1. Como aprovador de um departamento, quero que as SCs de quem está nele
   cheguem para mim, para dar o "de acordo" no pedido.
2. Como Louise, não quero ver Aprovar/Rejeitar nas SCs de departamentos que
   têm aprovador, porque eu só aprovo os orçamentos.
3. Como aprovador sem `canApproveRequests`, quero aprovar sem ganhar
   acesso ao operacional de Compras (finalizar, iniciar cotação, ver todos
   os setores).
4. Como aprovador, quero ver na lista de Solicitações, além do meu setor,
   as SCs em que sou o aprovador, com o filtro "Aguardando minha
   aprovação".
5. Como aprovador, quero um e-mail quando uma SC entrar para mim e um card
   na Home ("SCs aguardando sua aprovação"), visível só quando há alguma.
6. Como aprovador, quero rejeitar com comentário obrigatório, e quero que
   quem pediu receba um e-mail com o motivo.
7. Como RH, quero cadastrar os departamentos, definir quem está em cada um,
   quem responde por ele e quem aprova as SCs dele.
8. Como RH, quero que, ao mudar o departamento de alguém ou o aprovador de
   um departamento, as SCs pendentes que estavam sem aprovador sejam
   recalculadas e o novo aprovador avisado.
9. Como admin (`canApproveRequests`), quero aprovar/rejeitar no lugar do
   aprovador apenas quando a SC não tem aprovador, com isso registrado.
10. Como comprador, quero que uma SC pendente fique bloqueada para iniciar
    cotação ou finalizar até ser aprovada.
11. Como comprador, quero que a cotação gerada da SC já venha com o gestor
    do pedido travado em quem aprovou a SC.
12. Como responsável por um departamento (com `canViewHoleritesEquipe`),
    quero ver os holerites de quem está nele, inclusive de departamentos
    pelos quais respondo sem estar neles (Louise → equipe da Raquel).
13. Como RH, quero ver quem está sem departamento, para corrigir.

## Implementation Decisions

- **Escopo:** só `requests.type = 'SC'`. SM continua como hoje (aprovada
  por `canApproveRequests`).
- **Departamentos (schema):**
  - `departamentos`: `id`, `nome` (único), `ativo`, `aprovador_sc_id`
    (FK `colaboradores`, nullable). Plana: sem departamento pai (pode
    entrar depois como `departamento_pai_id`, se precisar).
  - `colaboradores.departamento_id` (FK `departamentos`, **nullable**): um
    departamento por pessoa. Nullable porque o colaborador nasce
    automaticamente de um `user_profile` (`rh_sync_colaborador`), sem
    departamento conhecido; "sem departamento" aparece como pendência no
    RH.
  - `departamento_responsaveis (departamento_id, colaborador_id)`, únicos
    juntos: N:N, independente de onde a pessoa está. Sem "líder": só
    responsáveis pela área.
  - O aprovador de SC é coluna do departamento (um por departamento), não
    papel em `departamento_responsaveis`; pode ser de outro departamento
    (Paulo aprova o departamento da Eduarda).
  - Desativar um departamento é bloqueado enquanto houver colaborador
    ativo nele. Não há exclusão.
  - Depois da carga conferida, saem `colaboradores.gestor_id` (e as
    funções/trigger de cadeia que dependem dela) e
    `colaboradores.departamento` (texto); `rh_sync_colaborador` deixa de
    gravar o texto.
- **Permissão:** nova `canManageDepartamentos` ("Gerenciar Departamentos",
  grupo RH): acesso à aba e escrita em `departamentos` e
  `departamento_responsaveis`, e definir `colaboradores.departamento_id`.
  Inicialmente para o cargo RH e admin. Leitura de `departamentos` (nome,
  ativo) aberta a qualquer autenticado.
- **Tela do RH:** aba "Departamentos" (criar, renomear, desativar,
  responsáveis, aprovador de SC, membros, pendência "sem departamento"); na
  ficha do colaborador o departamento vira select.
- **Holerites da equipe:** com `canViewHoleritesEquipe`, vê os holerites
  dos colaboradores cujo `departamento_id` é um departamento em que o
  usuário está em `departamento_responsaveis`. Ser responsável sem a
  permissão não basta. A troca é dentro de
  `colaborador_e_subordinado_do_usuario_atual`; as três policies ficam.
  Muda o resultado: a Louise passa a ver a equipe da Raquel (hoje só vê o
  gestor direto).
- **Schema das SCs:**
  - `requests.approver_id uuid` (FK `user_profiles`, nullable): aprovador,
    **gravado na criação**. Nulo = sem aprovador (cai no admin). O client
    não grava nem altera (trigger de criação ignora o valor enviado;
    trigger de UPDATE barra `authenticated`/`anon`). Quem grava fora da
    criação — RPC de decisão, recálculo — tem de ser `SECURITY DEFINER`.
  - `requests.approved_by_user_id uuid` (FK `user_profiles`, nullable):
    quem efetivamente aprovou (aprovador ou admin no lugar). O texto
    `approved_by` existente continua sendo preenchido.
  - Registro de que a decisão foi do admin no lugar do aprovador (coluna ou
    histórico de auditoria).
- **Resolução do aprovador** (função no banco, regra espelhada em função
  pura testável no client só para exibição):
  - parte do colaborador vinculado a `requested_by_user_id`;
  - pega o `aprovador_sc_id` do departamento dele (`departamento_id`);
  - o aprovador vale se o colaborador está `ativo`, tem `user_profile_id`
    e o usuário não está removido/desativado, e **não é o próprio
    solicitante**; senão `approver_id` nulo, sem procurar outro;
  - também nulo: solicitante sem colaborador, sem departamento, ou
    departamento sem aprovador. Paulo (aprovador da Área técnica) abrindo
    a própria SC cai aqui.
  - `requests.department` (texto da SC) não entra na resolução.
- **Quando calcular:** trigger na criação da SC; uma vez no deploy para as
  SCs `pending` sem aprovador (incluindo REQ868); e, quando o RH alterar
  `colaboradores.departamento_id` ou `departamentos.aprovador_sc_id`,
  recalcular **apenas** as SCs `pending` com `approver_id` nulo (disparando
  o e-mail para o novo aprovador). SCs que já têm aprovador não mudam.
- **Decisão (RPC `SECURITY DEFINER`, atômica, `FOR UPDATE`):**
  - autoriza: usuário é o `approver_id`, ou `approver_id` é nulo e o
    usuário tem `canApproveRequests`;
  - exige `type = 'SC'` e `status = 'pending'`;
  - aprovação → `approved`, grava `approved_by_user_id`;
  - rejeição → `rejected`, comentário obrigatório;
  - devolve se foi admin no lugar.
- **Permissões de Solicitações:** `canApproveRequests` deixa de significar
  "aprova SC" e fica para o operacional de Compras (iniciar cotação,
  finalizar, ver todos os setores), aprovar SM e aprovar no lugar quando
  não há aprovador. Ser aprovador não exige permissão nenhuma de cargo.
- **Tela de Solicitações:**
  - o aprovador vê o próprio setor + as SCs em que é `approver_id` (RLS de
    `requests` precisa permitir esse SELECT);
  - filtro "Aguardando minha aprovação";
  - Aprovar/Rejeitar numa SC: só para o `approver_id`; para quem tem
    `canApproveRequests`, só quando `approver_id` é nulo (com aviso "sem
    aprovador no RH");
  - SC pendente mostra quem é o aprovador;
  - iniciar cotação e finalizar bloqueados enquanto a SC está `pending`.
- **E-mails** (endpoint genérico + `email_notification_templates`, melhor
  esforço):
  - novo: SC aguardando aprovação → para o aprovador, com link para a
    lista filtrada;
  - novo: SC rejeitada → para quem pediu, com o comentário;
  - o e-mail de SC criada para `REQUESTS_STOCK_ALERT_TO` continua.
- **Card na Home** "SCs aguardando sua aprovação", só quando houver alguma.
- **Cotações (revisão da issue 09 de `cotacoes-aprovacao-gestor`):** o
  gestor do pedido travado passa a ser `requests.approved_by_user_id` (quem
  aprovou a SC), não mais `requested_by_user_id`. Se a SC foi aprovada por
  admin no lugar (sem aprovador), não há trava e vale a escolha manual da
  issue 09. Ajustar trigger `quotation_enforce_requester_manager` e
  `resolveRequesterManagerChoice`.
- **Dados iniciais:**
  1. Levantar (somente leitura) os valores distintos de
     `colaboradores.departamento` em produção e montar o mapeamento
     texto atual → departamento; **o usuário aprova o mapeamento antes da
     migration**.
  2. A migration cria os departamentos aprovados e preenche
     `colaboradores.departamento_id`.
  3. Preenche só o que já foi decidido: Área técnica (inclusive o time da
     Eduarda) → aprovador Paulo Vítor; Louise Fontel responsável pelo
     departamento dela e pelo da Raquel. Eduarda Fabri e Raquel não são
     aprovadoras. Os demais aprovadores (Louise, Suane — aprovadoras na
     versão anterior — e os outros departamentos) e responsáveis são
     confirmados junto com o mapeamento do passo 1; o que ficar sem
     confirmação o RH preenche na aba.
  4. `gestor_id` e o texto do departamento só saem depois de conferido.
- **Migration já commitada** `20261020170000_sc_aprovador_pela_cadeia_do_rh.sql`
  (nunca aplicada em nenhum projeto): editada no lugar — sai
  `aprova_solicitacao_compra` e a cadeia por `gestor_id`; ficam
  `approver_id`, `approved_by_user_id`, o trigger de criação e a proteção
  contra o client.

## Testing Decisions

- Funções puras via vitest, mesmo padrão do projeto:
  - resolução do aprovador: departamento com aprovador, departamento sem
    aprovador, aprovador desligado/sem login/desativado (nulo, sem
    procurar outro), aprovador = solicitante, solicitante sem colaborador,
    colaborador sem departamento, aprovador de outro departamento;
  - visibilidade dos botões por papel (aprovador, admin com e sem
    aprovador, comprador, SM);
  - builders de e-mail (aprovador, rejeição com comentário escapado).
- RPC, triggers de criação/recálculo/proteção, holerites da equipe e RLS:
  validação manual no projeto de teste com usuários reais de teste, como
  nas cotações.

## Out of Scope

- Mudar a etapa de alçada das cotações.
- Reatribuir o aprovador de uma SC que já tem aprovador (o recálculo só
  pega SCs sem aprovador).
- Hierarquia entre departamentos.
- Aprovador substituto por departamento.
- Unificar `user_profiles.department` e `requests.department` (texto) com
  `departamentos`: continuam como estão, inclusive para "ver as SCs do meu
  setor". **Dívida registrada** para uma entrega própria.
- Preencher os departamentos/aprovadores além dos já conhecidos (tarefa do
  RH na aba).
- Resumo diário de SCs pendentes.
- SM.

## Further Notes

- Decidido com o usuário em 20/10/2026 (grilling) a partir da pergunta da
  Louise sobre a REQ868; revisado no mesmo dia (segundo grilling): a
  cadeia de `gestor_id` com a marca "aprova SC" na ficha foi trocada por
  departamentos com aprovador e responsáveis.
- Ponto em aberto conhecido: uma SC cujo aprovador fica indisponível
  depois de gravado (férias, desligamento) não tem como ser destravada,
  porque o admin só decide quando não há aprovador. Se isso virar dor,
  liberar o "admin decide no lugar" também para SC com aprovador.
