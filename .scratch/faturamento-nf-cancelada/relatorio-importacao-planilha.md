# Importação das NFs canceladas da planilha

Gerado por `supabase/scripts/importar-nfs-canceladas-planilha.ts` em 27/10/2026, com a aba
"NF CANCELADAS FORA APLIS" da planilha "CONTROLE DE EMISSÃO DE NOTAS", o Supabase de produção e o apLIS.
A migration é `supabase/migrations/20261027180000_fat_nfs_canceladas_planilha.sql`.

Regra do vínculo: título da mesma operadora, emitido no mesmo dia ou até 30 dias depois da
NF cancelada, com lote em comum ou o mesmo valor, e só quando há um candidato. Os lotes da NF
cancelada vêm do texto dela no apLIS (`fatrps.DadosAdicionais`), porque o apLIS já não a liga
a lote nenhum. A data do cancelamento é a emissão do título substituto ou, sem título, a da NF.

## Ligadas a um título (0)

_Nenhuma._

## Sem título, ligadas só à operadora (11)

Aparecem na busca por número da lista de títulos. A tabela é append-only e não tem tela de
vínculo: ligar uma delas a um título pede uma migration de dados. Os títulos listados abaixo
de cada NF têm um lote dela, mas a regra os recusou (outra operadora ou emitidos antes da NF:
os títulos importados da planilha levaram a data do lote, não a da NF).

- **NF 7724 — E-VIDA, R$ 48,37, emitida em 30/03/2026** — nenhum título de E-VIDA emitido até 30 dias depois com lote em comum ou o mesmo valor. Operadora: E-VIDA (pelo apLIS); lote(s) 4964 no texto da NF.
  Títulos com lote da NF, fora da regra:
  - NF s/ nº de 03/02/2026, R$ 48,37, lote(s) 4964 (`95c48fe9-9ab6-538b-bc2a-e3008ff0d935`) — emitido antes da NF
- **NF 7496 — SIS, R$ 6.941,85, emitida em 04/03/2026** — nenhum título de SIS SENADO emitido até 30 dias depois com lote em comum ou o mesmo valor. Operadora: SIS SENADO (pelo apLIS); lote(s) 5124 no texto da NF.
  Títulos com lote da NF, fora da regra:
  - NF 7633 de 02/03/2026, R$ 6.891,66, lote(s) 5124 (`2e7cbc31-7039-5dbf-99be-94d7bdf98ac7`) — de FASCAL, emitido antes da NF
- **NF 7495 — SIS, R$ 96,24, emitida em 05/03/2026** — nenhum título de SIS SENADO emitido até 30 dias depois com lote em comum ou o mesmo valor. Operadora: SIS SENADO (pelo apLIS); lote(s) 4967 no texto da NF.
- **NF 7498 — SIS, R$ 5.348,65, emitida em 05/03/2026** — nenhum título de SIS SENADO emitido até 30 dias depois com lote em comum ou o mesmo valor. Operadora: SIS SENADO (pelo apLIS); lote(s) 4729 no texto da NF.
  Títulos com lote da NF, fora da regra:
  - NF 7635 de 02/01/2026, R$ 5.248,26, lote(s) 4729 (`6d677709-d5c6-56d9-8e99-d80bae8a102f`) — de FASCAL, emitido antes da NF
- **NF 7504 — PLAN ASSISTE, R$ 37.956,81, emitida em 09/03/2026** — nenhum título de LAB PLANASSISTE emitido até 30 dias depois com lote em comum ou o mesmo valor. Operadora: LAB PLANASSISTE (pelo apLIS; o nome da planilha apontaria outra operadora); NF no apLIS sem lote no texto.
- **NF 7831 — GEAP, R$ 10.535,86, emitida em 16/04/2026** — nenhum título de GEAP Autogestão em Saúde emitido até 30 dias depois com lote em comum ou o mesmo valor. Operadora: GEAP Autogestão em Saúde (pelo nome); NF fora do apLIS.
- **NF 7914 — TJDFT, R$ 18.852,91, emitida em 23/04/2026** — nenhum título de TJDFT emitido até 30 dias depois com lote em comum ou o mesmo valor. Operadora: TJDFT (pelo apLIS); lote(s) 5033, 5204, 5212, 5201 no texto da NF.
  Títulos com lote da NF, fora da regra:
  - NF s/ nº de 14/03/2026, R$ 9.626,08, lote(s) 5212 (`2868eafc-6b64-5046-a6c5-9316aa3b7219`) — emitido antes da NF
  - NF s/ nº de 13/03/2026, R$ 92,08, lote(s) 5201 (`7149edb5-e889-5791-a339-7e1505a4c9b0`) — emitido antes da NF
  - NF s/ nº de 13/03/2026, R$ 1.364,42, lote(s) 5033 (`b8c8b31e-3dff-5191-b2d0-b0ea9d46e43e`) — emitido antes da NF
  - NF 8859 de 14/03/2026, R$ 8.808,09, lote(s) 5204 (`369f93c1-8dbc-5828-a5aa-5919afcaef10`) — emitido antes da NF
