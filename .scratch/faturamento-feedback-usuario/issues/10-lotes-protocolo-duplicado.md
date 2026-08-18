Status: ready-for-agent
Type: task

# Faturas: sinalizar lotes com protocolo de envio duplicado (exceto protocolos em formato de data)

## Onde

`src/modules/faturamento/components/FaturasDashboard.tsx` (tabela de lotes, rodapé com protocolo `:533-536`), `hooks/useFaturamentoLotes.ts`, `api/_lib/handlers/faturamento-lotes.ts`, `api/_lib/faturamento/bdLab.ts`.

## Regra (decidida no grilling, rodada 2 em 2026-08-18)

- Agrupar lotes por `Protocolo` não vazio; marcar todos os lotes de grupos com mais de um lote.
- Exceção: **protocolo em formato de data válida** — string de 8 dígitos `DDMMYYYY` (dia 01–31, mês 01–12, ano plausível). Lotes com esse padrão nunca são marcados, independente da operadora.
- Motivo: AMHP-DF e Medigest usam protocolo-data compartilhado legitimamente (ex.: `07082026` nos lotes 6490/6491 da AMHP-DF; `03082026` na Medigest). Uma exceção por operadora (`IdFontePagadora`) exigiria hardcode e ficaria incompleta conforme novas operadoras adotassem o mesmo padrão — a exceção por formato resolve as duas de uma vez e cobre operadoras futuras sem código novo.
- Achados dos dados (verificado no banco real em 2026-08-18, últimos 12 meses): 57 grupos de protocolo duplicado; 53 são 8 dígitos em formato de data, espalhados por pelo menos 5 operadoras diferentes (AMHP-DF, Medigest, INAS GDF, ABAC, MATER CLINICA — não só AMHP-DF/Medigest como se pensava), incluindo grupos cross-operadora coincidindo na mesma data (ex.: protocolo `26062026` = AMHP-DF + Medigest; `11052026` = ABAC + AMHP-DF; `23062026` = AMHP-DF + INAS GDF). Isso confirma que uma lista fixa de operadoras isentas ficaria incompleta — a exceção por formato é necessária, não só preferível.
- Os outros 4 grupos (não 8 dígitos) são duplicidade real dentro de uma única operadora (ASSEFAZ, INAS GDF, FUSEX, AMIL) e devem continuar sendo marcados.
- **Importante**: validar como data de fato (dia 01–31, mês 01–12), não só "8 dígitos" — há protocolos de 8 dígitos que não são datas e que devem continuar marcados: `79957289` (CASSI, duplicidade real) e ao menos 6 protocolos de 8 dígitos não-data da própria AMHP-DF (ex.: `43421411`, `44579468`) que hoje ficam ocultos pela exceção antiga "AMHP-DF nunca marca" — com a exceção por formato, esses passam a ser marcados corretamente (comportamento novo, é o esperado).
- Duplicidade cruzada histórica confirmada: protocolo `760054` (6 dígitos, fora da janela de 12 meses) compartilhado por ASSEFAZ e Medigest em dez/2024 — não é formato de data, continua sendo pego pela regra.

## O que fazer

1. Função de detecção "protocolo é data": valida 8 dígitos e componentes de data plausíveis (dia/mês/ano), não apenas o formato numérico.
2. Nova agregação no `bdLab.ts` (ex.: contagem de protocolos duplicados no período) ou subquery na `SQL_LISTA` indicando se o protocolo aparece em mais de um lote, já excluindo os que batem com o formato de data.
3. Badge visual no lote duplicado (coluna protocolo ou ao lado), com tooltip "protocolo duplicado em N lotes".
4. Filtro "protocolos duplicados" na barra de filtros do FaturasDashboard.
5. Sem bloqueio de operação.

## Critérios de aceite

- Lotes com protocolo em formato de data válida (ex.: AMHP-DF `07082026`, Medigest `03082026`) nunca recebem o badge, mesmo repetido entre vários lotes.
- Lotes com protocolo duplicado que não seja formato de data (ex.: `760054` compartilhado por ASSEFAZ/Medigest, `79957289` da CASSI, e demais operadoras como FUSEX) recebem badge e aparecem no filtro.
- Inclusive lotes da própria AMHP-DF: se o protocolo duplicado dela não for formato de data (ex.: `43421411`), o badge aparece — a exceção é pelo formato, não pela operadora.

## Fora de escopo

- Lista de operadoras isentas por `IdFontePagadora` (substituída pela detecção de formato).
