# Gerador de Orçamento: Conferência de cobertura do convênio

Status: ready-for-agent

## Problem Statement

Hoje o atendente sobe o pedido médico no Gerador de Orçamento e recebe os exames
prontos para o Orçamento do cliente particular. Mas boa parte dos clientes chega
com convênio, e a pergunta do atendimento é outra: **o convênio do paciente cobre
todos os exames do pedido? Quais não cobre?**

A informação já existe no flowlab — cada exame da lista mostra "Convênios (n)",
os convênios que o atendem — mas está espalhada exame a exame. Para responder,
o atendente precisa abrir a lista de convênios de cada exame e procurar o
convênio do paciente, um por um. É lento, fácil de errar, e atrasa a decisão de
autorizar e cadastrar a requisição.

## Solution

Uma **Conferência de cobertura**: o atendente escolhe um convênio e o Gerador
diz, para os exames lidos do pedido ou já no carrinho, quais são cobertos e
quais não são, com um indicador claro de "todos cobertos" ou "4 de 6 cobertos".
É só conferência: não gera PDF, não mostra valor de convênio, não muda preços.

- No modal **Ler pedido médico**, o resultado da leitura ganha duas abas:
  **Orçamento particular** (a tela de hoje) e **Cobertura do convênio** (com o
  seletor de convênio e a conferência). Trocar de aba ou de convênio não
  reanalisa o pedido.
- No **carrinho**, um seletor "Conferir cobertura do convênio" acima da lista
  marca cada item com ✓ coberto / ✗ não coberto e mostra o indicador geral.
- O convênio escolhido é um só para a página: escolhido no modal, o carrinho já
  confere o mesmo, e vice-versa. Não fica salvo ao recarregar.

## User Stories

1. Como atendente, quero escolher um convênio no resultado da leitura do pedido médico, para saber na hora se ele cobre os exames pedidos.
2. Como atendente, quero alternar entre a aba "Orçamento particular" e a aba "Cobertura do convênio" sem reenviar o pedido, para não esperar a IA de novo.
3. Como atendente, quero trocar o convênio escolhido e ver a conferência atualizar na hora, para comparar convênios quando o paciente tem mais de um.
4. Como atendente, quero um resumo verde "Todos os N exames são cobertos pela X" quando o convênio cobre tudo, para seguir com a autorização sem conferir item a item.
5. Como atendente, quero um resumo âmbar "K de N cobertos pela X" quando falta cobertura, para perceber de cara que há exame fora do convênio.
6. Como atendente, quero ver primeiro os exames não cobertos e depois os cobertos, para focar no que exige ação.
7. Como atendente, quero clicar num exame não coberto e ver quais outros convênios o atendem, para orientar o paciente ou checar se ele tem outro plano.
8. Como atendente, quero que exame não coberto por nenhum convênio diga isso claramente ao ser expandido, para não procurar uma lista que não existe.
9. Como atendente, quero que os exames do pedido que não estão na tabela do Gerador apareçam num grupo à parte, fora da conta de cobertos, para o resumo não mentir sobre o que foi conferido.
10. Como atendente, quero que esses exames não encontrados tragam a frase "Não está na tabela do Gerador — confira a cobertura à mão", para não ler "não realizamos" sobre um exame que o convênio pode cobrir.
11. Como atendente, quero continuar podendo adicionar ao carrinho os exames reconhecidos a partir da aba de cobertura, para seguir com o Orçamento sem voltar de aba.
12. Como atendente, quero um atalho "Marcar só os não cobertos" na aba de cobertura, para montar o Orçamento particular só do que o convênio não cobre.
13. Como atendente, quero um seletor "Conferir cobertura do convênio" acima do carrinho, para conferir exames que montei à mão pela busca.
14. Como atendente, quero um selo ✓ ou ✗ em cada item do carrinho quando há convênio escolhido, para ver a cobertura sem abrir nada.
15. Como atendente, quero um indicador "Todos os exames são aceitos pela X" no carrinho quando todos estão cobertos, para confirmar de uma vez.
16. Como atendente, quero o indicador "K de N cobertos pela X" no carrinho quando não estão todos, para saber quanto falta.
17. Como atendente, quero que o convênio escolhido no modal já valha no carrinho e vice-versa, para não escolher duas vezes no mesmo atendimento.
18. Como atendente, quero poder limpar o convênio escolhido, para voltar ao carrinho sem selos.
19. Como atendente, quero que o seletor de convênio tenha busca por digitação, sem acento e sem diferenciar maiúsculas, para achar rápido entre dezenas de convênios.
20. Como atendente, quero que o seletor liste os convênios em ordem alfabética, para me localizar com facilidade.
21. Como atendente, quero que os preços, o Desconto automático por volume e o PDF do Orçamento não mudem com a conferência, para ela não interferir no Orçamento particular.
22. Como atendente, quero que a conferência não mostre valor negociado com convênio, porque o Gerador só sabe se o convênio atende, não quanto paga.
23. Como atendente, quero que o carrinho vazio não mostre indicador de cobertura, para não ver "0 de 0".
24. Como atendente, quero que uma leitura sem exames reconhecidos mostre na aba de cobertura só o grupo de não encontrados, sem resumo, para não ver conta vazia.
25. Como atendente, quero que a quantidade de um exame no carrinho não altere a conta de cobertos, porque cobertura é por exame, não por unidade.
26. Como quem tem permissão de usar o Gerador de Orçamento, quero acessar a conferência sem permissão nova, porque ela só mostra nomes de convênio que a busca já mostra.
27. Como atendente, quero que fechar o modal descarte a leitura como hoje, mas mantenha o convênio escolhido na página, para seguir conferindo no carrinho.
28. Como atendente, quero que, sem convênio escolhido, a aba de cobertura peça a escolha antes de mostrar resultado, para não ver uma conferência vazia.

