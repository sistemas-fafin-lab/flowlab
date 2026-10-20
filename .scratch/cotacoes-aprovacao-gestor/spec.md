# Cotações: aprovação do gestor do pedido antes da alçada, com todas as propostas nos e-mails

Status: ready-for-agent

## Problem Statement

Hoje, quando o comprador envia uma cotação para aprovação, ela vai direto
para quem tem alçada de valor (na prática, a Louise): todo gestor com
alçada suficiente recebe o e-mail e o primeiro que aprovar encerra a
aprovação. O gestor que abriu a Solicitação de Compras (ou a solicitação de
manutenção, no caso de Contratação) nunca é consultado — ele não confirma se
a cotação montada pelo comprador atende ao que pediu, nem se a proposta
escolhida faz sentido para o setor dele. A Louise acaba aprovando sem saber
se o pedido ainda é válido para quem pediu.

Além disso, o sistema nem sabe quem é esse gestor: a SC guarda só o nome do
solicitante em texto livre, e a cotação guarda apenas quem a montou (o
comprador). Gestores de setor, em geral, também não têm acesso ao módulo de
Cotações, então mesmo que fossem avisados não teriam onde aprovar.

Por fim, os e-mails de aprovação não são uniformes: o e-mail de submissão já
lista todas as propostas recebidas, mas o resumo diário das 17h mostra só
código, título e valor de cada cotação — quem aprova pelo resumo não vê os
orçamentos.

## Solution

A aprovação de cotações passa a ter duas etapas:

1. **Aprovação do gestor do pedido** — ao enviar para aprovação, a cotação
   entra no novo status "Aprovação do gestor". O gestor do pedido vem
   pré-preenchido a partir de quem criou a SC (Compras) ou a solicitação de
   manutenção (Contratação), e o comprador pode trocá-lo. O gestor recebe um
   e-mail com todas as propostas e aprova (com assinatura eletrônica) ou
   rejeita numa tela própria e enxuta, "Minhas aprovações de cotação",
   acessível a qualquer usuário logado e que mostra só as cotações pendentes
   com ele. Nessa etapa não há checagem de valor — é o "de acordo" de quem
   pediu.
2. **Aprovação por alçada** — se o gestor aprovar e a alçada dele não cobrir
   o valor, a cotação segue para "Aguardando aprovação" exatamente como hoje,
   e só então os gestores com alçada (a Louise) recebem o e-mail. Se a
   alçada do próprio gestor cobrir o valor, a aprovação dele já vale pelas
   duas etapas e a cotação fica aprovada direto.

Se o gestor rejeitar, a cotação volta para "Em análise" com o comprador, que
recebe um e-mail com o comentário. Todo e-mail de aprovação — o da etapa 1,
o da etapa 2 e o resumo diário das 17h — mostra todas as propostas da
cotação, com a vencedora destacada.

## User Stories

1. Como gestor que abriu uma Solicitação de Compras, quero ser consultado
   antes de a cotação gerada a partir dela ir para a aprovação por alçada,
   para confirmar que a compra ainda atende ao que pedi.
2. Como gestor que abriu uma solicitação de manutenção, quero ser consultado
   da mesma forma na cotação de Contratação gerada a partir dela, para que o
   fluxo seja igual nos dois tipos de cotação.
3. Como gestor do pedido, quero receber um e-mail assim que uma cotação
   entrar na minha etapa de aprovação, para não depender de entrar no
   sistema para descobrir.
4. Como gestor do pedido, quero que esse e-mail traga o código, título,
   tipo, comprador, valor, itens e todas as propostas recebidas com a
   vencedora destacada, para entender a cotação antes de abrir o sistema.
5. Como gestor do pedido, quero que o link do e-mail me leve direto para a
   tela onde aprovo, sem precisar procurar a cotação.
6. Como gestor do pedido sem acesso ao módulo de Cotações, quero uma tela
   própria com só as cotações pendentes comigo, para aprovar sem ganhar
   acesso às demais cotações do laboratório.
7. Como gestor do pedido, quero ver na Home um card com quantas cotações
   estão aguardando minha aprovação, que só aparece quando há alguma, para
   lembrar das pendências sem receber resumo diário.
