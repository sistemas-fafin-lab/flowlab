# Cotações: editar as informações da cotação a qualquer momento

Status: ready-for-agent

## Problem Statement

Depois de criada, uma cotação não pode mais ter suas informações corrigidas
pelo sistema. A regra atual só permite edição no status rascunho, e mesmo
nele não há tela que edite: a função de atualização existente só altera o
estado da tela, não grava no banco e não é chamada por nenhum componente.

Na prática, qualquer correção — acrescentar na justificativa a referência a
uma requisição (caso da COT-202610-5XKW, que recebeu "Requisição: REQ-866"),
ajustar o título, a prioridade, o centro de custo ou um prazo — exige que
alguém com acesso ao painel do Supabase rode SQL direto em produção. Essa
alteração não deixa rastro no histórico da cotação: ninguém sabe depois o que
mudou, quando, nem quem mudou.

Ao mesmo tempo, a política de UPDATE da tabela de cotações está aberta para
qualquer usuário autenticado; a única barreira hoje é o front-end.

Por fim, a gaveta da cotação mostra a justificativa e a descrição sem
respeitar quebras de linha, então um texto em parágrafos aparece tudo
emendado.

## Solution

As **informações da cotação** — título, descrição, justificativa,
prioridade, centro de custo, prazo de entrega e prazo de resposta — passam a
ser editáveis em qualquer status, exceto cancelada e rejeitada:

- Na gaveta da cotação, um botão **"Editar informações"** abre um modal com
  os sete campos preenchidos; o usuário altera o que quiser e salva tudo de
  uma vez.
- Só vê o botão (e só consegue gravar) quem tem a nova permissão **"Editar
  informações da cotação"** ou "Administrar Cotações". Quem já tem "Criar
  Cotações" recebe a nova permissão automaticamente.
- Editar não invalida aprovações, não pede reaprovação e não envia
  mensagens a ninguém.
- Toda edição gera uma entrada **"Informações editadas"** na linha do tempo
  da cotação, com cada campo alterado no formato "Campo: antes → depois",
  quem editou e quando.
- As regras (status, permissão, validação) e o registro no histórico ficam
  garantidos no banco, por trigger: valem também para chamadas diretas ao
  Supabase. Alterações feitas por SQL no painel (sem usuário logado) passam
  sem checagem, mas ficam registradas como "Sistema (SQL)".
- A gaveta passa a respeitar as quebras de linha da justificativa e da
  descrição.

Itens, fornecedores, propostas, valores, departamento e gestor do pedido
continuam presos ao fluxo atual — não fazem parte das informações editáveis.

## User Stories

1. Como comprador, quero editar a justificativa de uma cotação já enviada
   aos fornecedores, para registrar a requisição que originou a compra sem
   depender de alguém com acesso ao banco.
2. Como comprador, quero editar a justificativa de uma cotação já aprovada,
   para corrigir uma informação que só percebi depois da aprovação.
3. Como comprador, quero editar as informações de uma cotação já convertida
   em pedido, para que o PDF do pedido gerado depois saia com a informação
   correta.
4. Como comprador, quero corrigir o título de uma cotação em qualquer etapa,
   para que ela seja encontrada pelo nome certo na lista e na busca.
5. Como comprador, quero alterar a prioridade de uma cotação em andamento,
   para refletir uma urgência que mudou depois da criação.
6. Como comprador, quero corrigir o centro de custo de uma cotação, para que
   a compra seja apropriada no centro de custo correto.
7. Como comprador, quero ajustar o prazo de entrega de uma cotação, para
   registrar o prazo combinado depois da negociação com o fornecedor.
8. Como comprador, quero ajustar o prazo de resposta enquanto aguardo os
   fornecedores, para dar mais tempo quando um fornecedor pede extensão.
9. Como comprador, quero poder informar um prazo que já passou, para
   registrar a data real numa correção feita depois do fato.
10. Como comprador, quero editar a descrição de uma cotação, para detalhar
    melhor o que está sendo comprado.
11. Como comprador, quero ver todos os campos editáveis num único modal já
    preenchido com os valores atuais, para alterar só o que preciso sem
    redigitar o resto.
12. Como comprador, quero salvar todas as alterações de uma vez, para que a
    edição fique registrada como um único evento no histórico.
13. Como comprador, quero ser avisado no modal quando deixo o título vazio,
    para corrigir antes de salvar.
14. Como comprador, quero que salvar sem ter mudado nada não gere registro
    no histórico, para que a linha do tempo não fique poluída.
15. Como comprador, quero que a edição de uma cotação em rascunho use o mesmo
    modal, para ter um único jeito de editar essas informações.
16. Como comprador, quero ver na gaveta a justificativa e a descrição com as
    quebras de linha que digitei, para que textos em parágrafos fiquem
    legíveis.
