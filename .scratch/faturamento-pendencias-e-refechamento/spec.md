# Faturamento: pendências até hoje sem clínicas/eventos não cobráveis, e título que acompanha o refechamento do lote

Status: ready-for-agent

## Problem Statement

O setor de faturamento usa as abas de Pendências e o card de Meta mensal para
acompanhar o mês, mas hoje as três telas atrapalham mais do que ajudam:

- **Pendências → Particulares** só mostra requisições até o fim do mês
  passado (M-1). O operador não consegue acompanhar o mês corrente "em tempo
  real", que é justamente quando a NF do particular precisa ser emitida.
- A lista de Particulares mistura pendência real com requisição que **nunca
  terá NF**: as das clínicas para as quais o laboratório não emite nota
  (ABAC, Nexus, Mater Clínica, Ecomed) e as de exame cancelado. O operador
  não tem nem uma coluna que diga de qual clínica a requisição veio.
- **Pendências → Sem lote** também para em M-1 e mostra requisições com
  amostra devolvida e material descartado, que nunca vão entrar em lote.
- O **Faturado no mês** da Meta não bate com a planilha do setor. Em
  out/2026 a planilha dava R$ 802.189,41 e o FlowLab R$ 708.006,74. O cliente
  achou que era porque "o lote é montado no fim do mês e enviado no início
  do seguinte" e pediu para contar pela data de envio. A conferência lote a
  lote no banco mostrou outra causa: o título guarda a data do **primeiro**
  fechamento do lote, e quando o lote é **refechado/reenviado** no apLIS (o
  apLIS atualiza `DtaFechamento`), o título fica no mês antigo. Só isso
  explica R$ 51,7 mil de outubro (lotes 6243, 6283, 6395, 6553, 6774). A data
  de envio do apLIS (`DtaEnvio`) não serve: é nula em boa parte dos lotes e
  muitas vezes é anterior ao fechamento.

## Solution

**Pendências → Particulares**

- O filtro de solicitação vai até **hoje** e abre por padrão no mês corrente
  (dia 1 até hoje). O subtítulo avisa que os dados são até D-1, porque a
  réplica do apLIS atrasa cerca de um dia.
- Nova coluna **Clínica**, com o local de origem da requisição.
- As requisições de locais de origem marcados como **"não emite NF"** somem
  da lista e do total. Um toggle "Mostrar clínicas sem NF", desligado por
  padrão, traz essas requisições de volta para conferência.
- A lista de clínicas sem NF é editável num modal **"Clínicas sem NF"** na
  própria aba, com busca dos locais de origem do apLIS. Começa com ABAC,
  Nexus, Mater Clínica e Ecomed.
- Saem da lista as requisições em estado final não cobrável: Exame Cancelado,
  Amostra Devolvida, Descarte Definitivo e Encaminhada p/ Descarte.

**Pendências → Sem lote**

- Mesmo limite (até hoje, dados até D-1) e mesma exclusão de estados finais
  não cobráveis.

**Pendências → Sem NF (lotes)**

- Sem mudança: continua limitado a M-1, porque lote do mês corrente ainda
  está no fluxo normal de fechamento.

**Meta, Dashboard e aba Títulos**

- O mês do título continua sendo a **emissão = fechamento do lote**. Não
  passa a ser data de envio.
