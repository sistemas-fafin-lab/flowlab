# Spec: chamado do LAB-BRAIN passa pela aprovação da EVA

**Status:** ready-for-agent

Continua a `.scratch/lab-brain-chamados/spec.md` e **substitui a D2 dela**. Nasceu da issue `.scratch/lab-brain-chamados/issues/07-chamado-lab-brain-na-aprovacao-da-eva.md`, fechada no grilling de 13/11/2026.

## Problem Statement

O LAB-BRAIN já abre chamados de TI no FlowLab em nome de quem pediu. Hoje o chamado entra direto na triagem de Solicitações de TI, pendente e fora do Kanban, igual ao aberto pela tela, e espera alguém do TI abrir, ler e promover.

O TI quer que esses pedidos passem pela EVA. Eles chegam de áreas que não conhecem o board, a qualquer hora, escritos por um agente. Alguém precisa decidir se cada um entra no Kanban, em que coluna, com que prioridade, com quem e para quando. Hoje essa decisão é toda manual e fica fora da fila de aprovação onde o TI já decide o que a EVA propõe.

Quando o TI recusa um pedido, o solicitante também não fica sabendo por quê. O LAB-BRAIN só recebe o motivo de um chamado resolvido, e não o de um cancelado.

## Solution

Quando o LAB-BRAIN abre um chamado, ele nasce na hora como hoje, com código, solicitante e o selo "via LAB-BRAIN", pendente e fora do Kanban. Junto, a EVA lê o pedido e deixa uma **sugestão de promoção** na fila de aprovação dela, em EVA → Sugestões. A sugestão traz a coluna, a prioridade, os responsáveis do TI e o prazo que a EVA propõe, com uma justificativa curta.

Quem aprova sugestões da EVA é avisado no sino, como já acontece com as outras sugestões. Depois revisa, ajusta se quiser e decide:

- **Aprovar:** a EVA coloca o chamado no Kanban com a proposta.
- **Rejeitar:** o motivo é obrigatório, e a tela avisa que ele vai para o solicitante. O chamado é cancelado, e o motivo vira a resolução que o LAB-BRAIN repassa ao solicitante.

Se a EVA não conseguir analisar, a sugestão nasce mesmo assim, com uma proposta mínima, e nenhum chamado fica parado em silêncio. Se alguém do TI promover o chamado pela tela de sempre antes da decisão, a sugestão sai da fila sozinha.

Para o LAB-BRAIN, nada muda no contrato: ele continua recebendo `{ id, codigo }` na criação e consultando a situação pelo `id_externo`. A única novidade é que um chamado cancelado também traz a resolução.

## User Stories

