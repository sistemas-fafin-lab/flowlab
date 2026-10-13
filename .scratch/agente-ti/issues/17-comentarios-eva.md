# 17 — Comentários da EVA nos blocos

**What to build:** os comentários inline do protótipo (`EvaInsight`), um por bloco do Início (Kanban, Atrasadas, WhatsApp, Projetos, Minhas tasks).
- Na v1, eles saem de **regras fixas**, sem IA, calculadas na leitura (D21), em `domain/comentarios.ts`.
- Cada comentário tem texto, origem ("Board · agora", "Granola · Sprint review 13/10"), uma ação principal e "Perguntar à EVA", que abre o chat com uma pergunta pronta.

A regra de ouro (D6, D28): **a EVA executa ações, sempre com aprovação prévia**. Uma ação pode navegar, abrir o chat ou **propor uma mudança**:
- para gestor, abre um diálogo com o que muda em cada card ("Mover IT-045 e IT-052 da Ana para o Diego?"). Confirmar chama `ti_agente_propor_sugestao(..., p_aprovar = true)`: aprova e executa na hora;
- para os demais, o mesmo diálogo envia a proposta para a fila.

Textos de "feito" ("Movi…") só aparecem depois que a execução voltou com sucesso. Antes disso, o texto é de proposta ("Proponho mover…"). Ações de agenda não existem na v1 (§12.2).

Exemplos de regra. A lista final fica registrada nos comentários da issue:

| Bloco | Quando aparece | Texto (exemplo) | Ação |
|---|---|---|---|
| Kanban | uma coluna aberta concentra muitos cards numa pessoa (ex.: Revisão com 4 ou mais de alguém) e há colega com menos carga | "A coluna Revisão acumulou 6 cards, 4 com a Ana. O Diego tem menos carga." | "Redistribuir": propõe mover 2 cards para quem tem menos carga (D28) |
| Atrasadas | uma cobrança ficou sem resposta há mais de 3 h | "O Bruno não respondeu à cobrança das 10:12." | "Cobrar de novo", que respeita a janela de 4 h (RN16) |
| WhatsApp | houve falha na fila hoje, ou o Wa-ha está sem sinal | "Uma mensagem para o Diego falhou às 08:45." | "Ver no histórico" (aba Membros) |
| Projetos | há reunião analisada com sugestões pendentes, ou um projeto entrou em Atenção | "Na reunião de 13/10 saíram 5 sugestões; 2 mexem em Notificações WhatsApp." | "Ver sugestões" (`/it/eva`) ou "Ver resumo da reunião" (abre o chat) |
| Minhas tasks | tenho card vencendo hoje parado em Revisão | "O PR de upload de carteirinha está em Revisão há 3 dias." | "Abrir card" |

Plano: §2 (D6, D21), §4.1 (RF09), §12.1, §12.2 e §14.1.

**Blocked by:** 02, 03. As ações que propõem mudança precisam da RPC `ti_agente_propor_sugestao` (11). O comentário de Projetos com reunião precisa da 08. Os de WhatsApp precisam da 12; até lá, essas regras não disparam.

**Status:** ready-for-agent

- [ ] `domain/comentarios.ts`:
  - uma função por bloco, que recebe o snapshot (e a fila, as sugestões e a última reunião, quando houver) e `hoje`;
  - devolve um `EvaInsightData` ou nada.
- [ ] Testes:
  - cada regra dispara e some no caso certo;
  - um teste varre os textos de proposta e falha se algum disser "movi", "atualizei", "criei", "bloqueei" ou "reservei" antes da execução.
- [ ] `evaService.acceptInsight` executa a ação: navegar, abrir o chat ou propor (diálogo de confirmação + `ti_agente_propor_sugestao`). Nada de escrita direta em `it_requests` (D28).
- [ ] Diálogo de confirmação reaproveitável (também usado pelo chat na 16): lista cada card com antes → depois; botão "Aprovar e executar" (gestor) ou "Enviar para aprovação".
- [ ] O `doneText` de cada ação descreve o que aconteceu de fato ("Abri o Board filtrado", "Sugestão enviada para aprovação").
- [ ] `showInsights` volta a `true` no Início quando a issue estiver pronta.

## Comments
