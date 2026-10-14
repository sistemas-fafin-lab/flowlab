# Faturamento: conferir as baixas dos títulos com o apLIS

Status: needs-triage

## Problem Statement

A baixa de um título no Contas a Receber é sempre lançada à mão no "Editar
título". O setor também registra o recebimento no apLIS (tela de Baixa), por
requisição. Nada liga as duas coisas, então elas se separam sem ninguém ver.

Levantamento de 14/10/2026 (1.723 títulos de produção × status dos 1.724 lotes
no backup MySQL):

- **112 títulos "aberta"** com o lote Recebido (73) ou Recebido parcial (39) no
  apLIS: ~R$ 920 mil recebidos lá e R$ 0,00 aqui. 80 deles foram recebidos no
  apLIS em setembro/2026; 6 em 2025.
- **119 títulos "parcialmente recebida"** com o recebido diferente do apLIS em
  R$ 1 ou mais (líquido de R$ 22.445,10 a mais no apLIS; em 47 o sistema tem
  mais que o apLIS).
- **101 títulos "recebida"** com o lote ainda "Faturado" no apLIS.

Conferido na tela de Baixa do apLIS (lote 6329, título 9127): 3 requisições
`RECEBIDO` em 22/09/2026, R$ 2.034,81, saldo 0 — e o título segue aberto aqui.
A lista completa ficou em `titulos-divergentes-aplis.csv` (Downloads do usuário).

Consequência: aging, atrasados e o relatório de recebidos do mês mostram como
"a receber" dinheiro que já entrou, e ninguém sabe quais títulos olhar.

## Solution

Uma **conferência** que compara, para cada título, o recebido no sistema com o
recebido no apLIS dos lotes dele, e **aponta** as diferenças. Ela não lança
nada: a baixa continua sendo do operador, no "Editar título", que já trata
glosa e rateio por guia.

1. Botão **"Conferir baixas com o apLIS"** no cabeçalho da página Contas a
   Receber abre um modal com os títulos divergentes, separados por tipo, com
   os valores dos dois lados e a data do recebimento no apLIS. Cada linha abre
   o título.
2. Na lista de Títulos, um **selo** "apLIS: recebido R$ X em DD/MM" nos títulos
   divergentes e um filtro **"Divergente do apLIS"**.

## User Stories

1. As a operador de faturamento, I want to see which títulos are still open here but already received in the apLIS, so that I can register the missing baixas.
2. As a operador de faturamento, I want each divergence to show the value received in the apLIS and the date, so that I can find the bank deposit and register the baixa with the right data.
3. As a operador de faturamento, I want to open the título straight from the divergence list, so that I don't have to search for it.
4. As a operador de faturamento, I want the divergences grouped by type (recebido só no apLIS, recebido a mais no apLIS, recebido a mais no sistema), so that I work the biggest problem first.
5. As a coordenador financeiro, I want totals per type, so that I know how much money is misreported.
6. As a operador de faturamento, I want títulos received only in the system (apLIS lote still "Faturado") to show up too, so that the apLIS gets updated or the wrong baixa gets reverted.
7. As a operador de faturamento, I want differences under R$ 1,00 to be ignored, so that rounding doesn't flood the list.
8. As a operador de faturamento, I want a badge on the título row in the Títulos list, so that I notice the divergence while working normally.
9. As a operador de faturamento, I want a "Divergente do apLIS" filter in the Títulos list, so that I can combine it with operadora and period filters.
10. As a operador de faturamento, I want the badge to disappear after I register the baixa, so that I know the título is settled.
11. As a coordenador financeiro, I want the conference to never write baixas by itself, so that a mistake typed in the apLIS doesn't become a financial record here.
12. As a operador de faturamento, I want a notice "dados do apLIS até ontem", so that I understand why a baixa done in the apLIS today doesn't show up.
13. As a usuário com canViewBilling, I want to see the conference, so that anyone who reads the Contas a Receber also sees the alert.
14. As a operador de faturamento, I want a clear message when the apLIS replica is unreachable, so that I don't read "no divergences" as "all good".
15. As a operador de faturamento, I want to export the divergence list as CSV, so that I can split the work with the team.

## Implementation Decisions

**Fonte do recebido no apLIS**

