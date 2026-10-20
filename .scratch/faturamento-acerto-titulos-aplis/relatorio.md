# Faturamento: títulos da planilha acertados pelo apLIS

Status: ready-for-human (migration gerada, aguardando revisão para rodar em produção)

## Problema

Cliente (20/10/2026): a conferência com o apLIS mostrava diferença de R$ 12.117,84
no lote 4797, "mas no apLIS a diferença é só a glosa", e títulos com diferença
"com valores iguais" (ex.: NF 9049, lote 6030).

A conferência estava certa. Os títulos dos backfills Jan–Jun e Jul–Set/2026 foram
gravados com o valor, a baixa e a glosa da **planilha do cliente**, que em ~530
títulos não batem com o apLIS:

- 4797: título de R$ 17.563,35 (valor da planilha) × lote de R$ 28.465,80 no apLIS;
  recebido 14.727,45 × 26.845,29; glosa 2.835,90 × 1.620,51.
- 6030 (NF 9049), 6114 e mais 33: baixa da planilha (R$ 86.724,13 no total), mas o
  lote segue "Faturado" no apLIS, sem recebimento (conferido ao vivo no site).
- 5768 (NF 8669): baixa de 25/09 lançada duas vezes em 14/10, com 7 s de diferença.

Decisão do usuário: o apLIS é o correto; estornar as baixas sem recebimento no
apLIS; substituir baixa e glosa da planilha pelas do apLIS; gerar migration para
revisão (não aplicar direto).

## Correção

- Gerador (somente leitura): `supabase/scripts/acerto-titulos-planilha-pelo-aplis.ts`.
  Usa as mesmas regras do "Aplicar baixas e glosas do apLIS" (`baixasSugeridas`,
  `glosasSugeridas`).
- Migration: `supabase/migrations/20261020120100_fat_acerto_titulos_planilha_pelo_aplis.sql`.
  668 títulos, numa transação, com uma verificação no fim que desfaz tudo se algum título
  não terminar com o valor, o recebido e a glosa esperados.
- Por título: valor do título e do lote = Σ ValorLiquido do apLIS; baixas e glosas
  da planilha saem; baixa repetida sai; entram as baixas do apLIS (uma por data) e
  as glosas do apLIS (origem `aplis`). Baixas e glosas lançadas à mão ou pelo botão
  ficam.
- Totais: valor −R$ 69.136,24; recebido +R$ 61.235,18; glosa −R$ 162.370,13.
- `titulos-acerto-aplis.csv`: antes/depois por título (valor, recebido, glosa,
  baixas e glosas que saem e entram).
- `antes-do-acerto.json`: estado completo dos 668 títulos antes da correção
  (notas, lotes, baixas, glosas), para desfazer se preciso.

Casos que ficam abertos depois do acerto (sem erro, é o estado do apLIS):

- 61 títulos: diferença no apLIS sem motivo de glosa (ex.: 4797, R$ 1.215,39 de
  "recurso não acatado" sem valor recebido) — saldo segue aberto.
- 17 títulos: glosas do apLIS passariam do saldo (o lote recebeu a mais em outros
  procedimentos) — valor e baixas acertados, glosa fica para conferir.

## Ficam para o setor (não mudam)

| NF | Operadora | Lote | Recebido no sistema | Recebido no apLIS | Motivo |
|---|---|---|---|---|---|
| 9223 | ASSEFAZ | 6388 | 11.198,70 | 1.293,42 | baixa lançada no sistema passa do recebido no apLIS |
| 9466 | BRADESCO SAUDE S/A 421715 | 6540 | 7.195,01 | 5.803,40 | idem |
| 9266 | BRADESCO SAUDE S/A 421715 | 6503 | 14.899,77 | 13.859,52 | idem |
| 9262 | BRADESCO SAUDE - 005711 | 6500 | 31.355,06 | 29.990,20 | idem |
| 9209 | PMDF | 6517 | 14.909,44 | 14.149,50 | idem |
| 9209 | PMDF | 6524 | 17.315,02 | 17.248,20 | idem |
| 9197 | BRADESCO SAUDE - 005711 | 6328 | 32.863,78 | 32.181,35 | idem |
| 8035 | INAS GDF | 5224 | 5.490,34 | 5.459,99 | idem |
| 8035 | INAS GDF | 5325 | 1.219,72 | 1.194,05 | idem |
| 8035 | INAS GDF | 5155 | 500,63 | 500,63 | tem glosa digitada à mão |

## Como aplicar

1. Revisar a migration e o CSV.
2. Gerar de novo logo antes de aplicar (os dados mudam com o uso):
   `npx tsx supabase/scripts/acerto-titulos-planilha-pelo-aplis.ts supabase/migrations/20261020120100_fat_acerto_titulos_planilha_pelo_aplis.sql .scratch/faturamento-acerto-titulos-aplis/titulos-acerto-aplis.csv`
   (com `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` de produção e `DB_*` do apLIS).
3. Rodar no SQL Editor de produção. Se a verificação do fim acusar diferença, nada é gravado.
4. Depois: "Conferir baixas com o apLIS" deve mostrar só os casos acima e os
   lançados no sistema depois de 29/09.

## Segunda etapa: cadastro (20/10/2026)

Aplicada a migration 20261020120100, um novo levantamento
(`inconsistencias-20-10.md`) deu origem à
`supabase/migrations/20261020150100_fat_acerto_cadastro_lotes_pelo_aplis.sql`
(gerador: `supabase/scripts/acerto-lotes-cadastro-pelo-aplis.ts`):

- 265 lotes: status (211), NF e RPS (67), protocolo (9), qtd. de requisições (5).
- 8 títulos com a NF reemitida no apLIS passam a ter o número atual.
- Lote 6877: valor do título e do lote 7.531,43 → 7.542,44 (ganhou uma requisição).

Ficam para o setor: títulos com duas NFs (6577 "9169, 9170" × 9165; 5225 "8035, 8034" × 8035);
77 lotes fechados em 2026 sem título (R$ 358 mil; Medigest R$ 280 mil);
4 lotes LOT-2026-001..004 sem aplis_id nem título; 5 baixas novas do apLIS (botão).
