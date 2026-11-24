# 30 — Preparação de 1:1

**What to build:** "prepara minha 1:1 com o Bruno". A EVA monta a pauta da conversa com os dados da pessoa e pontos para conversar. Sugestão aceita pelo usuário em 24/Nov.

Plano: §2 (D41) e §11.8.

**Blocked by:** 27 (o painel de gestão).

**Status:** done no código (24/Nov/2026). Falta publicar e conferir.

- [x] **A pauta** (`montarPautaUmAUm`, no painel dos últimos 7 dias):
  - as entregas e os abertos, atrasados e parados;
  - a ausência;
  - os atrasados, os parados, o que vence em 7 dias e as cobranças sem resposta;
  - o que a última reunião combinou com a pessoa.
- [x] **Pontos para conversar** por regras fixas:
  - repactuar o que está atrasado há mais de 7 dias;
  - destravar o parado;
  - as cobranças sem resposta;
  - carga acima da média;
  - quem cobre na ausência;
  - reconhecer as entregas, ou entender por que não houve.
- [x] **WhatsApp:** a intenção `preparar_1a1`, só para gestor.
- [x] **Chat:** o campo `pauta_1a1`. O servidor troca a resposta pela pauta, com negrito e listas.
- [ ] Publicar e pedir uma 1:1 de verdade, pelo WhatsApp e pelo chat.

## Comments

**24/Nov/2026 — implementado no código.**
- **Conferido com o Claude real, dados fictícios:** "prepara minha 1:1 com o Bruno" e "me ajuda a montar a pauta da conversa com a Ana", pelo WhatsApp, viraram `preparar_1a1` com a pessoa certa. No chat, "prepara minha 1:1 com a Ana" devolveu `pauta_1a1` com a Ana.
- **Testes:**
  - `domain/gestao.test.ts`: as duas formas e o caso sem pendências;
  - `comandos.test.ts`: gestor, sem a pessoa, sem ser gestor.
