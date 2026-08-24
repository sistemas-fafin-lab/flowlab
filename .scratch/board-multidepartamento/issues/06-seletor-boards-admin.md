# 06 — Seletor de boards para administradores

**What to build:** usuário com `canManageAllBoards` que tem acesso a mais de
um board (mais de uma linha em `boards`) vê, ao entrar em `/board`, um
seletor (dropdown ou abas) para trocar entre os boards dos diferentes
departamentos — com visualização e as ações de gerenciamento do ticket 05
funcionando normalmente em qualquer board selecionado. Usuário comum, que só
enxerga o board do próprio cargo, continua caindo direto nele, sem ver
seletor nenhum.

Como hoje só existe o board "transporte" semeado (ticket 02), este ticket só
fica plenamente demonstrável quando houver um segundo board cadastrado — a
implementação deve funcionar corretamente para N boards, mesmo que a
verificação prática no v1 seja com um board só mais um board de teste
temporário.

**Blocked by:** 04, 05

**Status:** ready-for-agent

- [ ] Usuário com `canManageAllBoards` e acesso a mais de um board vê um
      seletor ao entrar em `/board`.
- [ ] Trocar a seleção troca o board exibido (colunas + cards) corretamente.
- [ ] Ações de criar/editar/mover/excluir card (ticket 05) funcionam
      normalmente em qualquer board selecionado.
- [ ] Usuário com acesso a exatamente um board (o do próprio cargo, sem
      `canManageAllBoards`) não vê seletor — cai direto no seu board.
- [ ] `npm run lint` e typecheck limpos.
