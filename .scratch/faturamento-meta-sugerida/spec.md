# Faturamento: Meta sugerida (90/10, média de 2 e de 3 meses)

Status: ready-for-agent

## Problem Statement

A coordenação do Faturamento define a meta mensal numa planilha à parte. Para cada mês, a planilha calcula três candidatas a partir dos **Elegíveis** dos meses anteriores (o valor das requisições dos convênios que contam para a meta):

- **90/10**: 90% dos Elegíveis do mês anterior + 10% dos Elegíveis do mês retrasado. Os 10% cobrem as requisições que ficaram para trás do mês retrasado.
- **Média de 2 meses**: média simples dos Elegíveis dos dois meses anteriores.
- **Média de 3 meses**: média simples dos Elegíveis dos três meses anteriores.

Depois, alguém escolhe uma delas e digita o valor à mão no card "Meta" do Contas a Receber. Isso causa três problemas:

- **Os números vêm de fora do sistema.** As Admissões e os Elegíveis da planilha não batem com o apLIS. Em setembro a diferença é pequena, mas de janeiro a abril as Admissões ficam bem abaixo do banco. De maio a agosto, Elegíveis + Não elegíveis ficam R$ 180–204 mil abaixo das Admissões da própria planilha.
- **Não fica registrado de onde a meta veio.** A meta de outubro (R$ 1.100.000,08) não é igual a nenhuma das três candidatas. A de setembro (R$ 5.000) parece ser de teste.
- **A lista de convênios da planilha e a do sistema divergem.** AMIL e ASSEFAZ foram desmarcados da lista "considerada na meta" em 04/09, com motivos de teste. SELECT e STM nunca foram marcados.

A meta também alimenta a Pontuação do setor ("Meta mensal" e "Meta superada"). Por isso, um valor errado tira ou dá pontos indevidos.

## Solution

O card **Meta** do Contas a Receber passa a calcular as três candidatas sozinho, a partir do apLIS:

- **Modal "Definir meta"**: mostra a 90/10, a média de 2 meses e a média de 3 meses do mês corrente, com a 90/10 pré-selecionada. Cada opção mostra os meses e valores usados, e o modal avisa "dados até DD/MM". A coordenação escolhe uma ou digita outro valor. Nada é salvo sem ação de alguém.
- **Abertura a qualquer momento**: o modal abre em qualquer dia do mês, mesmo com a meta já salva. Quem só tem permissão de ver o Contas a Receber consulta as opções, mas não salva.
- **Origem gravada**: ao salvar, o sistema grava o valor e a origem (90/10, média de 2 meses, média de 3 meses ou manual). Se alguém escolher uma opção e mudar o valor, a origem vira manual.
- **Histórico**: o modal de histórico de metas ganha três colunas com as candidatas de cada mês, recalculadas ao abrir. A meta salva nunca muda.
- **apLIS fora do ar**: o modal avisa e oferece "Tentar novamente", e continua sendo possível digitar a meta manualmente.

## User Stories

