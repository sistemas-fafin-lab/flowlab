Status: needs-triage
Type: feature

# Exportação (CSV/Excel) das listas de Títulos/Pendências/Atrasados

## Onde

Não existe hoje em `src/modules/faturamento/` (busca por
"csv"/"excel"/"xlsx"/"exportar" não retorna nada no módulo).

## Contexto

O levantamento de requisitos pede exportação explicitamente para a visão de
atrasados/>90 dias ("lista detalhada... com filtros e exportação"), mas o
mesmo padrão de planilha que a usuária está tentando substituir sugere que
qualquer lista operacional (Títulos, Pendências) se beneficiaria de export —
hoje não há nenhuma forma de tirar dado do flowlab para, por exemplo, anexar
num e-mail de cobrança para o convênio.

## Perguntas para triagem

- Quais telas precisam de export: só a lista de atrasados (issue 41), ou
  também Títulos e Pendências (sem lote / não faturadas)?
- Formato: CSV simples basta, ou precisa ser `.xlsx` (com formatação/moeda)?
- Export respeita os filtros ativos na tela (mais provável) ou é sempre "tudo"?

## O que fazer (após triagem)

Adicionar botão "Exportar" nas telas decididas, gerando CSV (ou XLSX se
confirmado) com as colunas visíveis da tabela, respeitando os filtros
aplicados no momento do clique.

## Referência

Levantamento de requisitos com a usuária do setor (áudio transcrito,
2026-09-03), item "Visão de atrasados/>90 dias... lista detalhada... com
filtros e exportação".
