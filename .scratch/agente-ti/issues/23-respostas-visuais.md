# 23 — Respostas visuais no chat da EVA

**What to build:** as respostas do chat do Início eram só texto, com formatação "bem comum". Pedido do usuário (16/Out): "queria que ela conseguisse ser mais visual em algumas respostas dela".

Ele aprovou os Níveis 1 e 2 da proposta. O Nível 3, formatação nas mensagens do WhatsApp, fica para o futuro: ele acha que as mensagens de lá estão boas.

Regra: a IA escolhe o formato, e os dados saem do board que o Início já carregou. Nada do que um bloco mostra é escrito pela IA.

Plano: §2 (D34) e §8.

**Blocked by:** 16 (chat).

**Status:** done no código (16/Out/2026); falta publicar e conferir no navegador

- [x] **Nível 1:**
  - formatação leve: parágrafos, listas, **negrito** e códigos de card como link, sem HTML (`domain/respostaVisual.ts`, `chat/TextoEva.tsx`);
  - cards citados como cartões, com coluna, prazo legível, prioridade e responsáveis (`chat/CardsCitados.tsx`);
  - a resposta nova aparece aos poucos, uma vez só, respeitando "menos movimento"; o drawer acompanha rolando (`chat/useRevelacao.ts`).
- [x] **Nível 2: blocos** (`chat/BlocosEva.tsx`), no máximo 2 por resposta:
  - Números: os do topo do Início;
  - Distribuição: por pessoa (com atrasados) ou por coluna;
  - Projeto: feito contra o tempo da sprint, situação e cards que pedem atenção;
  - Agenda: atrasadas, depois os próximos dias;
  - Reunião: decisões e sugestões da última.
- [x] **Nível 2: próximos passos** (`chat/ProximosPassos.tsx`), até 3:
  - perguntar;
  - abrir card;
  - cobrar card atrasado (só gestor com o WhatsApp ligado, pelo mesmo caminho do botão Cobrar).
- [x] **Servidor:**
  - `SchemaChat` ganha `blocos` e `proximos_passos`, só com enum e texto;
  - as instruções dizem quando usar cada bloco e que o texto não repete o que o bloco mostra;
  - `validarRespostaChat` passa por `lerBlocos` e `lerPassos` (`domain/blocos.ts`): projeto que existe, reunião analisada, cobrança só de card atrasado.
- [x] Card que a agenda ou o projeto já mostram não se repete como cartão.
- [ ] Publicar e conferir no Início: "como está a equipe?", "como está o projeto X?", "o que vence esta semana?", "o que decidimos na última reunião?".

## Comments

**16/Out/2026 — implementado no código.**
- **Conferido com o Claude real, dados fictícios.** Ele escolheu o bloco certo nas sete perguntas:
  - panorama e carga para "como está a equipe";
  - Projeto, Agenda e Reunião para as perguntas sobre cada um;
  - Distribuição para "quem está sobrecarregado";
  - nada na saudação;
  - nada no pedido de mudança, que virou proposta.

  Os próximos passos fizeram sentido, e cada resposta levou de 2 a 6 s.
- **Ajuste depois do teste:** com Agenda ou Projeto, o texto listava os cards de novo. A instrução passou a pedir só a leitura, e os cartões repetidos saem da resposta.
- **Conferência visual:** Chrome headless, tema claro e escuro, três conversas de exemplo numa página temporária (já apagada).
- **Testes:**
  - novos: `blocos.test.ts` (5), `respostaVisual.test.ts` (12) e a validação em `chat.test.ts`;
  - o teste do limite de campos "ou nulo" do schema continua passando.