- **NF 7996 — TRT, R$ 940,98, emitida em 07/05/2026** — nenhum título de TRT emitido até 30 dias depois com lote em comum ou o mesmo valor. Operadora: TRT (pelo nome); NF fora do apLIS.
- **NF 7787 — STF MED, R$ 6.867,86, emitida em 11/05/2026** — nenhum título de STF emitido até 30 dias depois com lote em comum ou o mesmo valor. Operadora: STF (pelo CNPJ do tomador); lote(s) 4941, 5023, 4939 no texto da NF.
  Títulos com lote da NF, fora da regra:
  - NF s/ nº de 04/02/2026, R$ 935,80, lote(s) 4941 (`2ea7d537-38ab-58dc-b192-182c39b10eca`) — emitido antes da NF
  - NF s/ nº de 02/02/2026, R$ 3.648,97, lote(s) 4939 (`74a52d2a-7b5d-5123-b5c5-73dc09a32f79`) — emitido antes da NF
  - NF s/ nº de 18/02/2026, R$ 2.283,38, lote(s) 5023 (`eef13560-6da3-59de-89ae-ce9811be94e1`) — emitido antes da NF
- **NF 7793 — BRADESCO, R$ 20.954,24, emitida em 15/04/2026** — nenhum título de BRADESCO SAUDE S/A 421715 emitido até 30 dias depois com lote em comum ou o mesmo valor. Operadora: BRADESCO SAUDE S/A 421715 (pelo apLIS); NF no apLIS sem lote no texto.
- **NF 7990 — BRADESCO OPERADORA, R$ 6.582,79, emitida em 05/05/2026** — nenhum título de BRADESCO SAUDE S/A 421715 emitido até 30 dias depois com lote em comum ou o mesmo valor. Operadora: BRADESCO SAUDE S/A 421715 (pelo CNPJ do tomador); NF no apLIS sem lote no texto.

## Operadora contra o nome da planilha (1)

O convênio da NF no apLIS (ou o CNPJ do tomador) apontou uma operadora diferente da que o nome
da planilha apontaria. Vale o apLIS; conferir.

- NF 7504: "PLAN ASSISTE" na planilha, LAB PLANASSISTE pelo apLIS.

## Operadora ambígua, não importadas (0)

_Nenhuma._

## Fora desta importação (29)

As demais linhas da aba não entram aqui (decisão de 27/10/2026): várias ainda são o número
atual de títulos no flowlab, o que pede a troca da NF no título com "NF anterior cancelada",
não a importação.

| NF | Convênio | Valor | Emissão | Observação |
|---|---|---|---|---|
| 7991 | BRADESCO SAUDE | 46.898,38 | 05/05/2026 | emitida com a competência errada |
| 7907 | GDF | 48.542,80 | 20/04/2026 | Emitida sem o valor do IR  |
| 7054 e 7052 | GDF | — | — | Aguardando a declaração da NF 7054 e 7052 PARA CANCELAMENTO |
| 8662 | LUMINAR | 166,03 | 10/07/2026 | A pedido do convênio, pois a conta foi glosa total  |
| 9083 | PMDF | 2.136,95 | 24/08/2026 | DESCRIÇÃO ERRADA |
| 9070 | PMDF | 21.824,39 | 24/08/2026 | DESCRIÇÃO ERRADA |
| 8763 | LUMINAR | 3.044,59 | — | DESCRIÇÃO ERRADA |
| 9164 | TST | 15.190,85 | 02/09/2026 | DESCRIÇÃO ERRADA |
| 9165 | TST | 898,69 | 02/09/2026 | DESCRIÇÃO ERRADA |
| 9166 | TST | 15.190,85 | — | — |
| 9209 | PMDF | 161.518,29 | 15/09/2026 | DESCRIÇÃO DAS COMPETENCIAS ERRADAS |
| 9229 | CASSI | 49,76 | 18/09/2026 | É DE GLOSA - EMITIDA ERRADA |
| 9133 | POSTAL SAÚDE | 24.497,88 | 31/08/2026 | CEP ALTERADO. EMITIDA OUTRA COM NOVO CEP |
| 8972 | POSTAL SAÚDE | 19.742,56 | 12/08/2026 | CEP ALTERADO. EMITIDA OUTRA COM NOVO CEP |
| 8973 | POSTAL SAÚDE | 16.814,20 | 12/08/2026 | CEP ALTERADO. EMITIDA OUTRA COM NOVO CEP |
| 9440 | — | — | — | — |
| 9446 | plan assiste | 27.054,50 | — | — |
| 9527 | assefaz | 2.661,16 | 19/10/2026 | valor errado |
| 9520 | assefaz | 14.889,67 | 19/10/2026 | site unificou os valores uma nota só. |
| 9525 | assefaz | 417,91 | 19/10/2026 | site unificou os valores uma nota só. |
| 9526 | assefaz | 5.755,17 | 19/10/2026 | site unificou os valores uma nota só. |
| 9530 | assefaz | 2.661,16 | 19/10/2026 | site unificou os valores uma nota só. |
| 9528 | assefaz | 1.700,63 | 19/10/2026 | site unificou os valores uma nota só. |
| 9529 | assefaz | 182,66 | 19/10/2026 | site unificou os valores uma nota só. |
| 9531 | assefaz | 13.764,80 | 19/10/2026 | site unificou os valores uma nota só. |
| 9532 | assefaz | 18.899,91 | 19/10/2026 | site unificou os valores uma nota só. |
| 9533 | assefaz | 9.736,36 | 19/10/2026 | site unificou os valores uma nota só. |
| 9536 | assefaz | 1.113,35 | 19/10/2026 | site unificou os valores uma nota só. |
| 9534 | assefaz | 2.194,74 | 19/10/2026 | site unificou os valores uma nota só. |
