Status: ready-for-agent
Type: task
Blocked by: 07

# Pendências: requisições particulares sem NF emitida

## Onde

Mesma aba "Pendências" da issue 07 (`ContasReceberPage.tsx`) + consulta/endpoint próprios em `api/_lib/faturamento/bdLab.ts` e `api/faturamento/[action].ts`.

## Regra (decidida no grilling, espelha a subtab "recebido" da planilha do setor)

- Fonte pagadora `IdFontePagadora = 1102` (PARTICULAR, ativa no apLIS; a linha tem flag `fatinstituicao.Particular = 1` — a 101, inativa, também é Particular). Verificado no banco real: `IdInstituicao 101` = "PARTICULAR" (`Particular=1`, `Inativo=1`); `IdInstituicao 1102` = "PARTICULAR" (`Particular=1`, `Inativo=0`) — não há erro de digitação, são dois IDs de 3 e 4 dígitos legítimos.
- Evento de laudo liberado: `CodEvento` 11 (Laudo Concluído Definitivo), 56 (Concluído - Laudo em Fotos), 16 (Microscopia), 1000 (Microscopia - Aguarda Liberação), 9 (Histotécnica), 19 (Envio material parceiro).
- Sem NF emitida (lote sem `IdRPS` / requisição sem `NFeReq`).
- Referência: evento 1040 "Requisição para pagamento no particular" (rótulo com typo no banco: "Requsição").

## O que fazer

1. Consulta no `bdLab.ts`: requisições/lotes da fonte 1102 com os eventos acima e sem NF.
2. Ação na API — pode compartilhar o endpoint da issue 07 com um filtro/seção "Particulares".
3. Exibir na aba "Pendências" (seção ou filtro "Particulares").

## Critérios de aceite

- Lista somente particulares com laudo liberado e sem NF.
- Sem ruído de outras fontes pagadoras.
