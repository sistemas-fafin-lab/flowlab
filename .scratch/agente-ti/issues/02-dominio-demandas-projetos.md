# 02 — Domínio: demandas, projetos, datas e snapshot do Início

**What to build:** as regras puras que o Início (03), os comentários (17) e a cobrança (14) usam, sem tela.

Dados os cards, projetos, sprints, comentários e membros de entrada, mais `hoje`, as funções devolvem:
- quais cards estão abertos, atrasados, vencendo ou parados;
- as tasks do dia (D23);
- o resumo do Kanban com os destaques;
- a situação, o prazo, o progresso e o ritmo de cada projeto (RN05, D27);
- o **snapshot do Início** por visão (Equipe / Minha visão): indicadores, briefing e listas, no formato `EvaHomeSnapshot` do handoff (`docs/flowlab_agent/design_handoff_eva_home/src/modules/eva/types.ts`).

O cuidado principal é o **dia de Brasília**. `due_date` é `TIMESTAMPTZ`, e um card que vence às 21h de hoje não pode virar "atrasado" porque em UTC já é amanhã.

Esse `domain/` vai ser importado também por `api/` e pelo script da VPS. Por isso não pode usar `import.meta.env`, `window` nem nada do navegador (§8, "Domínio compartilhado").

Plano: §4.4 (RN01 a RN06), §8 (`domain/`), §12.1 e §14.1.

**Blocked by:** nenhuma; pode rodar em paralelo à 01.

**Status:** done (13/Out/2026)

- [x] `src/modules/eva/domain/datas.ts`: dia em America/Sao_Paulo a partir de ISO, diferença em dias, dia útil, próximo dia útil.
- [x] `domain/demandas.ts`:
  - `estaAberto` (RN01), `estaAtrasado` (RN02), `venceEmBreve(n)` (RN03), `estaParado(diasParado)` (RN04, usando o último comentário);
  - `tasksDoDia` (D23): vence hoje + atrasados, só abertos;
  - `resumoKanban`: contagem por coluna e até 2 destaques (maior prioridade → prazo mais próximo → mais recente). Em "Concluído", só os da semana.
- [x] `domain/projetos.ts`: `resumirProjeto` → em andamento, prazo, situação (`late` · `at_risk` · `on_track` · sem prazo), progresso e ritmo da sprint (RN05 + D27).
- [x] `domain/inicio.ts`:
  - `montarSnapshot({ visao, usuarioId, cards, projetos, sprints, comentarios, membros, hoje })` → `EvaHomeSnapshot`;
  - indicadores das duas visões (RF03);
  - briefing por modelo fixo, com plurais e o caso de zero atrasadas;
  - "Cobranças hoje" e a fila entram como zero e vazio até a 12 e a 14.
- [x] `domain/pessoas.ts`: normalizar "@Nome" e casar com apelidos, sem acento e sem diferenciar maiúsculas (RN08). É usado na 08, mas é puro e mora aqui.
- [x] Tipos do handoff (`types.ts`) reaproveitados; o que faltar entra ao lado.
- [x] Testes cobrindo os casos da §14.1 que não são de cobrança nem de comentários.
- [x] Nenhuma função chama `new Date()` por dentro.

## Comments

**13/Out/2026.** Escopo ampliado com o protótipo: entraram o resumo do Kanban, as tasks do dia, o ritmo da sprint e o snapshot no formato do handoff. Saíram "minhas demandas agrupadas" e "carga por pessoa", que o protótipo não usa.

**13/Out/2026 — implementado** em `src/modules/eva/domain/`:
- `datas.ts`: dia em Brasília, dia útil, início da semana;
- `demandas.ts`: aberto, atrasado, vence em breve, parado, tasks do dia, resumo do Kanban com destaques;
- `projetos.ts`: RN05 + ritmo D27, ordenação por urgência;
- `pessoas.ts`: iniciais, cor estável, `casarMembro` para a RN08;
- `inicio.ts`: `montarSnapshot` nas duas visões, com indicadores, briefing por modelo fixo e listas.

Fábricas de teste em `domain/testes/fabricas.ts`. **48 testes** novos cobrem os casos da §14.1 que cabem aqui, entre eles:
- o card das 21h;
- `done` com `status` `pending`;
- sexta → segunda;
- parado pelo comentário;
- ritmo 35%/60% e 45%/60%;
- destaques;
- tasks do dia;
- briefing sem "0".

**Decisões de implementação:**
- **"Concluídas na semana"** usa o `updated_at` dos cards concluídos, porque `it_requests` não tem coluna de data de conclusão.
- **Briefing:** "vence nos próximos dias" exclui o que vence hoje, que já entra nas tasks do dia.
- **Tasks do dia:** incluem os cards que a pessoa concluiu hoje, para o "x de y" não encolher ao marcar.