- Ao clicar em **Atualizar** na aba Títulos, todo título cujo lote tem no
  apLIS um fechamento **mais recente** que a emissão recebe essa nova data na
  hora. A competência acompanha quando era igual ao mês da emissão antiga.
  Um aviso lista o que mudou ("3 títulos mudaram de mês por refechamento no
  apLIS": lote, emissão antiga → nova). Isso vale também para títulos do
  backfill e títulos com emissão escolhida à mão.
- Como Meta, Dashboard e "Ver títulos do mês" usam a mesma emissão, as três
  telas mudam juntas e continuam batendo entre si.

## User Stories

1. As an operador de faturamento, I want que o filtro de Particulares vá até hoje, so that eu acompanhe as NFs de particular do mês corrente enquanto ele acontece.
2. As an operador de faturamento, I want que Particulares abra no mês corrente (dia 1 até hoje), so that eu não precise mexer no filtro toda vez que entro na aba.
3. As an operador de faturamento, I want poder escolher um período anterior em Particulares, so that eu ainda consiga caçar pendências antigas.
4. As an operador de faturamento, I want que o subtítulo de Particulares e Sem lote diga que os dados são até ontem, so that eu não estranhe uma requisição de hoje que ainda não aparece.
5. As an operador de faturamento, I want ver a clínica (local de origem) de cada requisição particular, so that eu saiba de onde vem cada pendência.
6. As an operador de faturamento, I want que as requisições de ABAC, Nexus, Mater Clínica e Ecomed não apareçam em Particulares, so that a lista mostre só o que realmente precisa de NF.
7. As an operador de faturamento, I want que o total de Particulares também ignore essas clínicas, so that o valor pendente no widget do Dashboard seja real.
8. As an operador de faturamento, I want um toggle "Mostrar clínicas sem NF", so that eu confira de vez em quando o que está sendo escondido.
9. As an operador de faturamento, I want que, com o toggle ligado, a coluna Clínica deixe claro quais linhas são de clínica sem NF, so that eu não as confunda com pendência real.
10. As an gestor de faturamento, I want marcar e desmarcar clínicas como "não emite NF" num modal, so that eu acompanhe novas parcerias sem depender de desenvolvedor.
11. As an gestor de faturamento, I want buscar o local de origem pelo nome no modal, so that eu ache a clínica certa entre centenas de locais do apLIS.
12. As an gestor de faturamento, I want ver no modal a lista atual de clínicas sem NF, so that eu saiba o que já está marcado.
13. As an operador sem permissão de gestão, I want ver a lista de clínicas sem NF sem poder editar, so that eu entenda por que uma requisição não aparece.
14. As an operador de faturamento, I want que exame cancelado não apareça em Particulares, so that eu não tente emitir NF de exame que não existe.
15. As an operador de faturamento, I want que amostra devolvida e material descartado não apareçam em Particulares nem em Sem lote, so that essas requisições não poluam as pendências.
16. As an operador de faturamento, I want que "Aguardando devolução/retirada" e "Aguardando descarte" continuem aparecendo, so that eu não perca requisições que ainda podem voltar a ser cobradas.
17. As an operador de faturamento, I want que o filtro de Sem lote também vá até hoje, so that eu veja guias sem lote do mês corrente antes do fechamento.
18. As an operador de faturamento, I want que Sem NF (lotes) continue até M-1, so that lotes ainda em fechamento normal não virem ruído.
19. As an operador de faturamento, I want que, ao clicar em Atualizar na aba Títulos, a emissão do título acompanhe o refechamento do lote no apLIS, so that o faturado do mês bata com a planilha do setor.
20. As an operador de faturamento, I want um aviso dizendo quais títulos mudaram de mês e de qual data para qual, so that eu saiba por que o faturado de um mês subiu ou desceu.
21. As an operador de faturamento, I want que a competência do título acompanhe a nova emissão quando era o mês da emissão antiga, so that o título não fique com competência de um mês e emissão de outro sem motivo.
22. As an operador de faturamento, I want que uma competência escolhida diferente da emissão seja preservada, so that um ajuste manual meu não seja desfeito.
23. As an operador de faturamento, I want que títulos do backfill também acompanhem o refechamento, so that lotes antigos reenviados (ex.: SIS Senado 6283) entrem no mês do reenvio.
24. As an operador de faturamento, I want que um título com vários lotes use o fechamento mais recente entre eles, so that a regra seja a mesma da criação do título.
25. As an operador de faturamento, I want que a emissão só mude quando o fechamento do apLIS for mais recente que a emissão atual, so that uma data posterior escolhida à mão não volte para trás.
26. As an operador de faturamento, I want que títulos cancelados não sejam mexidos, so that o histórico de cancelamento fique intacto.
27. As an gestor de faturamento, I want que Meta, Dashboard e "Ver títulos do mês" continuem batendo depois do Atualizar, so that eu possa fazer o drill-down do card de meta sem divergência.
28. As an gestor de faturamento, I want que o histórico de metas reflita a mudança de mês dos títulos refechados, so that julho/agosto/setembro não contem um lote que foi reenviado em outubro.
29. As an operador sem permissão de edição, I want que o Atualizar só recarregue a lista sem tentar mudar emissões, so that não apareça erro de permissão para quem só visualiza.
30. As an operador de faturamento, I want que uma falha ao ler o apLIS no Atualizar não apague a lista, so that eu continue trabalhando com o que já tinha.

## Implementation Decisions

**Regra de janela das pendências por requisição**

- Particulares e Sem lote deixam de usar o corte de M-1. O limite superior
  passa a ser **hoje** (calculado no MySQL a partir de `CURDATE()`, como já é
  feito hoje com o M-1). O `ate` do cliente continua só podendo encurtar a
  janela. A meta devolvida troca o `cutoff` de M-1 por esse limite.
- Sem NF (lotes) mantém a regra de M-1 sem mudança. A função compartilhada
  de corte deixa de ser compartilhada pelas três listas, ou ganha um
  parâmetro de regra.
- O padrão do filtro de Particulares no front passa a ser o mês corrente
  (dia 1 até hoje). O de Sem lote segue o mesmo padrão.
- O subtítulo das duas abas troca o texto "até o fim de M-1" por "dados até
  ontem (D-1)".

**Estados finais não cobráveis**

- Um único conjunto nomeado de `requisicao.CodEvento` não cobráveis,
  compartilhado por Particulares e Sem lote: **8** Exame Cancelado, **64**
  Amostra DEVOLVIDA, **1023** Material Encaminhado p/ Descarte Definitivo,
  **1037** Amostra Encaminhada p/ Descarte/Sem Contato com Paciente.
  Substitui o corte isolado de `CodEvento = 8` que hoje só existe em Sem
  lote.
- **1020** (Aguardando devolução/retirada) e **1034** (Aguardando descarte)
  ficam fora do conjunto de propósito, porque ainda podem ser revertidos.
- Códigos verificados em `evento` no banco real (19/10/2026). Em Sem lote,
  ago/2026 tinha 11 requisições com evento 64 e 3 com 1023.

**Clínicas sem NF (local de origem)**

- "Clínica" é o **Local de Origem** da requisição (`requisicao.IdLocalOrigem`
  → `fatinstituicao`). Não é fonte pagadora: todas essas requisições são da
  fonte 1102 PARTICULAR.
- Tabela nova no Supabase com a lista de locais de origem que não emitem
  NF: `aplis_id` (inteiro, chave), nome exibido, quem marcou e quando. RLS:
  leitura para `canViewBilling` ou `canManageBilling`, escrita só para
  `canManageBilling`. A migration já insere ABAC (1155), Nexus (1290), Mater
  Clínica (1014) e Ecomed (1222). Os médicos cadastrados com razão social
  "Mater Sul" ficam de fora de propósito.
- O handler de Particulares lê essa lista com o cliente do usuário, no mesmo
  padrão em que Sem lote lê a whitelist de fontes consideradas na meta (com
  cache curto em memória), e passa os ids para a consulta do MySQL.
- Parâmetro novo no endpoint de Particulares: `incluirSemNf=1`. Sem ele, as
  requisições desses locais saem da lista **e** do `valorTotal`. Com ele,
  entram, e cada linha diz se a clínica é "sem NF".
- Cada requisição devolvida ganha `localOrigem: { id, nome }` (nome fantasia)
  e `clinicaSemNf: boolean`.
- Endpoint novo de busca de locais de origem no apLIS por nome (para o modal),
  restrito a quem tem acesso a faturamento, devolvendo id, nome fantasia e
  razão social. Busca com LIKE escapado, limitada, sem paginação.
- Modal "Clínicas sem NF" na aba Particulares, no mesmo padrão do modal de
  "Considerada na meta": lista as marcadas, busca e adiciona, remove. Quem
  não tem `canManageBilling` vê o modal só para leitura.

**Emissão do título acompanha o refechamento do lote**

- A conferência com o apLIS (a mesma leitura que já roda no Atualizar da aba
  Títulos e alimenta os selos "Divergente do apLIS") passa também a calcular,
  para cada título não cancelado cujos lotes têm todos `aplis_id`, o
  **fechamento mais recente** entre os lotes no apLIS (`fatlote.DtaFechamento`).
  Quando esse fechamento cai num **mês posterior** ao da `data_emissao` do
  título, o título sai na resposta como **refechado**, com emissão atual e
  emissão nova. Diferença só de dia dentro do mesmo mês não conta (decidido em
  19/10/2026, igual à auditoria de 06/10 "mesmo mês: só o dia muda → manter";
  ex.: 6111, emissão 08/07 e fechamento 09/07).
- Título com algum lote ainda sem fechamento no apLIS não é refechado: o
  fechamento mais recente só é calculado com todos fechados.
- A conferência devolve `refechamentos: { idNota, lotes, emissaoAtual,
  emissaoNova }[]`, separado das divergências de recebido.
- No Atualizar, para quem tem permissão de edição, o front aplica os
  refechamentos por uma RPC nova que, numa transação só, atualiza
  `data_emissao` e (só quando a competência era o mês da emissão antiga)
  `competencia`. A RPC confere de novo no servidor que a nova data é de um
  mês posterior ao da atual, para ser idempotente e segura contra corrida. Exige
  `canManageBilling`. Devolve quantos e quais títulos mudaram.
- O aviso da página lista os títulos que mudaram (operadora, lote(s), emissão
  antiga → nova). Sem refechamentos, nenhum aviso.
- Vale para títulos do backfill e de emissão manual: a regra só olha se o
  apLIS tem um fechamento mais recente.
- Vencimento não muda (sai do RPS ou do envio, não da emissão), igual à
  migration de 06/10.
- Não há correção de dados à parte: os 5 lotes de outubro (6243, 6283, 6395,
  6553, 6774) entram no primeiro Atualizar depois do deploy. O 6111 continua
  em julho, porque esse é o fechamento dele no apLIS.

## Testing Decisions

Um bom teste aqui só olha comportamento externo: o que o endpoint devolve
para um dado estado do banco/Supabase (mockado), ou o que uma regra pura
devolve para uma entrada. Não testa a forma do SQL nem a ordem de chamadas
internas.

Seams, do mais alto para o mais baixo:

1. **Handler da conferência com o apLIS** (já testado com `bdLab` e Supabase
   mockados): casos de título refechado (fechamento em mês posterior →
   aparece com emissão nova), não refechado (fechamento no mesmo mês ou
   anterior → não aparece), vários lotes (usa o mais recente), lote sem fechamento (não
   aparece), cancelado (não aparece). Prior art: os testes atuais desse
   handler e de `conferenciaAplis`.
2. **Handlers de Particulares e Sem lote** com `bdLab` e Supabase mockados:
   repassam a lista de clínicas sem NF lida do Supabase; `incluirSemNf`
   liga e desliga a exclusão; parâmetros inválidos dão 400; falha ao ler a
   lista do Supabase dá erro claro e não uma lista sem filtro. Prior art: os
   testes de `faturamento-titulos-aplis-previa`, que já mockam as duas pontas.
3. **Regra pura de competência** quando a emissão muda (acompanha só se
   igual ao mês antigo). Prior art: `atualizarAplis.test.ts` e
   `emissaoTitulo.test.ts`.

O SQL do MySQL (janela até hoje, conjunto de eventos, exclusão por local de
origem) não tem teste automatizado no repositório. Ele é validado à mão
contra o banco real: ago/2026 em Sem lote sem os eventos 64/1023, e
Particulares de out/2026 sem ABAC/Nexus/Mater/Ecomed e sem exame cancelado.
A RPC de aplicação é validada à mão no Supabase: depois do Atualizar, a meta
de out/2026 sobe cerca de R$ 51,7 mil (lotes 6243, 6283, 6395, 6553, 6774).

## Out of Scope

- Contar por data de envio (`DtaEnvio`). Descartado: nula ou anterior ao
  fechamento em boa parte dos lotes.
- Contar na meta lote enviado mas ainda não fechado no apLIS (ex.: 7017,
  7018, 7045). Entra quando for fechado.
- Leitura ao vivo do apLIS para tirar o atraso de D-1 da réplica.
- Mudar a janela de Sem NF (lotes).
- Mudar a whitelist de fontes consideradas na meta (ex.: STM). É configuração
  que o cliente já consegue fazer na tela.
- Excluir os estados de espera 1020 e 1034.
- Corrigir a planilha do cliente (lotes faltando, números digitados errado,
  valores divergentes da AMHPDF).

## Further Notes

- Conferência de 19/10/2026, planilha × FlowLab para out/2026 (gap de
  R$ 94,2 mil): R$ 51,7 mil de lotes refechados com título no mês antigo;
  R$ 51,5 mil de lotes não fechados no apLIS ou ainda fora da réplica;
  R$ 1,4 mil de STM fora da whitelist; R$ 1,0 mil de valores diferentes na
  planilha; −R$ 11,5 mil de lotes no FlowLab que faltam na planilha (6990,
  6882, 7034). Esse material vai para o cliente num relatório à parte, com
  a orientação de fechar o lote no apLIS no dia do envio.
- A coluna "Data Faturamento" da planilha segue o último fechamento, não o
  envio. Exemplo: no lote 6553 o envio foi 24/09, o fechamento 14/10 e a
  planilha usa 14/10.
- A emissão mudar de mês altera o histórico de metas de meses passados. Isso
  foi aceito explicitamente.
