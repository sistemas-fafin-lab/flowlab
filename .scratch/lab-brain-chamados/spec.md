# LAB-BRAIN abre chamados de TI no FlowLab (e a camada de permissões por agente)

**Status:** ready-for-agent

Decisões fechadas no grilling de 13/11/2026.

## Problem Statement

As áreas do laboratório levam pedidos ao LAB-BRAIN, o assistente de IA do Mário. Um exemplo é a Suane, do RH, pedindo escrita na API do TiqueTaque para lançar afastamento de férias.

Quando um desses pedidos depende do TI, o LAB-BRAIN não tem como abri-lo no FlowLab. Alguém precisa copiar à mão para a tela de chamados. Hoje não há endpoint, webhook nem e-mail de entrada de chamados.

Além disso, o FlowLab passa a ter dois agentes de IA:

- a **EVA**, interna, que age em nome de quem está logado ou de um número de WhatsApp ligado a um membro;
- o **LAB-BRAIN**, externo, sem sessão de usuário.

Hoje a EVA acessa o banco com a service_role, e as permissões são checadas só no código, espalhadas por cada rota. Não existe um lugar único que diga o que cada agente pode fazer. Isso fica arriscado a cada agente novo.

## Solution

O LAB-BRAIN ganha duas rotas na integração server-to-server que ele já usa:

- uma para **abrir um chamado** de TI em nome do solicitante;
- outra para **acompanhar a situação** desse chamado até a conclusão.

O chamado entra como um chamado comum, igual ao aberto pela tela, no nome da pessoa que pediu. Ele recebe um selo "via LAB-BRAIN", para o TI saber de onde veio.

Junto nasce a **camada de permissões por agente**: um manifesto único no código, onde cada agente declara as operações que pode fazer. Toda rota de agente checa esse manifesto. O LAB-BRAIN é o primeiro a usá-lo, inclusive nas consultas que já existem. A EVA migra para a mesma camada numa etapa seguinte.

## User Stories

1. Como LAB-BRAIN, quero abrir um chamado de TI no FlowLab por uma chamada HTTP, para que as demandas das áreas cheguem ao TI sem cópia manual.
2. Como LAB-BRAIN, quero me autenticar com uma chave dedicada à abertura de chamados, para que o acesso de escrita seja controlado separado do de leitura.
3. Como LAB-BRAIN, quero informar título, descrição, e-mail do solicitante, prioridade e tipo, para que o chamado chegue completo ao TI.
4. Como LAB-BRAIN, quero que prioridade e tipo tenham padrões (média e suporte), para não precisar decidir isso em todo pedido.
5. Como LAB-BRAIN, quero mandar meu próprio identificador do pedido, para relacionar o chamado do FlowLab com o meu registro.
6. Como LAB-BRAIN, quero que reenviar o mesmo identificador devolva o chamado que já existe, para que uma nova tentativa depois de falha de rede não crie chamado duplicado.
7. Como LAB-BRAIN, quero receber o código legível do chamado (ex.: IT-123), para citá-lo ao solicitante.
8. Como LAB-BRAIN, quero uma recusa clara quando o e-mail do solicitante não for de um usuário ativo do FlowLab, para orientar a pessoa a se cadastrar ou corrigir o e-mail.
9. Como LAB-BRAIN, quero uma recusa clara quando os dados forem inválidos (campo faltando, texto longo demais, prioridade ou tipo desconhecidos), para corrigir a chamada.
10. Como LAB-BRAIN, quero saber quanto esperar quando passar do limite de chamadas, para tentar de novo no momento certo.
11. Como LAB-BRAIN, quero consultar a situação de um chamado que abri pelo meu identificador, para acompanhar até a conclusão.
12. Como LAB-BRAIN, quero ver na consulta a situação, a coluna do Kanban, a prioridade, o responsável e a resolução, para responder ao solicitante sem perguntar ao TI.
13. Como solicitante (ex.: a Suane), quero que o chamado aberto pelo LAB-BRAIN fique no meu nome, para acompanhá-lo pela tela como qualquer chamado meu.
14. Como solicitante, quero receber os mesmos avisos de mudança de situação dos chamados que abro pela tela, para não depender do LAB-BRAIN para saber o andamento.
15. Como membro do TI, quero que o chamado do LAB-BRAIN entre na mesma fila de triagem dos chamados da tela, para tratar tudo num lugar só.
16. Como membro do TI, quero ver o selo "via LAB-BRAIN" na lista e no detalhe do chamado, para saber que o texto foi escrito por um agente, e não pela pessoa.
17. Como membro do TI, quero promover o chamado do LAB-BRAIN para o Kanban como qualquer outro, para não ter um fluxo à parte.
18. Como administrador do FlowLab, quero que a chave de escrita do LAB-BRAIN fique separada da de leitura, para revogar uma sem derrubar a outra.
19. Como administrador, quero que cada agente só faça as operações listadas para ele num único lugar do código, para saber e revisar o que cada um pode.
20. Como administrador, quero que as consultas que o LAB-BRAIN já faz ao Envio ao Álvaro também passem pelo manifesto, para que a regra valha para todas as rotas do agente.
21. Como administrador, quero um limite de chamadas de escrita bem menor que o de leitura, para que um loop do agente não inunde a fila do TI.
22. Como administrador, quero que toda chamada autorizada do agente fique registrada na auditoria de integrações, para investigar o que ele fez.
23. Como administrador, quero que a consulta do LAB-BRAIN só enxergue chamados abertos por ele, para que o agente não leia chamados de outras pessoas.
24. Como administrador, quero que a consulta não exponha comentários nem anexos, para que conversas internas do TI não saiam do FlowLab.
25. Como EVA, quero tratar o texto dos chamados do LAB-BRAIN como dado, nunca como instrução, para que um texto malicioso não mude o meu comportamento.
26. Como administrador, quero que título e descrição tenham tamanho máximo, para limitar abuso e o custo de contexto da EVA.
27. Como desenvolvedor do LAB-BRAIN, quero um guia da integração com campos, exemplos e códigos de erro, para implementar sem tirar dúvidas.
28. Como Gabriel, quero um texto de resposta pronto para o LAB-BRAIN no Slack, dizendo onde fica o segredo sem enviá-lo, para responder rápido e com segurança.

