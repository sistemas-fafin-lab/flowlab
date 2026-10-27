# 01: Colunas de status, laudo liberado e tarefas nas Pendências

**What to build:** as três colunas novas e o modal de tarefas da spec (`../spec.md`).

**Status:** ready-for-human

- [x] `bdLab.ts`: as três consultas de Pendências trazem `CodEvento`/`DesEvento`, `DtaFinalizacao` e `QtdTarefasAbertas`.
- [x] `listarTarefasRequisicao` + rota `GET /api/faturamento/tarefas-requisicao?idRequisicao=` (dispatcher e `vite.config.ts`).
- [x] `textoDaMensagemTarefa` limpa o HTML da mensagem, com testes em `bdLab.test.ts`.
- [x] Componentes `StatusRequisicao`, `BotaoTarefas` e `TarefasRequisicaoModal` (`TarefasRequisicao.tsx`) nas três sub-abas.
- [x] Conferido no banco: consulta de Sem lote com contador em ~1,7 s para o mês; requisição 207247 com 27 tarefas no modal.
- [ ] Conferir na tela: as três sub-abas e o modal, nos temas claro e escuro.