17. Como comprador, quero que o botão de editar não apareça em cotações
    canceladas ou rejeitadas, para não tentar corrigir uma cotação
    encerrada.
18. Como usuário sem a permissão de edição, quero não ver o botão "Editar
    informações", para não esbarrar numa ação que não posso fazer.
19. Como usuário sem a permissão de edição, quero receber um erro claro se
    tentar gravar por outro caminho, para entender por que a alteração não
    passou.
20. Como administrador de cotações, quero poder editar as informações de
    qualquer cotação, para corrigir dados sem depender do comprador.
21. Como administrador de cargos, quero uma permissão própria "Editar
    informações da cotação", para decidir por cargo quem pode corrigir
    cotações já aprovadas, independentemente de quem pode criá-las.
22. Como administrador de cargos, quero que quem já cria cotações receba a
    nova permissão automaticamente, para que ninguém perca a capacidade de
    corrigir as próprias cotações no dia do deploy.
23. Como gestor do pedido, quero que minha aprovação continue valendo depois
    de uma edição de informações, para não ter que reaprovar por causa de
    uma correção de texto.
24. Como gestor do pedido, quero não receber mensagens quando alguém edita as
    informações, para não ser notificado de mudanças que não alteram o que
    aprovei.
25. Como aprovador por alçada, quero ver na linha do tempo o que foi editado
    depois da minha aprovação, para conferir se a correção é aceitável.
26. Como qualquer pessoa que acompanha a cotação, quero ver na linha do tempo
    uma entrada "Informações editadas" com cada campo alterado no formato
    "Campo: antes → depois", para saber exatamente o que mudou.
27. Como qualquer pessoa que acompanha a cotação, quero ver quem fez cada
    edição e quando, para saber a quem perguntar.
28. Como qualquer pessoa que acompanha a cotação, quero que justificativas e
    descrições longas apareçam cortadas na linha do tempo com um "ver mais",
    para que a linha do tempo continue legível.
29. Como administrador do sistema, quero que alterações feitas por SQL no
    painel do Supabase continuem funcionando, para ter uma saída de
    emergência.
30. Como administrador do sistema, quero que essas alterações por SQL fiquem
    registradas na linha do tempo como "Sistema (SQL)", para que nenhuma
    mudança escape do histórico.
31. Como responsável pela segurança dos dados, quero que as regras de status,
    permissão e validação sejam garantidas no banco, para que uma chamada
    direta ao Supabase não as contorne.
32. Como comprador, quero que cancelar, aprovar, reverter ou converter uma
    cotação continue funcionando como hoje, para que a nova regra de edição
    não atrapalhe o fluxo de status.

## Implementation Decisions

- **Informações da cotação** é o nome do conjunto editável: título,
  descrição, justificativa, prioridade, centro de custo, prazo de entrega e
  prazo de resposta. Os campos estruturais (itens, fornecedores, propostas,
  valores, departamento, gestor do pedido) ficam fora e seguem as regras
  atuais.
- **Máquina de estados**: a regra antiga "só edita em rascunho" é
  substituída por uma regra de edição de informações que libera todos os
  status exceto `cancelled` e `rejected`. A regra de itens
  (`canModifyItems`) não muda.
- **Módulo puro de edição de informações** (novo), sem dependência de
  Supabase nem de React, com três responsabilidades:
  - **validar** a entrada: título obrigatório e não vazio após trim;
    prioridade restrita a `low | medium | high | urgent`; demais campos
    opcionais (vazio vira nulo); prazos aceitam datas passadas;
  - **calcular o diff** entre as informações atuais e as editadas,
    produzindo `{ campo: { de, para } }` só com os campos alterados; diff
    vazio significa "nada a salvar";
  - **formatar o detalhe para a linha do tempo**: rótulo do campo em
    português, "antes → depois", valor vazio exibido como "—", prioridade e
    datas no formato de exibição, textos longos cortados em ~120
    caracteres.
- **Hook de cotações**: a função de atualização atual (que só mexe no estado
  local) é substituída por uma que grava as informações no banco e
  atualiza o estado com o retorno. Ela não grava o histórico — quem grava é
  o trigger. Se o diff estiver vazio, não chama o banco.
