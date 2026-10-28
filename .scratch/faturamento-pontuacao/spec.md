# Faturamento: Pontuação do setor (Indicadores)

Status: done (7 issues concluídas e pontos base editáveis, 28/Out/2026); falta a conferência na tela das issues 01, 04 e 06

## Problem Statement

A coordenação do Faturamento avalia a equipe todo mês com duas planilhas do Google: **INDICADOR – FATURAMENTO** e **INDICADOR – GLOSA** (recurso de glosa). Cada planilha lista critérios com uma pontuação base e fecha num total de pontos do mês. Em setembro/2026 deram 14,2 e 8,3.

Hoje a planilha é montada à mão, contando em outras telas:

- convênios com guias sem lote;
- convênios recebidos sem glosa;
- faturado contra a meta;
- tarefas que cada pessoa deixou abertas.

Isso toma tempo e dá resultados que ninguém consegue refazer. O "faturado" da planilha (R$ 1.318.403,06) não bate com nenhuma medida do banco. A coluna "Pontos" diz uma coisa e o "Pontos base" do resumo diz outra. As regras também não estão escritas em lugar nenhum além da própria planilha.

## Solution

Um bloco **"Pontuação do setor"** na página **Faturamento → Indicadores**. Ele segue o mês escolhido no cabeçalho e mostra um resumo para cada **Frente**, no formato do "RESUMO" das planilhas: critério, pontos base, pontos atingidos e observação.

- **Frente Faturamento:** Renata, Rívia e Cleber.
- **Frente Recurso de Glosa:** Raquel (gerente) e Maria Eduarda.

O sistema calcula sozinho os critérios que têm dado:

- guias sem lote;
- zero glosa;
- meta mensal;
- meta superada;
- tarefas pendentes.

Os critérios que dependem de avaliação são **lançados** pela coordenação, com pontos digitados e observação obrigatória. Enquanto o mês está aberto, o bloco mostra uma **prévia ao vivo**. No **Fechamento da pontuação**, a coordenação congela os números do mês, e pode reabrir depois, com registro de quem reabriu.

As regras ficam escritas neste documento. Os pontos base da tabela abaixo são o padrão, no código; quem gerencia Faturamento pode ajustá-los na tela "Pontos base" (decisão de 28/10/2026, ver "Pontos base editáveis").

### Regras de pontuação

A pontuação é sempre do **mês M** escolhido. Pontos base por critério:

| Frente | Critério | Tipo | Pontos base | Regra |
|---|---|---|---|---|
| Faturamento | Guias sem lote | automático | 0,1 por convênio | Ver "Guias sem lote" abaixo. |
| Faturamento | Tarefas pendentes | automático | 1 | Ver "Tarefas pendentes" abaixo. |
| Faturamento | Domínio dos POPs | manual | 1 | Leitura dos POPs e domínio dos processos do setor. |
| Faturamento | Melhoria do setor | manual | 2 | Sugestão de melhoria, inovação, curso, treinamento ou leitura técnica aplicável ao setor. |
| Faturamento | Meta mensal | automático | 5 | Faturado do mês ≥ meta e < 115% da meta. |
| Faturamento | Zero glosa | automático | 0,5 por convênio | Ver "Zero glosa" abaixo. |
| Faturamento | Meta superada | automático | 10 | Faturado do mês ≥ 115% da meta. Substitui a "Meta mensal", não soma com ela. |
| Recurso de Glosa | Intrasetorial | manual | 0,1 | Suporte ao setor Comercial, quando solicitado e concluído. |
| Recurso de Glosa | Tarefas pendentes | automático | 1 | Mesma regra da frente Faturamento, com os membros desta frente. |
| Recurso de Glosa | Domínio dos POPs | manual | 1 | Igual ao da frente Faturamento. |
| Recurso de Glosa | Melhoria do setor | manual | 2 | Igual ao da frente Faturamento. |
| Recurso de Glosa | Refaturamento | manual | 5 | Resolver pendências de autorização ou faturamento, ou refaturar requisições. |
| Recurso de Glosa | Reversão de glosa | manual | 0,5 | Reverter glosas de valor expressivo ou de convênios complexos (Sul América, Fascal, Bradesco, Fusex, E-Vida, STJ). |
| Recurso de Glosa | Destravar recursos | manual | 10 | Liberar valores em análise há mais de 120 dias junto às auditorias, por convênio. |