8. Como gestor do pedido, quero aprovar a cotação no mesmo modal-resumo já
   usado na aprovação por alçada, vendo todas as propostas, para decidir com
   a mesma informação que a aprovação final tem.
9. Como gestor do pedido, quero poder trocar a proposta vencedora dentro do
   modal de aprovação, para corrigir a escolha do comprador sem devolver a
   cotação.
10. Como gestor do pedido, quero que minha aprovação exija a mesma
    assinatura eletrônica da aprovação por alçada, para que ela tenha o
    mesmo peso quando for a aprovação final.
11. Como gestor do pedido, quero rejeitar a cotação com um comentário
    obrigatório, para o comprador saber o que precisa mudar.
12. Como gestor do pedido, não quero que minha aprovação dependa de alçada
    de valor, porque nessa etapa estou dando o "de acordo" do pedido, não
    autorizando o gasto.
13. Como gestor do pedido que também tem alçada suficiente para o valor,
    quero que minha aprovação já conclua a cotação, para não aprovar a mesma
    coisa duas vezes.
14. Como gestor do pedido com alçada, quero que, se eu trocar a vencedora
    para uma proposta mais cara que minha alçada, a cotação siga para a
    aprovação por alçada em vez de ser aprovada por mim, para não furar o
    limite de valor.
15. Como comprador, quero que o campo "Gestor do pedido" venha
    pré-preenchido com quem abriu a SC ou a solicitação de manutenção, para
    não precisar descobrir quem é.
16. Como comprador, quero poder trocar o gestor do pedido ao enviar para
    aprovação, para cobrir SCs antigas (que só têm o nome do solicitante) e
    cotações criadas sem SC vinculada.
17. Como comprador, quero que o envio para aprovação exija um gestor do
    pedido preenchido, para nenhuma cotação ficar sem responsável na etapa 1.
18. Como comprador, quero poder trocar o gestor de uma cotação já parada na
    etapa 1, e que o novo gestor receba o e-mail, para destravar cotações de
    gestor de férias ou desligado.
19. Como comprador, quero receber um e-mail quando o gestor rejeitar a
    cotação, com o comentário dele, para saber que ela voltou para mim.
20. Como comprador, quero que a cotação rejeitada pelo gestor volte para
    "Em análise", para eu poder trocar a proposta ou cotar de novo sem
    recriar a cotação.
21. Como comprador ou administrador, quero ver o novo status "Aprovação do
    gestor" no stepper, nos cards de status e no filtro da lista de
    cotações, para acompanhar onde cada cotação está parada.
22. Como administrador, quero poder aprovar ou rejeitar a etapa 1 no lugar
    do gestor, para destravar uma cotação quando o gestor não está
    disponível.
23. Como auditor, quero que a aprovação feita por um administrador no lugar
    do gestor fique registrada como tal no histórico, para distinguir de uma
    aprovação do próprio gestor.
24. Como auditor, quero que a troca de gestor do pedido, a troca de
    vencedora na etapa 1 e a dispensa da etapa 2 por alçada do gestor fiquem
    registradas no histórico de auditoria da cotação.
25. Como gestor com alçada (Louise), quero só receber o e-mail de aprovação
    depois que o gestor do pedido aprovou, para não analisar cotações que
    ainda podem ser devolvidas.
26. Como gestor com alçada, quero continuar aprovando pela mesma tela,
    modal e card da Home de hoje, sem mudança no meu fluxo.
27. Como gestor com alçada, quero que o resumo diário das 17h liste, para
    cada cotação pendente comigo, todas as propostas recebidas com a
    vencedora destacada, para decidir pelo e-mail com a mesma informação do
    sistema.
28. Como gestor com alçada, quero que o resumo diário continue listando só
    as cotações da etapa 2 (aguardando alçada), para não receber o que ainda
    está com o gestor do pedido.
29. Como gestor com alçada, quero que desfazer uma aprovação volte a
    cotação só para a etapa 2, mantendo a aprovação do gestor do pedido,
    para não refazer a etapa 1 sem necessidade.
30. Como gestor com alçada, quero que desfazer uma aprovação em que a etapa
    2 foi dispensada volte a cotação para a etapa 1, já que ninguém aprovou
    a etapa 2 de fato.
