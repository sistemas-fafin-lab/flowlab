# Gerador de Orçamento: trazer a Tabela-Particular para dentro do flowlab

Status: ready-for-agent

## Problem Statement

O atendimento monta orçamentos para clientes particulares num app separado, a
Tabela-Particular (Next.js, projeto próprio na Vercel). Esse app:

- vive fora do flowlab: login, visual e deploy à parte, e mais um sistema para
  manter;
- busca os preços no flowlab por um endpoint server-to-server protegido por
  uma chave de API dedicada, ou seja, o flowlab precisa manter uma integração
  só para alimentar um app que poderia ser uma tela dele mesmo;
- manda para o navegador o **custo** de todos os exames, mesmo para quem só
  gera o orçamento do cliente; qualquer pessoa com o DevTools aberto lê o
  custo do laboratório;
- não tem controle de acesso por pessoa: quem tem o link usa, e quem usa vê
  tudo, inclusive o PDF interno de custo e margem;
- busca o prompt da IA num arquivo do Google Drive por Service Account, uma
  dependência externa a mais, sem versionamento.

## Solution

Uma área nova no menu do flowlab, **Atendimento**, com uma única ferramenta:
o **Gerador de Orçamento**. Ela faz tudo o que a Tabela-Particular faz, no
visual do flowlab e atrás do login e das permissões do flowlab:

- busca de exames por nome ou código TUSS, com os convênios que atendem cada
  exame;
- carrinho com quantidade por exame;
- **desconto automático por volume** (10% ou 15% sobre os exames elegíveis),
  com as mesmas regras de hoje;
- **Orçamento** em PDF para o cliente (Valor Total e Valor com Desconto);
- PDF interno de custo × venda e margem, só para quem tem permissão de custos;
- (fase 2) leitura do pedido médico por IA: o atendente envia fotos ou PDFs do
  pedido e o sistema marca no carrinho os exames reconhecidos.

Os preços vêm direto do banco do flowlab por um endpoint interno, com a sessão
do usuário logado. O custo só sai do servidor para quem tem a permissão de
custos. Quando o módulo estiver validado em produção, a Tabela-Particular é
desligada e o endpoint por chave de API é removido.

## User Stories

### Acesso e navegação

1. Como atendente, quero encontrar o Gerador de Orçamento numa área
   "Atendimento" no menu lateral do flowlab, para não precisar abrir outro
   sistema.
2. Como atendente, quero entrar no Gerador de Orçamento com o meu login do
   flowlab, para não ter outro link ou senha para lembrar.
3. Como usuário sem a permissão de uso do Gerador de Orçamento, quero não ver
   a área "Atendimento" no menu, para que o menu mostre só o que posso usar.
4. Como usuário sem permissão que abre a rota pelo endereço direto, quero ser
   barrado como nas outras telas protegidas do flowlab, para que o acesso não
   dependa de esconder o link.
5. Como administrador, quero que o cargo de sistema "atendente" já exista com
   a permissão de uso do Gerador de Orçamento, para dar acesso à equipe só
   atribuindo o cargo.
6. Como administrador, quero que o cargo "Administrador" receba as duas
   permissões do Gerador de Orçamento (uso e custos), para que a gestão tenha
   acesso total sem configuração manual.
7. Como administrador, quero ver as duas permissões novas num grupo
   "Atendimento" na tela de cargos, para montar cargos customizados (por
   exemplo, um gestor de atendimento que vê custos).

### Busca e carrinho

8. Como atendente, quero buscar exames pelo nome, para achar o exame mesmo sem
   saber o código.
9. Como atendente, quero buscar exames pelo código TUSS, para achar o exame
   exato quando o pedido traz o código.
10. Como atendente, quero que a busca filtre em tempo real enquanto digito,
    para montar o orçamento rápido com o cliente na frente.
11. Como atendente, quero ver o preço particular de cada exame no resultado da
    busca, para informar o valor na hora.
12. Como atendente, quero ver quais convênios atendem cada exame, para avisar
    o cliente que talvez o convênio dele cubra o exame.
13. Como atendente, quero adicionar um exame ao carrinho com um clique, para
    montar o orçamento sem passos extras.
14. Como atendente, quero alterar a quantidade de um exame no carrinho, para
    orçar exames pedidos mais de uma vez.
15. Como atendente, quero remover um exame do carrinho, para corrigir uma
    seleção errada.
16. Como atendente, quero limpar o carrinho de uma vez, para começar o
    orçamento do próximo cliente.
17. Como atendente, quero que exames com o mesmo TUSS e nomes diferentes
    apareçam como itens separados, para escolher o nome exato pedido (a lista
    de preços pode ter mais de um item por TUSS).
