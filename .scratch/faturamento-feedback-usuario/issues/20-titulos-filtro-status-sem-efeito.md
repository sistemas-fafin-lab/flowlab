Status: done
Type: research

# Títulos (Contas a Receber): filtro de Status parece não mudar a lista

## Onde

`src/modules/faturamento/components/TitulosList.tsx:257-263` (Select de Status) →
`onFiltrar({ status: v as TituloStatus | '', pagina: 1 })` →
`ContasReceberPage.tsx:103-105` (`aplicarFiltro`, merge no `filtros` state) →
`hooks/useContasReceber.ts:167-245` (`refetch`, `.eq('status', status)`).

## Problema

Relato do setor: "Quando vou em contas a receber e pesquiso pelo filtro no
status. Ele não muda permanece de modo igual para todos os status."

## Investigado em 27/08 — hipótese de baixo volume de dado DESCARTADA

A hipótese inicial (rodada 5) era que `notas` em produção não tinha
diversidade de status suficiente pra filtro fazer diferença — mesmo padrão das
issues 01/05/06/12. **Verificado direto na produção (jqx) e não é isso**:

- `notas` tem 5 linhas (o seed já conhecido), mas com status **diversos**:
  `aberta` (2), `parcialmente_recebida` (1), `recebida` (1), `glosada` (1).
- Testei a MESMA query que o hook faz (`.from('notas').select(...).eq('status',
  X)`) direto contra produção: filtra perfeitamente — `''` → 5,
  `aberta` → 2, `recebida` → 1, `glosada` → 1, `parcialmente_recebida` → 1.
  **O backend/query está correto.**
- Revisei a cadeia completa do front (`TitulosList` → `ContasReceberPage` →
  `useContasReceber`): `status` é desestruturado de `filtros`, entra na
  dependência de `refetch` (`useCallback`) e do `useEffect` que o dispara,
  `aplicarFiltro` faz merge correto do patch (`{ ...atual, ...patch }`), e
  `filtros`/`onFiltrar` chegam em `TitulosList` sem interceptação. **Não achei
  bug na leitura de código.**

## Hipóteses restantes (nenhuma confirmada)

1. **Deploy desatualizado**: o setor está testando uma versão do bundle
   anterior a algum ajuste não documentado, ou há cache de CDN/browser servindo
   JS antigo.
2. **Reprodução diferente do que o código sugere**: talvez o setor tenha visto
   a CONTAGEM mudar (5 → 2, por ex.) mas continuou achando "igual" por outro
   motivo (ex.: os títulos que sobram têm a mesma aparência visual, ou ele
   testou combinando status com busca/período de um jeito que zera a lista
   toda vez independente do status).
3. Algo fora do código lido aqui (ex.: uma extensão de navegador, uma sessão
   com permissão insuficiente que devolve erro silencioso e mantém o estado
   anterior na tela).

## O que fazer

- Preciso de uma reprodução ao vivo pra avançar: ou (a) o setor grava/descreve
  passo a passo (qual status escolheu, quantos títulos apareciam antes e
  depois, se o número total mudou), ou (b) eu mesmo abro o app com uma sessão
  de teste (`canViewBilling`) e reproduzo manualmente. Peço ao usuário para
  decidir por qual caminho seguir.

**Decidido em 27/08**: sem credencial de teste disponível no repo pra eu
logar sozinho (opção b), o usuário vai mandar prints mostrando o filtro de
Status antes/depois (qual status escolhido, contagem de títulos em cada
caso). Aguardando os prints — nenhuma mudança de código até chegarem.

## Print recebido em 27/08 — achada a causa real: período padrão, não Status

Print da tela em produção com o período padrão (`Emissão de` 01/05/2026 até
31/08/2026, Status "Todos"): **"Nenhum título no período"**.

Cruzei com os dados reais das 5 `notas` de produção (mesma consulta desta
sessão) — `data_emissao` de todas: 28/01, 15/02, 25/02, 01/03, 05/03/2026,
todas em **2026**. O período padrão é `mesesAtras(3)` até `fimDoMes()`
(`ContasReceberPage.tsx:27-37`) — hoje (27/08) isso dá 01/05 a 31/08/2026,
que não cobre NENHUMA das 5 notas existentes.

**Causa real**: a tela abre vazia por causa do período padrão, não do
Status. Trocar o Status numa lista que já está zerada continua zerada — daí
parecer que "nada muda", mas o filtro de Status nunca chegou a ser testado
contra dado nenhum. Mesma causa-raiz das issues 01/05/06/12 (produção sem
uso orgânico de `notas`), só que aqui ela se disfarça de bug no Status.

**Falta só uma confirmação final**: pedi ao usuário mais um print com
`Emissão de` = 01/01/2026 (cobre as 5 notas) — se a lista aparecer e o
Status passar a filtrar corretamente entre as opções, fecha em definitivo
que não há bug de código, só falta de dado no período padrão.

## Confirmado em 27/08 — fechada, sem bug

Dois prints do usuário com `Emissão de` = 01/01/2026:
- Status "Todos": as 5 notas aparecem (Recebida/Glosada/Parcial/Aberta/Aberta),
  batendo exatamente com o dado real de produção já verificado nesta sessão.
- Status "Aberta": a lista cai corretamente para as 2 notas certas
  (NF-2026-001237, NF-2026-001235).

**Causa raiz confirmada**: não havia bug no filtro de Status. A tela abre no
período padrão (`mesesAtras(3)` até `fimDoMes()`), que hoje (27/08) não cobre
nenhuma das 5 notas existentes (todas com emissão em jan–mar/2026) — a lista
já nascia vazia, e trocar o Status numa lista vazia continua vazia,
parecendo "não muda". Assim que o período cobre as notas, o Status filtra
normalmente. Mesma causa-raiz de fundo das issues 01/05/06/12 (produção sem
uso orgânico de `notas` ainda) — nenhuma mudança de código necessária.

Ponto a observar (fora do escopo desta issue, não é bug): assim que o setor
passar a criar títulos organicamente, vale considerar se o período padrão de
3 meses ainda faz sentido, ou se merece um aviso mais claro que "Nenhum
título no período" quando o motivo é a janela de datas e não a ausência real
de títulos.

## Critérios de aceite

- Reproduzir o sintoma ao vivo (não só por leitura de código) antes de
  qualquer mudança — a essa altura não há candidato de bug no código para
  corrigir às cegas.

## Referência

Novo relatório de feedback do setor de faturamento (27/08). Investigação com
dado real de produção em 2026-08-27 (ver histórico da sessão).
