# Faturamento: Calendário de envios

Status: ready-for-agent

## Problem Statement

As faturistas enviam os lotes de cada convênio dentro de uma janela que o próprio convênio define. Por exemplo: "1 ao 15", "1º ao 5º dia útil", "último dia útil do mês" ou "todos os dias". Essas janelas estão numa planilha. O planejamento do mês é feito à mão num calendário do Google: a equipe escolhe os dias de cada convênio e põe os de "todos os dias" nos dias que estão mais vazios.

Isso causa três problemas:

- **A coordenação não sabe no mesmo dia se a demanda foi feita.** O FlowLab lê o apLIS por um backup com 24 h de atraso. Por isso, um lote enviado hoje só aparece amanhã.
- **Ninguém avisa quando um envio atrasa.** O atraso só aparece se alguém conferir o calendário contra os lotes.
- **As janelas mudam com frequência.** Quando um convênio muda o prazo, é preciso refazer à mão o calendário do mês e do mês seguinte.

Além disso, as faturistas precisam ver Contas a Receber e o calendário. Hoje, porém, a permissão "Visualizar Faturamento" abre todas as telas do Faturamento juntas.

## Solution

Um item novo no menu: **Faturamento → Calendário de envios**.

- **Painéis Hoje e Amanhã.** Amanhã é sempre o próximo dia útil. Cada painel lista os convênios a enviar naquele dia, cada um com um checkbox. Ao marcar, a faturista informa a data do envio, que já vem preenchida com hoje.
- **Bloco Atrasados.** Fica ao lado dos painéis e tem dois níveis:
  - 🟡 **Atrasado**: passou a data agendada.
  - 🔴 **Fora do prazo do convênio**: acabou a janela da regra.
- **Calendário do mês.** Mostra de segunda a sexta, com os feriados destacados. Cada dia lista os agendamentos com a cor do status, e dá para mover, adicionar e remover agendamentos.
- **Lista "Pode enviar qualquer dia".** Mostra os convênios de "todos os dias", que a equipe agenda onde quiser.
- **Cadastro das Regras de envio por convênio.** Também traz a lista de feriados.
- **Botão "Gerar sugestão de \<mês\>".** Fica liberado a partir do dia 15. Ele monta o mês seguinte a partir das regras e preserva o que já foi ajustado à mão.
- **Confirmação automática no dia seguinte.** O sistema lê os lotes do backup. Se o agendamento já estava marcado, ele ganha o selo "confirmado no apLIS". Se ninguém tinha marcado, o sistema marca sozinho, com a data do lote. Lotes que não casam com nenhum agendamento vão para a lista "Envios não planejados".
- **Contador no menu.** O item do menu mostra um contador vermelho com os atrasados.
- **Painéis no Dashboard de Contas a Receber.** Os mesmos painéis Hoje e Amanhã aparecem compactos no topo dessa aba.
- **Permissões.** A visualização do Faturamento passa a ter uma permissão por tela. Assim, as faturistas podem ficar só com Contas a Receber (leitura) e com o Calendário (gestão).

## User Stories

### Hoje, amanhã e atrasados

1. Como faturista, quero ver ao abrir a tela os convênios agendados para hoje, para saber o que preciso enviar.
2. Como faturista, quero ver os convênios do próximo dia útil (numa sexta, os de segunda), para me preparar.
3. Como faturista, quero marcar um convênio de hoje como enviado com um clique, para registrar que a demanda foi feita.
4. Como faturista, quero informar a data real do envio ao marcar (hoje por padrão, mas editável), para registrar um envio feito em outro dia.
5. Como faturista, quero desmarcar um envio marcado por engano, para corrigir o registro.
6. Como coordenação, quero ver quem marcou cada envio e quando, para saber quem fez a demanda.
7. Como coordenação, quero ver o histórico de cada agendamento (marcou, desmarcou, mudou de data), para entender o que aconteceu.
8. Como coordenação, quero um bloco "Atrasados" com os agendamentos cuja data passou sem envio, para cobrar a entrega.
9. Como coordenação, quero distinguir "atrasado" de "fora do prazo do convênio", para priorizar o que já estourou a janela.
10. Como faturista, quero resolver um atraso no próprio bloco, marcando como enviado com a data real ou reagendando, para limpar a pendência.
11. Como coordenação, quero um contador vermelho no item "Calendário de envios" do menu, para notar atrasos sem abrir a tela.
12. Como coordenação, quero ver os painéis Hoje e Amanhã no topo do Dashboard de Contas a Receber, para acompanhar os envios na tela que já uso.

### Calendário do mês

