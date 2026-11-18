# Recebidos do apLIS pelo site (retrato), com o banco de backup como reserva

Status: ready-for-agent

## Problema

O "Atualizar do apLIS → Baixas" e a "Conferência com o apLIS" leem o recebido dos
lotes no MySQL de backup. Ele é um dump diário restaurado às 04:00, com os dados
até a noite anterior: no melhor caso, ~1 dia de atraso. Quando o arquivo do dia
chega tarde no S3, a carga usa o de ontem e o atraso vira 2 dias sem alerta.

Caso real (18/11/2026): a baixa do lote 6912 (TRT, NF 9660, R$ 319,68, recebido
em 13/11) foi lançada no apLIS em 17/11. O `lab_20261118.7z` chegou às 12:38, a
carga das 04:00 usou o `lab_20261117` (dados até 16/11) e o título não apareceu
para atualizar.

## Decisão (18/11/2026)

O site do apLIS é a fonte principal do recebido; o banco de backup é a reserva.

- O site não lista baixas por data de recebimento nem por data de lançamento
  (`listarBaixa` com período filtra por outra data, e `listarLote` filtra pela
  criação do lote). O jeito é consultar lote a lote: `faturamento-ajax.listarBaixa`
  com `Filtro[Lote]`, uma linha por requisição (`VlrLiquido`, `DtaRecebido`,
  `VlrRecebido`). Medido: ~65 ms por lote numa sessão só.
- Consultar a cada abertura de tela é caro demais (~1.000 lotes). Vira um
  **retrato** gravado no Supabase:
  - rotina agendada às 07h, 12h e 17h de Brasília (o plano Hobby da Vercel só
    roda cada cron uma vez por dia; são 3 entradas do mesmo caminho);
  - botão "Buscar no apLIS agora" nas duas telas.
- Lotes do retrato: os dos títulos não cancelados com saldo em aberto
  (`notas.valor_saldo > 0`). Título quitado no FlowLab continua vindo do banco.
  Ordem: o lote capturado há mais tempo primeiro; a rotina para no orçamento de
  tempo e o que sobrar vai na próxima.

## Regra de fonte, por lote

- Usa o retrato quando ele existe e foi capturado num dia (Brasília) **depois**
  do `dadoAte` do banco (o dado mais recente do dump). Empate ou retrato mais
  velho: usa o banco.
- Status do lote e data de fechamento (refechamento) vêm sempre do banco: o
  `listarBaixa` não traz.
- Banco fora do ar: lote com retrato usa o retrato (status "—", sem
  refechamento); título com algum lote sem retrato fica fora e a tela avisa
  quantos ficaram. Banco e retrato ausentes → erro, como hoje.

## Fora do escopo

- Status do lote na aba Títulos (`sincronizarTitulosAplis`) continua vindo do
  banco.
- Requisição com procedimentos recebidos em datas diferentes: o site devolve uma
  data por requisição. Aceito.