1. Como solicitante de uma área, quero que meu pedido feito ao LAB-BRAIN vire um chamado na hora, com código, para ter algo concreto para acompanhar.
2. Como solicitante, quero que o chamado fique no meu nome, para acompanhá-lo pela tela do FlowLab e receber os avisos de sempre.
3. Como LAB-BRAIN, quero continuar recebendo `201 { id, codigo }` na criação, para não mudar a integração que já fiz.
4. Como LAB-BRAIN, quero que a criação responda na hora, sem esperar a análise da EVA, para não estourar o meu tempo limite de chamada.
5. Como LAB-BRAIN, quero que reenviar o mesmo `id_externo` continue devolvendo o chamado que já existe, sem criar outra sugestão, para poder repetir com segurança depois de uma falha de rede.
6. Como LAB-BRAIN, quero que a criação dê certo mesmo se a sugestão da EVA não puder ser gravada, para que um problema interno do FlowLab não faça o solicitante perder o pedido.
7. Como LAB-BRAIN, quero que, enquanto o chamado espera a decisão, a consulta mostre situação pendente e nenhuma coluna, para dizer ao solicitante que o TI ainda vai avaliar.
8. Como LAB-BRAIN, quero que, depois da aprovação, a consulta mostre a coluna, a prioridade e o responsável, para dizer ao solicitante quem vai atender.
9. Como LAB-BRAIN, quero que, depois da rejeição, a consulta mostre a situação cancelada com o motivo em `resolucao`, para explicar ao solicitante por que o pedido não seguiu.
10. Como membro do TI, quero que todo chamado novo do LAB-BRAIN gere uma sugestão na fila da EVA, para decidir esses pedidos no mesmo lugar onde decido o resto do que a EVA propõe.
11. Como quem aprova sugestões, quero ser avisado no sino quando nasce uma sugestão de um chamado do LAB-BRAIN, pelo mesmo aviso das outras sugestões, sem canal novo.
12. Como quem aprova, quero ver na sugestão o selo "via LAB-BRAIN", o código, o título, a descrição e o solicitante, para entender o pedido sem abrir outra tela.
13. Como quem aprova, quero ver a coluna, a prioridade, os responsáveis e o prazo que a EVA propõe, com uma justificativa curta, para decidir rápido.
14. Como quem aprova, quero editar coluna, prioridade, responsáveis e prazo antes de aprovar, para corrigir a proposta sem rejeitar.
15. Como quem aprova, quero que aprovar coloque o chamado no Kanban com a proposta, numa operação só, para que não fique nada pela metade.
16. Como quem aprova, quero que rejeitar exija um motivo, para que o solicitante sempre saiba por quê.
17. Como quem aprova, quero que a tela me avise que o motivo da rejeição vai para o solicitante pelo LAB-BRAIN, para escrever algo que eu diria a ele.
18. Como quem aprova, quero que rejeitar cancele o chamado na mesma operação, para que não sobre um chamado pendente de um pedido recusado.
19. Como quem aprova pelo WhatsApp da EVA, quero que aprovar e rejeitar uma sugestão de chamado do LAB-BRAIN funcionem igual à tela, para decidir de onde estiver.
20. Como membro do TI, quero que o chamado continue aparecendo em Solicitações de TI enquanto espera a decisão, para não perder de vista o que entrou.
21. Como membro do TI, quero poder promover o chamado pela tela de sempre antes da decisão, e que a sugestão saia da fila como substituída, para não precisar decidir duas vezes.
22. Como membro do TI, quero que qualquer forma de colocar o chamado no Kanban por fora da fila tire a sugestão de lá, inclusive formas que ainda não existem, para que a fila não mostre pedidos já resolvidos.
23. Como quem aprova, quero que a EVA só proponha como responsáveis pessoas do TI, para não receber sugestões impossíveis.
24. Como quem aprova, quero que a EVA proponha também um prazo quando o pedido der base para isso, para não precisar calcular do zero.
25. Como quem aprova, quero que, se a EVA não conseguir analisar o pedido, a sugestão nasça mesmo assim na coluna "A Fazer", com a prioridade enviada e um aviso de que não houve análise, para que nenhum pedido fique sem decisão.
26. Como administrador, quero que o texto do chamado entre na análise da EVA como dado, nunca como instrução, para que um pedido malicioso não mude o comportamento dela (D12 da spec anterior).
27. Como administrador, quero que a análise use o mesmo caminho de IA da EVA, com o registro de chamadas que já existe, para acompanhar custo e falhas num lugar só.
28. Como administrador, quero que só chamados do LAB-BRAIN criados depois do deploy gerem sugestão, para não encher a fila com chamados antigos.
29. Como administrador, quero que os chamados abertos pela tela continuem sem passar pela EVA, para não mudar o trabalho do TI além do pedido.
30. Como administrador, quero que aprovar, rejeitar e substituir apliquem tudo dentro do banco, nas RPCs e no trigger, para que a tela, o WhatsApp e futuros caminhos se comportem igual.
31. Como administrador, quero que quem não pode aprovar sugestões da EVA seja barrado nas RPCs de promoção e de rejeição, porque elas ignoram a RLS de chamados.
32. Como desenvolvedor do LAB-BRAIN, quero o guia e o documento da integração atualizados, para saber que agora o TI avalia antes e que o cancelado traz resolução.

## Implementation Decisions

### O fluxo

