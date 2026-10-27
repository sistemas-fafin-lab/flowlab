# 05: Modo Período

**What to build:** além do modo Mês, o usuário pode alternar para "Período" e informar as datas de início e fim. Cards e rankings passam a usar esse intervalo. A variação dos cards compara com o período imediatamente anterior, de mesmo tamanho (ex.: 01–15/10 contra 16–30/09).

**Blocked by:** 01 (Página Indicadores com o modo Mês e os cards).

**Status:** done

- [x] Alternância Mês / Período no cabeçalho. O modo Mês continua com o mês anterior como padrão.
- [x] Datas de início e fim reaproveitando os componentes de data já usados no Faturamento. O fim é inclusivo (o dia inteiro conta).
- [x] O endpoint valida o período (fim ≥ início, datas válidas) e recusa um período inválido com uma mensagem clara.
- [x] A janela anterior é o intervalo imediatamente anterior, com o mesmo número de dias.
- [x] Cards e rankings que já existirem respeitam o período escolhido.
- [x] Testes do módulo:
  - período anterior de mesmo tamanho, inclusive cruzando a virada de mês;
  - período de um dia só.
