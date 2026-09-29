# Backfill histórico de Contas a Receber — Jan a Jun/2026

Status: migration gerada e testada num Postgres local com o schema de
produção (colunas lidas da API, triggers e CHECKs das migrations). Ainda
**não** rodou em produção.

## Por que

A tela Contas a Receber → Títulos não mostrava nada de janeiro a junho: o
backfill de 11/09 (`20260911100000`) só trouxe a planilha do 3º trimestre. O
cliente mandou as planilhas do 1º e do 2º trimestres em 29/09.

## O que foi entregue

1. Seis migrations, uma por mês, com 1058 títulos no total (lote, título,
   vínculo, recebimento e glosas), sem PII. Cada uma tem pré-condições e
   transação próprias e roda sozinha, em qualquer ordem:
   - `supabase/migrations/20260929140000_backfill_contas_receber_2026_01_janeiro.sql`
   - `supabase/migrations/20260929140100_backfill_contas_receber_2026_02_fevereiro.sql`
   - `supabase/migrations/20260929140200_backfill_contas_receber_2026_03_marco.sql`
   - `supabase/migrations/20260929140300_backfill_contas_receber_2026_04_abril.sql`
   - `supabase/migrations/20260929140400_backfill_contas_receber_2026_05_maio.sql`
   - `supabase/migrations/20260929140500_backfill_contas_receber_2026_06_junho.sql`
2. As guias (requisições) saem pelo script do 3º tri, que aceita `--lotes`:
   ```
   npx tsx supabase/scripts/backfill-requisicoes-contas-receber-q3-2026.ts --lotes=$(cat .scratch/faturamento-backfill-h1-2026/lotes.txt) --dry-run
   ```
   Rode **depois** da migration. As mensagens do script falam em "Q3", mas
   ele processa qualquer lista de lotes.
3. `gerador/`: os scripts que leram as planilhas, cruzaram com o apLIS e
   geraram o SQL (`extrair.py` → `classificar.py` → `gerar_sql.py` →
   `montar.py` → `relatorio.py`; os JSON intermediários com dados do apLIS e
   de produção não foram versionados).

| Aba | Títulos | Valor |
|---|---|---|
| JANEIRO | 106 | R$ 1.080.178,49 |
| FEVEREIRO | 113 | R$ 1.020.428,75 |
| MARÇO | 177 | R$ 1.398.540,91 |
| ABRIL | 223 | R$ 1.464.234,44 |
| MAIO | 220 | R$ 1.321.836,91 |
| JUNHO | 219 | R$ 1.296.184,29 |

Conferência que motivou o trabalho: CASSI com emissão em junho = 14 títulos,
R$ 145.557,68 — igual à aba JUNHO da planilha e à soma dos lotes no apLIS.

## Como as 1120 linhas viraram 1058 títulos

| Categoria | Linhas |
|---|---|
| Importadas | 1058 |
| Vazias (sem convênio nem valor) | 18 |
| Excluídas (ver abaixo) | 44 |
| **Total** | **1120** |

## O que veio de onde

- **Operadora, lote, protocolo, datas de criação/envio, status STLOT, NF-e/RPS
  e quantidade de guias**: apLIS (`fatlote`/`fatrps`, lido em 29/09), pelo
  número de lote da planilha. Mesma regra do complemento de 28/09.
- **Emissão** = "Data Faturamento" (é o fechamento do lote no apLIS);
  **vencimento** = "Data Provável Pagamento" (não o do RPS, ver
  `20260928130000`); **competência** = mês da aba.
- **Valor do título**: soma de `ValorLiquido` no apLIS quando o título não tem
  baixa nem glosa (23 lotes diferem da planilha), a regra de
  `20260928140000`. Com baixa ou glosa, fica o "Valor Enviado" da planilha
  (221 lotes diferem do apLIS): é o valor sobre o qual o pagamento e a
  glosa foram lançados, e trocar deixaria saldo fantasma ou negativo.
- **Recebimento**: valor da planilha. Com "Valor Recebido" ≥ valor → `recebido`;
  entre 0 e o valor → `parcial`; zero/vazio → `previsto` na data provável.
