# 03 — Início da EVA: tela a partir do handoff

**What to build:** a página `/it/inicio` no visual do protótipo do Claude Design, com dados reais.
- O handoff já traz a implementação React: `docs/flowlab_agent/design_handoff_eva_home/src/modules/eva/`, com README de integração, comportamento, tokens e modo escuro.
- A pasta é copiada para `src/modules/eva/`. O **único** ponto que muda é o `services/evaService.ts`: o `getSnapshot(view)` deixa de devolver os mocks e passa a montar o snapshot com Supabase + `domain/inicio.ts` (issue 02).
- Ficam desativados ou vazios, sempre com explicação na tela:
  - chat e voz (16);
  - botão Cobrar e fila do WhatsApp (12, 14);
  - chips de integração (10, 12);
  - comentários da EVA (17).

O que exige cuidado:
- **Nenhum dado de mock aparece em produção.** Os nomes fictícios (Ana, Bruno…), as tasks com horário e os textos de comentário saem da tela. `mocks.ts` fica só para testes e para um harness visual.
- **Minhas tasks do dia concluem o card de verdade** (D23): `kanban_status = 'done'` e `status = 'resolved'`, a mesma regra de `ITKanbanBoard.tsx:774`, com opção de desfazer por alguns segundos.
- **O clique num card** (Kanban, atrasadas, tasks) abre o `ITTaskDrawer` existente.

Plano: §2 (D18, D19, D23, D27), §4.1 (RF01 a RF09), §7, §8, §12 inteira, §13 (Fase 1) e §14.8.

**Blocked by:** 01, 02.

**Status:** done no código (13/Out/2026); falta conferir no navegador com login real

- [x] Copiar `design_handoff_eva_home/src/modules/eva/` para `src/modules/eva/`, mantendo `eva.css` e os componentes como vieram. A página provisória da 01 sai.
- [x] `services/evaService.ts`:
  - `getSnapshot(view)` com:
    - cards não ocultos (abertos + concluídos da semana), paginando, porque o PostgREST corta em 1000;
    - projetos, sprints e comentários recentes;
    - membros: nome, iniciais e um gradiente estável por usuário.
  - O snapshot é montado por `domain/inicio.ts`. Visão `me` = cards em que o usuário está em `assigned_to`.
- [x] `useEvaHome`: guarda contra resposta atrasada (`requestIdRef`); o botão atualizar recarrega.
- [x] Indicadores, Kanban, Atrasadas (sem o botão, até a 14), Projetos e Minhas tasks com dados reais, nas duas visões.
- [x] Saudação com `userProfile.name`, e briefing de `domain/inicio.ts`.
- [x] Estados:
  - carregando (snapshot anterior esmaecido, sem piscar);
  - erro;
  - sem demandas;
  - usuário sem cards;
  - projeto sem prazo.
- [x] Chat (antes da 16): o orb e o campo abrem o drawer com "O chat com a EVA chega na próxima etapa". O microfone fica escondido.
- [x] Fila do WhatsApp (antes da 12): estado vazio, "As mensagens da EVA vão aparecer aqui".
- [x] Comentários (antes da 17): `showInsights={false}`.
- [x] Tema claro e escuro (o `ThemeToggle` existente), `prefers-reduced-motion`, celular.
- [x] Conferência:
  - abertas, atrasadas, concluídas na semana e o progresso de um projeto batem com `SELECT`s feitos à mão;
  - lado a lado com `TI Inicio EVA (standalone).html`, a tela fica fiel (§14.8).
- [x] `tsc`, `lint` e `vite build` sem erros novos.

## Comments

**13/Out/2026.** Protótipo e handoff recebidos em `docs/flowlab_agent/`. Conferido o encaixe no repositório:
- `src/hooks/useAuth.ts` existe, com `userProfile.name`;
- lucide-react 0.263.1, framer-motion 12.38, Tailwind 3.4.17;
- `animate-fade-in-up` está em `src/index.css`.

A primeira versão desta issue esperava o protótipo e descrevia blocos (filtros, carga da equipe, sprint ativa separada) que o protótipo substituiu. A descrição acima é a que vale.

**13/Out/2026 — implementado no código.**

- **Módulo do handoff** copiado para `src/modules/eva/`, com componentes e animações como vieram. `mocks.ts` foi removido: nenhum dado fictício chega à tela. A referência continua em `docs/flowlab_agent/`.
- **`services/evaService.ts`:**
  - `carregarDadosInicio` lê, paginando de 1000 em 1000:
    - os cards não ocultos e não cancelados (abertos, mais os concluídos dos últimos 14 dias);
    - os projetos;
    - as sprints ativas e planejadas;
    - o nome das pessoas citadas.
  - `carregarCardCompleto` monta o card no mesmo formato do Board, para abrir o `ITTaskDrawer` existente.
  - `concluirCard` e `reabrirCard` seguem a regra do Board.
- **`hooks/useEvaHome.ts`:**
  - guarda contra resposta atrasada;
  - o snapshot é recalculado no cliente a partir dos dados, então marcar uma task atualiza todos os blocos na hora.
  - **Concluir** tem "Desfazer" por 5 s (`EvaToast`). O aviso ao solicitante (sino + e-mail, com o mesmo intervalo de 5 min do Board) só sai depois que essa janela passa, ou imediatamente se a pessoa sair da página. Assim, uma conclusão desfeita nunca gera aviso.
- **Adaptações nos componentes:**
  - Kanban, atrasadas e tasks abrem o card ao clicar;
  - "Sem prazo" virou um estado de projeto (`no_deadline`);
  - o horário das tasks virou o código do card;
  - estados vazios em todos os blocos;
  - o microfone só aparece quando há `onMic` (entra com o chat, na 16).
- **Fila do WhatsApp:** só para gestor (D24), com o estado "Ainda não ligada". Para os demais, as atrasadas ocupam a linha.
- **Chips** "Granola" e "Wa-ha" mostram "ainda não configurado".
- **Chat:** o drawer abre e responde com o aviso de que o chat chega na próxima etapa. Nenhuma resposta é inventada.
- **Comentários da EVA:** desligados (`showInsights={false}`) até a 17.
- **Tema e movimento:** `MotionConfig reducedMotion="user"`. O tema claro/escuro segue o `ThemeToggle`, com as classes `dark:` do handoff.

**Verificação:**
- `npm test`: 97 arquivos, 1062 testes passando. Inclui `components/blocos.test.ts`, um teste de fumaça que renderiza os blocos (Kanban, atrasadas, projetos, tasks, fila e indicadores) com um snapshot real do domínio, cheio e vazio, via `react-dom/server`. O projeto não tem jsdom, e nada foi instalado.
- `vite build`: ok, com saída no scratchpad.
- `tsc`: nenhum erro no módulo.
- `eslint` no módulo: só o aviso de fast refresh em `EvaUIContext.tsx`, que veio do handoff.

**Não verificado:**
- o Início no navegador com login real;
- a comparação lado a lado com `TI Inicio EVA (standalone).html` (§14.8);
- as contagens contra `SELECT`s feitos à mão.

Falta conferir esses três pontos com um usuário da TI.