O total da Frente é a soma dos pontos atingidos dos seus critérios.

**Meta mensal e Meta superada**

- O faturado é o da **meta mensal que já existe no FlowLab**: soma dos títulos não cancelados com emissão (fechamento do lote) no mês M, só das operadoras marcadas como "considerada na meta". É o mesmo número do widget "Meta mensal" das Faturas.
- A meta é a cadastrada para o mês M.
- Abaixo da meta: 0 nos dois critérios. A partir da meta e abaixo de 115% dela: 5 em "Meta mensal". A partir de 115%: 10 em "Meta superada" e 0 em "Meta mensal".
- Mês sem meta cadastrada: os dois critérios mostram "meta não cadastrada" e valem 0.

**Guias sem lote**

- Olha as requisições solicitadas no **mês anterior (M-1)** que estão sem lote. Na planilha, a pontuação de setembro avalia as guias de agosto.
- Usa a mesma regra da aba Pendências → Sem lote: as mesmas fontes consideradas, sem Particular e sem Cortesia.
- Entra na conta todo convênio que teve requisições solicitadas em M-1. Cada um com **zero** requisições ainda sem lote vale 0,1 ponto.
  - Só contam as requisições que a aba poderia listar como pendência: fonte considerada, com procedimento e em estado cobrável. Um convênio só com requisições em estado não cobrável (ex.: canceladas) fica fora, para não ganhar 0,1 de graça.
  - A pendência é a situação de hoje no backup. A prévia de um mês antigo mostra os lotes como estão agora, e o Fechamento congela o número.
- O detalhe lista os convênios "fechados sem pendência" e os "com pendência", com o número de requisições pendentes.

**Zero glosa**

- Olha os convênios que receberam pagamento no mês M, pelos recebimentos registrados no apLIS no mês.
- Um convênio é **sem glosa** quando nenhuma requisição recebida no mês foi glosada. Vale a mesma definição de glosa do módulo de Glosas e Recursos.
- Cada convênio sem glosa vale 0,5 ponto. Convênio que não recebeu nada no mês fica fora da conta.
- O detalhe lista os convênios com e sem glosa.

**Tarefas pendentes**

- Para cada membro da Frente, conta as tarefas do apLIS **endereçadas à pessoa** que estavam abertas às 23h59 do último dia do mês M. São abertas as que foram incluídas até esse momento, de qualquer mês, e não estavam concluídas nele.
- Também entram as tarefas do setor "GLOSA – FATURAMENTO" do apLIS, endereçadas ao setor. Quase nenhuma tarefa tem setor preenchido.
- A Frente ganha 1 ponto só se **todos** os membros tiverem zero pendências. O detalhe mostra o número de pendências de cada pessoa.

## User Stories

### Visualização

1. Como coordenadora do faturamento, quero ver a pontuação do mês na página Indicadores, para não montar mais as planilhas à mão.
2. Como coordenadora, quero que a pontuação siga o mês escolhido no cabeçalho, para olhar qualquer mês com o mesmo seletor.
3. Como usuária, quero que a pontuação abra no mês anterior, porque esse é o último mês fechado.
4. Como usuária no modo Período, quero ver o aviso "A pontuação é mensal; escolha um mês" no lugar dos pontos, para não confundir um intervalo livre com um mês.
5. Como coordenadora, quero um resumo para cada Frente (Faturamento e Recurso de Glosa), com critério, pontos base, pontos atingidos e observação, para ler do mesmo jeito que lia as planilhas.
6. Como coordenadora, quero o total de pontos de cada Frente em destaque, para saber o resultado do mês de relance.
7. Como coordenadora, quero ver se o mês está "em aberto (prévia)" ou "fechado em dd/mm por fulano", para saber se os números ainda podem mudar.
8. Como usuária, quero que o bloco siga o tema claro e escuro e mostre um esqueleto enquanto carrega, como o resto da página.
9. Como usuária, quero uma mensagem clara quando o banco do laboratório não responder, para não confundir falha com pontuação zerada.
10. Como usuária, quero o aviso "dados até dd/mm hh:mm" na prévia, porque os números automáticos vêm do backup do apLIS, que atrasa cerca de um dia.

