# 22 — Permissões da EVA por pessoa e seletores com busca

**What to build:** duas coisas, pedidas juntas pelo usuário (15/Out):
- "quero conseguir controlar a nível usuário as permissões que são tocantes a ela, já que não quero criar diversos cargos só para isso";
- "otimize os seletores (select box e droplists): não quero select box padrão de navegador, e a lista de seleção de usuários, por exemplo, quero que tenha um campo de busca além da lista".

Regra das permissões, só para as três chaves da EVA (D31):
- admin tem as três, sempre;
- com linha na aba Permissões, vale a linha, no lugar do cargo, inclusive para tirar;
- sem linha, vale o cargo, como antes.

Plano: §2 (D33), §6.2, §6.3 e §7.

**Blocked by:** 20.

**Status:** done (15/Out/2026): migration aplicada e conferida, merge no `main` (PR #13); falta a conferência no navegador

- [x] Migration `20261015160000_eva_papeis_por_pessoa.sql`:
  - tabela `ti_agente_papeis`;
  - `ti_agente_tem_permissao` com a linha e `ti_agente_pode`;
  - policies e RPCs da EVA com `ti_agente_pode`;
  - `ti_agente_definir_papeis` e `ti_agente_voltar_ao_cargo`, com as travas.
- [x] Servidor: `autorizar`, `usuarioPorId` e `lerQuemTem` com a linha (sem a tabela, seguem o cargo).
- [x] Front:
  - `AuthContext` aplica a própria linha, e o admin passa a ter as três também na tela;
  - aba **Permissões** (`/it/eva/permissoes`, só quem configura);
  - aba Membros com os papéis pela mesma regra.
- [x] Seletores:
  - `Select` com `searchable` e descrição por opção;
  - `MultiSelect` com busca e chips;
  - `Switch` no lugar dos checkboxes nativos.
- [x] Seletores na EVA:
  - com busca: pessoa (Membros), "Dar permissão a outra pessoa", grupo da equipe, projeto e sprint;
  - responsáveis da sugestão com `MultiSelect`;
  - o `<select>` nativo do grupo saiu;
  - liga/desliga de Configurações e do grupo, e "Recebe cobrança"/"Ativo" de Membros, com `Switch`.
- [x] Aplicar a migration no projeto do app.
- [ ] Conferir no navegador:
  - dar Gestor a alguém sem cargo e ver o botão Cobrar para essa pessoa;
  - tirar Aprova de quem tem pelo cargo;
  - "Voltar ao cargo".

## Comments

**15/Out/2026 — implementado no código.**
- **Testes:**
  - migration no PGlite: 113 cenários, 36 novos (a linha dá e tira chaves, admin, desativado, travas, RLS da tabela, RPCs da tela e "como");
  - vitest: a regra (`papeis.test.ts`), a aba (`permissoes.test.ts`), a busca (`selectBusca.test.ts`), `lerQuemTem` com a linha e o WhatsApp com a linha (`comandos.test.ts`). Suíte inteira: 1481.
- **Conferência visual:** Chrome headless, tema claro e escuro, numa página temporária com dados fictícios:
  - Select com busca, MultiSelect aberto, Switch;
  - a aba Permissões com o seletor aberto.
- **Achado na conferência:** o cartão de vidro (`backdrop-blur`) empilha à parte, e a lista aberta ficava atrás do cartão de baixo. Os cartões com seletor (Permissões, Grupo da equipe) ganharam `relative z-10`.
- **Escopo dos seletores:** a EVA. Os componentes ficam em `src/components/` e servem para o resto do FlowLab; os outros `<select>` nativos do app não foram trocados.

**15/Out/2026 — aplicada e publicada.**
- O usuário aplicou a migration no projeto do app (`jqxe…`) e fez o merge (PR #13).
- Conferência só com a chave pública, sem ler nem gravar dados:
  - `ti_agente_papeis` existe, com todas as colunas;
  - `ti_agente_pode`, `ti_agente_definir_papeis`, `ti_agente_voltar_ao_cargo` e `ti_agente_tem_permissao` existem, e o anon é barrado nas quatro.
