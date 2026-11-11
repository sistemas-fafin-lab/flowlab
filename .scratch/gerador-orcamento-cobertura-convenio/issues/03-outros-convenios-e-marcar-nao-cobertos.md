# 03: Outros convênios e atalho "Marcar só os não cobertos"

**What to build:** na aba "Cobertura do convênio" do modal Ler pedido médico, o atendente clica num exame não coberto e vê quais outros convênios o atendem (para orientar o paciente ou checar se ele tem outro plano); quando nenhum convênio cadastrado atende o exame, a tela diz isso. E um atalho "Marcar só os não cobertos" deixa marcados exatamente os exames que o convênio não cobre, para o atendente montar o Orçamento particular só deles com o botão de adicionar ao carrinho.

Ver `.scratch/gerador-orcamento-cobertura-convenio/spec.md` → histórias 7, 8, 12 e "Modal Ler pedido médico".

**Blocked by:** 02 — Aba "Cobertura do convênio" no modal Ler pedido médico

**Status:** resolved

- [x] Clicar num não coberto expande/recolhe os outros convênios que o atendem (vindos de `conferirCobertura`), com a mesma apresentação do "Convênios (n)" da busca
- [x] Não coberto sem nenhum outro convênio: ao expandir, avisa que nenhum convênio cadastrado atende o exame
- [x] Atalho "Marcar só os não cobertos" na aba de cobertura: marca exatamente os não cobertos e desmarca o resto; o contador do "Adicionar N ao carrinho" acompanha
- [x] Atalho escondido ou desabilitado quando não há não cobertos
- [x] Conferido no navegador
