# 04: Calendário de recursos: grade do mês

Spec: `.scratch/glosas-recursos-calendario-pendencias/spec.md`

**What to build:** abaixo dos painéis, a grade do mês do Calendário de recursos, com navegação de mês e os lotes em cada dia (pela data de exibição), usando a grade genérica.

**Blocked by:** 01, 03

**Status:** done

- [x] A grade mostra os itens do mês navegado, com o mesmo resumo e selos dos painéis.
- [x] Os prazos de fim de semana aparecem na sexta anterior com "vence sáb" ou "vence dom".
- [x] Clicar num item abre as requisições dele, como nos painéis.
- [x] Respeita o filtro de convênio; temas claro e escuro.

## Comments

- A grade está em `CalendarioRecursos.tsx` (`ChipRecurso` + `GradeMes`), abaixo do detalhe aberto e acima da lista "Sem prazo cadastrado". Os itens vêm do mesmo endpoint dos painéis (`itens` do mês, já pela data de exibição); o mês é navegado pela própria grade.
- **Resumo compacto na célula:** convênio, valor, lote, protocolo, quantidade e o motivo principal (com "+N" quando há mais). A lista completa de motivos e o prazo real ficam na dica do item e nas requisições ao clicar.
- **Cor por selo:** os itens da grade têm a cor do selo (Atrasado, Hoje, Amanhã, A vencer), com legenda. Atrasado também ganha a pílula "atrasado", para não depender só da cor.
- O item aberto fecha ao navegar para um mês em que ele não está (e que não está num painel).
- Ao trocar de mês, um erro de leitura substitui a aba inteira, painéis inclusive, porque eles vêm na mesma resposta. Isso já era assim antes desta issue.
- **Conferido no app (26/11/2026):** dados reais, novembro e dezembro, "vence sáb/dom" na sexta, clique abrindo as requisições, filtro de convênio (CASSI), temas claro e escuro, sem rolagem horizontal da página em 390 px. A grade rola dentro do card, como no Calendário de envios.
