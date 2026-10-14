# 01 — Glosas do apLIS na prévia (só leitura)

**What to build:** o modal "Aplicar baixas do apLIS" passa a mostrar, por
título, as glosas que seriam lançadas a partir do apLIS — lote, código, motivo,
status, valor e número de procedimentos — e, quando não há glosa a lançar, o
motivo do pulado. Entram na prévia também os títulos cuja baixa já bate com o
apLIS e só falta a glosa. Nada é gravado ainda. Ver `../spec.md` — "Decisões" e
"Implementation Decisions".

**Blocked by:** None — can start immediately

**Status:** done

- [x] Leitura no MySQL de faturamento dos procedimentos dos lotes (blocos de 1.000 lotes): lote, requisição, líquido, recebido, motivo do catálogo (código + descrição), `DesMotivoGlosa`, situação da requisição (`CodEventoFatur`) e se está em lote de recurso
- [x] Utilitário puro `glosasSugeridas`, com teste vitest dos casos da spec: agrupamento por lote + código + status; status (6 → aberta, 7/16 ou em lote de recurso → em recurso, 18/27/23/8/15 com recebido a menor → definitiva); código em texto livre; glosa total sem data; diferença < R$ 0,01 fora
- [x] Pulados da glosa com o motivo: sem motivo no apLIS, título com glosa já lançada (nesta issue, qualquer glosa existente conta como manual), passa do saldo depois das baixas sugeridas (tolerância R$ 1,00), sem número da nota, `sistema-maior` / `lote-ausente`
- [x] Rota da prévia inclui os títulos só com glosa a lançar e devolve `glosas` e `puladoGlosa` por título; teste do handler cobre título só com glosa, pulados, 401/403 e 502
- [x] Modal mostra as glosas sugeridas e as puladas por título, sem lançar; a prévia continua sem baixa para os títulos só com glosa
- [x] Conferido com dado real: NF 9124 (lote 6228) sugere R$ 867,86 com o código 2902

## Comments

### 14/10/2026 — implementado

Decisões da implementação (valem para as issues 02 e 03):

- **Leitura somada no MySQL** (`diferencasDosLotes` em `api/_lib/faturamento/bdLab.ts`):
  por lote + motivo (catálogo + `DesMotivoGlosa`) + `CodEventoFatur` + em lote de
  recurso, com `Σ(líquido − recebido)` e o número de procedimentos. São ~27 mil
  procedimentos em ~1.400 grupos; um bloco de 1.000 lotes leva ~1,7 s pelo túnel.
  A requisição não volta: a issue 03 (demonstrativo por requisição + procedimento)
  precisa somar o `VlrGlosa` no mesmo agrupamento ou ler à parte.
- **`ValorRecebido` nulo fica fora** (operadora ainda não retornou, e o motivo pode
  ser só autorização em análise); recebido 0 sem data entra (glosa total). A
  diferença < R$ 0,01 por procedimento é cortada no SQL — "situação definitiva mas
  procedimento já pago → sem glosa" sai daí, sem teste de unidade.
- **Precedência do `puladoGlosa`:** `tipo` → `sem-nota` → `sem-motivo` →
  `glosa-manual` → `passa-do-saldo`. Só há pulado quando o apLIS tem alguma
  diferença nos lotes do título.
- **Título sem baixa a lançar** (recebido batendo, `sistema-maior`, `lote-ausente`)
  entra na prévia só com saldo ≥ R$ 1,00 e glosa ou pulado: fechado, ficaria na
  prévia para sempre como pulado.
- A resposta ganhou `saldo` (depois das baixas sugeridas) e `tipo`/`recebidoAplis`
  aceitam `null`. O modal mostra as glosas numa coluna "Glosas do apLIS
  (conferência)", sem checkbox; o rodapé soma as sugeridas à parte, só como
  informação.

Conferido ao vivo (réplica até 13/10): NF 9124 da PMDF com o lote 6228 sugere
R$ 867,86, código 2902 "GLOSA MANTIDA", aberta, 475 procedimentos. Prévia
inteira: 56 títulos só com glosa (R$ 56.021,73), pulados 39 `sem-nota`, 17
`sem-motivo`, 2 `passa-do-saldo`. Nenhum `glosa-manual`: os 19 títulos abertos
com glosa lançada estão todos sem número da nota.
