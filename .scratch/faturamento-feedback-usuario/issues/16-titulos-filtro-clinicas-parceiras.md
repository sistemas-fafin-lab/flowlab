Status: needs-triage
Type: task

# Títulos: opção pra ocultar clínicas parceiras (Nexus, ABAC, Medigest etc.)

## Onde

`src/modules/faturamento/components/TitulosList.tsx` (filtros da aba Aberta/Todas). Sem estrutura existente pra isso — nova tabela Supabase + tela de gerenciamento.

## Problema

O setor quer poder ocultar da lista de Títulos as fontes pagadoras que são clínicas parceiras (labs que enviam exame pra este laboratório processar, não convênios de saúde) — exemplos dados: Nexus, ABAC, Medigest. "etc." no relatório indica que a lista não é fechada.

Verificado no apLIS (24/08): **não existe nenhuma coluna em `fatinstituicao` que distinga isso.** Nexus (`IdInstituicao 1290`), ABAC (`1155`) e Medigest (`1123`) têm exatamente as mesmas flags (`FontePagadora=1`, `Afiliado=0`, `Filial=0`, `Segmento=0`) que qualquer operadora de saúde comum, como a AMHP-DF. É uma classificação de negócio que o flowlab não conhece — precisa ser criada e mantida no próprio sistema (decisão de grilling, 24/08: lista gerenciável em vez de config fixa no código, já que a lista pode crescer).

## O que fazer

1. Nova tabela no Supabase (ex.: `faturamento_fontes_parceiras`) guardando `id_fonte_pagadora` (int, do apLIS) + `nome` (cache do `NomFantasia`, pra não depender de consulta ao apLIS só pra listar) + `criado_por`/`criado_em`.
2. Tela/modal simples de gerenciamento (gated por `canManageBilling`, mesma permissão já usada pro módulo): buscar fontes pagadoras do apLIS (endpoint já existente ou novo, listando `fatinstituicao` com `FontePagadora=1`), marcar/desmarcar quais contam como "parceira". Cadastrar os 3 exemplos do relatório (Nexus, ABAC, Medigest) como ponto de partida.
3. Em Títulos (aba Aberta e no filtro "Todas"), toggle "ocultar clínicas parceiras" que filtra títulos cuja fonte pagadora está na lista marcada.

## Critérios de aceite

- Usuário com `canManageBilling` consegue marcar/desmarcar quais fontes pagadoras contam como "parceira", sem precisar de deploy.
- Com o toggle "ocultar clínicas parceiras" ativo, títulos de Nexus/ABAC/Medigest (e qualquer outra marcada) somem da lista de Títulos.
- Toggle desligado (padrão) mantém o comportamento atual, sem nada oculto.

## Referência

Novo relatório de feedback do setor de faturamento (24/08), item 4.1. Verificação de schema (`fatinstituicao`) e decisão de abordagem (lista gerenciável) nesta sessão de grilling (24/08).
