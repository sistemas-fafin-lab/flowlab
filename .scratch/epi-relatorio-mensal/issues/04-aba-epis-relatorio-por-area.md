# 04: Aba EPIs na Qualidade e relatório por área

**What to build:** na Qualidade, uma aba nova **"EPIs"**, visível a quem tem "Ver relatórios de EPI". A Qualidade escolhe o mês, vê as áreas que tiveram EPI entregue (com o aviso de pedidos de EPI do mês ainda não entregues), filtra por área e gera o PDF do **Relatório mensal de EPI** de cada área, calculado na hora, para imprimir e colher as assinaturas. Spec: `.scratch/epi-relatorio-mensal/spec.md` (histórias 16–32, 49–50; Regras de inclusão das linhas; Área; Layout do PDF por área; Testing Decisions → pontos 1 e 2).

**Blocked by:** 02 (Produto EPI e Identificação do EPI).

**Status:** ready-for-agent

- [x] Nova chave "Ver relatórios de EPI" (`canViewEpiReport`); a aba, a rota e o item de menu só aparecem com ela (sem ela, a URL não abre).
- [x] Domínio: função que monta as linhas de uma área e mês a partir das solicitações, produtos e movimentações, com todas as regras de inclusão da spec (só solicitação de materiais, só concluída, mês da data da solicitação, área = setor gravado, produto EPI, item com movimentação) e a identificação vinda da cópia do item, senão do cadastro atual, senão vazia; ordenadas por data e solicitante.
- [x] Domínio: função que lista as áreas do mês com a contagem de pedidos de EPI ainda não entregues (nesta fatia, toda área está "aberta").
- [x] Tela: seletor de mês, filtro de área, lista de áreas com o aviso de pendentes e o botão "Gerar PDF".
- [x] PDF A4 horizontal: cabeçalho "EPIs — <Área> — <Mês>/<Ano>"; colunas Data, Produto, Identificação (ex.: "CA 12345", "ANVISA 80495510226"), Qtd., Solicitante, Assinatura (larga, uma por linha); rodapé "Responsável da área: ______  Data: __/__/____" e número da página.
- [x] Testes do domínio cobrem todos os casos listados em Testing Decisions → ponto 1 (montagem das linhas e lista de áreas).
- [x] Teste do PDF por extração de texto, no estilo dos testes de PDF do Gerador de Orçamento.
