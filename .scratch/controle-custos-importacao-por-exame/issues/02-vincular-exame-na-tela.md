# 02: Vincular e trocar o exame de uma linha importada na tela

**What to build:** Na tela da fonte pagadora, uma linha "Custo não levantado" ganha a ação "Vincular exame", e uma linha importada já vinculada ganha "Trocar exame". O usuário escolhe o exame (os do mesmo TUSS primeiro, mas qualquer exame vale) e a linha passa a mostrar o custo dele. O Atendido não muda. Ver spec: `../spec.md`.

**Blocked by:** 01 — Importação vincula por semelhança

**Status:** ready-for-agent

- [ ] Ação "Vincular exame" nas linhas não levantadas e "Trocar exame" nas linhas com nome no convênio.
- [ ] Escolha de exame com os do mesmo TUSS primeiro; exame que já tem linha nesta tabela é recusado com mensagem clara.
- [ ] Grava `exame_id` sem mexer em valor nem Atendido; a reimportação seguinte mantém o vínculo.