13. Como faturista, quero um calendário mensal de segunda a sexta com os convênios de cada dia, para ver o planejamento do mês inteiro.
14. Como faturista, quero navegar para o mês anterior e para o seguinte, para conferir o passado e planejar o próximo.
15. Como faturista, quero cores diferentes por status (pendente, enviado, atrasado, fora do prazo), para entender o mês num relance.
16. Como faturista, quero ver os feriados destacados no calendário, para não agendar envio neles.
17. Como faturista, quero mover um agendamento para outro dia, para seguir uma mudança pontual do convênio.
18. Como faturista, quero adicionar um agendamento avulso num dia (por exemplo, "Bradesco hoje também"), para registrar um envio extra.
19. Como faturista, quero remover um agendamento que não vai acontecer, para manter o calendário limpo.
20. Como faturista, quero ver a observação do convênio ("XML junto", "física e online") no detalhe e no tooltip do agendamento, para não esquecer a particularidade dele.
21. Como faturista, quero ver no detalhe do agendamento AMHPDF a lista dos convênios que ele cobre, para saber o que vai junto.
22. Como faturista, quero uma lista "Pode enviar qualquer dia" com os convênios de "todos os dias", para agendá-los no dia que eu escolher.
23. Como faturista, quero agendar fora da janela da regra sem ser bloqueada, porque as regras não são rígidas.
24. Como coordenação, quero um selo cinza "fora da janela da regra" nesses agendamentos, para saber que fugiram do padrão.

### Sugestão do mês seguinte

25. Como faturista, quero gerar a sugestão do mês seguinte a partir das regras com um botão, para não montar o calendário à mão.
26. Como faturista, quero que a sugestão ponha cada janela no dia menos carregado e, no empate, no mais cedo, para equilibrar a carga e sobrar margem.
27. Como faturista, quero que os convênios de "todos os dias" com "envios sugeridos no mês" sejam espalhados pelos dias mais vazios, depois dos demais, como já faço hoje.
28. Como faturista, quero que os convênios de "todos os dias" sem esse número não entrem na sugestão, para eu agendá-los livremente.
29. Como faturista, quero que gerar a sugestão de novo não apague o que ajustei à mão, para poder regerar depois de mudar uma regra.
30. Como coordenação, quero um aviso "\<mês\> ainda não foi planejado" quando o mês seguinte não foi gerado, para não esquecer de planejar.
31. Como faturista, quero que a sugestão desconte fins de semana e feriados ao contar dias úteis, para que "1º dia útil" seja de fato o primeiro dia útil.

### Regras de envio

32. Como faturista, quero cadastrar a regra de envio de cada convênio com um dos tipos (faixa de dias corridos, faixa de dias úteis, dias fixos, último dia útil, todos os dias, calendário do convênio), para refletir a planilha.
33. Como faturista, quero dar mais de uma janela ao mesmo convênio (TRT: 1º–2º e 15º–16º dia útil), para cobrir convênios com mais de uma entrega no mês.
34. Como faturista, quero editar a regra quando o convênio mudar o prazo, para que os próximos meses saiam certos.
35. Como faturista, quero que, depois de mudar uma regra, o sistema ofereça regerar os agendamentos ainda pendentes e não editados do mês seguinte, para aplicar a mudança sem refazer tudo.
36. Como faturista, quero lançar à mão as datas dos convênios de "calendário do convênio" (Plan Assiste, TST), já que eles divulgam as datas por conta própria.
37. Como faturista, quero um campo de observação em cada regra, para guardar notas como "XML junto" e "geralmente até o dia 20".
38. Como faturista, quero desativar um convênio que deixou de ser enviado à parte, para ele sair das próximas sugestões sem perder o histórico.
39. Como faturista, quero manter a lista de feriados (nacionais e do DF), para o cálculo de dias úteis ficar correto.
40. Como faturista, quero que as regras da planilha já venham cadastradas e novembro/2026 já venha gerado, para usar a tela desde o primeiro dia.

### Confirmação automática

41. Como coordenação, quero que um envio que ninguém marcou seja marcado sozinho quando o lote aparecer no backup, para o calendário não ficar desatualizado.
42. Como coordenação, quero o selo "confirmado no apLIS" nos envios em que existe lote, para saber que a marcação manual confere com o sistema.
43. Como coordenação, quero ver os "Envios não planejados" (lotes que não casaram com nenhum agendamento), para saber de envios fora do calendário.

### Acesso