## Implementation Decisions

- **Glossário.** O termo novo é **Conferência de cobertura** (ver `CONTEXT.md`). Evitar "orçamento de convênio" e "autorização". O **Orçamento** segue sendo só o do cliente particular.
- **Base de dados: a mesma de hoje.** A conferência usa a lista de preços já carregada pela tela. Desde a issue 04 a montagem da lista manda também `coberturaConvenios` por exame (só para o Gerador; a integração da Tabela Particular não recebe o campo). Consequência aceita: exames atendidos por convênio mas sem preço Particular (10 em produção em 11/Nov/2026, ver Further Notes) não estão na lista e aparecem como não encontrados.
- **Granularidade: fonte pagadora e convênio** (revisado em 11/Nov/2026, issue 04). A fonte pagadora agrupa convênios — em produção a AMHP-DF tem 26 tabelas associadas (AFFEGO, BACEN, NOTRE DAME…). A conferência escolhe a **fonte pagadora** (obrigatória) e, opcionalmente, o **convênio** = tabela associada da fonte, listada como está cadastrada (pares "X" e "X - MEDICINA LABORATORIAL" são dois convênios). Só fonte: coberto se alguma tabela dela atende. Com convênio: coberto só se aquela tabela atende. Regra por tabela (a do Controle de Custos): linha do exame tem precedência sobre a linha geral do TUSS da mesma tabela, e exclusão tira o exame da linha geral. A lista de preços passa a mandar `coberturaConvenios` (pares fonte + convênio que atendem, sem valor); `conveniosAceitos` vira as fontes distintas desses pares.
- **Módulo de domínio novo, puro: `cobertura`** (no domínio do Gerador, ao lado de `carrinho`, `orcamento` e `pedidoMedico`), sem React, rede nem PDF. Duas funções:
  - `conveniosDaLista(exames)`: os nomes distintos de `conveniosAceitos` da lista, em ordem alfabética (comparação em pt-BR). Alimenta o seletor.
  - `conferirCobertura(exames, convenio)`: recebe exames da lista (carrinho ou reconhecidos da leitura) e o nome do convênio; devolve os cobertos, os não cobertos — cada um com os outros convênios que o atendem — e um resumo `{ cobertos, total, todosCobertos }`. Exame repetido (mesma chave tuss + nome) conta uma vez. Lista vazia → total 0, e a tela não mostra resumo.
- **Estado do convênio na página.** Um único convênio escolhido (ou nenhum) vive na página do Gerador e é passado ao modal e ao carrinho; ambos podem alterá-lo. Não persiste (sem localStorage nem banco).
- **Seletor de convênio.** Campo com busca por digitação usando a mesma normalização da busca de exames (sem acento, sem diferenciar maiúsculas). Opções vindas de `conveniosDaLista`. Tem como limpar a escolha.
- **Modal Ler pedido médico.** Depois da leitura, duas abas sobre o mesmo resultado: "Orçamento particular" (inalterada) e "Cobertura do convênio". Na aba de cobertura:
  - sem convênio escolhido: só o seletor e um convite a escolher;
  - com convênio: resumo verde (todos cobertos) ou âmbar (K de N), depois os não cobertos, depois os cobertos, e por fim os não encontrados num grupo à parte, fora da conta;
  - clicar num não coberto expande os outros convênios que o atendem (mesma apresentação do "Convênios (n)" da busca); sem nenhum, diz que nenhum convênio cadastrado atende o exame;
  - não encontrados usam a frase fixa "Não está na tabela do Gerador — confira a cobertura à mão" (as frases de "Não realizamos…" ficam só na aba particular);
  - o rodapé mantém "Adicionar N ao carrinho" com as mesmas marcações das duas abas, e a aba de cobertura ganha o atalho "Marcar só os não cobertos", que marca exatamente os não cobertos e desmarca o resto.