- **Glosas**: coluna "Glosas" da planilha.
  - `aberta` por padrão (297), como no 3º tri. A planilha também as conta
    como saldo a receber, com "Glosa Devida?" preenchida ou não.
  - `definitiva` quando a linha marca refaturamento (22): o valor foi
    cobrado de novo em outro lote e não pode contar duas vezes. O título fica
    `liquidada`.
  - `revertida` para a parte que passa de "valor − recebido" (24): a glosa
    foi recuperada em recurso (ex.: CASSI jan, glosa 911,48 e lote pago inteiro).
- O status do título sai do trigger `fat_recalcular_nota`. No teste local:
  635 recebida, 304 parcialmente_recebida, 97 aberta, 22 liquidada.

## Datas de recebimento estimadas (109)

Em MARÇO e MAIO a coluna "Data Recebimento" repete o valor recebido; em ABRIL
30 linhas têm o texto "MARCOS ESTAVA TENTANDO DESENVOLVER..."; outras têm
"VERIFICAR", "COBRAR NOVAMENTE" etc. Nessas, a data é a última baixa do lote
no apLIS (`fatrequisicaoprocedimento.DtaRecebido`) ou, sem ela, a data
provável. Ficam marcadas com "data de recebimento estimada" em
`recebimentos.observacoes`. Linhas: FEVEREIRO:94, MARÇO:25, MARÇO:26, MARÇO:27, MARÇO:28, MARÇO:29, MARÇO:30, MARÇO:31, MARÇO:32, MARÇO:33, MARÇO:34, MARÇO:35, MARÇO:36, MARÇO:37, MARÇO:38, MARÇO:39, MARÇO:40, MARÇO:41, MARÇO:42, MARÇO:43, MARÇO:44, MARÇO:45, MARÇO:46, MARÇO:47, MARÇO:48, MARÇO:49, MARÇO:50, MARÇO:51, MARÇO:52, MARÇO:53, MARÇO:54, MARÇO:56, MARÇO:57, MARÇO:58, ABRIL:25, ABRIL:26, ABRIL:27, ABRIL:28, ABRIL:29, ABRIL:30, ABRIL:31, ABRIL:32, ABRIL:33, ABRIL:34, ABRIL:35, ABRIL:36, ABRIL:37, ABRIL:38, ABRIL:39, ABRIL:40, ABRIL:41, ABRIL:42, ABRIL:43, ABRIL:44, ABRIL:45, ABRIL:46, ABRIL:47, ABRIL:48, ABRIL:49, ABRIL:50, ABRIL:51, ABRIL:52, ABRIL:53, ABRIL:54, ABRIL:70, MAIO:26, MAIO:27, MAIO:28, MAIO:29, MAIO:30, MAIO:31, MAIO:32, MAIO:33, MAIO:34, MAIO:35, MAIO:36, MAIO:37, MAIO:38, MAIO:39, MAIO:40, MAIO:41, MAIO:42, MAIO:43, MAIO:44, MAIO:45, MAIO:46, MAIO:47, MAIO:48, MAIO:49, MAIO:50, MAIO:51, MAIO:52, MAIO:53, MAIO:54, MAIO:55, MAIO:56, MAIO:57, MAIO:58, MAIO:59, MAIO:60, MAIO:61, MAIO:62, MAIO:63, MAIO:64, MAIO:65, MAIO:66, MAIO:67, MAIO:68, MAIO:205.

## Correções automáticas

- FEVEREIRO:97 (PMDF): lote digitado 4900 → lote real 5653 (pelo protocolo)
- MARÇO:117 (INAS-GDF): Data Faturamento '27/03/0226' → ano 2026
- ABRIL:58 (AMIL): lote digitado 5524 → lote real 5525 (pelo protocolo)
- ABRIL:135 (CAMARA): Data Recebimento '16/06/0206' → ano 2026
- ABRIL:157 (INAS-GDF): Data Provável Pagamento '23/05/0226' → ano 2026
- MAIO:49 (AMHPDF - PROASA): lote digitado 5672 → lote real 5762 (pelo protocolo)
- MAIO:205 (SAUDE CAIXA): Data Recebimento '22/0/2026' inválida
- MAIO:210 (SAUDE CAIXA SEM FISICO): lote digitado 58761 → lote real 5876 (pelo protocolo)
- JUNHO:230 (STF): Data Recebimento '27/08/0226' → ano 2026

## Linhas excluídas (44)

### Já têm título em produção (reapresentados e importados no backfill do 3º tri) (12)