- **Permissão nova** `canEditQuotationInfo` ("Editar informações da
  cotação", grupo Cotações). Quem tem `canAdministerQuotations` também pode
  editar. Uma migration concede a nova permissão a todo cargo que já tem
  `canCreateQuotations`.
- **Trigger em `quotations`** (BEFORE UPDATE), mesmo padrão do trigger que
  trava o gestor do pedido. Só age quando algum dos sete campos muda;
  mudanças só de status ou de outros campos passam direto e não geram
  entrada no histórico.
  - Com usuário logado (`auth.uid()` presente): bloqueia se o status for
    cancelada ou rejeitada, se o usuário não tiver `canEditQuotationInfo`
    nem `canAdministerQuotations` (via `current_user_has_permission`), ou se
    a validação falhar (título vazio, prioridade fora do domínio). As
    mensagens de erro são em português e exibíveis ao usuário.
  - Sem usuário logado (SQL Editor, chave de serviço): não checa status,
    permissão nem validação.
  - Em ambos os casos, grava em `quotation_audit_logs` uma entrada com
    ação `info_edited` e `details = { campo: { de, para } }`. Sem usuário
    logado, `performed_by` é o UUID fixo
    `00000000-0000-0000-0000-000000000000` e `performed_by_name` é
    "Sistema (SQL)"; com usuário, o id e o nome do perfil.
- **Schema**: nenhuma coluna nova. A política de UPDATE aberta continua;
  a proteção das informações vem do trigger.
- **Tipos de auditoria**: a nova ação `info_edited` entra no tipo de ações
  do histórico, com rótulo "Informações editadas", ícone e cor próprios na
  linha do tempo.
- **Gaveta da cotação**: botão "Editar informações" visível só com a
  permissão e fora de cancelada/rejeitada; justificativa e descrição
  exibidas preservando quebras de linha.
- **Modal de edição**: abre com os sete campos preenchidos, valida com o
  módulo puro antes de enviar, mostra o erro do banco se o trigger
  recusar, e salva tudo numa única gravação.
- **Linha do tempo**: entradas `info_edited` listam cada campo alterado com
  o texto formatado pelo módulo puro e um "ver mais" para expandir textos
  cortados.
- **Mensagens**: nada muda. O trigger de mensagens só dispara em mudança de
  status, então editar informações não envia nada.
- **Concorrência**: vale a última gravação, sem detecção de conflito.

## Testing Decisions

- Bons testes cobrem comportamento externo (entrada → saída) de funções
  puras via vitest, sem mock profundo de Supabase e sem teste de
  renderização de componente — mesmo padrão do projeto.
- **Seam 1 — máquina de estados** (prior art: os testes já existentes da
  máquina de estados de cotações): a regra de edição de informações em
  todos os dez status — liberada em oito, bloqueada em `cancelled` e
  `rejected`.
- **Seam 2 — módulo puro de edição de informações** (novo; prior art de
  estilo: os testes de utilitários do módulo de cotações):
  - validação: título vazio ou só espaços falha; prioridade fora do domínio
    falha; campos opcionais vazios viram nulo; prazo no passado é aceito;
  - diff: só os campos alterados aparecem, com `de` e `para`; nada alterado
    gera diff vazio; vazio ↔ preenchido conta como alteração; texto igual
    após trim não conta;
  - formatação: rótulos em português, "—" para vazio, prioridade e datas no
    formato de exibição, corte em ~120 caracteres só em textos longos.
- **Seam 3 — trigger e migration: validação manual** no projeto Supabase de
  teste, sem pgTAP, como na RPC da etapa do gestor:
  - usuário com `canEditQuotationInfo` edita cotação aprovada: grava e gera
    `info_edited` com o diff;
  - usuário com `canAdministerQuotations` e sem a permissão nova: grava;
  - usuário sem nenhuma das duas: erro de permissão;
  - edição em cotação cancelada e em rejeitada: erro de status;
  - título vazio e prioridade inválida: erro de validação;
  - UPDATE pelo SQL Editor: grava sem checagem e registra "Sistema (SQL)"
    com o UUID fixo;
  - mudança só de status (cancelar, enviar para aprovação): passa e não
    gera entrada `info_edited`;
  - a migration concede `canEditQuotationInfo` a todos os cargos com
    `canCreateQuotations`.
- Fora dos testes automatizados: botão e modal na gaveta, quebras de linha
  na gaveta e exibição na linha do tempo — validação manual.

## Out of Scope

- Vincular requisições à cotação (uma ou várias) como relação de dados; a
  referência continua como texto na justificativa.
- Editar campos estruturais (itens, fornecedores, propostas, valores,
  departamento, gestor do pedido) fora do fluxo atual, e travá-los no banco.
- Detecção de conflito entre edições simultâneas.
- Registro retroativo da alteração feita por SQL na COT-202610-5XKW.
- Notificar alguém sobre edições de informações.

## Further Notes

- Origem: a justificativa da COT-202610-5XKW precisou receber
  "Requisição: REQ-866" via SQL Editor em produção, porque não havia como
  editar pela tela.
- Os PDFs da cotação e do pedido são gerados na hora a partir da cotação, e
  esses campos não são copiados para outras tabelas — editar a cotação já
  reflete em tudo, sem sincronização.