1. Como coordenação do Faturamento, quero ver a meta 90/10 do mês corrente calculada pelo sistema, para não depender da planilha.
2. Como coordenação, quero ver também a média de 2 meses e a de 3 meses, para comparar antes de escolher.
3. Como coordenação, quero a 90/10 pré-selecionada, porque é a referência que o setor usa.
4. Como coordenação, quero ver os meses e os valores de Elegíveis que formaram cada opção, para conferir a conta.
5. Como coordenação, quero escolher uma das três opções e salvar com um clique, sem digitar o valor.
6. Como coordenação, quero poder digitar outro valor em vez das opções, para casos em que a meta é decidida por outro critério.
7. Como coordenação, quero que, ao alterar o valor de uma opção, ela passe a contar como manual, para o registro não mentir sobre a origem.
8. Como coordenação, quero ver no card de onde veio a meta salva (90/10, média de 2, média de 3 ou manual), para saber qual critério foi usado.
9. Como coordenação, quero abrir as opções em qualquer dia do mês, mesmo com a meta já salva, para comparar a meta escolhida com as alternativas.
10. Como faturista com permissão só de ver, quero consultar as opções sem poder salvar, para entender de onde vem a meta.
11. Como coordenação, quero ver até que dia os dados do apLIS estão atualizados, porque a réplica atrasa cerca de 1 dia e, no dia 1º, o fim do mês anterior pode faltar.
12. Como coordenação, quero que os Elegíveis contem pela data de solicitação da requisição, inclusive as ainda sem lote, para que a meta reflita o que entrou no mês, e não o que já foi faturado.
13. Como coordenação, quero que os Elegíveis só contem os convênios marcados como "considerada na meta", para que a lista continue sendo gerenciada num lugar só.
14. Como coordenação, quero que requisições em status não cobráveis (cancelado, amostra devolvida, descarte, pagamento no particular etc.) não contem nos Elegíveis, com a mesma regra das Pendências.
15. Como coordenação, quero que um convênio marcado ou desmarcado na lista passe a valer nas opções sem mexer em código, porque os convênios mudam com o tempo.
16. Como coordenação, quero que a meta de janeiro use dezembro e novembro do ano anterior, para que a virada de ano não quebre a conta.
17. Como coordenação, quero que, se faltar dado de algum mês usado numa opção, essa opção apareça como indisponível em vez de um valor errado.
18. Como coordenação, quero valores arredondados em centavos, iguais aos da planilha.
19. Como coordenação, quero que o modal avise quando o apLIS estiver fora do ar e ofereça "Tentar novamente", para eu saber que o problema não é a meta.
20. Como coordenação, quero poder salvar a meta manualmente mesmo com o apLIS fora do ar, para não ficar sem meta.
21. Como coordenação, quero ver no Histórico as três candidatas de cada mês ao lado da meta salva e do faturado, para comparar os critérios ao longo do tempo.
22. Como coordenação, quero que as metas já salvas (setembro e outubro) continuem no Histórico, sem origem, em vez de receber uma origem inventada.
23. Como coordenação, quero que a meta salva nunca mude depois, mesmo que o apLIS ou a lista de convênios mudem, porque ela vale para a Pontuação do setor.
24. Como coordenação, quero que salvar a meta continue restrito a quem hoje pode editá-la, para não abrir uma permissão nova.

## Implementation Decisions

**Elegíveis de um mês**
- Soma de `ValorLiquido` dos procedimentos (`fatrequisicaoprocedimento`) das requisições com `DtaSolicitacao` dentro do mês calendário, lida do MySQL de backup do apLIS.
- Entram as requisições com e sem lote.
- Só entram as fontes pagadoras com `operadoras.is_considerada_meta = true`. A lista vem do Supabase pelo mesmo helper das outras rotas do Faturamento. Lista vazia vira condição falsa (`1 = 0`), nunca `IN ()`.
- Saem as requisições com `CodEvento` em `EVENTOS_NAO_COBRAVEIS`, a mesma constante das Pendências. O `CodEvento` nulo entra.
- A consulta agrupa pelos meses pedidos numa ida só ao banco e formata as datas dentro do SQL, como o resto do acesso ao apLIS.

**Cálculo das candidatas para o mês M** (função pura, sem banco)
- 90/10 = 0,9 × E(M-1) + 0,1 × E(M-2).
- Média de 2 meses = (E(M-1) + E(M-2)) / 2.
- Média de 3 meses = (E(M-1) + E(M-2) + E(M-3)) / 3.
- Os meses atravessam a virada de ano.
- Arredondamento em centavos, só no resultado final.
- Uma candidata com algum mês sem Elegíveis (mês ausente do resultado) fica indisponível (`null`).
- As fórmulas reproduziram até o centavo as candidatas de setembro e outubro da planilha a partir da linha Elegíveis dela.

**Rota da API** (nova, no dispatcher do Faturamento)
- `GET` com o parâmetro `mes` (YYYY-MM); fora desse formato, responde 400.
- Autorização: sessão com a permissão de ver a tela Contas a Receber, a mesma das Pendências.
- Resposta: o mês da meta; as três candidatas, cada uma com valor (ou `null`) e os meses usados; os Elegíveis de cada mês usado; e o `dadoAte` de `requisicao.DtaSolicitacao`.
- Aceita um intervalo de meses para o Histórico calcular as candidatas de vários meses numa chamada só.
- Se o MySQL estiver fora do ar, responde com um status e uma mensagem próprios, distintos de erro interno, para a tela mostrar "Tentar novamente".
- Sem cache de navegador (`no-store`), como as outras rotas financeiras.

**Schema**
- `metas_faturamento` ganha a coluna `origem`, nula, com os valores permitidos `90_10`, `media_2`, `media_3` e `manual`.
- As linhas existentes ficam com `origem` nula.
- As políticas RLS de insert e update atuais continuam sendo o controle de acesso.
- As candidatas não são gravadas.

