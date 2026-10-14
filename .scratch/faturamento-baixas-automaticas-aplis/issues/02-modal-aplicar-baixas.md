# 02 — Botão e modal "Aplicar baixas do apLIS"

**What to build:** botão no cabeçalho do Contas a Receber e modal de prévia que
lança as baixas confirmadas. Ver `../spec.md` — "Implementation Decisions".

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Botão ao lado de "Conferir baixas com o apLIS", só com `canManageBilling`
- [ ] Prévia: títulos com as baixas (data, valor), marcar/desmarcar por título, total a lançar, pulados à parte, aviso "dados do apLIS até ontem"
- [ ] Confirmar lança uma baixa por vez via `fat_registrar_baixa` (sem glosas), com progresso e resultado por título; erro num título não para os outros
- [ ] Ao fechar depois de lançar, refaz a lista e a conferência (selos)
- [ ] Estados de carregando, vazio ("nada a lançar") e erro da réplica

## Comments
