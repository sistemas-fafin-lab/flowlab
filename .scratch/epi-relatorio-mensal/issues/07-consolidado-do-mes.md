# 07: Consolidado do mês de EPI

**What to build:** na aba EPIs, quem tem "Ver relatórios de EPI" baixa o consolidado do mês: todas as áreas, com as mesmas regras de inclusão do relatório por área, mais os totais por produto e por área, em PDF e em Excel. Não tem assinatura nem fechamento. Spec: `.scratch/epi-relatorio-mensal/spec.md` (histórias 43–47; Consolidado).

**Blocked by:** 04 (Aba EPIs na Qualidade e relatório por área).

**Status:** ready-for-agent

- [x] Domínio: função que monta o consolidado (linhas com Área, Data, Produto, Identificação, Qtd., Solicitante; totais por produto e por área), reaproveitando a montagem das linhas.
- [x] Botões "Consolidado (PDF)" e "Consolidado (Excel)" na aba EPIs.
- [x] PDF: tabela de todas as áreas e quadros de totais por produto e por área, sem coluna de assinatura.
- [x] Excel: as linhas e os totais, no padrão da exportação da lista de produtos.
- [x] Testes do domínio: os totais batem com as linhas e respeitam as regras de inclusão.
