# Cotações: fluxo de aprovação do gestor, deep-link, digest diário e reset de dados

Status: ready-for-agent

## Problem Statement

Hoje, quando uma cotação de compras entra em "aguardando aprovação", o gestor
responsável não tem um caminho direto até ela: o card de aprovações da Home
aponta para uma tela genérica de solicitações (`requests`), sem nenhuma
relação com cotações, e o próprio e-mail de notificação de submissão leva só
para a lista inteira de cotações — nunca para o item específico. Para
aprovar, o gestor precisa entrar no módulo de Cotações, localizar a cotação
certa na lista, abrir o painel lateral de detalhes e navegar até a aba de
aprovação, sem uma visão única que já mostre o essencial (valores, todas as
propostas recebidas e qual delas venceu) para decidir. Além disso, a tela de
"Solicitação de Compras" mostra datas sem nenhuma formatação, cotações
antigas de teste continuam acumuladas na base de produção, e não existe
nenhum lembrete diário para os gestores sobre o que ainda está pendente com
eles — cada aprovação depende de alguém lembrar de checar manualmente.

## Solution

Um card dedicado na Home mostra quantas cotações estão aguardando aprovação
e leva direto para a lista de cotações já filtrada nesse status. Dentro da
lista, cada cotação pendente ganha um botão "Aprovar" que abre, sem passar
pelo painel de detalhes genérico, um modal-resumo com as informações da
cotação e todas as propostas recebidas, destacando visualmente a vencedora
atual — o gestor pode trocar a vencedora ali mesmo e aprovar ou rejeitar no
mesmo fluxo. A tela de Solicitação de Compras passa a exibir as datas em
formato brasileiro (dd/mm/aaaa). Todo dia às 17h, cada gestor com alçada de
aprovação recebe um e-mail individual listando só as cotações que ainda
estão pendentes com ele, reaproveitando a mesma lógica de elegibilidade que
já dispara o e-mail de submissão hoje. Por fim, como último passo — depois de
tudo implementado e testado — a base de produção de cotações é zerada,
removendo os dados acumulados de teste/uso anterior.

## User Stories

1. Como gestor aprovador, quero ver na Home quantas cotações estão aguardando
   minha aprovação, para saber rapidamente se há pendências sem precisar
   entrar no módulo de Cotações.
2. Como gestor aprovador, quero que o card de aprovações da Home seja
   específico de cotações (separado do card genérico de solicitações), para
   não confundir os dois fluxos.
3. Como gestor aprovador, ao clicar no card de aprovações da Home, quero cair
   direto na lista de cotações já filtrada para "aguardando aprovação", sem
   precisar aplicar o filtro manualmente.
4. Como gestor aprovador, quero um botão "Aprovar" visível diretamente em
   cada cotação da lista que esteja aguardando minha aprovação, para não
   precisar abrir o painel de detalhes genérico e navegar até a aba de
   aprovação.
5. Como gestor aprovador, ao clicar em "Aprovar", quero que abra um modal
   dedicado com o resumo da cotação (código, título, solicitante, valor,
   itens), para decidir sem precisar navegar por várias telas.
6. Como gestor aprovador, quero ver todas as propostas recebidas para aquela
   cotação dentro do modal-resumo, para comparar as opções antes de decidir.
7. Como gestor aprovador, quero que a proposta vencedora atual seja destacada
   visualmente entre as demais, para identificar rapidamente qual foi a
   escolha até então.
8. Como gestor aprovador, quero poder trocar qual proposta é a vencedora
   diretamente no modal de aprovação, para corrigir a escolha sem precisar
   sair do fluxo de aprovação.
9. Como gestor aprovador, quero aprovar ou rejeitar a cotação no mesmo modal,
   imediatamente depois de revisar/ajustar a vencedora, para ter um fluxo
   único e coeso.
10. Como gestor aprovador, quero que a troca de vencedora dentro do modal
    respeite as mesmas verificações de valor/alçada que já existem hoje na
    decisão de aprovação, para não abrir uma brecha de segurança.
11. Como gestor aprovador, quero que cada troca de proposta vencedora feita
    durante a aprovação fique registrada no histórico de auditoria da
    cotação, para manter rastreabilidade.
12. Como comprador/solicitante, quero ver as datas na tela de Solicitação de
    Compras em formato brasileiro (dd/mm/aaaa), para não precisar interpretar
    strings cruas.
