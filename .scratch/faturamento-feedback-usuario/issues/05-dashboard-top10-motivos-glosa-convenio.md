Status: ready-for-agent
Type: task

# Dashboard: top 10 motivos de glosa com breakdown por operadora

## Onde

Widget `motivos-glosa` em `src/modules/faturamento/components/ContasReceberDashboard.tsx`; agregação `porMotivo` no RPC `fat_dashboard_receber` (`supabase/migrations/20260811130000_glosas_por_motivo.sql` — hoje top 8 por valor, motivo normalizado lower/btrim).

## O que fazer

1. Ampliar a agregação de 8 → 10 motivos.
2. Adicionar breakdown por operadora: `glosas.nota_id → notas.operadora_id → operadoras.nome`; expor por motivo a lista de operadoras com valores (e, por operadora, os motivos).
3. No widget, permitir ver quais operadoras concentram cada motivo (tooltip/expansão ou tabela lateral), seguindo o padrão visual existente (cores dos charts, dark mode).

## Critérios de aceite

- Os 10 principais motivos aparecem por valor.
- Para cada motivo é possível ver as operadoras e valores associados.
- A fonte continua sendo as glosas do flowlab (não `DesMotivoGlosa` do apLIS).

## Fora de escopo

- Ler glosas do apLIS.
