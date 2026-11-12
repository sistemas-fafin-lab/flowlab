# 05: Ranking de códigos de glosa e requisições por código

**What to build:** na aba Comparativos, o ranking de códigos de glosa com alternador **Total | Acatada** (padrão Acatada), mostrando código, descrição, valor, quantidade e % do total. Clicar num código abre a tabela de requisições (requisição, guia, lote, convênio, procedimento, valor glosado, status, data) com exportação CSV e **sem nome de paciente**. A lista vem da foto de recursos e/ou dos demonstrativos do apLIS, não de `glosas.requisicao_id` (quase vazio). Ver `../spec.md`.

**Blocked by:** 04

**Status:** done (aguardando conferência ao vivo com a usuária)

- [x] O ranking Acatada e o Total batem com o funil do mesmo mês.
- [x] Código sem descrição aparece só pelo código.
- [x] A tabela e o CSV não contêm nome de paciente.
- [x] Testes do ranking (ordenação, percentual, centavos) e da rota; `npm test` e typecheck passam.

## Entregue

Rota `GET /api/faturamento/comparativos-ranking-glosa?mes=YYYY-MM`; cálculo puro em `src/modules/faturamento/utils/rankingCodigosGlosa.ts`; bloco na aba Comparativos (`RankingCodigosGlosaComparativo.tsx`), logo abaixo do funil.

- **Mesmas glosas do funil**: a rota lê a foto de recursos com `glosasParaFunil` e põe cada glosa no mês pela mesma regra do funil (`mesDaGlosaNoFunil`, extraída de `funilGlosa.ts`). Total = glosa total do funil (recuperada + acatada + em disputa); Acatada = acatada do funil.
- **Código**: vem do apLIS por procedimento (`glosasDasRequisicoes` em `bdLab.ts`: demonstrativo → catálogo `fatmotivoglosa` → texto livre, a mesma `resolverCodigoGlosa` da tela do lote). Entra todo procedimento com algum sinal de glosa (demonstrativo, motivo ou recebido abaixo do líquido), porque no recurso pago o apLIS sobrescreve o recebido. Conferido no banco em 12/11/2026: as 40 requisições glosadas mais recentes vieram todas com código.
- **Rateio**: o valor da requisição no funil é dividido entre os códigos dela pelo valor glosado de cada um, em centavos (maiores restos), e a soma fecha com o funil. Procedimento sem valor glosado pesa a média dos outros. A parte sem código vai para "Sem código", sempre por último no ranking.
- **Quantidade** = requisições distintas com o código; **%** = sobre o total do modo, 1 casa.
- **Tabela de requisições** (clique no código): requisição, guia, lote, convênio, procedimento, valor glosado, status do apLIS e data (retorno mais recente da operadora). A glosa de lote sem título aparece como "<lote do apLIS> · Fora de lote". O CSV (`;`, vírgula decimal, BOM) tem ainda as colunas Código e Classe no funil. Nenhum nome de paciente é lido da foto.
- A tela mostra um mês por vez (referência, M-1, M-2, cada um com seu total) e o alternador Total | Acatada, com Acatada como padrão.

### Para conferir com a usuária

- Na glosa **recuperada** (recurso pago), o apLIS zera o "não recebido" do procedimento. Se um procedimento ainda tem valor de demonstrativo, ele pode levar a maior parte do rateio no modo Total. Os totais continuam batendo; só a divisão entre códigos fica aproximada.