### Critérios automáticos

11. Como coordenadora, quero ver na "Guias sem lote" a lista de convênios fechados sem pendência e com pendência, com o número de requisições pendentes, para cobrar quem precisa.
12. Como coordenadora, quero que a "Guias sem lote" olhe as requisições do mês anterior, para seguir a regra da planilha ("fechar o mês anterior com zero guias pendentes").
13. Como coordenadora, quero que a "Guias sem lote" use as mesmas fontes da aba Pendências, sem Particular nem Cortesia, para os dois lugares mostrarem o mesmo.
14. Como coordenadora, quero ver na "Zero glosa" os convênios recebidos com e sem glosa no mês, para conferir os 0,5 ponto por convênio.
15. Como coordenadora, quero que convênio sem recebimento no mês fique fora da "Zero glosa", para não ganhar ponto sem ter sido pago.
16. Como coordenadora, quero ver a meta do mês, o faturado e o percentual atingido, para entender por que a frente ganhou 0, 5 ou 10 pontos.
17. Como coordenadora, quero que superar a meta em 15% dê só os 10 pontos, sem somar os 5, como manda a planilha.
18. Como coordenadora, quero ver "meta não cadastrada" quando o mês não tiver meta, para cadastrar antes de fechar.
19. Como coordenadora, quero que o faturado da meta seja o mesmo do widget "Meta mensal" das Faturas, para os dois números nunca divergirem.
20. Como coordenadora, quero ver as tarefas pendentes de cada membro no último dia do mês, para saber quem deixou tarefa aberta.
21. Como coordenadora, quero que a Frente só ganhe o ponto das tarefas se todos os membros tiverem zero pendências, como na planilha.
22. Como gerente (Raquel), quero ser contada nas tarefas pendentes da frente Recurso de Glosa como qualquer membro.

### Critérios manuais

23. Como coordenadora, quero lançar os pontos dos critérios manuais de cada Frente, digitando os pontos direto, porque hoje a nota depende de avaliação.
24. Como coordenadora, quero que a observação seja obrigatória em todo lançamento manual, para o motivo da nota ficar registrado.
25. Como coordenadora, quero ver o "Pontos base" ao lado do campo de lançamento, como referência.
26. Como coordenadora, quero corrigir um lançamento enquanto o mês está aberto, para ajustar antes de fechar.
27. Como coordenadora, quero saber quem lançou e quando, para ter histórico.
28. Como coordenadora, quero que um critério manual sem lançamento apareça como "não lançado", com 0 ponto, para eu ver o que falta antes de fechar.

### Fechamento

29. Como coordenadora, quero fechar a pontuação do mês, para congelar os números automáticos e os lançamentos.
30. Como coordenadora, quero que, depois de fechado, o mês mostre sempre os números congelados, mesmo se uma guia entrar num lote ou uma glosa chegar depois.
31. Como coordenadora, quero reabrir um mês fechado, com o registro de quem reabriu e quando, para corrigir um erro.
32. Como coordenadora, quero que o FlowLab não me deixe fechar um mês cujo último dia ainda não chegou ao backup do apLIS, para não congelar dado incompleto.
33. Como coordenadora, quero que, ao reabrir, a prévia volte a ser calculada ao vivo e os lançamentos manuais continuem lá.

### Membros

