# Solicitações de Compra: aprovação pelo gestor de quem pediu (hierarquia do RH)

Status: ready-for-agent

## Problem Statement

Hoje o "Aprovar" de uma Solicitação de Compra (SC) aparece para qualquer
pessoa cujo cargo tenha `canApproveRequests`, e essa pessoa vê as SCs de
todos os setores. O sistema nunca consulta quem é o gestor de quem pediu.
Na prática, a Louise (Administrador) recebe para aprovar SCs que não são
dela — por exemplo a REQ868 (Qualidade, Ana Claudia) — e ela só aprova a
compra dos orçamentos (etapa de alçada da cotação), não o pedido.

A regra do laboratório é: quem tem gestor, o pedido vai para o gestor
aprovar; tudo da área técnica vai para o Paulo, mesmo que venha do time da
Eduarda Fabri.

Além disso, `canApproveRequests` mistura duas coisas: aprovar o pedido e o
operacional de Compras (iniciar cotação, finalizar, ver todos os setores),
que o comprador (Mateus) precisa. O Paulo, a Eduarda, a Suane e a Raquel
nem têm essa permissão.

Levantamento de produção (20/10/2026): 27 de 58 colaboradores estão sem
gestor no RH, entre eles Ana Claudia, Eduarda Fabri e Paulo; Marina e
Luanna (Área técnica) têm a Eduarda como gestora.

## Solution

A aprovação da SC passa a ser do **gestor aprovador** de quem pediu,
descoberto pela hierarquia de colaboradores do RH (`colaboradores.gestor_id`):

- A ficha do colaborador ganha a marca **"Aprova solicitações de compra"**.
- Ao criar uma SC, o sistema sobe a cadeia de gestores a partir de quem
  pediu até o primeiro gestor marcado como aprovador e utilizável (ativo,
  com login vinculado e usuário ativo), e grava esse aprovador na SC.
- Marina → Eduarda (não aprova) → Paulo (aprova): a SC vai para o Paulo.
- Sem aprovador na cadeia, a SC fica com o aviso "sem gestor aprovador no
  RH" e quem tem `canApproveRequests` aprova no lugar, registrado no
  histórico.
- O gestor aprovador aprova/rejeita na mesma lista de Solicitações, não
  precisa de `canApproveRequests`, e é avisado por e-mail e por um card na
  Home.
- Compras só inicia cotação/finaliza depois da aprovação.
- Quem aprovou a SC vira o **gestor do pedido travado** na cotação gerada
  a partir dela (etapa 1 de `.scratch/cotacoes-aprovacao-gestor/`).

A Solicitação de Material (SM) não muda.

## User Stories

1. Como gestor aprovador, quero que as SCs do meu time (inclusive de quem
   está abaixo de um gestor não aprovador) cheguem para mim, para dar o
   "de acordo" no pedido.
2. Como Louise, não quero ver Aprovar/Rejeitar nas SCs de setores que têm
   gestor aprovador, porque eu só aprovo os orçamentos.
3. Como gestor aprovador sem `canApproveRequests`, quero aprovar sem ganhar
   acesso ao operacional de Compras (finalizar, iniciar cotação, ver todos
   os setores).
4. Como gestor aprovador, quero ver na lista de Solicitações, além do meu
   setor, as SCs em que sou o aprovador, com o filtro "Aguardando minha
   aprovação".
5. Como gestor aprovador, quero um e-mail quando uma SC entrar para mim e
   um card na Home ("SCs aguardando sua aprovação"), visível só quando há
   alguma.
6. Como gestor aprovador, quero rejeitar com comentário obrigatório, e
   quero que quem pediu receba um e-mail com o motivo.
7. Como RH, quero marcar na ficha do colaborador se ele aprova SCs.
8. Como RH, quero que, ao corrigir um gestor ou a marca de aprovador, as
   SCs pendentes que estavam sem aprovador sejam recalculadas e o novo
   aprovador avisado.
9. Como admin (`canApproveRequests`), quero aprovar/rejeitar no lugar do
   gestor apenas quando a SC não tem aprovador, com isso registrado.
10. Como comprador, quero que uma SC pendente fique bloqueada para iniciar
    cotação ou finalizar até ser aprovada.
11. Como comprador, quero que a cotação gerada da SC já venha com o gestor
    do pedido travado em quem aprovou a SC.

## Implementation Decisions

- **Escopo:** só `requests.type = 'SC'`. SM continua como hoje (aprovada
  por `canApproveRequests`).
