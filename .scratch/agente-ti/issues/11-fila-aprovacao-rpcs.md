# 11 — Fila de aprovação e RPCs

**What to build:** a aba **Sugestões** de `/it/eva` e as RPCs que aplicam as decisões.
- Cada sugestão mostra o tipo, o card afetado, os campos propostos (com o valor atual ao lado, quando for mudança), o trecho da reunião, a confiança e os avisos.
- Quando a reunião foi analisada pelo Gemini (D17), aparece o selo "analisada pelo Gemini" com o motivo.
- O aprovador **edita e aprova**, ou **rejeita** com motivo.
- Há aprovação em lote para as de confiança alta.
- Quem tem só `canManageIT` vê a fila, sem os botões.

As RPCs são `SECURITY DEFINER` e por isso **ignoram a RLS de `it_requests`**. A conferência de `canApproveAgenteTI` na primeira linha é a única barreira. Ela tem teste com usuário sem a chave, chamando a RPC direto pelo cliente do Supabase.

Plano: §4.2 (RF14 a RF16), §4.4 (RN07), §6.3 e §14.4.

**Blocked by:** 08.

**Status:** done no código (13/Out/2026); falta a conferência com três usuários (§14.6), depois das migrations

- [ ] Migration `2026MMDDhhmmss_agente_ti_rpcs.sql`:
  - `ti_agente_aprovar_sugestao(p_id, p_proposta)` e `ti_agente_rejeitar_sugestao(p_id, p_motivo)`, conforme a §6.3;
  - `search_path` fixo;
  - `FOR UPDATE`;
  - só os campos listados;
  - `done` grava junto `status = 'resolved'`;
  - tag `agente-ti` nos cards criados;
  - aviso no sino para os responsáveis;
  - `ti_agente_propor_sugestao(p_tipo, p_card_id, p_proposta, p_trecho, p_origem, p_aprovar)` (D28, §6.3): insere a proposta com `origem` e `proposta_por`. Com `p_aprovar = true` e `canApproveAgenteTI`, aprova e executa na mesma transação. É o caminho dos comentários (17) e do chat (16).
- [ ] `hooks/useSugestoes.ts`: lista (pendentes primeiro, filtro por reunião e status), aprovar, aprovar em lote, rejeitar.
- [ ] `SugestaoCard` e `EditarSugestaoModal`:
  - campos do card com os mesmos componentes do Board;
  - seletor de responsáveis só com membros;
  - seletor de projeto e de sprint.
- [ ] Link "ver card" depois de aprovar; o card aparece no Board com a tag.
- [ ] Chip "N sugestões aguardando" no Início (`EvaControls`), só para aprovadores, levando a `/it/eva` (D25). O protótipo não tem esse chip; ele segue o estilo dos chips de integração.
- [ ] Testes da proposta: quem não é gestor com `p_aprovar = true` recebe erro e nada é gravado; gestor com `p_aprovar = true` gera sugestão `aprovada` com `decidido_por` e o card mudado; proposta de quem não é gestor fica `pendente` na fila, com a origem visível.
- [ ] Na fila, a origem de cada sugestão (reunião, comentário, chat, WhatsApp) e quem propôs.
- [ ] Conferência com três usuários (§14.6), registrada nos comentários.

## Comments

**13/Out/2026 — implementado no código.**
- **RPCs:** em `20261013151000_eva_rpcs.sql` (issue 05), testadas no PGlite. Os cenários incluem:
  - não gestor com `p_aprovar = true` recebe erro, e nada é gravado;
  - gestor gera a sugestão `aprovada` e o card muda;
  - proposta de quem não é gestor fica `pendente`;
  - o cliente não consegue gravar sugestão direto, só pelas RPCs.
- **Aba Sugestões** (`SugestoesPage.tsx`, `SugestaoCard.tsx`):
  - filtro Pendentes, Aprovadas, Rejeitadas e Todas;
  - "antes → depois" de cada campo, com o trecho, a confiança, os avisos, o selo do Gemini e a origem com quem propôs;
  - gestor: "Aprovar e executar", "Editar" e "Rejeitar" (com motivo), mais o lote das de confiança alta;
  - quem tem só `canManageIT` vê a fila sem os botões;
  - aprovada mostra quem decidiu e o link "Ver card" (`/requests/it?open=<id>`).
- **Editar e aprovar** (`EditarPropostaModal.tsx`):
  - coluna, prioridade e prazo com o `Select` e o `DatePicker` do projeto;
  - responsáveis só entre os membros ativos da EVA, ou todas as pessoas ativas enquanto a aba Membros estiver vazia;
  - no card novo, projeto e sprint (só as ativas e planejadas do projeto escolhido).
- **Chip "N sugestões aguardando"** no Início, só para gestor, levando a `/it/eva` (`domain/integracoes.ts`).
- **Falta:** a conferência com três usuários (§14.6), que precisa das migrations aplicadas.