- **Carrinho.** Seletor "Conferir cobertura do convênio" acima da lista. Com convênio e carrinho não vazio: selo ✓/✗ por item e indicador — "Todos os exames são aceitos pela X" quando todos cobertos, "K de N cobertos pela X" quando não. Preço, quantidade, Desconto automático por volume, resumo de valores e PDFs (cliente e interno) não mudam.
- **Permissão.** A mesma `canUseGeradorOrcamento`. Nenhuma chave, cargo ou migration nova.

## Testing Decisions

- **Um seam só: o módulo de domínio `cobertura`**, testado com vitest, só pelo comportamento observável (entrada → resultado), sem olhar estrutura interna.
- Casos a cobrir em `conferirCobertura`: todos cobertos (`todosCobertos` verdadeiro); parte coberta (contagem e separação corretas); nenhum coberto; lista vazia (total 0); exame repetido conta uma vez; outros convênios de um não coberto excluem o convênio escolhido e vêm em ordem; não coberto sem nenhum convênio (lista de outros vazia); exames de mesmo TUSS com nomes diferentes tratados como exames distintos; convênio que não aparece em nenhum exame (tudo não coberto).
- Casos a cobrir em `conveniosDaLista`: nomes distintos sem repetição, ordem alfabética com acentos, lista vazia, exames sem convênio.
- **Prior art:** os testes de domínio do próprio Gerador — `carrinho.test.ts`, `orcamento.test.ts`, `pedidoMedico.test.ts` e `busca.test.ts` — com o mesmo helper de montar item da lista.
- A tela (abas, seletor, selos, indicador, expansão dos outros convênios, atalho de marcar) **não tem teste automatizado** — o repositório não usa testing-library. É conferida no navegador depois do deploy, como nas issues anteriores do Gerador.

## Out of Scope

- Incluir na base exames sem preço Particular (exames "só convênio"). Decidido deixar para depois; a lista desses exames está em Further Notes.
- Limpeza do cadastro no Controle de Custos (exames sem linha Particular, grafias duplicadas, duplicatas idênticas em `custo_exames`). Feita à parte, fora do código.
- Selo de cobertura nos resultados da busca de exames (antes de entrar no carrinho). Fica como evolução.
- Conferência por plano ou tabela associada do convênio.
- Valor negociado com convênio, PDF da conferência, ou qualquer menção à cobertura no Orçamento.
- Guardar o convênio escolhido entre sessões ou associá-lo ao paciente.
- Mudança no servidor, no endpoint da lista de preços ou na leitura por IA.

## Further Notes

- Pedido original do usuário (área Atendimento): "deixarmos um campo para o atendente escolher se ele quer fazer um orçamento particular ou identificar se todos os exames do pedido médico tem cobertura pelo convênio que ele vai escolher e quais que não tem."
- Levantamento em produção (11/Nov/2026, somente leitura): 508 exames cadastrados, 468 com preço Particular no Gerador, **10 atendidos por convênio e fora do Gerador**:
  - **Sem linha Particular nenhuma:** HIV 1/2 - Imunoensaio de 4ª geração (Primeira Amostra) [40307166]; IMPRINT e CELL BLOCK [40601110]; IMUNOGLOBULINAS IgM [40307301]; IST - Chlamydia Por Biologia Molecular [40314243].
  - **Excluídos do preço Particular, com "irmão" de grafia quase igual que tem preço:** PROTEÍNA C REATIVA (acento) vs PROTEINA C REATIVA [40308383]; SÍFILIS – VDRL (travessão) vs SÍFILIS - VDRL [40307760]; MIOGLOBINA, SORO vs MIOGLOBINA [40302245]; HPV DETECÇÃO E GENOTIPAGEM DE ALTO RISCO e PCR PARA HPV A/B vs os demais de HPV [40601285].
  - **Preço Particular em outro exame do TUSS:** INSULINA vs INSULINA BASAL [40316360].
- No grupo de grafias quase iguais, a cobertura pode estar marcada num nome e o preço Particular no outro — na conferência, o mesmo exame pode sair "coberto" ou "não encontrado" conforme o nome que a IA casar. A limpeza do cadastro resolve.
- Há também ~18 exames com cadastro **idêntico** duplicado em `custo_exames` (mesmo TUSS e nome — ex.: Sódio, Renina, Rubéola, Toxoplasmose, CMV). O Gerador fica com o último; se a cobertura estiver marcada só no outro, a conferência não a vê.