- **Schema:**
  - `colaboradores.aprova_solicitacao_compra boolean not null default false`,
    editável pela tela de RH (mesma permissão de edição da ficha).
  - `requests.approver_id uuid` (FK `user_profiles`, nullable): gestor
    aprovador, **gravado na criação**. Nulo = sem aprovador (cai no admin).
  - `requests.approved_by_user_id uuid` (FK `user_profiles`, nullable):
    quem efetivamente aprovou (gestor ou admin no lugar). O texto
    `approved_by` existente continua sendo preenchido.
  - Registro de que a decisão foi do admin no lugar do gestor (coluna ou
    histórico de auditoria).
- **Resolução do aprovador** (função no banco, regra espelhada em função
  pura testável no client só para exibição):
  - parte do colaborador vinculado a `requested_by_user_id`;
  - sobe `gestor_id` (começa no gestor, nunca no próprio solicitante);
  - o primeiro com `aprova_solicitacao_compra = true`, `status = 'ativo'`,
    `user_profile_id` preenchido e usuário não removido/desativado é o
    aprovador; os que não servem são pulados e a busca continua;
  - sem colaborador, sem gestor ou cadeia sem aprovador → `approver_id`
    nulo. Quem está no topo (Paulo, Louise, Suane) abrindo a própria SC
    cai nesse caso.
- **Quando calcular:** trigger na criação da SC; uma vez no deploy para as
  SCs `pending` existentes (incluindo REQ868); e, quando o RH alterar
  `gestor_id` ou `aprova_solicitacao_compra`, recalcular **apenas** as SCs
  `pending` com `approver_id` nulo (disparando o e-mail para o novo
  aprovador). SCs que já têm aprovador não mudam.
- **Decisão (RPC `SECURITY DEFINER`, atômica, `FOR UPDATE`):**
  - autoriza: usuário é o `approver_id`, ou `approver_id` é nulo e o
    usuário tem `canApproveRequests`;
  - exige `type = 'SC'` e `status = 'pending'`;
  - aprovação → `approved`, grava `approved_by_user_id`;
  - rejeição → `rejected`, comentário obrigatório;
  - devolve se foi admin no lugar.
- **Permissões:** `canApproveRequests` deixa de significar "aprova SC" e
  fica para o operacional de Compras (iniciar cotação, finalizar, ver todos
  os setores), aprovar SM e aprovar no lugar quando não há aprovador. Ser
  aprovador não exige permissão nenhuma de cargo.
- **Tela de Solicitações:**
  - o gestor aprovador vê o próprio setor + as SCs em que é `approver_id`
    (RLS de `requests` precisa permitir esse SELECT);
  - filtro "Aguardando minha aprovação";
  - Aprovar/Rejeitar numa SC: só para o `approver_id`; para quem tem
    `canApproveRequests`, só quando `approver_id` é nulo (com aviso "sem
    gestor aprovador no RH");
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
- **Dados iniciais (migration):** marcar como aprovadores **Paulo Vítor**,
  **Louise Fontel** e **Suane Batista De Oliveira**. Eduarda Fabri e Raquel
  não são aprovadoras. Os gestores faltantes (Ana Claudia, Eduarda → Paulo
  etc.) são ajustados pelo RH na tela; o recálculo da história 8 leva as
  SCs pendentes até o aprovador.

## Testing Decisions

- Funções puras via vitest, mesmo padrão do projeto:
  - resolução do aprovador: cadeia simples, cadeia que pula não aprovador
    (Marina → Eduarda → Paulo), pula desligado/sem login/desativado, topo
    sem gestor, solicitante sem colaborador, ciclo impossível (já barrado
    no banco);
  - visibilidade dos botões por papel (aprovador, admin com e sem
    aprovador, comprador, SM);
  - builders de e-mail (aprovador, rejeição com comentário escapado).
- RPC, triggers de criação/recálculo e RLS: validação manual no projeto de
  teste com usuários reais de teste, como nas cotações.

## Out of Scope

- Mudar a etapa de alçada das cotações.
- Reatribuir o aprovador de uma SC que já tem aprovador (o recálculo só
  pega SCs sem aprovador).
- Preencher os gestores faltantes no RH (é tarefa do RH, não da migration).
- Resumo diário de SCs pendentes.
- SM.

## Further Notes

- Decidido com o usuário em 20/10/2026 (grilling) a partir da pergunta da
  Louise sobre a REQ868.
- Ponto em aberto conhecido: uma SC cujo aprovador fica indisponível
  depois de gravado (férias, desligamento) não tem como ser destravada,
  porque o admin só decide quando não há aprovador. Se isso virar dor,
  liberar o "admin decide no lugar" também para SC com aprovador.
