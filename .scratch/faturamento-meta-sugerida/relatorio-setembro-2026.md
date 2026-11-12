# Elegíveis de setembro/2026: sistema × planilha

Relatório da issue 01 (Meta sugerida), para o faturamento explicar as diferenças antes de a meta sugerida ser publicada. Ninguém precisa bater até o centavo, mas cada diferença precisa de uma explicação.

- **Fonte:** MySQL de backup do apLIS, consulta só de leitura feita em 12/11/2026. A última data de solicitação no backup é 11/11/2026.
- **Regra do sistema:** soma do valor líquido dos procedimentos das requisições, pelo mês da **data de solicitação**, com e sem lote. Ficam de fora as requisições em status não cobráveis: cancelado, amostra devolvida, descarte, pagamento no particular e os demais de `EVENTOS_NAO_COBRAVEIS`.
- **Elegíveis** = só os convênios marcados como "considerada na meta", **simulando AMIL, ASSEFAZ, SELECT e STM já marcados**. Nada foi alterado em produção.
- Não há nenhum dado de paciente neste relatório.

## 1. Totais de setembro/2026

| | Planilha | Sistema | Diferença (sistema − planilha) |
|---|---:|---:|---:|
| Admissões (todas as fontes, sem status não cobráveis) | R$ 1.212.335,21 | R$ 1.210.606,73 | −R$ 1.728,48 |
| Elegíveis | R$ 1.186.656,81 | R$ 1.185.538,20 | −R$ 1.118,61 |
| Não elegíveis | R$ 24.478,40 | R$ 25.068,53 | +R$ 590,13 |

Com todas as fontes **e** os status não cobráveis, as Admissões do sistema somam R$ 1.228.516,54. Os status não cobráveis valem R$ 17.909,81 no mês.

Com a lista de hoje, sem os quatro convênios, os Elegíveis seriam R$ 1.108.649,37, ou seja, R$ 76.888,83 a menos.

## 2. Elegíveis de setembro/2026 por convênio (sistema)

Status: **Marcado** = já está na lista "considerada na meta" hoje; **Simulado** = AMIL, ASSEFAZ, SELECT e STM, que ainda faltam marcar.

| Convênio | Código apLIS | Status | Elegíveis |
|---|---:|---|---:|
| PMDF | 1251 | Marcado | R$ 176.978,14 |
| BRADESCO SAUDE - 005711 | 1122 | Marcado | R$ 173.199,96 |
| CASSI | 1009 | Marcado | R$ 134.348,17 |
| SAUDE CAIXA | 1101 | Marcado | R$ 119.924,65 |
| AMHP-DF | 1025 | Marcado | R$ 65.766,45 |
| ASSEFAZ | 1008 | Simulado | R$ 63.764,04 |
| **PARTICULAR** | 1102 | Marcado | R$ 63.459,05 |
| LAB PLANASSISTE | 1129 | Marcado | R$ 47.182,59 |
| INAS GDF | 1257 | Marcado | R$ 44.073,35 |
| TJDFT | 1231 | Marcado | R$ 42.751,56 |
| SUL AMERICA COMPANHIA DE SEGURO SAÚDE | 1078 | Marcado | R$ 36.037,98 |
| BRADESCO SAUDE S/A 421715 | 1000 | Marcado | R$ 35.968,30 |
| CÂMARA DOS DEPUTADOS | 1283 | Marcado | R$ 30.758,89 |
| STJ | 1252 | Marcado | R$ 24.349,60 |
| POSTAL SAÚDE | 1052 | Marcado | R$ 20.426,35 |
| GEAP Autogestão em Saúde | 1282 | Marcado | R$ 18.366,28 |
| SIS SENADO | 1197 | Marcado | R$ 16.615,32 |
| AMIL | 1007 | Simulado | R$ 11.400,89 |
| POLÍCIA FEDERAL | 1281 | Marcado | R$ 9.499,32 |
| BRB SAÚDE | 1268 | Marcado | R$ 9.427,21 |
| TST | 1227 | Marcado | R$ 8.052,75 |
| CBMDF | 1210 | Marcado | R$ 7.965,00 |
| STF | 1235 | Marcado | R$ 7.362,84 |
| TRT | 1228 | Marcado | R$ 6.989,80 |
| FASCAL | 1253 | Marcado | R$ 6.833,17 |
| STM | 1067 | Simulado | R$ 1.723,90 |
| E-VIDA | 1049 | Marcado | R$ 1.353,41 |
| FUSEX | 1204 | Marcado | R$ 501,73 |
| TRE-SAÚDE | 1232 | Marcado | R$ 457,50 |
| SELECT | 1365 | Simulado | sem requisição no mês |
| **Total** | | | **R$ 1.185.538,20** |

