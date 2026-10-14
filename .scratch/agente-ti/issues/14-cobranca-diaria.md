# 14 — Cobrança diária e sob demanda

**What to build:** as duas formas de a EVA cobrar pelo WhatsApp.

**Diária (a mensagem da manhã):**
- Em dia útil, o cron `agente-cobranca-cron` calcula as pendências de cada membro com as **mesmas regras do Início** (domínio da 02).
- Monta o texto pelo modelo fixo (D11, §10) e grava uma mensagem `cobranca` por membro na fila, com `chave_dia`.
- O script da VPS (12) envia.
- O `dryRun` devolve as mensagens montadas sem gravar. É a forma de conferir, antes de ligar, que as pendências batem com o Início.

**Sob demanda (o botão Cobrar/Lembrar do protótipo, D22):**
- No bloco "Atrasadas e cobranças" do Início, o botão chama `agente-cobrar`.
  - **Lembrar:** o próprio card, para quem tem `canManageIT`.
  - **Cobrar:** card de outra pessoa, só para `canApproveAgenteTI`.
- O servidor confere permissão, janela de 4 h por card e WhatsApp com adesão (RN16), e grava uma mensagem `cobranca_manual` com `enviada_por`.
- A tela segue o comportamento otimista do handoff: o botão vira "Cobrada", aparece "Cobrança enviada agora via WhatsApp", a mensagem entra na fila e o card Cobranças soma +1.

Plano: §2 (D11, D13, D22), §4.3 (RF18, RF25), §4.4 (RN12, RN16), §10, §12.1 e §14.1/§14.5.

**Blocked by:** 02, 03, 06, 12. A conferência em produção depende da 13.

**Status:** done no código (14/Out/2026); falta ligar a cobrança e conferir o primeiro envio real (depende da 13)

- [ ] `domain/cobranca.ts`, com testes:
  - `pendenciasPorMembro` (atrasadas, vencem hoje ou no próximo dia útil, paradas);
  - `montarMensagem` (seções vazias somem, até 8 itens mais "e outras N no Início", link do Início);
  - `montarCobrancaManual` (texto do protótipo + código do card);
  - `podeCobrar({ card, usuario, permissoes, ultimaManual, agora })`, com o motivo da recusa.
- [ ] Ação `agente-cobranca-cron`:
  - GET com `CRON_SECRET` e `dryRun`;
  - não faz nada em fim de semana, com o liga/desliga desligado ou para membro sem pendência;
  - `chave_dia` impede uma segunda cobrança no mesmo dia.
- [ ] Cron `0 11 * * 1-5` no `vercel.json`.
- [ ] Migration com `ti_agente_cobrancas_hoje()`: exige `canManageIT` e conta `cobranca` + `cobranca_manual` enviadas hoje, no dia de Brasília.
- [ ] Ação `agente-cobrar`:
  - POST com sessão;
  - 403 sem permissão, 409 dentro da janela de 4 h, 422 sem WhatsApp, cada um com mensagem clara;
  - uma mensagem por responsável do card.
- [ ] No Início:
  - `evaService.sendCharge` chama `agente-cobrar`;
  - o botão mostra Lembrar ou Cobrar conforme o dono do card, e fica desabilitado, com dica, quando não pode;
  - o "último contato da EVA" de cada atrasada vem da fila ("Cobrada às 10:12 · sem resposta", "Ainda não cobrada");
  - o indicador **Cobranças hoje** usa `ti_agente_cobrancas_hoje()` (função `SECURITY DEFINER` que só devolve a contagem, D24, §6.3), para quem não é gestor também ver o número;
  - o "último contato da EVA" nas atrasadas aparece **só para gestores** (D24).
- [ ] Link do Início com a URL pública do app (reaproveitar a variável já usada nos links dos e-mails).
- [ ] Situação na aba Configurações: última cobrança, quantas mensagens e quantas falhas.

## Comments

**13/Out/2026.** A cobrança sob demanda entrou com o protótipo (botão Cobrar/Lembrar). A diária continua como estava.