13. Como gestor aprovador, quero receber todo dia às 17h um e-mail com a
    lista de cotações que ainda estão pendentes comigo, para não depender de
    lembrar de checar o sistema manualmente.
14. Como gestor aprovador, quero que o e-mail diário só liste o que ainda
    está pendente comigo especificamente (respeitando minha alçada), e não
    todas as cotações pendentes do sistema, para o e-mail ser relevante.
15. Como gestor aprovador, quero que os links do e-mail diário (e do e-mail
    de submissão já existente) levem para a lista de cotações filtrada por
    "aguardando aprovação", da mesma forma que o card da Home, para ter
    consistência entre os pontos de entrada.
16. Como administrador do sistema, quero que a tabela de cotações de produção
    seja zerada (junto com itens, propostas, aprovações e logs relacionados)
    como último passo desta entrega, para remover dados acumulados de
    teste/uso anterior antes de liberar o novo fluxo.
17. Como administrador do sistema, entendo que essa exclusão é irreversível e
    feita sem backup prévio, e quero que ela só seja executada depois que
    todas as demais mudanças estiverem implementadas e validadas.
18. Como desenvolvedor mantendo o sistema, quero que a lógica de "quem
    recebe o quê" no e-mail diário reaproveite a mesma função/lógica de
    elegibilidade já usada na notificação de submissão, para não duplicar a
    regra de negócio em dois lugares.
19. Como desenvolvedor mantendo o sistema, quero que o agendamento do e-mail
    diário siga o mesmo mecanismo de cron já validado no projeto (script +
    cron do SO), para não introduzir uma nova forma de agendar tarefas sem
    necessidade.
20. Como gestor aprovador, quero que o botão "Aprovar" e a contagem no card
    da Home só apareçam para cotações onde eu de fato tenho alçada de
    aprovação (mesmo critério de valor já usado hoje), para não ver
    pendências que não são minhas.

## Implementation Decisions

- Home: o widget genérico de aprovações (hoje conta/linka `requests`
  genéricas) permanece como está. Um novo widget/card separado, específico de
  cotações, é adicionado à Home, contando cotações com status "aguardando
  aprovação" (respeitando a alçada do usuário logado) e linkando para a lista
  de cotações já filtrada por esse status via parâmetro de rota/query — sem
  deep-link por id individual.
- Lista de cotações: cada item em status "aguardando aprovação" (visível para
  quem tem alçada) ganha uma ação/botão "Aprovar" que abre o modal-resumo
  diretamente — sem passar pelo painel de detalhes lateral existente.
- Modal-resumo de aprovação: novo componente, separado do painel de detalhes
  lateral e do modal de assinatura existente. Recebe a cotação e a lista
  completa de propostas; reaproveita a lógica de anotação já existente
  (menor preço, proposta vencedora) usada hoje na comparação de propostas, em
  vez de duplicá-la. Sempre renderiza todas as propostas, com destaque visual
  para a vencedora atual.
- Troca de vencedora dentro do modal: reaproveita a operação de seleção de
  vencedora já existente no domínio de cotações; a chamada de
  aprovação/rejeição reaproveita a decisão atômica já existente (que já
  verifica autorização e valor no servidor). Se a vencedora for trocada, o
  valor usado na verificação de alçada/decisão deve refletir a proposta
  recém-selecionada antes de confirmar a aprovação. A troca gera uma entrada
  própria no histórico de auditoria da cotação, distinta da entrada de
  aprovação/rejeição.
- Solicitação de Compras: a data da solicitação passa a ser formatada em
  pt-BR (dd/mm/aaaa) usando a função de formatação de data já existente no
  domínio de cotações, sem alterar as demais formatações duplicadas em
  outros pontos do sistema (fora de escopo).
- E-mail diário: novo script que roda uma vez por dia (17h), reaproveitando a
  mesma consulta de elegibilidade (gestor × alçada × valor) já usada hoje
  para montar a notificação de submissão, agrupando por gestor as cotações
  ainda em "aguardando aprovação". Reaproveita a função de construção de
  notificação já existente no domínio (mesmo padrão de variáveis/template),
  gerando uma notificação por gestor elegível com a lista consolidada de
  pendências, e envia através do endpoint de notificação por e-mail já
  existente no projeto.
