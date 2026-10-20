# 24 — Cobrança e aviso pelo grupo para quem não recebe pelo WhatsApp

**What to build:** pedido do usuário (16/Out), combinado com a equipe: "quando eu pedir pra EVA comunicar um membro que não recebe cobrança pelo WhatsApp, ela pode enviar a mensagem ao grupo e citar o nome da pessoa que eu estou cobrando".

Vale só para os pedidos do gestor. A cobrança da manhã não muda.

Plano: §2 (D35), §10 e §11.6.

**Blocked by:** 18 (grupo da equipe), 21 (aviso para uma pessoa).

**Status:** done no código (19/Out/2026); falta publicar e conferir com o grupo de verdade

- [x] **Cobrança** (`domain/cobranca.ts`, `ti-agente/cobranca.ts`):
  - botão Cobrar, passo "Cobrar" do chat e "cobra…" pelo WhatsApp;
  - os responsáveis ativos sem adesão ou sem número vão citados numa mensagem só no grupo (`citadosNoGrupo`, `montarCobrancaNoGrupo`);
  - quem tem adesão continua no privado, e um card pode ter os dois;
  - no Lembrar, nada muda.
- [x] **Aviso** (`ti-agente/aviso.ts`): quem não tem WhatsApp recebe no grupo, como "📢 Aviso de Ana para Bruno: …". Quem tem WhatsApp continua no privado (D32).
- [x] **Citar:** o primeiro nome, ou o nome inteiro quando há outra pessoa na equipe com o mesmo primeiro nome (`nomeParaCitar`).
- [x] **Mesmas regras:** a linha no grupo é `cobranca_manual` (ou `aviso`) com `chat_id_destino`. Valem a janela de 4 h, o horário da EVA e a contagem do dia. Sem grupo escolhido, a recusa diz o que falta.
- [x] **Antes de sair**, o gestor vê que vai para o grupo:
  - na prévia do WhatsApp;
  - no cartão de aviso do chat ("Aviso no grupo", "Enviar no grupo");
  - na dica do botão Cobrar.

  Depois, o aviso na tela e o "Pronto" do WhatsApp dizem para onde foi.
- [x] **Início:** o último contato mostra "Cobrada no grupo às 10:12", sem "sem resposta", porque a EVA não lê o grupo.
- [ ] Publicar e conferir:
  - Cobrar um card de quem não tem adesão: a mensagem chega no grupo e cita o nome;
  - "avisa o <pessoa sem WhatsApp> que…", pelo chat e pelo WhatsApp.

## Comments

**19/Out/2026 — implementado no código.**
- **Interpretação, para confirmar com o usuário:**
  - "não recebe cobrança pelo WhatsApp" é não ter adesão ou não ter número, para a cobrança;
  - para o aviso, é não ter número, porque o aviso já ia para quem tem WhatsApp, com ou sem adesão (escolha de 15/Out).
- **Citar é o nome no texto, não a menção do WhatsApp (@).** A menção pediria o número da pessoa, que quem não tem WhatsApp não tem, e mudança no script da VPS.
- **Sem migration.** A tabela já aceita `chat_id_destino` em qualquer tipo, e o script da VPS envia para o grupo quando ele está preenchido.
- **Testes:**
  - `cobranca.test.ts`: citados, texto, destino e o botão;
  - `pessoas.test.ts`: `juntarNomes` e `nomeParaCitar`;
  - `whatsapp.test.ts`: o último contato no grupo;
  - `aviso.test.ts`: sem WhatsApp vai para o grupo; sem grupo, recusa;
  - `ti-agente-cobrar.test.ts`: privado e grupo no mesmo card, inativo de fora, Lembrar sem mudança;
  - `comandos.test.ts`: prévias e SIM;
  - `blocos.test.ts`: o cartão e o botão.
- **De carona:** quatro erros de tipo em testes, deixados pela D34 (`chat.test.ts`) e pela varredura do role (`faturamento-titulos-aplis-previa.test.ts`).