**Front**
- O hook da meta mensal passa a salvar valor e origem juntos.
- Um hook novo busca as candidatas na rota.
- O modal de meta, hoje só com o campo de valor, passa a ter as três opções e a entrada manual.
- Com permissão só de ver, o modal abre em modo leitura e o botão do card fica sempre visível ("Ver sugestões" quando não pode editar).
- O card mostra a origem da meta salva quando ela existir.
- O modal de Histórico ganha as três colunas, preenchidas pela rota com o intervalo de meses do histórico.

**Lista de convênios**
- Nenhuma migration altera `is_considerada_meta`. A correção de AMIL, ASSEFAZ, SELECT e STM é feita pelo modal "Fontes consideradas na meta" (Títulos), que registra o autor na auditoria.
- "Amil Assistência Médica" (`OP003`) continua desmarcada.
- ABAC não entra.

## Testing Decisions

Bons testes aqui olham só o comportamento visto de fora: dada a entrada, qual valor ou resposta sai. Não testam como a consulta é montada nem o estado interno de componentes.

**1. Cálculo das candidatas** (ponto principal)
- Testa a função pura com Elegíveis por mês montados à mão.
- Casos:
  - as três fórmulas com os valores reais de setembro e outubro da planilha (devem bater até o centavo);
  - virada de ano (janeiro usa dezembro e novembro);
  - mês faltando deixa só as candidatas afetadas indisponíveis;
  - arredondamento em centavos;
  - Elegíveis zero contam como valor, não como ausência.
- Padrão: `indicadoresFaturamento.test.ts` e `pontuacaoSetor.test.ts`.

**2. Rota da API**
- Testa o handler com o acesso ao apLIS e o Supabase simulados.
- Casos:
  - sem sessão ou sem permissão;
  - `mes` inválido devolve 400;
  - a lista de fontes consideradas é repassada para a consulta dos Elegíveis;
  - a resposta traz candidatas, meses usados e `dadoAte`;
  - apLIS fora do ar devolve a resposta própria, e não 500;
  - o intervalo de meses do Histórico.
- Padrão: `faturamento-pendencias-particulares.test.ts`.

**Sem teste automatizado**
- **Consulta SQL dos Elegíveis**: validada pela comparação de setembro (Further Notes).
- **Tela**: o módulo Faturamento não tem testes de componente.
- **Gravação da origem**: coberta pela restrição de valores da coluna e pela RLS existente.

## Out of Scope

- Réplica completa da planilha (Admissões, Não elegíveis, linhas Média e Total, %Atingimento por mês).
- Gravar a meta sozinho todo mês, sem escolha da coordenação.
- Guardar as candidatas oferecidas no momento de salvar.
- Editar metas de meses passados pela tela.
- Corrigir a meta de R$ 5.000 de setembro/2026. Será tratada à parte quando o faturamento informar o valor real, porque mexe com a Pontuação do setor de setembro.
- Explicar a diferença da planilha de janeiro a agosto. É pergunta ao faturamento e não bloqueia esta entrega.

## Further Notes

**Antes de publicar**
1. Gerar a comparação de setembro/2026 por convênio, sistema × planilha, simulando AMIL, ASSEFAZ, SELECT e STM marcados, sem alterar produção.
2. O faturamento explica as diferenças de setembro. Não precisa bater até o centavo, mas a diferença tem que ter explicação.
3. Marcar AMIL, ASSEFAZ, SELECT e STM pelo modal "Fontes consideradas na meta", e avisar o faturamento. A marcação muda na hora o faturado, o dashboard, as tabelas e a Pontuação do setor, inclusive em meses anteriores.
4. Publicar.

**Números de referência** (levantados em 04/11/2026)

Setembro, Admissões:

| Fonte | Valor |
|---|---|
| Planilha | R$ 1.212.335,21 |
| apLIS, todas as fontes | R$ 1.228.711 |
| apLIS, sem status não cobráveis | R$ 1.210.801 |

Novembro/2026 com a lista atual, antes de marcar os quatro convênios e com status não cobráveis incluídos: 90/10 ≈ R$ 1,15 mi. Com AMIL e ASSEFAZ, ≈ R$ 1,22 mi.

**Glossário**: "Elegíveis" e "Meta sugerida" são termos novos. Vale registrá-los no `CONTEXT.md` quando a feature for implementada.