34. Como coordenadora, quero manter a lista de membros de cada Frente, para incluir ou tirar alguém sem pedir mudança no sistema.
35. Como coordenadora, quero escolher o membro pelo usuário do apLIS, porque é por ele que as tarefas são contadas.
36. Como coordenadora, quero que o fechamento guarde quem eram os membros naquele mês, para uma mudança na lista não mexer em meses já fechados.

### Permissões

37. Como usuário com permissão de gerenciar Faturamento, quero lançar pontos, fechar, reabrir e editar membros.
38. Como usuário que só vê Faturamento, quero ver a pontuação sem os botões de lançar, fechar, reabrir e editar.
39. Como usuário sem permissão de Faturamento, quero não ver a pontuação, como o resto da página.

### Regras

40. Como coordenadora, quero as regras de pontuação escritas num documento, para consultar e saber o que mudar quando a regra mudar.

## Implementation Decisions

- **Glossário (CONTEXT.md).** Entram três termos:
  - **Pontuação do setor:** os pontos do mês de cada Frente.
  - **Frente:** Faturamento ou Recurso de Glosa, cada uma com sua lista de membros e seus critérios.
  - **Fechamento da pontuação:** congelar o mês.
- **Módulo puro de pontuação** (servidor, ao lado do módulo dos Indicadores). Concentra toda a regra e não acessa banco nem relógio.
  - **Entrada:** o mês, os **fatos** do mês, os **lançamentos manuais** e os **membros** de cada Frente.
  - **Fatos:**
    - faturado e meta, sendo a meta nula quando não está cadastrada;
    - convênios de M-1 com o número de requisições sem lote;
    - convênios recebidos em M, cada um com a marcação "teve glosa";
    - pendências de tarefa por usuário do apLIS.
  - **Saída:** para cada Frente, os critérios na ordem da tabela de regras. Cada critério traz tipo, pontos base, pontos atingidos, observação ou motivo e um detalhe próprio (listas de convênios, meta × faturado × %, pendências por pessoa). A Frente traz também o total.
  - **Regras e pontos base padrão ficam em constantes nesse módulo**, numa única tabela de critérios: chave, Frente, rótulo, tipo e pontos base. Os pontos base ajustados na tela entram como entrada do módulo e substituem o padrão do critério; as regras continuam só no código.
  - **Arredondamento:** os pontos têm uma casa decimal, e as somas são arredondadas no fim, para 0,1 × 12 dar 1,2 exato.
- **Leitura dos fatos** (camada de acesso ao backup do apLIS e ao Supabase). Só lê e achata; não aplica regra de pontos.
  - **Guias sem lote:** reutiliza a regra da consulta da aba Pendências → Sem lote (mesmo filtro de fontes, sem Particular e Cortesia), agrupada por fonte pagadora, com solicitação em M-1.
  - **Zero glosa:** requisições com recebimento em M, agrupadas por fonte pagadora, com a marcação de glosa pela definição já usada no módulo de Glosas e Recursos.
  - **Tarefas:** contagem na tabela de tarefas do apLIS por destinatário (o usuário do apLIS), mais as do setor "GLOSA – FATURAMENTO". Uma tarefa conta como aberta no fim de M quando foi incluída até o fim de M e não estava concluída até ele. Só os membros das Frentes entram na consulta.
  - **Meta:** reaproveita a meta mensal existente (a tabela de metas e a função que calcula o faturado do mês por emissão). Não se cria uma segunda meta.
- **Persistência no Supabase:**
  - **Membros das Frentes:** Frente, usuário do apLIS (id e nome), ativo. Valores iniciais:
    - Faturamento: Renata Queiroz Bento (235), Rívia Freire Araujo Barretos Borba (202) e Cleber Kendel de Andrade (256);
    - Recurso de Glosa: Raquel dos Santos Avelino (224) e Maria Eduarda Fonseca Bomfim (173).
  - **Lançamentos manuais:** ano, mês, Frente, chave do critério, pontos, observação (obrigatória, não vazia), quem lançou e quando. Há um lançamento por mês, Frente e critério; lançar de novo substitui o anterior e guarda quem alterou.
  - **Fechamentos:** ano e mês (único), o resumo inteiro congelado em JSON (fatos, membros, lançamentos e pontos), a data do "dados até" usada, quem fechou e quando. Ao reabrir, o fechamento sai de vigor e o histórico guarda quem reabriu e quando. Um mês pode ser fechado de novo depois.
  - **Proteção no banco (RLS):**
    - leitura das três tabelas: quem vê Faturamento;
    - escrita: só quem gerencia Faturamento;
    - lançamentos de mês fechado: o banco recusa a escrita, para a regra não depender só da tela.
