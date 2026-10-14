# 09 — Colar reunião

**What to build:** a aba **Reuniões** de `/it/eva` e o caminho manual. Quem tem `canManageIT` cola título, data e resumo (texto ou markdown), e o servidor grava e analisa na hora. A tela mostra o andamento ("analisando…") e, no fim, quantas sugestões saíram, com link para a fila.

A lista mostra todas as reuniões:
- origem;
- data;
- status;
- número de sugestões;
- link para o Granola, quando houver;
- selo "atualizada desde a análise" (D14).

O botão **Reanalisar** aparece só para aprovadores.

O protótipo do Início não tem atalho para colar reunião. A entrada fica na aba Reuniões de `/it/eva`.

Plano: §4.2 (RF11, RF13, RF17), §5 (Fluxo 1) e §8 (`ti-agente-analisar.ts`).

**Blocked by:** 08.

**Status:** done no código (13/Out/2026); falta colar uma reunião de verdade pela tela, depois das migrations

- [ ] Ação `agente-analisar` no dispatcher:
  - POST com sessão;
  - `canManageIT` para colar, `canApproveAgenteTI` para reanalisar (`{ reuniao_id }`);
  - limite de tamanho do resumo (ex.: 60 mil caracteres) com erro claro;
  - `dryRun`.
- [ ] `hooks/useReunioes.ts` e `ReunioesPage` com a lista e o selo da D14 (`fonte_atualizada_em > analisada_em`).
- [ ] `ColarReuniaoModal` com prévia do markdown e data padrão = hoje.
- [ ] Reunião em erro mostra a mensagem e o botão Reanalisar.

## Comments

**13/Out/2026 — implementado no código.**
- **Ação `agente-analisar`** (`api/_lib/handlers/ti-agente-analisar.ts`):
  - colar exige `canManageIT` ou `canApproveAgenteTI`; reanalisar (`{ reuniao_id }`) só gestor;
  - resumo de até 60 mil caracteres, com erro 413 legível;
  - `dryRun` analisa numa linha temporária e não deixa nada gravado.
- **Aba Reuniões** (`ReunioesPage.tsx`):
  - lista com origem, data, status, número de sugestões, link para o Granola e o selo "atualizada desde a análise" (D14);
  - selo "Gemini" com o motivo da reserva;
  - reunião em erro mostra a mensagem e, para gestor, "Reanalisar".
- **Colar reunião:** modal com título, data (padrão: hoje em Brasília) e resumo. A data vai como 15:00 UTC (meio-dia em Brasília), para os prazos relativos não mudarem de dia.
- **Diferença do texto da issue:** o modal não tem prévia do markdown. O resumo vai como foi colado.