- **Nova D2:** o chamado do LAB-BRAIN nasce na hora, como hoje, e uma sugestão de promoção nasce junto, na fila da EVA. Aprovar promove o chamado e rejeitar o cancela. A versão anterior da D2 dizia que ele não passava pela fila da EVA, e essa regra cai.
- **Escopo:** vale só para chamados com origem `lab-brain` criados a partir do deploy. Não há backfill. Os chamados da tela não mudam.

### Banco

- **Sugestão:** a fila de sugestões da EVA ganha o tipo `promover_card` e a origem `lab-brain`, nas restrições de valores aceitos. A sugestão aponta para o chamado pelo vínculo de card que já existe. Há no máximo uma sugestão `promover_card` por chamado, garantida por índice único parcial.
- **Proposta (JSON da sugestão):**
  - coluna do Kanban;
  - prioridade;
  - responsáveis, como ids de pessoas do TI;
  - prazo, no formato que as outras propostas já usam;
  - justificativa curta;
  - marca de "sem análise da EVA" quando vier da regra fixa.

  Projeto e sprint não fazem parte da proposta.
- **Aprovação:** a RPC de aprovação que já existe passa a tratar `promover_card`. Ela tira o chamado de "fora do Kanban" e aplica a coluna, a prioridade, os responsáveis e o prazo, na mesma transação. Usa a proposta editada por quem aprova, quando houver. A situação do chamado segue a regra que a RPC já usa para a coluna: concluído vira resolvido, e o resto continua pendente ou em andamento.
- **Rejeição:** a RPC de rejeição que já existe, que já exige motivo, passa a cancelar o chamado na mesma transação quando a sugestão é `promover_card`. O motivo vira a resolução do chamado. Vale para o caminho da tela e para o "como" do WhatsApp.
- **Permissão:** as duas RPCs mantêm a conferência de quem pode aprovar sugestões da EVA na primeira linha. Como são `SECURITY DEFINER`, essa conferência é a única barreira.
- **Substituição:** um trigger nos chamados marca como substituída a sugestão `promover_card` pendente quando o chamado sai de "fora do Kanban" por qualquer caminho que não seja a RPC de aprovação. A aprovação não dispara a substituição da própria sugestão.

### Rota de criação

- **Contrato:** não muda. Mesmos campos, mesmas validações, mesma cota e as mesmas respostas `201`/`200`.
- **Análise em segundo plano:** depois de gravar um chamado **novo**, a rota agenda a análise com o `waitUntil` e responde `201` sem esperar. O reenvio (`200`) não agenda nada.
- **Montagem da sugestão:**
  - A análise usa o caminho de IA estruturada da EVA (Claude com o Gemini de reserva) e o registro de chamadas que já existe.
  - O prompt é versionado e trata título e descrição como dado, nunca como instrução.
  - O contexto mandado para a IA é a lista de membros do TI e o pedido. A IA não recebe o board inteiro.
  - A saída é validada com a mesma regra das outras sugestões: responsáveis fora do TI e colunas ou prioridades desconhecidas são descartados.
- **Regra fixa de reserva:** se a IA falhar, der timeout ou devolver algo inválido, a sugestão nasce assim:
  - coluna "A Fazer";
  - a prioridade enviada pelo LAB-BRAIN;
  - sem responsável e sem prazo;
  - com a marca de "sem análise".
- **Falha ao gravar a sugestão:** é registrada no log e não muda a resposta, que já saiu. O chamado continua visível em Solicitações de TI.
- **Aviso:** a gravação da sugestão dispara o aviso do sino para quem aprova, pelo mesmo caminho das sugestões de reunião e de chat.

### Rota de consulta

- **Contrato:** não muda. A única diferença é que `resolucao` passa a sair também quando a situação é `cancelled`, além de `resolved`.
- **Enquanto espera:** a consulta mostra `situacao: "pending"` e `coluna_kanban: null`. Não há campo novo de "aguardando aprovação".

### Tela

