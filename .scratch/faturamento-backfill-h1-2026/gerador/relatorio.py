# Gera o relatório de importação a partir de classificadas.json, resumo.json e
# do status dos títulos medido no Postgres local (h1/status_local.json).
import json, collections

C = json.load(open('h1/classificadas.json'))
r = json.load(open('h1/resumo.json'))
t = r['tot']
ST = json.load(open('h1/status_local.json'))
L = {f"{l['aba']}:{l['linha']}": l for l in json.load(open('h1/linhas.json'))}
extra = dict(r['excluidas_extra'])


def br(v):
    return f"{v:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')


def env(ref):
    v = L[ref]['valor_enviado']
    return 'R$ ' + br(v) if isinstance(v, (int, float)) else '—'


exc = [c for c in C if c['acao'] == 'excluir'] + [
    {'ref': a, 'convenio': L[a]['convenio'], 'lote': int(L[a]['lote']), 'motivo': b} for a, b in extra.items()]
vaz = [c for c in C if c['acao'] == 'vazia']
imp = [c for c in C if c['acao'] == 'importar' and c['ref'] not in extra]
pm = '\n'.join(f"| {k} | {n} | R$ {br(v)} |" for k, (n, v) in r['por_mes'].items())

grupos = collections.OrderedDict([
    ('Já têm título em produção (reapresentados e importados no backfill do 3º tri)', lambda m: 'já tem título' in m),
    ('Lote repetido em mais de uma linha ou de outra operadora',
     lambda m: 'repetido' in m or 'reapresentado em' in m or ' é d' in m or 'devolvido (protocolo' in m),
    ('Lote não existe no apLIS e o protocolo não acha outro', lambda m: 'não existe no apLIS' in m),
    ('PARTICULARES (total do mês, não é lote)', lambda m: 'PARTICULARES' in m),
    ('Outros', lambda m: True)])
usado, sec = set(), []
for titulo, f in grupos.items():
    xs = [c for c in exc if c['ref'] not in usado and f(c['motivo'])]
    usado |= {c['ref'] for c in xs}
    if xs:
        sec.append(f"### {titulo} ({len(xs)})\n\n| Aba:linha | Convênio | Lote | Valor Enviado | Motivo |\n|---|---|---|---|---|\n"
                   + '\n'.join(f"| {c['ref']} | {(c['convenio'] or '').strip()} | {c['lote'] or '—'} | {env(c['ref'])} | {c['motivo']} |" for c in xs))
n_prod = sum(1 for c in exc if 'já tem título' in c['motivo'])
corr = [(c['ref'], c['convenio'], o) for c in imp for o in c['obs']]
va, vp = r['valor_aplis'], r['valor_planilha']

md = f"""# Backfill histórico de Contas a Receber — Jan a Jun/2026

Status: migration gerada e testada num Postgres local com o schema de
produção (colunas lidas da API, triggers e CHECKs das migrations). Ainda
**não** rodou em produção.

## Por que

A tela Contas a Receber → Títulos não mostrava nada de janeiro a junho: o
backfill de 11/09 (`20260911100000`) só trouxe a planilha do 3º trimestre. O
cliente mandou as planilhas do 1º e do 2º trimestres em 29/09.

## O que foi entregue

1. Seis migrations, uma por mês, com {t['titulos']} títulos no total (lote, título,
   vínculo, recebimento e glosas), sem PII. Cada uma tem pré-condições e
   transação próprias e roda sozinha, em qualquer ordem:
{chr(10).join('   - `supabase/migrations/' + a + '`' for a in open('h1/arquivos.txt').read().split())}
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
{pm}

Conferência que motivou o trabalho: CASSI com emissão em junho = 14 títulos,
R$ 145.557,68 — igual à aba JUNHO da planilha e à soma dos lotes no apLIS.

## Como as {len(C)} linhas viraram {t['titulos']} títulos

| Categoria | Linhas |
|---|---|
| Importadas | {t['titulos']} |
| Vazias (sem convênio nem valor) | {len(vaz)} |
| Excluídas (ver abaixo) | {len(exc)} |
| **Total** | **{len(C)}** |

## O que veio de onde

- **Operadora, lote, protocolo, datas de criação/envio, status STLOT, NF-e/RPS
  e quantidade de guias**: apLIS (`fatlote`/`fatrps`, lido em 29/09), pelo
  número de lote da planilha. Mesma regra do complemento de 28/09.
- **Emissão** = "Data Faturamento" (é o fechamento do lote no apLIS);
  **vencimento** = "Data Provável Pagamento" (não o do RPS, ver
  `20260928130000`); **competência** = mês da aba.
- **Valor do título**: soma de `ValorLiquido` no apLIS quando o título não tem
  baixa nem glosa ({len(va)} lotes diferem da planilha), a regra de
  `20260928140000`. Com baixa ou glosa, fica o "Valor Enviado" da planilha
  ({len(vp)} lotes diferem do apLIS): é o valor sobre o qual o pagamento e a
  glosa foram lançados, e trocar deixaria saldo fantasma ou negativo.
- **Recebimento**: valor da planilha. Com "Valor Recebido" ≥ valor → `recebido`;
  entre 0 e o valor → `parcial`; zero/vazio → `previsto` na data provável.
- **Glosas**: coluna "Glosas" da planilha.
  - `aberta` por padrão ({t['glosa_aberta']}), como no 3º tri. A planilha também as conta
    como saldo a receber, com "Glosa Devida?" preenchida ou não.
  - `definitiva` quando a linha marca refaturamento ({t['glosa_definitiva']}): o valor foi
    cobrado de novo em outro lote e não pode contar duas vezes. O título fica
    `liquidada`.
  - `revertida` para a parte que passa de "valor − recebido" ({t['glosa_revertida']}): a glosa
    foi recuperada em recurso (ex.: CASSI jan, glosa 911,48 e lote pago inteiro).
- O status do título sai do trigger `fat_recalcular_nota`. No teste local:
  {', '.join(f'{n} {s}' for s, n in ST.items())}.

## Datas de recebimento estimadas ({len(r['data_receb_estimada'])})

Em MARÇO e MAIO a coluna "Data Recebimento" repete o valor recebido; em ABRIL
30 linhas têm o texto "MARCOS ESTAVA TENTANDO DESENVOLVER..."; outras têm
"VERIFICAR", "COBRAR NOVAMENTE" etc. Nessas, a data é a última baixa do lote
no apLIS (`fatrequisicaoprocedimento.DtaRecebido`) ou, sem ela, a data
provável. Ficam marcadas com "data de recebimento estimada" em
`recebimentos.observacoes`. Linhas: {', '.join(r['data_receb_estimada'])}.

## Correções automáticas

{chr(10).join(f'- {a} ({b.strip()}): {o}' for a, b, o in corr)}

## Linhas excluídas ({len(exc)})

{(chr(10) * 2).join(sec)}

## Para revisar com o cliente

- Os {n_prod} lotes que já têm título em produção foram cobrados de novo no 3º tri
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
"""
open('h1/relatorio-importacao.md', 'w').write(md)