| Aba:linha | Convênio | Lote | Valor Enviado | Motivo |
|---|---|---|---|---|
| JANEIRO:94 | PMDF | 4826 | R$ 21.916,12 | lote 4826 já tem título em produção (reapresentado no 3º tri) |
| JANEIRO:95 | PMDF | 4827 | R$ 23.962,23 | lote 4827 já tem título em produção (reapresentado no 3º tri) |
| JANEIRO:96 | PMDF | 4828 | R$ 16.303,07 | lote 4828 já tem título em produção (reapresentado no 3º tri) |
| JANEIRO:102 | PMDF | 4905 | R$ 14.363,97 | lote 4905 já tem título em produção (reapresentado no 3º tri) |
| FEVEREIRO:104 | PMDF | 4898 | R$ 28.353,66 | lote 4898 já tem título em produção (reapresentado no 3º tri) |
| FEVEREIRO:105 | PMDF | 4989 | R$ 10.135,92 | lote 4989 já tem título em produção (reapresentado no 3º tri) |
| ABRIL:172 | PMDF | 5429 | R$ 1.448,00 | lote 5429 já tem título em produção (reapresentado no 3º tri) |
| ABRIL:202 | SIS SENADO | 5424 | R$ 348,67 | lote 5424 já tem título em produção (reapresentado no 3º tri) |
| ABRIL:237 | TRT | 5371 | R$ 0,00 | lote 5371 já tem título em produção (reapresentado no 3º tri) |
| ABRIL:238 | TRT | 5370 | R$ 0,00 | lote 5370 já tem título em produção (reapresentado no 3º tri) |
| MAIO:140 | CBMDF | 5894 | R$ 463,74 | lote 5894 já tem título em produção (reapresentado no 3º tri) |
| JUNHO:149 | GEAP RESOLVIDA / 2025 | 4421 | R$ 10.303,10 | lote 4421 já tem título em produção (reapresentado no 3º tri) |

### Lote repetido em mais de uma linha ou de outra operadora (8)

| Aba:linha | Convênio | Lote | Valor Enviado | Motivo |
|---|---|---|---|---|
| JANEIRO:79 | FASCAL | 4919 | R$ 13.649,56 | lote 4919 é da SUL AMERICA (linha JANEIRO:124); linha sem protocolo |
| JANEIRO:122 | SUL AMERICA | 4818 | R$ 17.065,93 | lote 4818 é da AMIL (linha JANEIRO:41); protocolo 260130009297 não existe no apLIS |
| FEVEREIRO:113 | POSTAL | 4935 | R$ 510,39 | lote 4935 repetido em ABRIL:193 (mesmo valor recebido); fica ABRIL, mês do fechamento no apLIS |
| ABRIL:119 | CASSI | 5188 | R$ 8.783,38 | lote 5188 repetido em ABRIL:109 (mesmo protocolo e valor) |
| ABRIL:227 | TJDF | 5200 | R$ 16.256,91 | lote 5200 devolvido (protocolo 476016) e reapresentado em MAIO:230 com o protocolo atual |
| MAIO:156 | GEAP | 5675 | R$ 2.477,59 | lote 5675 reapresentado em JUNHO:147 com o protocolo atual |
| MAIO:159 | GEAP | 5692 | R$ 2.037,29 | lote 5692 reapresentado em JUNHO:148 com o protocolo atual |
| MAIO:238 | GEAP | 5699 | R$ 31,18 | lote 5699 repetido em MAIO:160 (mesmo protocolo e valor) |

### Lote não existe no apLIS e o protocolo não acha outro (6)

| Aba:linha | Convênio | Lote | Valor Enviado | Motivo |
|---|---|---|---|---|
| FEVEREIRO:130 | TJDF | 5043 | R$ 795,72 | lote 5043 não existe no apLIS e o protocolo não acha outro |
| FEVEREIRO:132 | TJDF | 5034 | R$ 20.877,63 | lote 5034 não existe no apLIS e o protocolo não acha outro |
| MARÇO:55 | AMHPDF - PROASA | 5213 | R$ 2.167,23 | lote 5213 não existe no apLIS e o protocolo não acha outro |
| MARÇO:200 | MEDIGEST -  ASSEFAZ | 5170 | R$ 542,22 | lote 5170 não existe no apLIS e o protocolo não acha outro |
| MAIO:120 | CASSI - PERIÓDICO | 5689 | R$ 35,66 | lote 5689 não existe no apLIS e o protocolo não acha outro |
| MAIO:247 | TRT | 5680 | R$ 818,77 | lote 5680 não existe no apLIS e o protocolo não acha outro |