- **Sugestão `promover_card` em EVA → Sugestões:**
  - mostra o selo "via LAB-BRAIN", o código, o título, a descrição e o solicitante;
  - mostra a proposta e a justificativa, e a marca de "sem análise" quando houver;
  - permite editar coluna, prioridade, responsáveis e prazo, como as outras sugestões;
  - na rejeição, o campo de motivo avisa que o texto vai para o solicitante pelo LAB-BRAIN.
- **Solicitações de TI:** continuam iguais. O chamado aparece com o selo e pode ser promovido manualmente.

### Ordem de entrega

1. Banco: tipo, origem, aprovação, rejeição, trigger.
2. A rota de criação gera a sugestão pela regra fixa, e a consulta passa a mandar `resolucao` no `cancelled`.
3. A tela de Sugestões.
4. A análise com IA, com a regra fixa de reserva.
5. Documentação e teste.

A 2 e a 3 vão juntas para produção: sem a tela, quem rejeita não vê o aviso de que o motivo sai para o solicitante.

## Testing Decisions

- **O que é um bom teste:** só comportamento externo. Status HTTP, corpo da resposta e o que fica gravado nas tabelas, e não como a rota chega lá. Nada de testar o prompt palavra por palavra nem a ordem interna das chamadas.
- **Rota de criação** (ponto de teste que já existe, Supabase falso, IA simulada no gerador estruturado, trabalho em segundo plano executado na hora). Casos:
  - chamado novo gera uma sugestão `promover_card` pendente, com origem `lab-brain`, ligada a ele;
  - a proposta da IA é gravada já validada, e um responsável fora do TI some;
  - IA com erro ou saída inválida gera a sugestão da regra fixa, com a marca "sem análise";
  - reenvio não gera segunda sugestão;
  - falha ao gravar a sugestão mantém o `201`;
  - o texto do chamado chega à IA como dado.
- **Rota de consulta** (ponto de teste que já existe). O cancelado traz `resolucao`, e o pendente continua sem.
- **Postgres de teste** (ponto de teste novo). Um script SQL com verificações, rodado no banco de teste numa transação que termina em `ROLLBACK`, como orienta o guia do banco de teste. Casos:
  - aprovar promove com a proposta, inclusive a editada;
  - rejeitar sem motivo é recusado;
  - rejeitar com motivo cancela e grava a resolução;
  - quem não pode aprovar é barrado nas duas RPCs;
  - promover por fora marca a sugestão como substituída;
  - aprovar não marca a própria sugestão como substituída;
  - uma segunda sugestão `promover_card` para o mesmo chamado é recusada.
- **Tela:** conferência manual no roteiro de teste local. Não há teste de componente parecido no projeto para seguir de modelo.
- **Testes parecidos que já existem:**
  - os testes de rota do LAB-BRAIN (criação e consulta), com o Supabase falso;
  - o teste da análise de reunião da EVA, com o gerador estruturado simulado e o aviso a quem aprova;
  - os ensaios de migration com `ROLLBACK` descritos no guia do banco de teste.

## Out of Scope

- Chamados abertos pela tela passarem pela EVA.
- Backfill de sugestões para chamados do LAB-BRAIN que já existem.
- Webhook ou aviso ativo ao LAB-BRAIN quando a decisão sai. Ele continua consultando.
- Campo novo na consulta, do tipo "aguardando aprovação".
- Projeto e sprint na proposta da EVA.
- Aviso novo por WhatsApp ou e-mail a quem aprova. Fica só o sino que já existe.
- A migração da EVA para a camada de permissões por agente (issue 06 da spec anterior).

## Further Notes

- **Antes de produção:** as migrations vão primeiro para o banco de teste, como manda o guia do banco de teste, com ensaio em `ROLLBACK` e registro no histórico. Depois vão para produção.
- **Documento do dev do LAB-BRAIN:** o documento entregue em 13/11/2026 continua válido no contrato. Precisa ganhar duas notas: o TI avalia cada pedido antes de ele entrar no Kanban, e `resolucao` também aparece no cancelado.
- **Chamados de teste:** o IT-132 e o IT-133, no banco de teste, devem ser cancelados antes de testar este fluxo. Assim não se confundem com chamados que deveriam ter sugestão.