Cinco convênios marcados não tiveram requisição em setembro: 090 SULAMERICA, CASSI-PER, CONAB, GAMA SAÚDE e GAMA SAÚDE - MEDICINA LABORATORIAL.

## 3. Fontes não elegíveis com valor em setembro/2026

| Fonte | Código apLIS | Valor |
|---|---:|---:|
| Medigest Centro de Medicina Digestiva | 1123 | R$ 16.013,93 |
| Cortesia | 100 | R$ 5.489,60 |
| MATER CLINICA | 1014 | R$ 1.271,00 |
| ABAC | 1155 | R$ 1.200,00 |
| CENTRO DE DIAGNOSTICO POR IMAGEM DO GAMA LTDA - ME | 1208 | R$ 720,00 |
| CLINICA GINORTE | 1021 | R$ 299,00 |
| COEM | 1130 | R$ 75,00 |
| **Total** | | **R$ 25.068,53** |

## 4. Perguntas para o faturamento

1. **PARTICULAR (R$ 63.459,05) está marcada como "considerada na meta"** e por isso entra nos Elegíveis. A planilha também conta o Particular nos Elegíveis?
2. **Cortesia (R$ 5.489,60)** aparece nos Não elegíveis do sistema. A planilha conta a Cortesia nas Admissões e nos Não elegíveis?
3. **Elegíveis −R$ 1.118,61 e Não elegíveis +R$ 590,13.** Algum convênio foi trocado de lado na planilha (por exemplo, ABAC com R$ 1.200,00 ou MATER CLINICA com R$ 1.271,00)? Também podem ser requisições alteradas no apLIS depois que a planilha foi montada. O total de Admissões sem status não cobráveis era R$ 1.210.801 em 04/11 e hoje é R$ 1.210.606,73.
4. **Que data a planilha usa?** O sistema usa a data de solicitação. Se a planilha usa a data de cadastro, de coleta ou do lote, parte da diferença vem daí.

## 5. Maio a agosto/2026 (pergunta em aberto, não bloqueia a publicação)

A planilha de maio a agosto tem Elegíveis + Não elegíveis entre R$ 180 mil e R$ 204 mil abaixo das próprias Admissões. Os números mês a mês da planilha não estão neste repositório. Por isso, a tabela traz só o lado do sistema, para o faturamento preencher a coluna da planilha.

| Mês | Admissões (sem não cobráveis) | Elegíveis (com os 4 simulados) | Não elegíveis | Elegíveis com a lista de hoje | Admissões da planilha | Elegíveis da planilha |
|---|---:|---:|---:|---:|---:|---:|
| 05/2026 | R$ 1.218.902,36 | R$ 1.189.525,76 | R$ 29.376,60 | R$ 1.114.888,52 | | |
| 06/2026 | R$ 1.211.496,67 | R$ 1.177.912,74 | R$ 33.583,93 | R$ 1.100.306,90 | | |
| 07/2026 | R$ 1.263.222,61 | R$ 1.233.557,89 | R$ 29.664,72 | R$ 1.161.158,54 | | |
| 08/2026 | R$ 1.338.270,31 | R$ 1.303.818,51 | R$ 34.451,80 | R$ 1.199.306,39 | | |

No sistema, Elegíveis + Não elegíveis sempre fecha com as Admissões. Então a falta de R$ 180–204 mil na planilha não se repete aqui: algum valor ficou fora das duas linhas da planilha.

Pergunta: os Elegíveis da planilha de jul e ago (cerca de R$ 1.033 mil e R$ 1.091 mil, deduzidos das candidatas de outubro) estão bem abaixo do sistema (R$ 1.234 mil e R$ 1.304 mil). O que ficou de fora?

## 6. Para conferir na tela depois de marcar os quatro convênios

Com AMIL, ASSEFAZ, SELECT e STM marcados, as sugestões de **novembro/2026** pelos dados de hoje devem ficar assim. Elas podem mudar um pouco conforme o backup for atualizado.

| Opção | Meses usados | Valor |
|---|---|---:|
| 90/10 | out (R$ 1.238.077,20) e set (R$ 1.185.538,20) | R$ 1.232.823,30 |
| Média de 2 meses | out e set | R$ 1.211.807,70 |
| Média de 3 meses | out, set e ago (R$ 1.303.818,51) | R$ 1.242.477,97 |

Com a lista de hoje, a 90/10 de novembro dá R$ 1.153.494,63. Isso bate com a estimativa de "≈ R$ 1,15 mi" da spec.
