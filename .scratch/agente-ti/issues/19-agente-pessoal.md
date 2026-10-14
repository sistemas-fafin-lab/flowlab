# 19 — A EVA como agente pessoal no WhatsApp

**What to build:** depois do primeiro uso real, o usuário pediu que a EVA "possa agir como um agente pessoal mesmo, nas respostas". Ele escolheu os quatro itens propostos e o tom "próxima e objetiva":
- **Conversa natural:** lembra a conversa recente, responde cumprimentos e perguntas na voz dela, e escreve as confirmações com as próprias palavras, sem dizer o que não foi feito.
- **Assistente do dia:** "o que eu tenho hoje?" responde com o dia da pessoa (atrasadas, o que vence, paradas, o que a última reunião combinou para ela, lembretes) e sugere por onde começar.
- **Ações como no chat:** criar card, mudar prioridade, responsável, coluna ou prazo, e comentar, pelo WhatsApp. Vira sugestão: o gestor confirma com SIM, e os demais mandam para a fila.
- **Lembretes pessoais:** "me lembra amanhã às 9h de…", no horário da EVA (dia útil, das 7h às 20h).

Plano: §2 (D30) e §11.5.

**Blocked by:** 18.

**Status:** done no código (14/Out/2026); falta aplicar a migration, publicar e conferir com o celular

- [x] Migration `20261014180000_eva_lembretes.sql`: tipo `lembrete` e status `cancelada` em `ti_agente_mensagens`, e índice dos lembretes pendentes.
- [x] `api/_lib/ti-agente/pessoal.ts`: conversa recente, o dia da pessoa (bloco do contexto) e lembretes (criar, cancelar, listar), com testes.
- [x] Roteador (`comandos.ts`):
  - intenções `propor`, `lembrete_criar`, `lembrete_cancelar` e `conversa`;
  - contexto com hora, conversa e o dia da pessoa;
  - instruções com o tom e a lista do que a EVA faz.
- [x] Pedido de mudança: prévia e SIM para gestor (aprova pela mesma lógica da tela); fila e aviso no sino para a equipe; recusa sem `canManageIT`.
- [x] Confirmação de atualização na voz da IA só quando bate com o registrado (`respostaFiel`); senão, a do sistema.
- [x] "Obrigado" recebe "por nada" sem IA; "ok" e 👍 continuam sem resposta.
- [x] Textos fixos reescritos no tom novo.
- [x] Fila do Início mostra "Lembrete pessoal", não o texto; histórico do membro com os tipos novos.
- [x] VPS: `lembrete` também respeita o horário (pacote novo).
- [ ] Aplicar a migration no projeto do app.
- [ ] Conferir com o celular: "bom dia", "o que eu tenho hoje?", uma continuação ("e o da Ana?"), "me lembra…" (e receber o lembrete), "cria um card para…" com SIM.

## Comments

**14/Out/2026 — implementado no código.**

- **Conversa:** as últimas 12 falas com a pessoa, das últimas 24 h, entram em `<conversa_recente>`. A última cobrança entra à parte, se for mais antiga. Cobrança e lembrete agendados ficam de fora, porque ainda não chegaram à pessoa.
- **O dia:** usa as mesmas regras do Início e da cobrança da manhã (`pendenciasDoMembro`, com os dias de "parado" da config e o último comentário de cada card). A reunião entra com as sugestões em que a pessoa é responsável e a situação de cada uma.
- **Propor:** usa `SugestaoIA` e `validarRespostaChat`, como o chat, até 5 por mensagem, com `origem = 'whatsapp'`.
  - O gestor recebe a prévia e um pedido `aprovar` com `dados.daProposta`.
  - O SIM aprova pela mesma lógica da tela e responde "Pronto, já está no Kanban ✅".
  - NÃO deixa a proposta na fila ("A proposta ficou na fila de sugestões do Início").
- **Lembretes:** são uma mensagem `lembrete` na fila, com `proxima_tentativa_em` = a hora pedida. Sem cron nem tabela nova.
  - A IA devolve "AAAA-MM-DDTHH:MM" em Brasília (`lerQuando`).
  - Regras: futuro, até 60 dias, 20 por pessoa, dentro do horário da EVA. Fora do horário, vai para a próxima janela, e a EVA avisa.
  - Cancelar exige o id da lista do contexto e o próprio dono.
- **Privacidade:** a fila do Início é de gestor (D24). Para o lembrete, ela mostra "Lembrete pessoal", não o texto.
- **Dois limites da API do Claude** apareceram na conferência real; os testes não pegariam:
  1. A saída estruturada recusa `minimum`/`maximum` (o `.int()` do zod). Isso já tinha aparecido no primeiro teste do celular, com o Gemini assumindo; `paraJsonSchema` tira esses limites.
  2. Ela recusa schemas com campos "ou nulo" demais ("too many parameters with union types"): o da resposta do WhatsApp tinha 20.
     - Os textos opcionais desse schema vão como `""`, e `vazio()` devolve null no código. Só as propostas (formato das reuniões) têm nulos, 10 no total.
     - Um teste mantém os schemas da EVA (WhatsApp, chat e reunião) com no máximo 12.
- **Conferido com o Claude real, dados fictícios (14/Out):**

  | Mensagem | Resultado |
  |---|---|
  | "bom dia, EVA!" | `conversa`, resposta natural |
  | "o que eu tenho hoje?" | o dia em ordem, com sugestão de por onde começar |
  | "e o da Ana?" | entendeu pela conversa que era sobre o dia da Ana |
  | "terminei o robô 🎉" | `atualizar_cards` no IT-045, com a confirmação dizendo que vai para aprovação |
  | "me lembra amanhã às 9h de…" | lembrete para 2026-10-15T09:00 |
  | "quais lembretes eu tenho?" | a lista |
  | "cria um card pra trocar o nobreak…" | `propor`: card novo, prioridade alta, Bruno |
  | "o que você consegue fazer?" | explicou em poucas linhas |

  Cada resposta levou de 2 a 7 s.
- **Testes:** 246 da EVA. Entram:
  - 9 cenários novos no roteador: por nada, voz da IA com e sem reserva, conversa e dia no contexto, propor para equipe e gestor, recusa, criar, adiar e cancelar lembrete;
  - 4 no `pessoal.ts`;
  - 1 no `respostas.ts`;
  - 2 nos limites do schema;
  - 4 cenários na migration (PGlite).