31. Como gestor com alçada, quero que as cotações que já estavam
    "Aguardando aprovação" no dia do deploy continuem comigo, sem voltar
    para a etapa 1.
32. Como desenvolvedor, quero que a regra de "quem pode aprovar a etapa 1"
    e "quando a etapa 2 é dispensada" fique só no servidor, para o client
    não poder burlá-la nem divergir dela.

## Implementation Decisions

- **Status novo `awaiting_manager_approval`** ("Aprovação do gestor"),
  entre `under_review` e `awaiting_approval`. `awaiting_approval` passa a
  significar exclusivamente a etapa 2 (alçada), de modo que o card de
  aprovações da Home, o contador por alçada, o resumo das 17h e a RPC de
  decisão por alçada continuam funcionando sem mudança de filtro.
  Máquina de estados:
  - `under_review → awaiting_manager_approval` (envio para aprovação, que
    deixa de ir direto para `awaiting_approval`);
  - `awaiting_manager_approval → awaiting_approval` (gestor aprova, alçada
    dele não cobre o valor);
  - `awaiting_manager_approval → approved` (gestor aprova, alçada dele
    cobre o valor — etapa 2 dispensada);
  - `awaiting_manager_approval → under_review` (gestor rejeita);
  - `awaiting_manager_approval → cancelled`;
  - reversão de `approved`: volta para `awaiting_approval` quando houve
    aprovação real na etapa 2, e para `awaiting_manager_approval` quando a
    etapa 2 foi dispensada.
  `canSubmitForApproval` continua aceitando `under_review`; a aprovação e a
  troca de vencedora passam a ser permitidas também em
  `awaiting_manager_approval`. O stepper, os cards de status e o filtro da
  lista ganham o novo status.
- **Schema:**
  - `requests` ganha a coluna `requested_by_user_id` (uuid, FK
    `user_profiles`, nullable), gravada na criação da SC com o usuário
    logado. Sem backfill: SCs antigas ficam com o campo vazio e o comprador
    escolhe o gestor manualmente.
  - `quotations` ganha `requester_manager_id` (uuid, FK `user_profiles`,
    nullable no banco, obrigatório para enviar para aprovação a partir do
    deploy).
  - Os níveis de `quotation_approvals` passam a distinguir a etapa do gestor
    (um nível próprio, por exemplo `manager`) da etapa de alçada (o nível
    que já é usado hoje), mantendo a unicidade `(quotation_id, level)` — uma
    linha por etapa.
  - O status novo entra em todos os pontos do banco que listam ou rotulam
    status de cotação (constraints/rótulos, se houver).
- **Pré-preenchimento do gestor do pedido:** ao enviar para aprovação, o
  campo "Gestor do pedido" vem com `requests.requested_by_user_id`
  (Compras) ou `maintenance_requests.requester_id` (Contratação), quando
  existirem. O envio é bloqueado sem gestor preenchido. A troca de gestor
  com a cotação em `awaiting_manager_approval` é permitida ao comprador
  (quem tem acesso ao módulo de Cotações), gera registro de auditoria e
  dispara o e-mail da etapa 1 para o novo gestor.
  - **Revisado em 07/10 (issue 09):** quem abriu a origem, se ativo e
    diferente do comprador e de quem está enviando, é o gestor **travado**:
    não pode ser trocado no envio nem depois (indisponível → admin decide no
    lugar). Sem origem válida, o comprador escolhe entre os ativos, **nunca
    a si mesmo nem quem criou a cotação**. A regra vale no banco (trigger
    `quotation_enforce_requester_manager`) e na tela
    (`resolveRequesterManagerChoice`). Substitui o "pode trocar para
    qualquer usuário ativo" da história 16.
  - **Revisado em 20/10:** em Compras, a origem travada passa a ser
    **quem aprovou a SC** (`requests.approved_by_user_id`), não quem a
    abriu. SC aprovada por admin no lugar (sem gestor aprovador no RH) não
    trava. Ver `.scratch/solicitacoes-aprovacao-gestor/` (issue 05).