**14/Out/2026 — implementado no código.**
- **Domínio compartilhado.** `src/modules/eva/domain/cobranca.ts` é importado pelo Início e pela `api/`.
  - Os arquivos do domínio passaram a importar com `.js`, porque a `api/` compila com NodeNext. O Vite resolve `.js` para `.ts` sem configuração.
  - Isso resolve a questão aberta na 06: as regras de atrasado e parado são as mesmas do Início, sem cópia.
- **Funções do domínio:**
  - `pendenciasDoMembro`: cada card numa seção só, na ordem atrasada > vence hoje ou até o próximo dia útil > parada. O comentário recente tira o card de "parado";
  - `montarMensagemDiaria`: modelo do §10, com 8 itens no máximo e "… e outras N no Início". Na sexta, a seção diz "Vencem até segunda". Os exemplos de resposta usam os códigos reais;
  - `montarCobrancaManual`, `podeCobrar` (403/409/422 com o motivo e o horário da próxima cobrança possível), `destinatarios` e `chaveDia`. 13 testes.
- **`agente-cobranca-cron`:**
  - GET com `CRON_SECRET`;
  - não grava em fim de semana nem com o WhatsApp ou a cobrança desligados;
  - `chave_dia` com `upsert` e `ignoreDuplicates`: rodar duas vezes conta como "repetida";
  - o `dryRun` monta os textos mesmo com tudo desligado ou em fim de semana, para conferir antes de ligar.
  
  Cron `0 11 * * 1-5` no `vercel.json`.
- **`agente-cobrar`:**
  - POST com sessão, para cards atrasados;
  - Lembrar o próprio card com `canManageIT`; Cobrar só com `canApproveAgenteTI`;
  - 409 dentro de 4 h; 422 sem WhatsApp, com o WhatsApp desligado ou com o card em dia;
  - uma mensagem por responsável, com `enviada_por`. 5 testes da rota.
- **`ti_agente_cobrancas_hoje()`:** já estava na migration de RPCs (05).
- **Início:**
  - o botão aparece só com o WhatsApp ligado e só onde a pessoa pode usar: Lembrar no próprio card, Cobrar só para gestor;
  - para gestor, fica desabilitado com a dica quando ninguém tem WhatsApp com adesão;
  - resposta otimista ("Cobrada", "Cobrança enviada agora via WhatsApp", o indicador soma +1); recusa do servidor desfaz a mudança e mostra o motivo;
  - "último contato da EVA" só para gestor (D24): "Cobrada às 10:12 · sem resposta", "… · respondeu às 10:40", "Cobrança na fila", "Ainda não cobrada";
  - fila e contagem são relidas a cada minuto com a página aberta.
- **Link do Início:** usa `APP_URL` (`api/_lib/appUrl.ts`).
- **Configurações:** mostra a última cobrança diária e, nos últimos 7 dias, quantas mensagens foram enviadas, quantas falharam e quantas estão na fila.
- **Horário de cobrança (14/Out, pedido do usuário: "não deve cobrar aos fins de semana"):** cobranças e lembretes só saem em dia útil, das 7h às 20h.
  - O domínio ganhou `proximaJanelaDeCobranca`.
  - O botão Cobrar grava a mensagem agendada e devolve `agendadaPara`; a tela mostra "Cobrança agendada para segunda (19/10) às 07:00".
  - O script da VPS reagenda qualquer cobrança fora da janela, para ela não ocupar a fila.
  - A validade de 12 h conta da hora agendada.
  - Teste e confirmação saem sempre.
  
  Testes: janela (manhã, noite, sexta à noite, sábado e domingo), fila num sábado e rota num sábado.
- **Conferido no banco do app (14/Out), sem gravar:**
  - o cron em `dryRun` respondeu "A cobrança diária está desligada" e não montou mensagens: há 1 membro cadastrado, ainda sem WhatsApp e adesão;
  - a prévia do texto desse membro, ignorando a adesão, saiu no modelo, com 1 card parado desde 08/09.