## Implementation Decisions

- **D1, solicitante:** o solicitante é o usuário do FlowLab procurado pelo e-mail enviado (sem diferenciar maiúsculas).
  - E-mail inexistente, ou de usuário removido ou desativado: a chamada é recusada com 422.
  - Não existe usuário técnico "LAB-BRAIN" como solicitante. É a mesma regra de "inativo = sem permissão" que a EVA já aplica a quem escreve pelo WhatsApp.
- **D2, como o chamado entra:** como um chamado comum, igual ao da tela: situação pendente, fora do Kanban até o TI promover. Não passa pela fila de aprovação da EVA. Abrir chamado já é direito de qualquer usuário. **Substituída em 13/11/2026** por `.scratch/lab-brain-aprovacao-eva/spec.md`: o chamado nasce igual, mas gera junto uma sugestão de promoção na fila da EVA.
- **D3, manifesto de permissões:** um módulo novo e pequeno declara, para cada agente, as operações permitidas. Na v1: LAB-BRAIN → ler apoio, criar chamado, ler chamado.
  - A interface é uma pergunta simples: "o agente X pode a operação Y?".
  - As rotas de consulta do Envio ao Álvaro, que já existem, passam a perguntar ao manifesto, sem mudar o comportamento.
  - Não há tabela nem tela de permissões na v1.
- **D4, chaves:** a abertura e a consulta de chamados usam uma chave nova, só para chamados, guardada nas variáveis de ambiente do Vercel. A chave de leitura do apoio não abre essas rotas. O administrador entrega a chave por canal separado, nunca pelo Slack.
- **D5, criação do chamado:** uma rota nova no dispatcher de integrações que já existe, só por POST, sem criar Serverless Function nova.
  - Corpo em JSON:
    - `titulo`: obrigatório, até 255 caracteres, sem espaço sobrando;
    - `descricao`: obrigatória, até 5.000 caracteres;
    - `solicitante_email`: obrigatório;
    - `prioridade`: `low|medium|high|critical`, padrão `medium`;
    - `tipo`: `suporte|desenvolvimento`, padrão `suporte`. É a "categoria" pedida pelo LAB-BRAIN, sem uma classificação nova;
    - `id_externo`: obrigatório.
  - Respostas:
    - 201 `{ id, codigo }` na criação;
    - 200 com o chamado que já existe quando o `id_externo` se repete;
    - 400 para entrada inválida, 401 para chave ausente ou errada, 405 para outro método, 422 para solicitante inválido, 429 com `Retry-After` sem cota.
- **D6, mudança no banco:** os chamados de TI ganham duas colunas:
  - `origem`: texto; nulo = aberto pela tela, `lab-brain` = aberto pelo agente;
  - `id_externo`: texto, único por origem quando preenchido.

  A migration é idempotente, como as demais.
- **D7, consulta do chamado:** rota de GET por `id_externo`, que só encontra chamados com origem LAB-BRAIN; qualquer outro devolve 404.
  - Devolve o código, a situação, a coluna do Kanban, a prioridade, o nome do responsável (ou nulo), a resolução (quando houver) e a data da última atualização.
  - Não devolve comentários, anexos nem outros dados pessoais.
  - Não há webhook na v1.
