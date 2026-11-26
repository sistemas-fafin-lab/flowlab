# 31 — Histórico diário e tendências

**What to build:** a EVA guarda como a equipe estava em cada dia e mostra a tendência: entregas e tempo de resolução por semana, atrasados e fila por dia. Sugestão aceita pelo usuário em 24/Nov.

Plano: §2 (D42) e §11.9.

**Blocked by:** 27 (o painel de gestão).

**Status:** done no código (24/Nov/2026). Falta aplicar a migration, publicar e conferir.

- [x] **Foto do dia:** o fechamento das 18h grava `fotografar(painel de hoje)` em `ti_agente_fotos`, uma linha por dia. Separada do fechamento; o `dryRun` não grava.
- [x] **Entrega pela data da resolução:** `diaDaConclusao` usa o `resolved_at`; o Kanban, o "meu dia" e o painel de gestão passam a usar.
- [x] **Séries** (`domain/tendencias.ts`): `seriePorSemana` (entregas, chamados resolvidos e tempo médio) e `seriePorDia` (atrasados e fila, das fotos).
- [x] **Cartão "Tendências" no Início**, na visão da equipe: três gráficos com a paleta validada, tooltip, rótulos na ponta e tabela para leitor de tela.
- [x] **Relatório da semana:** a comparação com a foto de antes do período.
- [x] **Perguntas de gestão:** entregas das 4 últimas semanas e a tendência no bloco.
- [ ] Aplicar `20261124171300_eva_fotos_diarias.sql` no projeto do app.
- [ ] Publicar e conferir o cartão no navegador, nos temas claro e escuro. O gráfico das fotos aparece a partir do segundo dia útil.

## Comments

**24/Nov/2026 — implementado no código.**
- **Testes:**
  - `domain/tendencias.test.ts`: a foto até o dia, a série por dia útil e a série por semana (fuso de Brasília, chamado fora do Kanban, chamado que virou card);
  - `domain/gestao.test.ts`: a foto do dia, as entregas por semana pela resolução, a linha do relatório e o bloco;
  - `domain/demandas.test.ts`: "concluído nesta semana" e "meu dia" pelo `resolved_at`;
  - `api/_lib/ti-agente/gestao.test.ts`: grava a foto, o relatório compara e, sem a tabela, só não compara.
