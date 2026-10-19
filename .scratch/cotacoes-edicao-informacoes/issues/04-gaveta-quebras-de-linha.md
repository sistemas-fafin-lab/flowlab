# 04 — Gaveta respeita quebras de linha

**What to build:** na gaveta da cotação, a justificativa e a descrição
aparecem com os parágrafos e quebras de linha que foram digitados, em vez de
tudo emendado numa linha só. Ex.: a COT-202610-5XKW passa a mostrar
"Requisição: REQ-866" separada do texto original.

Ver spec: `.scratch/cotacoes-edicao-informacoes/spec.md` (Implementation
Decisions — gaveta da cotação).

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Justificativa e descrição na gaveta preservam quebras de linha.
- [ ] Textos sem quebra de linha continuam com a mesma aparência.
- [ ] Verificação manual com uma cotação cuja justificativa tem parágrafos.
