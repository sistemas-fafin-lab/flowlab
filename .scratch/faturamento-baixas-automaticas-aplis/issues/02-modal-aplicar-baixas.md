# 02 — Botão e modal "Aplicar baixas do apLIS"

**What to build:** botão no cabeçalho do Contas a Receber e modal de prévia que
lança as baixas confirmadas. Ver `../spec.md` — "Implementation Decisions".

**Blocked by:** 01

**Status:** done

- [x] Botão ao lado de "Conferir baixas com o apLIS", só com `canManageBilling`
- [x] Prévia: títulos com as baixas (data, valor), marcar/desmarcar por título, total a lançar, pulados à parte, aviso "dados do apLIS até ontem"
- [x] Confirmar lança uma baixa por vez via `fat_registrar_baixa` (sem glosas), com progresso e resultado por título; erro num título não para os outros
- [x] Ao fechar depois de lançar, refaz a lista e a conferência (selos)
- [x] Estados de carregando, vazio ("nada a lançar") e erro da réplica

## Comments
- Implementado em `src/modules/faturamento/components/AplicarBaixasAplisModal.tsx`,
  regras puras em `utils/aplicarBaixasAplis.ts` (vitest). A RPC sai por
  `rpcRegistrarBaixa` (extraída de `useContasReceber`, sem reler a lista a cada baixa).
- Respostas aos pontos em aberto da issue 01: título com número e sem baixa
  sugerida vai para os pulados como "sem data de recebimento no apLIS"; títulos
  que sugerem a mesma baixa (lote vinculado a dois títulos) ganham o selo "lote
  em outro título" e vêm desmarcados — o operador escolhe em qual lançar.
- Se uma baixa de um título falha, as seguintes do mesmo título não são tentadas
  (estado "lançadas N de M, depois falhou"); os outros títulos seguem.
- Fechar no meio para de iniciar baixas (com confirmação); a lista e a
  conferência são relidas ao fechar e, se uma baixa ainda estava no ar, de novo
  quando ela termina.