18. Como atendente, quero uma mensagem clara quando a lista de exames não
    carregar, e um jeito de tentar de novo, para saber que o problema não é da
    minha busca.
19. Como atendente, quero um indicador de carregamento enquanto a lista de
    exames chega, para não achar que a busca está vazia.

### Desconto automático por volume

20. Como atendente, quero que o desconto seja calculado sozinho, sem escolher
    percentual, para não errar nem esquecer o desconto.
21. Como cliente, quero 10% de desconto sobre os exames elegíveis quando levo
    5 ou mais exames elegíveis distintos, ou quando eles somam R$300 ou mais.
22. Como cliente, quero 15% de desconto sobre os exames elegíveis quando levo
    10 ou mais exames elegíveis distintos, ou quando eles somam R$1.000 ou
    mais, em vez dos 10%.
23. Como gestor, quero que as faixas não se somem (15% substitui 10%), para
    cumprir a política comercial.
24. Como gestor, quero que exames não elegíveis nunca recebam desconto e não
    contem para atingir as faixas, para que a política fique restrita aos
    exames marcados.
25. Como gestor, quero que a contagem de exames elegíveis ignore a quantidade
    (um exame com quantidade 3 conta como 1), e que o valor considere preço ×
    quantidade, como a regra atual.
26. Como gestor, quero que a elegibilidade de cada exame continue vindo do
    cadastro de fontes pagadoras do flowlab (a marcação de desconto
    particular), para manter um único lugar de configuração.
27. Como cliente, quero ver no resumo só o Valor Total e o Valor com Desconto,
    sempre os dois (iguais quando não há desconto), sem percentual nem selo,
    como hoje.

### Orçamento em PDF (cliente)

28. Como atendente, quero gerar o Orçamento em PDF com os exames, as
    quantidades, os preços, o Valor Total e o Valor com Desconto, para
    entregar ou enviar ao cliente.
29. Como cliente, quero que o PDF mostre exatamente os valores do resumo da
    tela, para que o documento bata com o que me disseram.
30. Como gestor, quero que o PDF tenha o cabeçalho e o logo no padrão dos
    outros PDFs do flowlab, para manter a identidade do laboratório.
31. Como gestor, quero que o PDF do cliente nunca mostre custo, margem ou
    informação interna.

### PDF interno (custos)

32. Como usuário com permissão de custos, quero gerar o PDF interno com custo,
    preço de venda e margem por exame, para avaliar a rentabilidade do
    orçamento.
33. Como usuário com permissão de custos, quero que o PDF interno mostre uma
    linha com o desconto automático aplicado (percentual e quantos exames
    elegíveis entraram), para entender como o valor final foi composto.
34. Como usuário com permissão de custos, quero que o PDF interno tenha a
    marca d'água "INTERNO", para que ele não seja confundido com o Orçamento do
    cliente.
35. Como atendente sem permissão de custos, quero não ver o botão do PDF
    interno, para que a tela mostre só o que posso usar.
36. Como gestor, quero que o custo dos exames nem chegue ao navegador de quem
    não tem permissão de custos, para que ele não possa ser lido pelo DevTools.

### Leitura do pedido médico por IA (fase 2)

37. Como atendente, quero enviar fotos ou PDFs do pedido médico (até 5
    arquivos de até 10MB cada), para não digitar os exames um por um.
38. Como atendente, quero que a IA identifique os exames do pedido e os ligue
    aos exames da lista de preços, para que eles entrem no carrinho.
39. Como atendente, quero revisar o resultado da IA antes de adicionar ao
    carrinho, vendo quais exames foram reconhecidos e quais ficaram sem
    correspondência, para corrigir à mão o que a IA não achou.
40. Como atendente, quero uma mensagem clara quando o arquivo for grande
    demais, forem arquivos demais ou a IA demorar ou falhar, para saber o que
    fazer.
41. Como gestor, quero que os arquivos do pedido médico sejam apagados do
    armazenamento depois da análise, para não guardar dado de saúde de
    paciente sem necessidade.
42. Como desenvolvedor, quero o prompt da IA versionado no repositório, para
    que mudanças nele passem por revisão e não dependam do Google Drive.

### Desligamento da Tabela-Particular

43. Como responsável pela TI, quero que o app antigo continue no ar por um
    período depois da entrada do módulo, como plano B, para que o atendimento
    não pare se aparecer um problema.
44. Como responsável pela TI, quero remover o endpoint por chave de API e a
    chave dedicada depois que o app antigo for desligado, para não manter uma
    integração sem uso nem uma credencial ativa sem necessidade.

## Implementation Decisions

### Módulo e navegação

- Módulo frontend novo `gerador-orcamento`, no padrão de `src/modules/*`
  (componentes, hooks, regras puras, tipos).
