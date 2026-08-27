Status: needs-info
Type: task

# Dashboard: top 10 motivos de glosa com breakdown por operadora

## Adiada (2026-08-18)

Verificado em produção (Supabase `jqxeqmeikqclmmongclj`, via SQL Editor): tabela `glosas` tem **0 linhas**. `notas` tem 5 linhas, todas de uma carga de seed única (mesmo timestamp `2026-03-27 14:45:38`), não uso orgânico do setor. O widget, implementado sobre essa fonte, ficaria vazio hoje.

Cogitou-se migrar a fonte para o apLIS (`fatrequisicaoprocedimento.IdMotivoGlosa` + `fatmotivoglosa.Descricao`, que tem 26.258 procedimentos com glosa reais, ex.: "VALOR APRESENTADO A MAIOR" 8.824× / R$225k, "GLOSA MANTIDA" 3.494× / R$22k) — descartado por decisão explícita: manter a fonte nativa do flowlab e esperar o módulo Títulos ganhar uso orgânico, em vez de reformular a fonte de dado agora.

**Retomar quando**: `glosas` (Supabase) tiver volume real de glosas registradas pelo setor via o fluxo de baixa do flowlab. Nesse momento, seguir o plano abaixo como estava.

**Revalidado em 27/08** (9 dias depois): consultei direto o Supabase de
produção (projeto jqx) — `glosas` continua com **0 linhas** e `recebimentos`
(de onde as glosas nasceriam) também com **0 linhas**; `notas` segue travada
nas mesmas 5 linhas de seed de 2026-03-27. Nada mudou desde a checagem
anterior — segue adiada.

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