44. Como administrador, quero dar a uma faturista acesso só a Contas a Receber e ao Calendário, sem as outras telas do Faturamento.
45. Como faturista, quero marcar envios, mover datas e editar regras sem poder dar baixa ou editar títulos.
46. Como usuário que já tem "Visualizar Faturamento", quero continuar vendo tudo o que via antes, sem precisar de nova configuração.

## Implementation Decisions

### Glossário

- **Calendário de envios**: a tela e o conjunto de agendamentos do mês.
- **Regra de envio**: a janela em que um convênio aceita o envio. Não confundir com a regra de prazo de recurso de glosa (`glosa_prazo_regras`), que é outra coisa.
- **Agendamento de envio**: um convênio e uma data prevista, com status.

Os três termos entram no `CONTEXT.md`.

### Módulo de domínio (único seam de teste)

O módulo puro "Calendário de envios" fica no servidor, ao lado dos módulos do Faturamento. Não acessa banco nem relógio: a data de hoje entra como parâmetro. Ele tem três entradas públicas:

1. **Gerar a sugestão do mês.**
   - Entrada: mês, regras ativas, feriados e agendamentos que já existem no mês.
   - Saída: os agendamentos a criar e os ids a remover. Só são removidos os de origem "sugestão", pendentes e não editados.
2. **Classificar um agendamento.**
   - Entrada: agendamento, regra e hoje.
   - Saída: o status (`pendente`, `enviado`, `atrasado` ou `fora_do_prazo`) e o selo `fora_da_janela`.
   - Os painéis, o bloco Atrasados e o contador do menu usam todos esta mesma função.
3. **Casar os lotes do backup.**
   - Entrada: lotes (fonte pagadora e `DtaEnvio`), agendamentos e regras.
   - Saída: as confirmações (agendamento e lote, e se é para marcar sozinho ou só pôr o selo) e os "envios não planejados".

O dia útil com feriados mora dentro deste módulo, e os feriados entram como parâmetro. As funções de dia útil que já existem (recurso de glosa e EVA) ignoram feriados e ficam como estão.

### Tipos de janela

Formato de uma janela da regra:

```ts
type JanelaEnvio =
  | { tipo: 'dias_corridos'; de: number; ate: number }      // "1 ao 15", "até o 19" (de = 1)
  | { tipo: 'dias_uteis'; de: number; ate: number }         // "1º ao 5º dia útil", "15º e 16º"
  | { tipo: 'dias_fixos'; dias: number[] }                  // "dia 03 e 16"
  | { tipo: 'ultimo_dia_util' }
  | { tipo: 'todos_os_dias' }
  | { tipo: 'calendario_convenio' };                         // datas lançadas à mão
```

Uma regra tem uma ou mais janelas. As regras de "todos os dias" têm também o campo opcional "envios sugeridos no mês".

### Regras da sugestão

- **Onde o agendamento pode cair.** Só em dia útil, ou seja, segunda a sexta fora dos feriados.
- **Carga de um dia.** É o número de agendamentos do dia, de todos os convênios, contando os que já existem e os que a sugestão já colocou.
- **Ordem de colocação:**
  1. Dias fixos e último dia útil, que não têm escolha. Um dia fixo que cai em dia não útil vai para o próximo dia útil.
  2. Faixas, das mais estreitas para as mais largas. Cada faixa gera um agendamento por janela, no dia de menor carga e, no empate, no mais cedo.
  3. "Todos os dias" com "envios sugeridos no mês" = N. Os dias úteis do mês são divididos em N trechos seguidos, e cada trecho recebe um agendamento no dia de menor carga (no empate, o mais cedo).
- **O que fica de fora.** "Calendário do convênio" e "todos os dias" sem N não geram nada.
- **Ajustes manuais.** Uma janela que já tem agendamento editado à mão ou manual no mês não gera outro.

### Regras de status

- **Enviado.** Tem data de envio, seja marcada à mão ou pela confirmação automática.
- **Atrasado.** Ainda não foi enviado e a data prevista já passou (data prevista < hoje).
- **Fora do prazo.** Ainda não foi enviado e hoje já passou do último dia da janela daquele agendamento no mês. Vale só para janelas com fim: faixas, dias fixos e último dia útil. "Todos os dias" e "calendário do convênio" nunca ficam fora do prazo.
- **Selo "fora da janela".** Aparece quando a data prevista ou a data de envio cai fora de todas as janelas da regra no mês. Não vale para "todos os dias" nem para "calendário do convênio". É só informativo.

### Casamento dos lotes