- **RPC nova de decisão da etapa 1** (no padrão da decisão por alçada
  existente: `SECURITY DEFINER`, atômica, com `FOR UPDATE` na cotação):
  - autoriza antes de ler a cotação: o usuário autenticado tem de ser o
    `requester_manager_id` da cotação ou admin;
  - exige status `awaiting_manager_approval`;
  - valida que o valor informado pelo client é o valor real atual da
    cotação (mesmo `COALESCE(final_total_amount, estimated_total, 0)` da
    decisão por alçada), para a decisão nunca ser tomada sobre um valor
    defasado depois de uma troca de vencedora;
  - rejeição: grava a linha da etapa do gestor como rejeitada (comentário
    obrigatório) e volta a cotação para `under_review`;
  - aprovação: grava a linha da etapa do gestor; em seguida consulta a
    alçada do aprovador (`get_user_approval_limit`) — se ele pode aprovar e
    o valor real cabe na alçada, grava também a linha da etapa de alçada em
    nome dele (mesma assinatura e mesmo instante) e muda o status para
    `approved`; senão muda para `awaiting_approval`;
  - devolve qual foi o desfecho (aprovada direto, seguiu para alçada,
    rejeitada) e se foi decidida por admin no lugar do gestor. O client só
    reflete esse desfecho; não recalcula a regra de dispensa.
  - A decisão por alçada existente não muda.
- **Reversão de aprovação:** a RPC atômica de reversão passa a distinguir
  os casos — se a aprovação de alçada foi gerada pela dispensa da etapa 2
  (mesmo aprovador e mesmo instante da linha do gestor, ou marcação
  equivalente gravada pela RPC da etapa 1), apaga as duas linhas e volta
  para `awaiting_manager_approval`; caso contrário apaga só a linha de
  alçada e volta para `awaiting_approval`, como hoje.
- **Auditoria:** entradas próprias para envio à etapa do gestor, troca de
  gestor do pedido, aprovação/rejeição do gestor (com indicação quando foi
  admin no lugar do gestor), dispensa da etapa 2 e troca de vencedora
  durante a etapa 1 (reaproveitando a entrada de troca de vencedora já
  usada na etapa 2).
- **Tela "Minhas aprovações de cotação"** (rota nova dentro do módulo de
  Cotações, por exemplo `/quotations/aprovacoes`), protegida só por login,
  sem `canManageQuotations`. Lista as cotações em
  `awaiting_manager_approval` cujo `requester_manager_id` é o usuário
  logado e abre o mesmo modal-resumo de aprovação já usado na etapa 2 (com
  troca de vencedora e assinatura eletrônica). Admins também a acessam, mas
  aprovam no lugar do gestor pela lista completa de cotações (filtro
  "Aprovação do gestor").
- **Modal-resumo de aprovação:** reaproveitado nas duas etapas; a etapa é
  determinada pelo status da cotação. Na etapa 1 não mostra aviso de
  "fora da alçada" (não há checagem de valor), exige comentário na
  rejeição, e chama a RPC nova em vez da decisão por alçada. A troca de
  vencedora reaproveita a operação de seleção de vencedora existente.
- **Card na Home** "Cotações aguardando sua aprovação (gestor)", separado
  do card de aprovações por alçada, visível só quando o usuário tem pelo
  menos uma cotação em `awaiting_manager_approval` como gestor, com link
  para a tela "Minhas aprovações de cotação".
- **Contrato de URL:** o módulo de rotas de cotações ganha o caminho da
  tela de aprovações do gestor, usado pelo card da Home e pelo e-mail da
  etapa 1, no mesmo padrão do link filtrado por status já usado hoje.
- **E-mails** (todos via o endpoint genérico de e-mail e templates em
  `email_notification_templates`, envio em melhor esforço — falha nunca
  bloqueia a mudança de status):
  - **Novo `quotation_awaiting_manager_approval`** — para o gestor do
    pedido, ao entrar na etapa 1 e ao trocar o gestor. Mesmo conteúdo do
    e-mail de alçada (código, título, tipo, comprador, valor, itens, todas
    as propostas com a vencedora destacada) e link para a tela de
    aprovações do gestor.
  - **Novo `quotation_manager_rejected`** — para o comprador (quem criou a
    cotação) quando o gestor rejeita, com o comentário e link para a
    cotação na lista.
  - **`quotation_awaiting_approval` (existente)** — conteúdo inalterado
    (já lista todas as propostas); passa a ser disparado quando a cotação
    entra em `awaiting_approval` pela aprovação do gestor, e não mais no
    envio para aprovação. Não é disparado quando a etapa 2 é dispensada.
  - **`quotation_pending_approval_digest` (existente, 17h)** — continua só
    com a etapa 2 e com a mesma regra de destinatário por alçada; cada
    cotação da lista passa a trazer todas as suas propostas com a vencedora
    destacada, reaproveitando a mesma anotação de propostas
    (`annotateProposals`) usada no e-mail de submissão e no modal. A
    consulta do script do resumo passa a carregar as propostas das
    cotações pendentes.
  - A montagem das listas de propostas e itens é compartilhada entre os
    builders de e-mail, sem duplicar a regra de "quem é a vencedora".
