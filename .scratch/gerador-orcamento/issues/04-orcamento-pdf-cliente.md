# 04: Orçamento em PDF do cliente

**What to build:** o atendente clica em "Gerar PDF" e baixa o **Orçamento** do cliente: exames, quantidades, preços, Valor Total e Valor com Desconto — os mesmos valores do resumo da tela. Conteúdo igual ao PDF do cliente da Tabela-Particular, com o cabeçalho e o logo no padrão do gerador de PDF de cotações do flowlab (jsPDF + jspdf-autotable, sem `canvg`).

Ver `.scratch/gerador-orcamento/spec.md` → histórias 28–31 e "Regras puras no navegador".

**Blocked by:** 03 — Desconto automático por volume e resumo

**Status:** done no código (20/Out/2026; sem migration nova); falta conferir no navegador depois do deploy

- [x] Botão "Gerar PDF" habilitado quando o carrinho tem itens
- [x] PDF com cabeçalho e logo no padrão dos PDFs do flowlab
- [x] Tabela de exames com quantidade e preço; totais "Valor Total" e "Valor com Desconto" vindos do mesmo cálculo da tela
- [x] O PDF do cliente nunca mostra custo, margem, percentual de desconto ou qualquer informação interna
- [x] A montagem do PDF é separada da tela (recebe os dados, devolve o documento) e é testada portando os testes de PDF da Tabela-Particular

**Desvios deliberados do PDF da Tabela-Particular:** o segundo total é sempre "Valor com Desconto" (lá era "Valor com N% de Desconto" / "Valor sem Desconto"), porque o PDF do cliente não mostra percentual e o resumo da tela usa esse rótulo; o título é "ORÇAMENTO" (lá "Orçamento Particular"), conforme o `CONTEXT.md`. O cabeçalho segue a faixa de `generateQuotationPDF.ts`, com o PNG branco `public/LOGO BRANCA.png` no lugar do texto "FLOW LAB" e os dados do laboratório da Tabela-Particular.
