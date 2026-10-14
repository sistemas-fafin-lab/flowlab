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

**Status:** done no código (14/Out/2026), com as duas regras da fila do WhatsApp

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

**13/Out/2026 — implementado no código.** `domain/comentarios.ts` tem uma função por bloco. Os limites são constantes exportadas.

**Lista final das regras (v1):**

| Bloco | Quando aparece | Texto | Ação |
|---|---|---|---|
| Kanban (só Equipe) | uma pessoa tem 4 ou mais cards em Revisão, Em Progresso ou A Fazer (nessa ordem de prioridade), e um colega tem pelo menos 3 cards a menos em aberto. No empate, vai quem tem menos naquela coluna | "A coluna Revisão tem 6 cards, 4 com Ana. Diego tem menos carga (1 card em aberto)." | **Redistribuir:** propõe passar os 2 cards de menor destaque (menor prioridade, prazo mais longe) para o colega |
| Atrasadas | card crítico ou alto atrasado e sem responsável | "IT-031 (Firewall) está atrasado há 3 dias e sem responsável." | Abrir card |
| Atrasadas | senão, o atraso mais longo, de 7 dias ou mais | "IT-020 (LIS) está atrasado há 8 dias, com Ana. Vale revisar o prazo ou o escopo." | Abrir card |
| WhatsApp (só gestor) | envio ligado e Wa-ha sem sinal, aguardando QR code ou desconectado | "O Wa-ha está sem sinal da VPS. As mensagens esperam na fila até a sessão voltar." | Ver configurações |
| Projetos | última reunião analisada há até 14 dias com sugestões pendentes | "A reunião de 10/10 gerou 3 sugestões que ainda aguardam aprovação." | Ver sugestões (`/it/eva`) |
| Projetos | mesma reunião sem pendentes, com decisões (`observacoes`) | as decisões da reunião | Ver resumo da reunião (abre o chat) |
| Projetos | senão, projeto Atrasado (antes) ou Em risco | "O projeto Portal está em risco: 2 de 10 cards feitos, prazo 17/10." | Abrir projeto |
| Minhas tasks | card meu de hoje ou atrasado em Em Progresso ou Revisão, sem mudança há 3 dias ou mais (Revisão primeiro) | "IT-052 (Upload) vence hoje e está em Revisão sem mudança há 4 dias." | Abrir card |

**Ficam para depois:**
- "cobrança sem resposta há mais de 3 h" (Atrasadas), quando a cobrança existir (14);
- "mensagem falhou hoje" (WhatsApp), quando a fila existir (12).

**Ações** (`hooks/useEvaComentarios.ts`):
- navegar, abrir o card ou abrir o chat. A proposta abre o `ConfirmarPropostaModal`, reaproveitável, com cada card em antes → depois;
- o gestor aprova e a EVA executa (`ti_agente_propor_sugestao(..., p_aprovar = true)`); os demais enviam para a fila (`origem = 'comentario'`). Nenhuma ação escreve direto em `it_requests`;
- uma proposta por card: se uma falhar, o diálogo diz qual e fica só com o que falhou, sem reenviar o que já foi;
- o texto de feito só aparece depois da execução ("Pronto: IT-045 e IT-052 passaram para Diego." ou "Proposta enviada para aprovação de um gestor."). Ele aparece no rodapé e no aviso, porque o board relido pode tirar o comentário da tela.

**`showInsights`** voltou a `true` no Início.

**Testes** (`comentarios.test.ts`, 12): cada regra aparece e some no caso certo. Um teste varre texto, botão, pergunta e título do diálogo das cinco regras e falha se algum disser "movi", "atualizei", "criei", "bloqueei", "reservei", "passei" ou "cobrei".

**14/Out/2026 — as duas regras da fila do WhatsApp** (só gestor, que lê a fila, D24):

| Bloco | Quando aparece | Texto | Ação |
|---|---|---|---|
| Atrasadas (depois de "crítica sem dono") | a última cobrança de um card atrasado saiu há mais de **4 h** e o responsável não respondeu | "Ana não respondeu à cobrança às 07:00 sobre o IT-020 (LIS)." | **Cobrar de novo**, pela mesma rota do botão Cobrar. O "feito" só aparece se a cobrança entrou na fila |
| WhatsApp (depois de "Wa-ha fora do ar") | uma mensagem de saída falhou hoje | "Uma mensagem para Diego falhou às 08:45: O número … não está no WhatsApp." | Ver no histórico (`/it/eva/membros`) |

**Desvio:** a issue falava em mais de 3 h sem resposta. Ficou em 4 h, a janela da RN16, para "Cobrar de novo" nunca ser recusada logo depois de aparecer.

**Diferença do texto da issue:** o `acceptInsight` não ficou no `evaService`. A ação mistura navegação, chat e diálogo, então ficou num hook da tela. O serviço só tem a chamada da RPC (`agenteAdmin.propor`).
