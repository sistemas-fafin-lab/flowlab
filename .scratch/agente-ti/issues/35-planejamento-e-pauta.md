# 35 — Planejamento e pauta da reunião

**What to build:**
- **Planejamento:** "o que cabe na próxima sprint?" responde com o ritmo real de cada pessoa. Quando alguém passa da capacidade, a EVA propõe passar cards para quem tem folga, e o gestor confirma com SIM.
- **Pauta da reunião:** antes da reunião da equipe, a EVA monta a pauta: o que a última reunião combinou e não andou, os atrasados, os bloqueios e as sugestões paradas.
- **Acompanhamento:** depois, a EVA cobra o que foi combinado ("combinado na reunião de 24/11").

Sugestões aceitas pelo usuário em 24/Nov. A pauta vai num "dia fixo, para gestores": o dia e a hora ficam em Configurações, a pauta sai 1 h antes no WhatsApp dos gestores, e "pauta da reunião" monta na hora.

Plano: §2 (D47 e D48) e §11.13.

**Blocked by:** 32 (o relógio da VPS manda a pauta). Os bloqueios da pauta vêm do check-in (34); sem ele, a seção só não aparece.

**Status:** done no código (27/Nov/2026). Falta aplicar a migration, publicar, marcar o dia e a hora em Configurações e conferir.

- [x] **Planejamento** (`montarPlanejamento`):
  - o ritmo das 4 semanas;
  - a capacidade até o fim da próxima sprint (ou 10 dias úteis), sem os dias de ausência;
  - o comprometido, o saldo e o que entraria do Backlog.
- [x] **Redistribuição:** até 2 cards por pessoa acima da capacidade, dos que não começaram, não são críticos e são só dela, para quem tem ritmo medido e folga. Pelo WhatsApp, a confirmação é com SIM (`planejar`); no chat, com os cartões (`planejamento`). A mudança entra pela aprovação de sempre, com um comentário no card.
- [x] **Pauta** (`montarPautaReuniao`):
  - da última reunião, o que não andou;
  - os atrasados e os bloqueios do check-in;
  - quem está acima da capacidade;
  - as pendências e os pontos para decidir.
- [x] **Envio 1 h antes** (`rodarPauta`, no relógio), uma vez por dia por gestor, e na hora pelo WhatsApp (`pauta_reuniao`) e pelo chat.
- [x] **Acompanhamento:** a cobrança da manhã cita a reunião que combinou o card.
- [x] **Configurações:** "Pauta da reunião da equipe", desligada por padrão, com o dia e a hora. **Histórico do membro:** "Pauta da reunião".
- [ ] Aplicar `20261127143700_eva_planejamento_pauta.sql` no projeto do app. Antes, a do check-in (`20261126172900_eva_checkin_diario.sql`), porque a lista de tipos da fila inclui os dele.
- [ ] Marcar o dia e a hora em Configurações e conferir a pauta de 1 h antes. Pedir "o que cabe na próxima sprint?" pelo WhatsApp e conferir a conta com o Kanban.

## Comments

**27/Nov/2026 — implementado no código.**
- **Conferido com a IA real, dados fictícios** (pelo Gemini; o crédito da Anthropic continuava zerado): as 11 frases caíram na intenção certa no WhatsApp e no chat. "Quem está sobrecarregado?" continuou sendo uma pergunta de gestão, e "prepara minha 1:1 com o Bruno" continuou sendo a 1:1.
- **Testes:**
  - `domain/planejamento.test.ts`: a janela, o ritmo, a capacidade com a ausência, quem recebe, a redistribuição, o Backlog e os textos;
  - `domain/pauta.test.ts`: a hora do envio, a situação de cada item da reunião, os bloqueios e o texto;
  - `ti-agente/pauta.test.ts`: o envio uma vez por gestor, os casos em que não sai e a leitura dos itens;
  - `ti-agente/planejamento.test.ts`: a redistribuição como sugestões e como cartões;
  - `comandos.test.ts`: as duas intenções, o SIM e quem não é gestor;
  - `domain/cobranca.test.ts`: a menção à reunião.
