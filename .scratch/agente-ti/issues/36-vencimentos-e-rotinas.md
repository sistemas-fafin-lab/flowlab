# 36 — Vencimentos e rotinas

**What to build:**
- **Vencimentos:** a EVA avisa com antecedência sobre licenças, contratos, domínios e certificados que vencem.
- **Rotinas:** a EVA cria sozinha os cards de rotina, como o backup mensal e a revisão de acessos.

Sugestão aceita pelo usuário em 24/Nov ("Gastos de TI + rotinas"):
- os vencimentos vêm das despesas do Gastos de TI, com o término que já está lá;
- as rotinas sem custo ganham um cadastro novo na EVA, que cria o card sozinho.

Plano: §2 (D49 e D50) e §11.14.

**Blocked by:** 32 (o relógio da VPS dispara os avisos e os cards).

**Status:** done no código (27/Nov/2026). Falta aplicar a migration, publicar, cadastrar a primeira rotina e conferir.

- [x] **Vencimentos** (`verificarVencimentos`, no relógio):
  - quando avisa: na antecedência de cada despesa e a 7 dias do fim, uma vez por pessoa;
  - quem recebe: os gestores com "Recebe alertas" e o responsável da despesa, desde que vejam o Gastos de TI;
  - o texto não leva valores.
- [x] **"O que vence este mês?"**, no chat e no WhatsApp, para quem vê o Gastos de TI.
- [x] **Rotinas** (`criarCardsDeRotina`, no relógio):
  - alguns dias antes de cada data, o card sai em A Fazer, com o prazo, os responsáveis e a prioridade;
  - depois, a rotina anda para a próxima data;
  - a trava é a própria data, e o erro fica na rotina.
- [x] **Aba Rotinas** (gestor e quem configura): cadastrar, editar, pausar e excluir (com confirmação).
- [ ] Aplicar `20261127191300_eva_rotinas.sql` no projeto do app.
- [ ] Cadastrar uma rotina com o prazo daqui a poucos dias e conferir o card. Conferir um aviso de vencimento com uma despesa de teste no Gastos de TI.

## Comments

**27/Nov/2026 — implementado no código.**
- **Conferido na tela:** a aba num harness com dados fictícios, nos temas claro e escuro, em 390 px de largura e com o formulário aberto.
- **Conferido com a IA real, dados fictícios** (pelo Gemini):
  - "o que vence este mês?" e "quando renova o certificado do portal?" responderam pelo bloco dos vencimentos;
  - sem o bloco, a resposta foi que os vencimentos ficam no Gastos de TI.
- **Testes:**
  - `domain/vencimentos.test.ts`: o término, a janela, os marcos do aviso e os textos;
  - `domain/rotinas.test.ts`: as datas (âncora no fim do mês), o dia de criar, as datas que passaram, os textos e o cadastro;
  - `ti-agente/vencimentos.test.ts`: quem recebe, uma vez por marco, e quando não sai;
  - `ti-agente/rotinas.test.ts`: o card, a trava, o erro e a tabela ausente;
  - `comandos.test.ts`: o bloco dos vencimentos só para quem vê o Gastos de TI.
