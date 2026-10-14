# 01 — Glosas do apLIS na prévia (só leitura)

**What to build:** o modal "Aplicar baixas do apLIS" passa a mostrar, por
título, as glosas que seriam lançadas a partir do apLIS — lote, código, motivo,
status, valor e número de procedimentos — e, quando não há glosa a lançar, o
motivo do pulado. Entram na prévia também os títulos cuja baixa já bate com o
apLIS e só falta a glosa. Nada é gravado ainda. Ver `../spec.md` — "Decisões" e
"Implementation Decisions".

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] Leitura no MySQL de faturamento dos procedimentos dos lotes (blocos de 1.000 lotes): lote, requisição, líquido, recebido, motivo do catálogo (código + descrição), `DesMotivoGlosa`, situação da requisição (`CodEventoFatur`) e se está em lote de recurso
- [ ] Utilitário puro `glosasSugeridas`, com teste vitest dos casos da spec: agrupamento por lote + código + status; status (6 → aberta, 7/16 ou em lote de recurso → em recurso, 18/27/23/8/15 com recebido a menor → definitiva); código em texto livre; glosa total sem data; diferença < R$ 0,01 fora
- [ ] Pulados da glosa com o motivo: sem motivo no apLIS, título com glosa já lançada (nesta issue, qualquer glosa existente conta como manual), passa do saldo depois das baixas sugeridas (tolerância R$ 1,00), sem número da nota, `sistema-maior` / `lote-ausente`
- [ ] Rota da prévia inclui os títulos só com glosa a lançar e devolve `glosas` e `puladoGlosa` por título; teste do handler cobre título só com glosa, pulados, 401/403 e 502
- [ ] Modal mostra as glosas sugeridas e as puladas por título, sem lançar; a prévia continua sem baixa para os títulos só com glosa
- [ ] Conferido com dado real: NF 9124 (lote 6228) sugere R$ 867,86 com o código 2902

## Comments
