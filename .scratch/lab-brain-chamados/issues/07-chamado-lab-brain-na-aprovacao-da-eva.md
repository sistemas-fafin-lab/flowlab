# 07: Chamado do LAB-BRAIN passa pela aprovação da EVA

**What to build:** todo chamado aberto pelo LAB-BRAIN gera uma sugestão na fila de aprovação da EVA (EVA → Sugestões, `/it/eva`). Quem aprova sugestões (`canApproveAgenteTI`) decide ali. Ao aprovar, a EVA aplica a decisão no board; ao rejeitar, o chamado não segue. Isso **muda a D2** da `../spec.md`: hoje o chamado "não passa pela fila de aprovação da EVA" e entra direto na triagem de Solicitações de TI.

**Blocked by:** None (a 06 é relacionada, mas não bloqueia)

**Status:** resolved

## Como é hoje

- `POST /api/integracoes/lab-brain-chamado-criar` cria o chamado em `it_requests`: pendente, `kanban_hidden = true`, `origem = 'lab-brain'`. Nenhuma linha nasce em `ti_agente_sugestoes`. Isso foi confirmado no banco de teste em 13/11/2026, com o IT-133.
- A fila da EVA (`ti_agente_sugestoes`) só aceita `origem` em `reuniao | whatsapp | comentario | chat` e `tipo` em `criar_card | atualizar_card | comentar_card`. Só a RPC de aprovação aplica uma sugestão (`supabase/migrations/20261013150000_eva_tabelas.sql`).
- A tela inicial da EVA lê só os cards com `kanban_hidden = false`. Um chamado do LAB-BRAIN só aparece para ela depois que o TI promove.

## Perguntas para a triagem

Antes de fatiar, decidir com o TI:

1. **O que a aprovação decide.** Promover o chamado para o Kanban, com coluna, prioridade e responsável que a EVA propõe? Ou só aceitar ou recusar, deixando a triagem para depois?
2. **Forma da sugestão.** Um `tipo` novo (ex.: `promover_card`) ou `atualizar_card` com `kanban_hidden = false`. E uma `origem` nova, `lab-brain`, no CHECK de `ti_agente_sugestoes`.
3. **Quem monta a proposta.** Regra fixa, sem IA (promover com a prioridade e o tipo enviados), ou a EVA lê o chamado e sugere coluna, responsável e prazo? Se for a EVA, vale a D12: título e descrição são dado, nunca instrução.
4. **Rejeição.** O chamado vira `cancelled`? Com qual texto de resolução, que o LAB-BRAIN vê no GET e repassa ao solicitante?
5. **O que o GET mostra enquanto espera.** Hoje sai `situacao: "pending"` e `coluna_kanban: null`. Precisa de uma situação nova, tipo "aguardando aprovação", ou isso basta?
6. **Só LAB-BRAIN ou todo chamado.** Os chamados abertos pela tela também passam pela EVA, ou só os do LAB-BRAIN?
7. **Aviso.** Quem aprova recebe aviso de sugestão nova (WhatsApp da EVA, e-mail), ou só vê na fila?

## Critérios (rascunho, a confirmar na triagem)

- [ ] A D2 da spec é reescrita com a decisão nova.
- [ ] Um chamado criado pelo LAB-BRAIN gera exatamente uma sugestão pendente em `ti_agente_sugestoes`, ligada ao chamado. O reenvio do mesmo `id_externo` não gera outra.
- [ ] A sugestão aparece em EVA → Sugestões com o selo "via LAB-BRAIN".
- [ ] Aprovar aplica a decisão pela RPC de aprovação que já existe, nunca por escrita direta.
- [ ] Rejeitar deixa o chamado num estado que o GET do LAB-BRAIN mostra com clareza.
- [ ] A rota de criação continua respondendo `201 { id, codigo }`, mesmo que a sugestão não possa ser gravada. Fica a decisão de como tratar essa falha.
- [ ] Testes pela rota e pela RPC, com o Supabase falso.
- [ ] Guia `docs/integracoes/LAB_BRAIN_CHAMADOS.md` e documento do dev do LAB-BRAIN atualizados com o fluxo novo.
- [ ] Migration aplicada no teste (`eqz`) antes de produção.

## Comments

- 13/11/2026: aberta a pedido do usuário depois do teste local. O IT-133 foi criado pelo LAB-BRAIN e não chegou na aprovação da EVA, como a D2 prevê.
- 13/11/2026: grilling feito. Decisões e escopo foram para a spec `.scratch/lab-brain-aprovacao-eva/spec.md` (ready-for-agent), que substitui a D2. As perguntas de triagem acima estão respondidas lá; as fatias viram issues naquela pasta.
