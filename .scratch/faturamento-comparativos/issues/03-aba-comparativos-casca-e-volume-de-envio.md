# 03: Aba Comparativos (casca) e volume de envio por convênio

**What to build:** nova aba "Comparativos" no Contas a Receber, com permissão por tela (ADR 0001), seletor de mês de referência e 3 colunas (referência, M-1, M-2; padrão: último mês fechado). Entrega a infraestrutura comum dos blocos seguintes (rota de leitura com mês e filtros, resposta de indisponibilidade do apLIS) e já abre com o primeiro bloco: **volume de envio** (lotes/guias) por convênio nos 3 meses. Ver `../spec.md`.

**Blocked by:** None (can start immediately).

**Status:** done (implementada em 7a14a9a, 06/11/2026; testes conferidos em 12/11/2026)

- [x] A aba só aparece para quem tem a permissão.
- [x] O seletor mostra referência, M-1 e M-2, com virada de ano correta.
- [x] O volume de envio por convênio aparece nos 3 meses, em barras agrupadas e tabela.
- [x] Falha do apLIS mostra aviso e "Tentar novamente", sem tela quebrada.
- [x] Testes da função de períodos e de volume (dados à mão) e da rota (sem permissão, mês inválido = 400, formato da resposta); `npm test` e typecheck passam.

## Comments

12/11/2026: a issue foi pedida para implementação, mas já estava entregue; só o status estava desatualizado.

- Aba e permissão: aba "Comparativos" em `ContasReceberPage.tsx`, dentro da tela Contas a Receber. Ela usa a chave da tela (`canViewContasReceber` ou `canViewBilling`, ADR 0001) e não tem chave própria. A rota `comparativos-volume-envio` autoriza com `['contasReceber']`.
- Seletor: `periodosComparativos` e `mesDeReferenciaPadrao` em `src/modules/faturamento/utils/comparativos.ts` (padrão: último mês fechado; virada de ano e fevereiro bissexto testados).
- Volume: `montarVolumeEnvio` + `listarVolumeEnvioMensal` (`api/_lib/faturamento/bdLab.ts`), barras agrupadas (verticais; a troca para horizontais e Valor é a issue 09) e tabela em `ComparativosPage.tsx`.
- apLIS fora do ar: a rota devolve o status e a mensagem da consulta, não 500; a tela mostra aviso com "Tentar novamente".
- Testes: `comparativos.test.ts` (18) e `faturamento-comparativos-volume-envio.test.ts` (16) passam; `npm test` passa (201 arquivos, 2493 testes). O typecheck só aponta os 25 erros já conhecidos de `src/components/IT/MindMapNodes.tsx` e `src/pages/IT/ITProjectMindMap.tsx`.