- MySQL de backup (`bdLab` de faturamento), não o site. O recebido é
  `SUM(fatrequisicaoprocedimento.ValorRecebido)` das requisições do lote
  (`requisicao.Lote`), e a data é `MIN/MAX(fatrequisicaoprocedimento.DtaRecebido)`,
  via `DATE_FORMAT`. É o mesmo dado da tela de Baixa do apLIS (`listarBaixa`,
  conferido no lote 6329). O `fatrps.DataRecebido` não serve: veio vazio na
  maioria dos lotes.
- Também vai o `fatlote.Status` (4 Recebido, 7 Recebido parcial, 3 Faturado…),
  só para exibir.
- O atraso de ~1 dia do backup é aceitável para conferência. O site
  (`listarBaixa`) fica fora: não é API oficial, exige login por execução e não
  traz nada que o banco não tenha.

**Comparação**

- Por título, não cancelado: `recebidoAplis` = soma dos lotes vinculados em
  `nota_lote`; `recebidoSistema` = `notas.valor_recebido`.
- Tolerância de R$ 1,00. Tipos:
  - `so-no-aplis`: `recebidoSistema` = 0 e `recebidoAplis` > 0;
  - `aplis-maior`: os dois > 0 e `recebidoAplis` − `recebidoSistema` ≥ 1;
  - `sistema-maior`: `recebidoSistema` − `recebidoAplis` ≥ 1 (inclui o lote
    "Faturado" no apLIS com título recebido aqui).
- Glosa fica fora da regra: o sistema guarda `valor_glosado` e o apLIS não tem
  o mesmo conceito por lote. O modal mostra `valor_glosado` para o operador
  avaliar; um `sistema-maior` com glosa pode ser legítimo.
- Lote vinculado que não existe no MySQL (hoje: 4905, 6596, 6652) aparece como
  `lote-ausente`, sem valor.

**Backend**

- Nova action `titulos-conferencia-aplis` (GET) no dispatcher de faturamento,
  `canViewBilling`. Lê os títulos e lotes no Supabase (cliente do usuário, para
  respeitar o RLS), consulta o MySQL em blocos de até 1.000 `IdLote` e devolve
  só os divergentes: `{idNota, numeroNota, operadora, status, valorTotal,
  recebidoSistema, glosadoSistema, recebidoAplis, primeiroRecebimentoAplis,
  ultimoRecebimentoAplis, lotes:[{aplisId, statusAplis, recebidoAplis}], tipo}`
  e `meta.dadoAte`.
- Sem cache (o operador quer o estado depois de lançar a baixa). Medido em
  14/10: ~1.700 lotes em 2 consultas.
- Falha na réplica → 502 com mensagem; nunca lista vazia.

**Frontend**

- Botão no cabeçalho da página, ao lado de "Atualizar do apLIS", visível com
  `canViewBilling`, com o aviso "dados do apLIS até ontem".
- Modal no padrão do `AtualizarAplisModal`: abas ou seções por tipo, totais,
  colunas título, operadora, emissão, lotes, recebido no sistema, glosado,
  recebido no apLIS, diferença, data do recebimento no apLIS; ação "Abrir
  título" (abre o `EditarTituloModal`); exportar CSV.
- Lista de Títulos: o hook busca a conferência uma vez por carga da aba (não
  bloqueia a lista) e cruza por `idNota`; selo na linha; filtro
  "Divergente do apLIS" junto dos demais filtros. Depois de salvar uma baixa,
  a conferência é refeita.

## Testing Decisions

- Teste vitest do handler no padrão de `faturamento-titulos-aplis-previa.test.ts`
  (`bdLab` e Supabase mockados): 401/403, os quatro tipos, tolerância de R$ 1,
  título cancelado fora, título com 2 lotes somando, 502 na falha da réplica.
- Teste do utilitário de classificação isolado (puro).
- Conferência ao vivo (skill `banco-lab-mysql`): os números têm que bater com o
  levantamento de 14/10 (112 abertas, 119 parciais com diferença), descontadas
  as baixas lançadas desde então.

## Out of Scope

- Dar baixa automática a partir do apLIS.
- Escrever qualquer coisa no apLIS.
- Conciliar glosa entre os dois lados.
- Ler o site do apLIS (`listarBaixa`) para ter o recebimento do mesmo dia.
- Notificação ou e-mail de divergência.

## Further Notes

- `listarBaixa` está documentado na skill `aplis-site-interno` e em
  `import_files/apLIS - Site Interno/`, caso um dia valha ter o dado do dia.