- **API:** um handler novo no roteador do Faturamento, no padrão dos Indicadores.
  - **GET pontuação do mês:** se o mês está fechado, devolve o resumo congelado e quem fechou. Se não, calcula a prévia ao vivo, com "dados até". No modo Período a tela nem chama.
  - **Ações de quem gerencia Faturamento:** lançar ou alterar um critério manual, fechar o mês e reabrir o mês.
  - **Fechar** recalcula a prévia no servidor e grava esse resultado. O que a tela mostrava não é usado. O fechamento é recusado quando o "dados até" do backup ainda não chegou ao último dia do mês.
  - **Erros:** permissão negada dá 403. Mês inválido dá 400. Lançamento sem observação ou em mês fechado dá 400 ou 409, com mensagem clara. Banco do laboratório fora do ar dá 503, como nos Indicadores.
- **Tela:** um bloco "Pontuação do setor" na página Indicadores, abaixo dos rankings.
  - **Conteúdo:** um card por Frente com total em destaque, tabela de critérios (base, atingido, observação) e um detalhe expansível por critério automático.
  - **Botões:** lançar (em cada critério manual), "Fechar pontuação"/"Reabrir" e "Membros". Só aparecem para quem gerencia Faturamento.
  - **Estado do mês:** o selo "Prévia" ou "Fechado em dd/mm por fulano".
  - **Modo Período:** o bloco mostra o aviso da pontuação mensal.

## Testing Decisions

- **Uma seam só: o módulo puro de pontuação.** Os testes entregam fatos, lançamentos e membros montados à mão e conferem o resumo devolvido. Não importa como o módulo calcula por dentro. Os valores esperados são literais tirados das regras deste documento e dos exemplos das planilhas, nunca recalculados do jeito que o código calcula.
- **Casos que os testes cobrem:**
  - **Meta:**
    - abaixo da meta: 0 e 0;
    - igual à meta: 5;
    - entre 100% e 115%: 5;
    - exatamente 115%: 10 em "meta superada" e 0 em "meta mensal";
    - sem meta cadastrada: "meta não cadastrada", 0.
  - **Guias sem lote:** 12 convênios zerados dão 1,2, sem erro de ponto flutuante. Convênio com pendência fica na lista "com pendência".
  - **Zero glosa:** 6 convênios sem glosa dão 3. Convênio sem recebimento fica fora. Convênio com uma única requisição glosada perde o ponto.
  - **Tarefas:** todos os membros zerados dão 1. Um membro com 1 pendência zera o critério da Frente. As pendências aparecem por pessoa. A Raquel conta na frente Recurso de Glosa.
  - **Manuais:** critério sem lançamento aparece como "não lançado", com 0. O ponto lançado entra no total.
  - **Total da Frente:** soma de todos os critérios, com uma casa decimal.
- **Fora dos testes automatizados:**
  - **Consultas SQL e Supabase:** conferidas à mão contra setembro/2026, como nos Indicadores, rodando a consulta no backup e comparando com os números levantados no grilling. Por exemplo, as tarefas de setembro: Renata com 1.378 recebidas e 1.262 concluídas até 30/09, Rívia com 934 e 925, Cleber com 804 e 804.
  - **Permissão e congelamento:** garantidos pela RLS e pela checagem do handler, e conferidos à mão.
- **Prior art:** os testes do módulo dos Indicadores (`indicadoresFaturamento.test.ts`), com uma fábrica de linha com valores padrão e um `describe` por regra.