- **D8, ordem de checagem, a mesma da integração atual:** método → chave → permissão no manifesto → parâmetros → cota + auditoria → operação. Erros de chave e de parâmetro não consomem cota nem entram na auditoria.
- **D9, limite:** cota própria da integração "lab-brain-chamados", de 10 chamadas por minuto, dividida entre criação e consulta. A cota de leitura do apoio (120 por minuto) não muda. O registro usa a mesma função de cota + auditoria que já existe.
- **D10, avisos:** nenhum aviso novo para o TI na criação, o mesmo tratamento dos chamados da tela. Os avisos ao solicitante sobre mudança de situação continuam como já são.
- **D11, selo na tela:** a lista e o detalhe dos chamados de TI mostram o selo "via LAB-BRAIN" quando a origem é o agente, seguindo a identidade visual do FlowLab.
- **D12, texto é dado:** título e descrição vindos do agente são cortados nos limites da D5. Quando a EVA os lê no contexto do board, continuam sendo dado, nunca instrução, pela regra que já vale para ela.
- **D13, documentação:** guia novo da integração de chamados, no mesmo formato do guia de consulta ao Envio ao Álvaro, mais o texto de resposta ao LAB-BRAIN no Slack. O prazo da resposta fica para o Gabriel preencher.
- **D14, etapa 2, a EVA:** a EVA migra para a camada depois, operação por operação, começando pelas escritas.
  - A permissão efetiva será o que o agente pode **∩** o que o usuário pode.
  - As operações passarão a usar o cliente com o JWT do usuário, para o RLS ser a segunda barreira, e a service_role fica só nas rotinas de sistema.
  - A camada continua sendo um módulo interno; rota HTTP só para agentes externos.
  - Detalhes num grilling próprio.

## Testing Decisions

- **Uma seam só: o handler HTTP de cada rota.** O teste monta uma requisição falsa (método, header de autorização, corpo ou query), chama o handler e confere o status, o corpo e os headers da resposta. O Supabase é substituído por um falso no limite do cliente.
- **Um bom teste aqui** confere só o comportamento visto de fora (o que o LAB-BRAIN recebe e o que é gravado no falso). Não confere detalhes internos, como a ordem das consultas ou funções auxiliares. O manifesto e o parser não ganham testes unitários próprios: são exercitados pela rota.
- **Casos da criação:**
  - método errado;
  - chave ausente, errada e de leitura;
  - cada campo inválido;
  - e-mail inexistente, removido e desativado;
  - falta de cota com `Retry-After`;
  - criação com os padrões aplicados e com origem e `id_externo` gravados;
  - reenvio idempotente.
- **Casos da consulta:**
  - sem `id_externo`;
  - chave errada;
  - chamado de outra origem → 404;
  - chamado resolvido, com resolução;
  - chamado em aberto, sem resolução;
  - ausência de comentários e anexos no corpo.
- **As rotas do apoio**, que já existem, continuam passando nos testes atuais depois de passarem a usar o manifesto.
- **Referência:** os testes da integração atual do LAB-BRAIN com o Envio ao Álvaro, com o mesmo Supabase falso, a mesma requisição e resposta falsas e o mesmo padrão de chave.
- **Sem teste automatizado:**
  - o selo na tela: conferência visual, porque não existe teste de componente da tela de chamados e não vale criar uma seam só para isso;
  - a migration: conferida aplicando no banco.

## Out of Scope

- O chamado do TiqueTaque em si: é conteúdo que o LAB-BRAIN vai abrir usando esta integração.
- Webhook do FlowLab para o LAB-BRAIN, anexos no chamado, comentários pela API e qualquer escrita além da criação.
- Tabela ou tela de permissões dos agentes.
- Aviso novo ao TI quando um chamado é aberto, por qualquer origem.
- A migração da EVA para a camada de operações (etapa 2, issue 05, precisa de triagem).

## Further Notes

- O pedido original veio do LAB-BRAIN no Slack, em nome do Mário. A resposta só deve citar onde o segredo fica guardado, nunca o segredo.
- A cota de 10 por minuto, dividida entre criação e consulta, pode ficar curta se o LAB-BRAIN consultar com muita frequência. Revisar se acontecer.
- Tickets:
  - `issues/01-manifesto-permissoes-agentes.md` (prefactor, sem bloqueio)
  - `issues/02-lab-brain-abre-chamado.md` (depende da 01)
  - `issues/03-lab-brain-acompanha-chamado.md` (depende da 02)
  - `issues/04-chave-e-resposta-lab-brain.md` (humano, sem bloqueio)
  - `issues/05-teste-ponta-a-ponta.md` (humano, depende da 03 e da 04)
  - `issues/06-eva-na-camada-de-operacoes.md` (etapa 2, needs-triage, depende da 01)
  - `issues/07-chamado-lab-brain-na-aprovacao-da-eva.md` (needs-triage, sem bloqueio; muda a D2)