- Link usado no corpo do e-mail (tanto o diário novo quanto o de submissão já
  existente, cujo link hoje é fixo na lista geral) passa a apontar para a
  lista de cotações filtrada por "aguardando aprovação" — mesmo destino
  usado pelo card da Home, para manter consistência.
- Agendamento do e-mail diário: script standalone, com execução disparada por
  cron do sistema operacional — mesmo mecanismo de agendamento já usado para
  o alerta de hardware existente no projeto (script + cron do SO), mas
  implementado na mesma linguagem/runtime do domínio de cotações (não
  reescreve a lógica de elegibilidade em outra linguagem).
- Zerar dados: script SQL avulso, de execução manual e única, na mesma área
  do repositório onde já existem scripts equivalentes de manutenção de
  banco. Remove a tabela principal de cotações; os relacionamentos existentes
  (itens, propostas, itens de proposta, fornecedores convidados, aprovações,
  logs de auditoria) já são removidos em cascata por constraint de banco
  existente — não é necessário tratamento adicional para eles. Executado em
  produção, sem backup/export prévio, como etapa final e isolada, após todo o
  restante desta entrega estar implementado e validado.

## Testing Decisions

- Testes devem cobrir comportamento externo (entrada → saída), não detalhes
  de implementação — seguindo o padrão já usado no projeto (ex.: teste da
  função de montagem de notificação de aprovação, hoje em
  `notifications.test.ts`), sem depender de mocks profundos de Supabase nem
  de testes de renderização de componente (o projeto não usa
  `@testing-library/react`; os testes existentes são de funções puras via
  vitest).
- Formatação de data: teste unitário da função de formatação usada na tela de
  Solicitação de Compras, cobrindo formatos de entrada esperados (string
  ISO, valores vazios/nulos) e o formato de saída esperado (dd/mm/aaaa).
- Montagem do resumo de propostas do modal de aprovação: teste unitário da
  função pura que anota a lista de propostas (menor preço, vencedora atual),
  verificando que todas as propostas são retornadas e que a vencedora correta
  é marcada, incluindo o caso de troca de vencedora.
- Elegibilidade e conteúdo do e-mail diário: teste unitário da função que
  agrupa cotações pendentes por gestor elegível e monta as notificações, no
  mesmo estilo do teste já existente para a notificação de submissão —
  cobrindo múltiplos gestores, gestor sem pendências (não deve gerar e-mail)
  e mais de uma cotação pendente para o mesmo gestor.
- Fora do escopo de testes automatizados: contagem/link do card da Home
  (depende de query ao Supabase, sem padrão de mock no projeto — validar
  manualmente), o script SQL de reset de dados (execução manual única) e o
  agendamento via cron do SO (validar manualmente, como já é feito para o
  alerta de hardware existente).

## Out of Scope

- Criação de um util central de formatação de datas reaproveitado em todo o
  sistema (fica restrito à tela de Solicitação de Compras).
- Qualquer alteração na notificação de submissão já existente além de
  corrigir o link para a lista filtrada.
- Deep-link por id de cotação individual (ex.: `/quotations/:id`) — a
  navegação via card/e-mail leva à lista filtrada, não a um item específico.
- Nova entrada de menu/rota dedicada de "Aprovações" fora do módulo de
  Cotações.
- Backup/export dos dados antes de zerar a tabela de cotações.
- Qualquer mudança na regra de quem tem alçada para aprovar (tabela/lógica de
  limites de aprovação permanece como está).

## Further Notes

- A exclusão dos dados de cotações em produção (última etapa) é irreversível
  e deve ser tratada como uma ação isolada, com confirmação explícita no
  momento da execução, separada do restante da implementação.
- A troca de vencedora dentro do modal de aprovação reaproveita operações que
  já existem no domínio (seleção de proposta vencedora e decisão de
  aprovação/rejeição) — a novidade é só oferecer as duas ações em um único
  modal, sem duplicar a lógica de negócio já implementada.
- O e-mail diário depende da mesma variável de URL base já usada pela
  notificação de submissão para montar o link de destino.
- Existe um esforço anterior no mesmo módulo em `.scratch/cotacoes/`
  (status: implementado) — este spec é um novo ciclo de melhorias sobre o
  que já está em produção, sem sobreposição direta com aquelas issues.
