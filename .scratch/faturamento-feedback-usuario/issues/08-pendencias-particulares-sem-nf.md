Status: done
Type: task
Blocked by: 07

# Pendências: requisições particulares sem NF emitida

## Onde

Mesma aba "Pendências" da issue 07 (`ContasReceberPage.tsx`) + consulta/endpoint próprios em `api/_lib/faturamento/bdLab.ts` e `api/faturamento/[action].ts`.

## Regra (decidida no grilling, espelha a subtab "recebido" da planilha do setor; revista pela issue 19)

- Fonte pagadora `IdFontePagadora = 1102` (PARTICULAR, ativa no apLIS; a linha tem flag `fatinstituicao.Particular = 1` — a 101, inativa, também é Particular). Verificado no banco real: `IdInstituicao 101` = "PARTICULAR" (`Particular=1`, `Inativo=1`); `IdInstituicao 1102` = "PARTICULAR" (`Particular=1`, `Inativo=0`) — não há erro de digitação, são dois IDs de 3 e 4 dígitos legítimos.
- Sem NF emitida (lote sem `IdRPS` / requisição sem `NFeReq`).
- **Sem exigência de laudo liberado (issue 19, 24/08):** a regra original também exigia `CodEvento` de laudo liberado (11, 56, 16, 1000, 9, 19), mas o setor reportou que a NF do particular precisa ser emitida no momento do **pagamento**, que acontece antes do laudo — esse corte escondia particulares que já deveriam ter NF emitida. Removido.
- **Janela M-1 (issue 19):** sem o corte por evento, a lista passa a contar da data de registro da requisição (`DtaSolicitacao`); pra não virar ruído com particulares muito antigos, aplica a mesma janela M-1 de `listarLotesPendentes` (issue 18).
- Referência: evento 1040 "Requisição para pagamento no particular" (rótulo com typo no banco: "Requsição").

## O que fazer

1. Consulta no `bdLab.ts`: requisições/lotes da fonte 1102 sem NF, dentro da janela M-1.
2. Ação na API — pode compartilhar o endpoint da issue 07 com um filtro/seção "Particulares".
3. Exibir na aba "Pendências" (seção ou filtro "Particulares").

## Critérios de aceite

- Lista particulares sem NF independente do laudo ter sido liberado ou não, dentro da janela M-1.
- Sem ruído de outras fontes pagadoras.
