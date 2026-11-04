# 25 — Aviso para a equipe toda, pelo chat e pelo WhatsApp

**What to build:** pedido do usuário (04/Nov): "ela não consegue encaminhar para todos os membros de uma vez". No chat do Início, "avisa todo mundo que…" gerava no máximo 3 cartões, um por pessoa, cada um com o próprio "Enviar". Pelo WhatsApp, `avisar_pessoa` aceitava uma pessoa só; para todos, só havia o post no grupo.

Decisões do usuário (04/Nov):
- no privado de cada um; quem não tem WhatsApp, citado no grupo (como na D35);
- pelo chat e pelo WhatsApp;
- todos os ativos da aba Membros, menos quem pede.

Só gestor (`canManageAgenteTI`). Nada sai antes da confirmação.

Plano: §2 (D36) e §11.6.

**Blocked by:** 21 (aviso para uma pessoa), 24 (aviso pelo grupo).

**Status:** done no código (04/Nov/2026); falta aplicar a migration, publicar e conferir com um aviso real

- [x] **Quem recebe** (`ti-agente/aviso.ts`, `checarAvisoEquipe`):
  - ativos da aba Membros, menos quem pede, sem removido ou desativado;
  - com WhatsApp, no privado; sem, citados numa mensagem só no grupo; sem grupo escolhido, de fora;
  - ninguém para receber, ou WhatsApp desligado: a recusa diz o motivo.
- [x] **Envio** (`enviarAvisoEquipe`): uma linha `aviso` por pessoa e uma do grupo, num insert só, no horário da EVA.
- [x] **Chat:**
  - `aviso_equipe` no schema, com a instrução para usar em "todo mundo", "todos", "a equipe";
  - a rota `agente-perguntar` monta o cartão com quem recebe;
  - cartão "Aviso para a equipe" (`AvisoEquipeChatCard`), com o texto editável e "Enviar para todos (N)";
  - `agente-avisar` aceita `{ todos: true, texto }`.
- [x] **WhatsApp:** intenção e comando `avisar_equipe`, com a prévia (quem recebe, quem vai no grupo, quem fica de fora) e o SIM.
- [x] Migration `20261104120000_eva_aviso_equipe_gestor_direto.sql`: `avisar_equipe` em `ti_agente_comandos`.
- [ ] Aplicar a migration no projeto do app.
- [ ] Conferir: "avisa todo mundo que…" pelo chat e pelo WhatsApp, recebido no celular de duas pessoas e no grupo, para quem não tem WhatsApp.

## Comments

**04/Nov/2026 — implementado no código.**
- **Interpretação:** "encaminhar para todos" é o aviso do gestor (D32) para a equipe inteira. O post no grupo ("avisa no grupo") continua existindo; a IA só usa `avisar_grupo` quando a pessoa fala do grupo.
- **O limite de 3 avisos por resposta** continua para pessoas específicas ("avisa o Bruno e a Ana").
- **Testes:**
  - `aviso.test.ts`: papel, WhatsApp desligado, ninguém para avisar, privado e grupo, sem grupo, xará, o insert de uma vez, agendado no sábado;
  - `comandos.test.ts`: prévia, SIM e o "Pronto", a recusa sem gestor e sem destino;
  - `chat.test.ts`: o campo no schema e na validação;
  - `blocos.test.ts`: o cartão aberto, bloqueado e enviado;
  - migration: 2 cenários no PGlite.
