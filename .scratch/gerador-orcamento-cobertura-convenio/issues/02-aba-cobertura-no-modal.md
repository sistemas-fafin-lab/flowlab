# 02: Aba "Cobertura do convênio" no modal Ler pedido médico

**What to build:** depois que a IA lê o pedido médico, o resultado do modal ganha duas abas: **Orçamento particular** (a tela de hoje, sem mudança) e **Cobertura do convênio**. Na aba de cobertura o atendente escolhe o convênio (o mesmo seletor do carrinho, e o mesmo convênio da página: escolhido aqui, o carrinho já confere o mesmo, e vice-versa) e vê um resumo verde "Todos os N exames são cobertos pela X" ou âmbar "K de N cobertos pela X", os não cobertos primeiro, depois os cobertos, e por fim os exames não encontrados na tabela num grupo à parte, fora da conta. Trocar de aba ou de convênio não reanalisa o pedido.

Ver `.scratch/gerador-orcamento-cobertura-convenio/spec.md` → histórias 1–6, 9–11, 17, 24, 27, 28 e "Modal Ler pedido médico".

**Blocked by:** 01 — Conferência de cobertura no carrinho

**Status:** resolved

- [x] Resultado da leitura com as abas "Orçamento particular" (inalterada) e "Cobertura do convênio"; trocar de aba ou de convênio não chama a IA de novo
- [x] A aba usa o mesmo seletor e o mesmo convênio da página que o carrinho (escolher num lado vale no outro)
- [x] Sem convênio escolhido: a aba mostra só o seletor e um convite a escolher
- [x] Com convênio: resumo verde/âmbar calculado por `conferirCobertura` sobre os reconhecidos; depois não cobertos, depois cobertos
- [x] Não encontrados num grupo à parte, fora da conta, com a frase fixa "Não está na tabela do Gerador — confira a cobertura à mão" (as frases de "Não realizamos…" continuam só na aba particular)
- [x] Leitura sem reconhecidos: a aba mostra só os não encontrados, sem resumo
- [x] "Adicionar N ao carrinho" continua no rodapé, com as mesmas marcações nas duas abas
- [x] Fechar o modal descarta a leitura como hoje, mas o convênio escolhido continua valendo no carrinho
- [x] Conferido no navegador com um pedido real (dev local, dados de produção, imagem de pedido montada para o teste)
