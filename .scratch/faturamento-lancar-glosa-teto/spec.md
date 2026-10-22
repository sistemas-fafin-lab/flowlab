# Contas a Receber: "Lançar glosa" com teto, auditoria e glosas visíveis no título

Status: ready-for-human (migration gerada, aguardando aplicar em produção)

## Problema (relato de 22/10/2026)

Lote 5774 (FuSEx), título de R$ 750,16. O "Aplicar baixas e glosas do apLIS"
lançou R$ 88,12 (duas requisições com motivo no apLIS). A usuária lançou depois
o total da glosa (R$ 750,16) pelo "Lançar glosa"; o aviso "excede o saldo em
R$ 88,12" foi confirmado e a glosa foi **somada**: glosado R$ 838,28, acima do
total do título. A inclusão não apareceu em "Alterações" e ela não encontrou
onde corrigir (a correção mora no lápis "Editar título").

Causas:

1. "Lançar glosa" fazia INSERT direto em `glosas`: sem o teto glosado ≤ total
   que as RPCs aplicam e sem auditoria.
2. O modal não dizia que a glosa nova soma às já lançadas.
3. A linha expandida não listava as glosas nem apontava para a correção.

## Correção

- Migration `20261022100000_fat_lancar_glosas.sql`: RPC `fat_lancar_glosas(p)`
  (permissão, trava do título, teto, validação de guia/lote, auditoria
  'inclusao'). `useContasReceber.lancarGlosas` passa a chamá-la.
- `BaixaModal`: aviso quando o título já tem glosa ("é somada"), atalho
  "Lançar só a diferença" e recusa no cliente de glosado acima do total.
- `TitulosList`: seção "Glosas lançadas" (valor, motivo, origem, status) com
  "Corrigir glosas", que abre o "Editar título".

## Dado do lote 5774

Não corrigido por aqui: a usuária corrige em "Editar título" → "Glosas sem
baixa" → Corrigir (glosa de R$ 750,16 → R$ 662,04, ou excluí-la e reaplicar
as glosas do apLIS).