- Área nova **"Atendimento"** no menu lateral, com um único item, "Gerador de
  Orçamento". Rota `/atendimento/gerador-orcamento`, protegida pela permissão
  de uso, como as outras rotas protegidas do `App.tsx`. Nenhuma tela
  existente muda de área.
- Visual no padrão do flowlab (guia `flowlab-identity` e o design system em
  `docs/`). Não copiar o visual da Tabela-Particular (glassmorphism próprio):
  só o comportamento.

### Permissões e cargos

- Grupo novo **"Atendimento"** na lista de chaves de permissão do app, com:
  - `canUseGeradorOrcamento`: "Usar Gerador de Orçamento" (tela, busca,
    carrinho, Orçamento do cliente e, na fase 2, a IA);
  - `canViewGeradorOrcamentoCustos`: "Ver custos e margem no Gerador de
    Orçamento" (custo na resposta da API e PDF interno).
- Migration idempotente, no padrão da que criou o cargo "analistaSaude":
  - seed do cargo de sistema **"atendente"** (`is_system = true`) com
    `canUseGeradorOrcamento`;
  - merge com dedup das duas chaves no cargo "Administrador".
- Ninguém mais recebe `canViewGeradorOrcamentoCustos` por padrão; quem
  precisar recebe por cargo customizado.

### Endpoint interno de preços

- Rota nova autenticada pela **sessão do usuário** (JWT do navegador), não por
  chave de API, seguindo o padrão de autorização por módulo (como a
  autorização do faturamento): sem token → 401; sessão inválida → 401; sem
  `canUseGeradorOrcamento` → 403.
- Reaproveita a regra de negócio que já existe para montar a lista de preços
  (tabela associada "Particular", exclusões e valores personalizados por
  exame, convênios que atendem, elegibilidade de desconto, um item por
  TUSS + nome). A montagem passa a receber uma opção que diz se o custo entra.
- **O custo só é consultado e devolvido** quando o usuário tem
  `canViewGeradorOrcamentoCustos`. Sem a permissão, a consulta nem busca as
  colunas de custo, e os itens saem sem o campo.
- Formato do item (com o campo de custo opcional):

  ```ts
  type ItemGeradorOrcamento = {
    tuss: string;
    nome: string | null;
    preco: number;
    custo?: number | null; // só com canViewGeradorOrcamentoCustos
    elegivelDescontoParticular: boolean;
    conveniosAceitos: string[];
  };
  ```

  A resposta também diz se o usuário pode ver custos, para a tela decidir se
  mostra o botão do PDF interno sem fazer uma consulta à parte.
- Os nomes do banco ficam como estão: tabela associada "Particular" e coluna
  `elegivel_desconto_particular` são dados, não o nome da ferramenta.

### Regras puras no navegador

- **Cálculo do Orçamento**: porta da função pura da Tabela-Particular, com o
  mesmo contrato:

  ```ts
  type ItemOrcamento = { preco: number; quantidade: number; elegivelDesconto: boolean };
  type ResultadoOrcamento = {
    valorTotal: number;
    valorComDesconto: number;
    percentualAplicado: 0 | 10 | 15;
    qtdElegiveis: number;
  };
  ```

  Faixas fixas no código: 15% com 10 ou mais elegíveis distintos ou R$1.000 ou
  mais em elegíveis; senão 10% com 5 ou mais ou R$300 ou mais; senão 0. O
  desconto incide só sobre o valor dos elegíveis. Tela e PDFs consomem o mesmo
  resultado.
- **PDFs**: porta de `buildClientPdf`/`buildInternalPdf` (jsPDF +
  jspdf-autotable, que o flowlab já tem), mantendo conteúdo e contas e
  trocando o cabeçalho e o logo pelos do gerador de PDF de cotações do
  flowlab. Sem `canvg`. O PDF interno só é montado com dados que tenham custo.
- A lógica de cenário "Não Atendido" (markup 0,7x/0,8x), que a
  Tabela-Particular mantinha sem imprimir, **não é portada**: está morta lá e
  não volta.

### Leitura do pedido médico por IA (fase 2)

- Segue o fluxo do envio ao apoio, que já existe no flowlab: o navegador sobe
  os arquivos direto num **bucket privado novo** do Supabase Storage, com
  policy para usuários autenticados com `canUseGeradorOrcamento`, e manda ao
  servidor só os caminhos. Assim o limite de corpo da Vercel (~4,5MB) não
  pesa.
- Limites mantidos: até 5 arquivos, até 10MB cada, imagens e PDF.
- Endpoint novo de análise, autenticado pela sessão e exigindo
  `canUseGeradorOrcamento`: baixa os arquivos com service role, chama o Gemini
  pelo SDK `@google/genai` (o mesmo que o flowlab usa no apoio) com o prompt
  versionado no repositório e a lista de nomes de exames, devolve a lista de
  exames reconhecidos com o item correspondente (ou nenhum) e **apaga os
  arquivos** do bucket ao terminar, com sucesso ou falha.