- Um lote do convênio X com `DtaEnvio` = D casa com o agendamento **pendente** de X mais próximo de D no mesmo mês, desde que D caia dentro da janela daquele agendamento. Cada agendamento recebe no máximo um lote.
- Os lotes de convênios agrupadores (AMHPDF) casam pelas fontes pagadoras dos convênios membros.
- Se o agendamento já estava marcado à mão, ele só ganha o selo. A data informada pela faturista prevalece.
- Lotes de um agendamento que já recebeu lote, e lotes sem agendamento, vão para "Envios não planejados". Essa lista é calculada na hora e não fica gravada.
- **Quando roda.** Ao carregar o mês, o servidor lê do backup os lotes do mês (status considerados "enviados", como na aba Envios de Contas a Receber) e aplica o casamento. O resultado é gravado e o processo pode rodar várias vezes sem duplicar nada.

### Dados (Supabase)

- **`fat_envio_regras`:** nome do convênio, convênios membros (texto, só nos agrupadores), fontes pagadoras do apLIS (lista de ids), janelas (jsonb), envios sugeridos no mês, observação, ativo, quem alterou e quando.
- **`fat_envio_agendamentos`:** regra, data prevista, índice da janela (nulo quando fora da janela), origem (`sugestao`/`manual`), editado, data de envio, quem marcou, quando marcou, lote do apLIS confirmado, data da confirmação.
- **`fat_envio_agendamento_historico`:** agendamento, ação (`criou`, `moveu`, `marcou`, `desmarcou`, `confirmou_aplis`, `removeu`), valores antes e depois, quem e quando.
- **`fat_feriados`:** data, descrição, abrangência (`nacional`/`DF`).
- **Acesso.** RLS no padrão das tabelas `fat_*`: leitura com permissão de ver o Calendário, escrita com `canManageCalendarioEnvios`.

### Carga inicial

Uma migration cadastra as regras da planilha, os feriados nacionais e do DF de 2026 e 2027, e gera novembro/2026 com o módulo.

| Convênio | Janela(s) | Observação |
| --- | --- | --- |
| AMIL | dias corridos 1–15 | |
| AMHP | todos os dias | |
| AMHP – BACEN | todos os dias | |
| AMPLA | dias corridos 1–10 | |
| ASSEFAZ | dias úteis 1–5 | |
| BRADESCO | todos os dias | |
| BRB | dias úteis 1–2 | |
| CÂMARA | todos os dias | |
| CASSI | dias corridos 1–19 | Inclui FASCAL |
| CBMDF | último dia útil | |
| EVIDA/LUMINAR | dias úteis 1–5 | |
| FUSEX | dias fixos 3 e 16 | XML junto |
| GAMA | dias úteis 1–5 | |
| GDF INAS | todos os dias | |
| GEAP | dias corridos 1–10 | |
| PF | dias corridos 1–7 | |
| PLAN ASSISTE | calendário do convênio | |
| PMDF | todos os dias | |
| POSTAL SAÚDE | dias úteis 1–5 | Confirmar no calendário do convênio |
| SAÚDE CAIXA | todos os dias | |
| SIS | todos os dias | |
| STF | dias corridos 1–21 | |
| STJ/PRO-SER | dias corridos 21–23 | |
| SULAMÉRICA | último dia útil | |
| TJDFT | dias corridos 15–20 | Física e online |
| TRE | dias úteis 1–2 | Física e online |
| TRT | dias úteis 1–2 e 15–16 | |
| TST | calendário do convênio | Geralmente até o dia 20 |
| AMHPDF – Online | todos os dias | Membros: AFEGO, SERPRO, BACEN, STM, CASEMBRAPA, TRF – PRO SOCIAL, CASEC, UNAFISCO, CONAB |
| AMHPDF – Entrega física | todos os dias | Membros: AFEB, LIFE EMPRESARIAL, ASETE, NOTRE DAME, CAEME, OMINT, FAPES, PROASA, CNTI, PETROBRAS, EMBRATEL – TELOS, CARE PLUS, GRAVIA |

- **Envios sugeridos no mês.** Toda regra de "todos os dias" começa com 4 (mais ou menos um por semana) e pode ser editada.
- **Fontes pagadoras.** Os ids do apLIS de cada linha são levantados no banco do lab durante a implementação. Linhas sem correspondência ficam sem fonte e só não recebem confirmação automática.

### API

As rotas ficam no roteador do Faturamento que já existe:

- **GET do mês:** agendamentos já classificados, regras, feriados, envios não planejados e se o mês seguinte já foi planejado. Esse GET aplica o casamento dos lotes.
- **GET leve do contador de atrasados**, para o menu. Não lê o backup.
- **POST marcar e desmarcar enviado** (com data), mover, criar avulso e remover agendamento.
- **POST gerar a sugestão do mês.** Só a partir do dia 15 do mês anterior. Também aceita o mês corrente, para regerar depois de mudar uma regra.
- **CRUD de regras e de feriados.**