- **Transição no deploy:** cotações já em `awaiting_approval` continuam na
  etapa 2, sem gestor do pedido e sem linha da etapa do gestor. A regra
  nova só vale para envios feitos após o deploy.

## Testing Decisions

- Bons testes cobrem comportamento externo (entrada → saída) de funções
  puras via vitest, sem mock profundo de Supabase e sem teste de
  renderização de componente — mesmo padrão do projeto.
- **Seam 1 — montagem de e-mails** (módulos de notificação e de resumo
  diário de cotações; prior art: os testes já existentes da notificação de
  submissão e do resumo de pendentes):
  - e-mail da etapa 1: destinatário é o gestor do pedido, todas as
    propostas presentes, vencedora destacada, link para a tela de
    aprovações do gestor, gestor sem e-mail não gera notificação;
  - e-mail de rejeição: destinatário é o comprador, comentário presente e
    escapado;
  - resumo diário: cada cotação traz suas propostas com a vencedora
    destacada; demais regras existentes (alçada × valor, gestor sem
    pendência não recebe) continuam passando;
  - escape de HTML em campos livres (título, nome de fornecedor,
    comentário).
- **Seam 2 — máquina de estados de cotações** (ainda sem testes; prior
  art de estilo: os testes de utilitários do módulo de cotações):
  transições válidas e inválidas a partir e para
  `awaiting_manager_approval`, destino da reversão nos dois casos, e
  `canSubmitForApproval` / aprovação / troca de vencedora por status.
- **Seam 3 — RPC da etapa 1 e reversão: validação manual** no projeto
  Supabase de teste, como foi feito com a decisão por alçada: gestor
  aprova sem alçada (vai para `awaiting_approval`), gestor aprova com
  alçada (vai para `approved`, duas linhas), troca de vencedora para valor
  acima da alçada do gestor, admin aprova no lugar do gestor, outro
  usuário tenta aprovar (erro de autorização), valor defasado (erro),
  rejeição sem comentário (erro), reversão nos dois casos. Sem pgTAP.
- Fora dos testes automatizados: card da Home, tela de aprovações do
  gestor, pré-preenchimento do gestor na submissão e recebimento real dos
  e-mails — validação manual.

## Out of Scope

- Resumo diário das 17h para a etapa do gestor (o gestor é lembrado pelo
  e-mail na entrada da etapa e pelo card da Home).
- Avisar o comprador quando o gestor aprova.
- Backfill de `requested_by_user_id` nas SCs antigas (o comprador escolhe o
  gestor manualmente).
- Usar a hierarquia de colaboradores do RH ou um responsável por
  departamento para descobrir o gestor.
- Mudar a regra de alçada, a decisão por alçada ou o e-mail de alçada além
  do momento em que ele é disparado.
- Mover cotações que já estão em `awaiting_approval` para a etapa 1.
- Endurecer o RLS genérico da tabela `quotations` (a decisão da etapa 1 é
  protegida pela RPC; o resto do módulo continua como está).
- Solicitações de Material (SM), que não geram cotação.

## Further Notes

- "Louise" neste contexto é quem tem alçada de aprovação hoje; a etapa 2
  não é amarrada a ela por nome — continua sendo "quem tem alçada ≥ valor".
- A regra de dispensa da etapa 2 usa o valor real da cotação no momento da
  aprovação do gestor, já considerando uma eventual troca de vencedora
  feita no próprio modal.
- Relacionado: `.scratch/cotacoes-aprovacao/` (modal-resumo, card da Home,
  resumo diário e RPC de decisão por alçada que esta entrega reaproveita).