## Out of Scope

- **Regras editáveis na tela.** Só os pontos base são editáveis (ver "Pontos base editáveis"); a regra de cada critério continua no código e neste documento.
- **Pontuação por pessoa.** A pontuação é da Frente. Só as tarefas pendentes aparecem por pessoa.
- **Automatizar refaturamento e "destravar recursos há mais de 120 dias".** Não há fonte de dado hoje. São os próximos candidatos a automatizar; o refaturamento talvez venha do status 44 "REFATURAMENTO" no histórico do apLIS.
- **Automatizar a reversão de glosa.** Há dado, mas ele conta pelo mês do lote original, e o histórico de mudanças só existe desde outubro/2026. Fica manual por enquanto.
- **Integração com o "Lab Points"** ou qualquer sistema externo de pontos.
- **Recalcular meses fechados quando a regra mudar.** Mês fechado mantém o resultado da regra vigente quando foi fechado.

## Further Notes

- **Origem:** planilhas "INDICADOR – FATURAMENTO" e "INDICADOR – GLOSA" (Google Planilhas), de setembro/2026, e o grilling de 27/10/2026.
- **Divergências das planilhas, decididas aqui:**
  - Valem os "Pontos base" do resumo, não a coluna "Pontos" da esquerda. A coluna "Pontos" dizia, por exemplo, 1 ponto por convênio nas guias sem lote e 3 no zero glosa.
  - Nos critérios manuais, a nota é digitada pela coordenação. Na planilha, refaturar 1 guia deu 3 com base 5, e reverter R$ 4.087,31 deu 2 com base 0,5.
- **Faturado da planilha sem explicação:** o R$ 1.318.403,06 não bate com nenhuma medida do banco. Em setembro:

  | Medida | Valor |
  |---|---|
  | Criação do lote | R$ 1.379.996 |
  | Fechamento do lote | R$ 1.241.974 |
  | Envio do lote | R$ 1.197.240 |
  | Meta por emissão | R$ 1.114.775 |

  A pontuação usa a meta por emissão.
- **Meta de teste no ar:** a meta cadastrada para setembro/2026 é R$ 5.000,00, um valor de teste. A coordenação precisa cadastrar as metas reais antes de fechar qualquer mês.
- **Outubro/2026 fora do normal nos Indicadores:** está com R$ 3,92 mi pela criação do lote, cerca de três vezes o normal. Investigar à parte; não afeta esta spec, que usa a meta por emissão.
- **A gerente se avalia:** a Raquel é membro da frente Recurso de Glosa e também quem lança e fecha. Foi aceito no grilling.

## Pontos base editáveis (28/10/2026)

Mudança pedida depois da implementação: o "Pontos base" passa a ser editável na tela.

- **Todos os critérios**, manuais e automáticos. Nos automáticos o valor muda o cálculo (por convênio em Guias sem lote e Zero glosa; o valor cheio em Tarefas pendentes, Meta mensal e Meta superada). Nos manuais é a referência mostrada ao lado do lançamento; os pontos continuam os lançados.
- **Um valor por Frente e critério, sem vigência por mês.** Vale para a prévia de todo mês aberto. Mês fechado não muda, porque o Fechamento congela o resumo inteiro (agora também com os ajustes em vigor); para recalcular, reabrir e fechar de novo.
- **Tabela `fat_pontuacao_pontos_base`** (migration `20261028120000`): só os critérios ajustados têm linha; sem linha vale o padrão do código. Quem alterou e quando, pelo trigger. Leitura para quem vê Faturamento, escrita para quem gerencia. Sem DELETE: voltar ao padrão é gravar o valor padrão.
- **API:** `GET ?consulta=pontosBase` (todos os critérios, com o padrão e o valor em vigor) e `POST acao: alterarPontosBase`, só para canManageBilling. Valor de 0 a 9999,9, uma casa.
- **Tela:** botão "Pontos base" ao lado de "Membros", com um campo por critério, o padrão, quem alterou por último e "voltar ao padrão".