- O casamento da resposta da IA com os itens da lista de preços é feito pelas
  regras puras portadas da Tabela-Particular (leitura do texto da IA e
  casamento por nome).
- Variáveis: `GEMINI_API_KEY` (e `GEMINI_MODEL` opcional), já usadas pelo
  flowlab. Sem Service Account do Google Drive.

### Desligamento

- Ordem: (1) módulo em produção no flowlab; (2) período de uso com a
  Tabela-Particular no ar como plano B; (3) o responsável desliga o projeto da
  Tabela-Particular na Vercel; (4) remoção do endpoint
  `/api/integracoes/orcamento-particular`, da validação por chave e da
  variável `TABELA_PARTICULAR_API_KEY`. O passo 4 depende de confirmação
  humana do passo 3.
- A montagem da lista de preços continua existindo (usada pelo endpoint
  interno); só a porta de entrada por chave de API sai.

### Domínio

- `CONTEXT.md` na raiz ganha os termos **Gerador de Orçamento** (a
  ferramenta), **Orçamento** (o documento entregue ao cliente particular),
  **Exame elegível a desconto** e **Desconto automático por volume**.
  "Tabela Particular", "Pardini" e "Álvaro" ficam registrados como sinônimos
  a evitar.

## Testing Decisions

- Um bom teste verifica comportamento observável (entrada → saída, status
  HTTP, conteúdo da resposta), não detalhes internos. Nada de checar se uma
  função usa `.filter` ou quantas vezes um mock interno foi chamado, a não ser
  que a chamada seja o próprio comportamento (por exemplo, "o bucket foi
  limpo").
- **Montagem da lista de preços**: estender os testes que já existem para ela
  (Supabase falso). Casos novos: sem permissão de custos, nenhum item traz
  `custo`; com a permissão, os itens trazem o custo como hoje. Os casos
  atuais (tabela "Particular", exclusões, valores personalizados, convênios,
  um item por TUSS + nome) continuam passando.
- **Endpoint interno**: testes do handler como os do endpoint de integração
  atual e os das rotas autorizadas por sessão: sem token → 401, sessão
  inválida → 401, sem `canUseGeradorOrcamento` → 403, com uso e sem custos →
  200 sem custo, com as duas permissões → 200 com custo, método diferente de
  GET → 405.
- **Regras puras**: portar para o vitest do flowlab os testes da
  Tabela-Particular para o cálculo do Orçamento (faixas, limites exatos 5, 10,
  R$300 e R$1.000, quantidade não contando na contagem, não elegíveis sem
  desconto), para os PDFs (conteúdo do cliente sem custo; interno com margem,
  linha de desconto e marca d'água) e para a leitura e o casamento da
  resposta da IA.
- **Endpoint de IA (fase 2)**: teste do handler com Gemini e Storage falsos,
  como no envio ao apoio: validação dos caminhos (quantidade, `..`, vazio),
  401/403, resposta com exames casados e arquivos apagados também quando o
  Gemini falha.
- Sem testes de componente React: a tela só consome as regras acima.

## Out of Scope

- Guardar orçamentos (histórico, reabrir, reenviar). O Orçamento é gerado e
  baixado, sem registro no banco.
- Tela para configurar as faixas de desconto.
- Mover outras telas (Agendamentos, Postos etc.) para a área "Atendimento".
- Enviar o Orçamento ao cliente por e-mail ou WhatsApp.
- Mudanças no cadastro de fontes pagadoras ou em como a elegibilidade de
  desconto é marcada.
- O desligamento do projeto da Tabela-Particular na Vercel, que é feito pelo
  responsável e não por código.

## Further Notes

- O app de origem fica em `../Tabela-Particular` (tela `alvaro-orcamento`, com
  as regras em `lib/alvaro-orcamento/`). Ele é a referência de comportamento:
  em caso de dúvida, o Gerador de Orçamento faz o que ele faz, a não ser onde
  esta spec diz o contrário (custo escondido no servidor, cenário "Não
  Atendido" fora, prompt no repositório, cabeçalho do PDF).
- Fatiamento sugerido para as issues: (1) permissões, cargos e área no menu;
  (2) endpoint interno com custo condicionado; (3) tela de busca, carrinho e
  desconto; (4) PDFs; (5) IA com bucket temporário; (6) `CONTEXT.md`; (7)
  remoção do endpoint por chave de API (`ready-for-human`, bloqueada pela
  confirmação do desligamento).
- O pedido médico tem dado de saúde de paciente: o bucket da IA é privado e os
  arquivos são temporários por desenho.
