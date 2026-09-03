Status: ready-for-agent
Type: task

# Títulos: exibir histórico de baixas (recebimentos) por título

## Onde

Tabela `recebimentos` (`supabase/migrations/20260807120000_contas_receber.sql`),
RPC `fat_registrar_baixa`
(`supabase/migrations/20260831150000_fat_registrar_baixa_bloqueia_sem_nota.sql`),
`src/modules/faturamento/components/TitulosList.tsx` (expansão do título),
`src/modules/faturamento/components/BaixaModal.tsx`.

## Contexto

A baixa já registra tudo que a usuária pediu — data (`data_receb`), valor
recebido (`valor_recebido`, permite parcial), quem registrou
(`registrado_por_id`) e quando (`created_at`) — mas nenhuma tela lista essas
linhas. A expansão do título hoje mostra só lotes/guias, e a coluna
"Recebido" da lista mostra apenas o valor agregado (`valorRecebido`), sem
discriminar por lançamento. Quando há mais de uma baixa parcial no mesmo
título, não dá pra ver quais datas/valores compuseram o total, nem quem
lançou cada uma — só o dado bruto na tabela, sem UI.

## O que fazer

Ao expandir um título (mesmo local onde já aparecem lotes/guias), listar as
linhas de `recebimentos` daquele título: data, valor, e quem registrou (nome
do usuário via `registrado_por_id`). Não precisa de tela nova — é acrescentar
uma seção/lista dentro da expansão já existente em `TitulosList.tsx`.

## Critérios de aceite

- Um título com 2+ baixas parciais mostra cada lançamento separadamente
  (data + valor + responsável), não só o total agregado.
- Título sem nenhuma baixa não mostra a seção (ou mostra "nenhuma baixa
  registrada").

## Referência

Levantamento de requisitos com a usuária do setor (áudio transcrito,
2026-09-03), itens "Baixa como fonte de verdade" e coluna "Situação da
baixa (data e valor)".
