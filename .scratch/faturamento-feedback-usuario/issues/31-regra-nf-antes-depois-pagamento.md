Status: done
Type: feature

# Títulos: mostrar se a NF do convênio é antes ou depois do pagamento, sem abrir o lote

## Problema

Pergunta do usuário na sessão (28/08): "para saber da nota do convênio tenho
que selecionar um lote? pq os títulos a receber que são os lotes, muitas das
vezes devido ao convênio só dá pra fazer a nf após pagamento, outros
convênios fazemos a nota para que eles possam pagar."

Confirmado com o usuário (AskUserQuestion): é pedido de mudança, não só
dúvida — quer a regra visível na lista de Títulos, sem precisar
expandir/abrir cada lote.

## Onde

A ordem NF↔pagamento varia por operadora e não existe em lugar nenhum do
sistema hoje: `fatinstituicao` no apLIS não tem essa distinção, e o resto do
módulo (`operadoras.prazo_pagamento_dias`/`regra_prazo_tipo`, migration
20260807150000) assume o fluxo padrão — NF/envio do lote primeiro, pagamento
depois, dentro do prazo contratual. É uma classificação de negócio nova, do
mesmo tipo que "clínica parceira" (issue 16): só o financeiro sabe, precisa
virar dado gerenciável no flowlab.

## O que foi feito

- `operadoras.nf_apos_pagamento` (boolean, default `false`) — migration
  `20260828120000_operadoras_nf_apos_pagamento.sql`, mesmo padrão de
  `is_clinica_parceira` (24/08): coluna direto em `operadoras`, sem tabela
  nova, RLS `_update_billing` já cobre. Sem seed — o relatório não veio com
  lista de operadoras nesse regime.
- `RegraNfModal.tsx` (mirror de `ClinicasParceirasModal.tsx`): financeiro
  marca/desmarca por operadora. Botão "Regra de NF" na aba Títulos, ao lado
  de "Clínicas parceiras", gate `podeEditar`/`canManageBilling`.
- `TitulosList.tsx`: badge "NF após pagamento" na própria linha do título,
  na coluna Operadora, quando a flag está marcada — é o que resolve a
  pergunta original, sem precisar expandir o título nem abrir o lote.
- `useContasReceber.ts`: `nf_apos_pagamento` entra no select de operadoras;
  `alternarNfAposPagamento` faz o UPDATE (mesmo esqueleto de
  `marcarClinicaParceira`).

## Pendente

Cadastro inicial: nenhuma operadora nasce marcada — o financeiro precisa
abrir "Regra de NF" e marcar as que exigem pagamento antes da NF (não temos
essa lista; não veio no relato).

## Referência

Pergunta direta do usuário na sessão de 28/08 (mesma sessão da issue 28).
