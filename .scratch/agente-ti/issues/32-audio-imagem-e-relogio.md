# 32 — Áudio e imagem pelo WhatsApp, e o relógio da VPS

**What to build:** a EVA entende áudio (transcrito e tratado como texto) e recebe imagem (anexada ao card ou chamado citado). A VPS passa a chamar um relógio na Vercel a cada 10 min, para a lógica de horário ficar na Vercel. Sugestão aceita pelo usuário em 24/Nov.

Plano: §2 (D43, D44) e §11.10.

**Blocked by:** 12 e 13 (a fila e a VPS), 15 (o webhook).

**Status:** done no código (24/Nov/2026). Falta aplicar a migration, fazer o deploy, atualizar a VPS com o `CRON_SECRET` e conferir com um áudio e uma imagem de verdade.

- [x] **Webhook:** `planoDaMidia`. Áudio e imagem ficam pendentes só com a VPS nova e viva; figurinha não responde; vídeo e documento têm resposta fixa.
- [x] **VPS:** `baixarMidias` (WAHA local → bucket privado → `/api/ti/agente-midia`), o sinal de vida com `vps_recursos`, e o relógio a cada 10 min, voltando aos alertas locais se a Vercel não responder.
- [x] **Vercel:** `processarMidia`.
  - Áudio: transcrição pelo Gemini, com eco na resposta.
  - Imagem: anexo no card citado, ou espera o código por 2 h.
- [x] **Relógio:** `/api/ti/agente-relogio`, com os alertas de gestão e a retomada das mídias.
- [x] **Tela:** o histórico do membro marca 🎤 Áudio e 📎 Imagem, com a situação; Configurações mostra "Áudios do WhatsApp" no uso de IA.
- [ ] Aplicar `20261124182900_eva_audio_imagem_relogio.sql` no projeto do app.
- [ ] Deploy na Vercel (as rotas novas).
- [ ] Gerar o pacote da VPS (`npm run eva-build-outbox`), copiar e reinstalar com o `CRON_SECRET`.
- [ ] Mandar um áudio e uma imagem com legenda "IT-…" pelo WhatsApp e conferir a resposta e o anexo no card.

## Comments

**24/Nov/2026 — implementado no código.**
- **Conferido com o Gemini real, áudios sintéticos e frases fictícias:**
  - os códigos ditos por extenso saíram como IT-045 e IT-046;
  - "dia vinte e cinco" e "às três da tarde" viraram números;
  - chiado ficou sem fala.
  - Com silêncio digital absoluto, o Gemini às vezes inventa uma frase. O campo `tem_fala`, a temperatura 0 e um detector separado não resolveram sempre. Por isso a resposta mostra "🎤 Entendi: …".
- **Testes:**
  - `domain/midia.test.ts`: tipos, caminho no WAHA, códigos no texto, "só o código", eco;
  - `webhook.test.ts` e `ti-waha-webhook.test.ts`: o plano da mídia e o que o webhook grava;
  - `vps.test.ts`: download, desistência, limite de 10 MB, chamadas à Vercel sem vazar o segredo;
  - `midia.test.ts`: áudio, imagem com e sem código, card de outra pessoa, retomada pelo relógio;
  - `comandos.test.ts`: o código que anexa a imagem que esperava, o prefixo e o comentário sem repetição;
  - `gerarEstruturado.test.ts`: só o Gemini, com o anexo;
  - `outbox.test.ts`: os recursos no sinal de vida.
