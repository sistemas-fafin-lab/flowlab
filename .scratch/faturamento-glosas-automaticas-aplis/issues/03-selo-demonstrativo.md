# 03 — Selo do demonstrativo nas glosas sugeridas

**What to build:** cada glosa sugerida na prévia mostra se confere com o
demonstrativo importado no apLIS ("confere" / "difere do demonstrativo"), ou
nada quando não há demonstrativo. É só informação: não desmarca nem bloqueia.
Ver `../spec.md` — decisão 10.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Leitura da glosa do demonstrativo por (requisição, código do procedimento), só do demonstrativo mais recente de cada guia (há reimportações duplicadas); pode reaproveitar o que as telas de glosa legado já usam
- [ ] Comparação por grupo de glosa (lote + código + status) com tolerância de R$ 0,01: `confere` / `difere` / sem demonstrativo; teste vitest dos três casos
- [ ] Selo na linha da glosa no modal; a seleção inicial não muda
- [ ] Conferido com dado real: lote 6485 confere (R$ 327,88, demonstrativo 4450); a glosa total de R$ 507,15 do lote 6063 sai sem demonstrativo

## Comments