### PARTICULARES (total do mês, não é lote) (7)

| Aba:linha | Convênio | Lote | Valor Enviado | Motivo |
|---|---|---|---|---|
| FEVEREIRO:143 | PARTICULARES | — | R$ 61.000,00 | PARTICULARES: total do mês, não é lote de convênio |
| MARÇO:195 | PARTICULARES | — | R$ 58.000,00 | PARTICULARES: total do mês, não é lote de convênio |
| ABRIL:243 | PARTICULARES | — | R$ 52.753,40 | PARTICULARES: total do mês, não é lote de convênio |
| MAIO:252 | PARTICULARES | — | R$ 64.900,00 | PARTICULARES: total do mês, não é lote de convênio |
| MAIO:255 | PARTICULARES | — | — | PARTICULARES: total do mês, não é lote de convênio |
| JUNHO:245 | PARTICULARES | — | R$ 72.691,19 | PARTICULARES: total do mês, não é lote de convênio |
| JUNHO:248 | PARTICULARES | — | — | PARTICULARES: total do mês, não é lote de convênio |

### Outros (11)

| Aba:linha | Convênio | Lote | Valor Enviado | Motivo |
|---|---|---|---|---|
| MAIO:25 | ALLIANZALIVE | — | R$ 0,00 | sem lote ou sem valor enviado |
| MAIO:256 | MEDIGEST - ASSEFAZ | — | — | sem lote ou sem valor enviado |
| MAIO:257 | MEDIGEST - SAUDE CAIXA | — | — | sem lote ou sem valor enviado |
| MAIO:258 | MEDIGEST - PARTICULAR | — | — | sem lote ou sem valor enviado |
| MAIO:259 | MEDIGEST - ASSEFAZ | — | — | sem lote ou sem valor enviado |
| JUNHO:86 | ASSEFAZ PENDÊNCIA RESOLVIDA | 5669 | — | cancelado na planilha (CANCELADO PELA RIVIA) |
| JUNHO:249 | MEDIGEST - ASSEFAZ | — | — | sem lote ou sem valor enviado |
| JUNHO:250 | MEDIGEST - SAUDE CAIXA | — | — | sem lote ou sem valor enviado |
| JUNHO:251 | MEDIGEST - PARTICULAR | — | — | sem lote ou sem valor enviado |
| JUNHO:252 | MEDIGEST - ASSEFAZ | — | — | sem lote ou sem valor enviado |
| JUNHO:204 | SIS SENADO | 6130 | R$ 0,00 | SIS SENADO devolvido com Valor Enviado 0 (apLIS 439,13) |

## Para revisar com o cliente

- Os 12 lotes que já têm título em produção foram cobrados de novo no 3º tri
  (devolvidos/refaturados). O título existente não foi alterado.
- Lotes da planilha que não existem no apLIS (TJDF 5043/5034, devolvidos e
  gerados de novo como 5463/5464/5466; AMHPDF PROASA 5213; CASSI-PERIÓDICO
  5689; TRT 5680 glosa total; MEDIGEST 5170) não viraram título.
- 4 linhas traziam o lote de outra operadora: ABRIL:58 e MAIO:49 foram
  corrigidas pelo protocolo; JANEIRO:122 (SUL AMERICA, R$ 17.065,93) e
  JANEIRO:79 (FASCAL, R$ 13.649,56) ficaram de fora porque o protocolo não
  achou o lote.
- A MEDIGEST (clínica parceira, fora da meta) entra com os lotes que existem no
  apLIS; aparece na tela quando "Ocultar clínicas parceiras" está desligado.

## Antes do `supabase db push`

Cada migration falha se algum lote dela já existir em `lotes`. Se o sistema
cadastrar algum desses lotes pela tela até lá, rode a checagem no SQL editor
de produção e tire a linha:

```sql
SELECT aplis_id FROM lotes WHERE aplis_id = ANY(string_to_array('<conteúdo de lotes.txt>', ','));
```
