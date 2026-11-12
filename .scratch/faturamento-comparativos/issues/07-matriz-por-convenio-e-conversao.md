# 07: Conversão de requisições (aptas × faturadas)

**What to build:** na aba Comparativos, a **conversão** de requisições por convênio nos 3 meses: aptas × faturadas, com % de conversão e "aptas sem lote". Sem prazo de perda de janela. Ver `../spec.md`.

A matriz faturado × glosado × recebido saiu desta issue e foi para a 11 (adiada; grilling de 12/11/2026).

**Blocked by:** 03, 04

**Status:** done

## Regras (decididas no grilling de 12/11/2026)

- **Apta** = requisição cujo **mês da data de solicitação** é o mês da coluna, de convênio cobrável (sem Particular nem Cortesia), com evento cobrável e com procedimento. É o mesmo recorte de data das Pendências.
- **Faturada** = apta que **hoje** está em lote com status diferente de cancelado e de prejuízo, mesmo que o lote tenha sido criado num mês posterior.
- **Aptas sem lote** = aptas − faturadas. Num mês fechado, bate com a sub-aba "Sem lote" no mesmo recorte.

## Tela

- **Linha de totais** por mês (referência, M-1, M-2): aptas, faturadas, % de conversão e aptas sem lote.
- **Gráfico de barras horizontais agrupadas**, no mesmo estilo do volume de envio (issue 09): uma barra de **% de conversão** por mês para cada convênio. Mostra os **15 convênios com mais aptas no mês de referência**.
- **Tabela** com todos os convênios: aptas, faturadas, % e aptas sem lote para cada mês.
- Falha do apLIS mostra aviso com "Tentar novamente".

## Critérios

- [x] A conversão exclui particular, cortesia, lote cancelado e lote em prejuízo.
- [x] "Aptas sem lote" bate com a sub-aba "Sem lote" no mesmo recorte, num mês fechado.
- [x] O % de conversão de um convênio sem aptas no mês aparece como "—", e não como 0% ou NaN.
- [x] Testes de função pura (exclusões, % e convênio sem aptas) e de rota (sem permissão, mês inválido = 400, formato da resposta, apLIS fora do ar); `npm test` e typecheck passam.

## Entrega (12/11/2026)

- Rota `GET /api/faturamento/comparativos-conversao?mes=YYYY-MM`; regra em `src/modules/faturamento/utils/conversaoRequisicoes.ts` (`montarConversaoRequisicoes`); tela em `ConversaoRequisicoesComparativo.tsx`, com o gráfico em `BarrasHorizontaisPorConvenio.tsx` (componente pensado para a issue 09 reusar).
- **RPS avulso conta como faturada.** A apta sem lote, mas com RPS não cancelado lançado direto na requisição (6 a 44 por mês em ago–out/2026, quase todas de fontes como CAMPANHAS LAB), já foi cobrada e não aparece na sub-aba "Sem lote". Contá-la como faturada é o que faz "aptas sem lote" bater com a sub-aba.
- **Mesma whitelist da sub-aba.** A conversão usa as fontes consideradas (`operadoras.is_considerada_meta`) que "Sem lote" usa.
- Conferido no banco (sem whitelist): "aptas sem lote" pela regra = `SQL_SEM_LOTE_WHERE` em ago (2), set (5) e out/2026 (389). Nenhuma requisição aponta hoje para lote cancelado ou em prejuízo (o apLIS solta o vínculo), mas a regra os exclui mesmo assim.
- O % fica em 99,9% enquanto houver apta sem lote (set/2026: 3.173 de 3.174 arredondaria para 100%).
- As constantes de Particular, Cortesia, eventos não cobráveis e status de lote não faturado passaram a viver em `src/modules/faturamento/utils/regrasCobranca.ts`; `bdLab.ts` as importa, então Pendências e Conversão usam a mesma regra.
- **Para a gestora confirmar:** (1) RPS avulso contar como faturada; (2) a whitelist de fontes consideradas recortar as aptas. As duas decisões existem só para bater com "Sem lote".
- **Risco conhecido:** se um dia uma requisição ficar apontando para lote cancelado ou em prejuízo, ela entra em "aptas sem lote" e não aparece na sub-aba "Sem lote" (que exige `Lote IS NULL`). Hoje são 0.