Toda escrita grava o histórico.

### Telas

- **Rota e menu.** Nova rota `/faturamento/calendario` e item "Calendário de envios" no menu do Faturamento, com o contador.
- **Componentes.** Painéis Hoje, Amanhã e Atrasados, grade mensal de segunda a sexta, lista lateral "Pode enviar qualquer dia", detalhe do agendamento com o histórico, modal de regras e modal de feriados.
- **Contas a Receber.** A aba Dashboard ganha os painéis Hoje e Amanhã compactos, só para quem pode ver o Calendário.
- **Visual.** Segue a identidade Flow LAB, com modo escuro.

### Permissões

- **Novas chaves de visualização por tela:** `canViewFaturas`, `canViewContasReceber`, `canViewGlosas`, `canViewIndicadores` e `canViewCalendarioEnvios`.
- **Nova chave de gestão:** `canManageCalendarioEnvios`.
- **Rotas e menu.** Cada tela aceita `canViewBilling` (que continua valendo para tudo) **ou** a chave própria. Com isso ninguém perde acesso.
- **Escrita no Calendário.** Exige `canManageCalendarioEnvios`, que é independente de `canManageBilling`. A escrita em Contas a Receber continua exigindo `canManageBilling`.
- **Perfil das faturistas.** `canViewContasReceber` + `canViewCalendarioEnvios` + `canManageCalendarioEnvios`.
- **ADR.** A separação fica registrada em `docs/adr/0001-permissoes-faturamento-por-tela.md`.

## Testing Decisions

- Um bom teste olha só o comportamento externo do módulo "Calendário de envios": entradas (mês, regras, feriados, agendamentos, lotes, hoje) e saídas. Não olha a ordem interna dos laços nem funções auxiliares. Datas são fixas no teste, nunca o relógio.
- Só o módulo de domínio ganha teste. Handlers, hooks e componentes são só a ligação com o banco e com a tela, como já acontece na Pontuação do setor.
- **Sugestão:**
  - cada tipo de janela;
  - feriado no meio de uma faixa de dias úteis;
  - dia fixo num sábado;
  - último dia útil seguido de feriado;
  - desempate pelo dia mais cedo;
  - faixas estreitas antes das largas;
  - distribuição de N envios de "todos os dias";
  - "todos os dias" sem N e "calendário do convênio" não geram nada;
  - regerar preserva os agendamentos manuais ou editados e não duplica janelas.
- **Classificação:**
  - pendente antes da data;
  - atrasado depois da data;
  - fora do prazo depois do fim da janela;
  - "todos os dias" nunca fica fora do prazo;
  - enviado vence atrasado;
  - selo "fora da janela".
- **Casamento:**
  - escolhe o pendente mais próximo;
  - lote fora da janela vai para não planejados;
  - um agendamento recebe no máximo um lote;
  - agendamento marcado à mão só ganha o selo e mantém a data informada;
  - agrupador AMHPDF casa pelos membros.
- **Testes que servem de modelo:** os testes do módulo de pontuação do setor e dos Indicadores no servidor, e o teste de regra de prazo no front. Todos usam vitest com funções puras.

## Out of Scope

- Leitura ao vivo dos lotes pelo site do apLIS (`listarLote`). Fica para depois, se a confirmação no dia seguinte não bastar.
- Lembretes e tarefas livres no calendário ("Conferência de guia", "Emissão NF", "Fechar o mês", datas comemorativas).
- Notificação por e-mail ou push de atraso.
- Arrastar e soltar no calendário, se for caro. Mover pelo detalhe do agendamento já atende.
- Usar os feriados no cálculo de prazo do recurso de glosa e da EVA.
- Mudar o que `canManageBilling` libera em Contas a Receber.

## Further Notes

- **Origem.** Pedido da coordenação do Faturamento. O modelo foi o calendário do Google da equipe (out/2019) e a planilha "convênio × data de faturamento". Decisões fechadas no grilling de 28/10/2026.
- **FASCAL.** Passou a ser enviada pela CASSI e não tem regra própria.
- **Suposições que dá para mudar depois:**
  - um dia fixo em dia não útil vai para o próximo dia útil;
  - as regras de "todos os dias" começam com 4 envios sugeridos no mês.
- **O atraso de 24 h do backup é o motivo da marcação manual ser a principal.** A confirmação automática só fecha as lacunas.
