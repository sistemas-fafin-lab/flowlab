Status: done
Type: feature

# Notas fiscais de particulares: permitir data inicial padrão a partir de 2026

## Problema

Relato do quarto relatório do setor (27/08): "é possível configurar uma data
inicial a partir de 2026 para a busca [de notas fiscais de particulares]? Não
poderemos emitir as notas dos anos anteriores, então ocultá-las ajudaria
bastante."

## Onde (hipótese, não confirmada)

Não há um filtro de data dedicado à tela de "particulares" isoladamente — a
pendência de particulares (`PendenciasParticulares.tsx`, issue 19) já usa
janela M-1 sobre `DtaSolicitacao`, sem seletor manual de data. O período
`desde`/`ate` configurável existe em dois lugares diferentes:

1. `ContasReceberPage.tsx:27-37` — período padrão `mesesAtras(3)` até
   `fimDoMes()`, usado pela lista de Títulos (mesma issue 20/27).
2. `FiltrosReceber.tsx` — painel de filtros do Dashboard.

Nenhum dos dois filtra especificamente "particulares" nem tem um piso
mínimo de data configurável — é preciso confirmar com o setor qual tela ele
estava usando quando pediu isso.

## O que fazer

- Confirmar com o setor: em qual tela exatamente esse "buscar notas de
  particulares" acontece hoje (Títulos com filtro de Operadora = Particular?
  Pendências → Particulares sem NF?).
- Se confirmado, decidir entre (a) piso de data fixo em 01/01/2026
  aplicado só ao recorte de Particular, ou (b) campo configurável pelo
  próprio setor (mais flexível, mas mais esforço).

## Critérios de aceite

- Tela e mecanismo confirmados com o setor antes de qualquer implementação.

## Referência

Quarto relatório de feedback do setor de faturamento (27/08).

## Comments

**28/08** — Confirmado direto pelo usuário na sessão: a tela é Contas a
Receber → Pendências → Particulares (`PendenciasParticulares.tsx`), não
Títulos. Faz sentido: "não poderemos emitir as notas dos anos anteriores,
então ocultá-las ajudaria" só se aplica a algo que AINDA vai virar NF — Títulos
lista notas já emitidas, então a reclamação só bate com a lista de pendências
(requisições sem NF ainda).

Implementação: opção (b) do "O que fazer" acima, mas sem `desde` vazio como
padrão — o campo "Solicitação de" (já existente, `DatePicker`) passa a nascer
preenchido com `2026-01-01` em vez de vazio. Continua editável (não é piso
fixo/travado no backend): quem precisar investigar um particular de 2025
ainda consegue, só não é o padrão. `desde` já era um parâmetro opcional em
`listarParticularesPendentes` (`bdLab.ts`), então não precisou de mudança no
backend — só o valor inicial do estado em `PendenciasParticulares.tsx`.
