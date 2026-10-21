# Spec: importação de fonte pagadora com Atendido calculado por % máx CSP

Status: ready-for-agent

## Problem Statement

Na importação de tabela de fonte pagadora do Controle de Custos, quem prepara a planilha precisa decidir à mão, linha a linha, se cada exame é "Atendido" (Sim/Não). Essa decisão é, na prática, uma conta: o laboratório só atende pelo convênio quando o custo do exame cabe no valor que o convênio paga. A conta já existe na tela (CSP = custo / valor cobrado, com o custo vindo da aba Exames), mas a planilha não a usa — o usuário calcula fora, digita Sim/Não, e qualquer erro de digitação vira um convênio aceito (ou recusado) no gerador de orçamento, que lê o Atendido para listar os convênios de cada exame.

## Solution

- A planilha passa a ter só três colunas: TUSS, Nome do Exame e Valor.
- O modal de importação ganha um campo obrigatório **% máx CSP**. Para cada TUSS da planilha, o sistema calcula o CSP com o custo já cadastrado na aba Exames e o valor da planilha; até o limite (inclusive) é "Sim", acima é "Não".
- A prévia mostra o custo usado, o CSP, qual exame definiu o CSP e o Atendido calculado, e muda na hora conforme o limite é alterado — dá para calibrar antes de gravar.
- O resultado é gravado em `atendido` como hoje: depois da importação o check continua editável à mão, e mudar o custo na aba Exames não recalcula nada.

## User Stories

1. Como responsável pelo faturamento, quero subir uma planilha só com TUSS, Nome do Exame e Valor, para não ter que decidir Sim/Não à mão em cada linha.
2. Como responsável pelo faturamento, quero informar um % máx CSP na tela de importação, para que o sistema decida o Atendido pela regra do laboratório.
3. Como responsável pelo faturamento, quero que um exame com CSP exatamente igual ao limite conte como atendido, para que o limite signifique "até X%".
4. Como responsável pelo faturamento, quero ser impedido de importar sem preencher o % máx CSP, para não gravar Atendidos com um limite implícito que eu não escolhi.
5. Como responsável pelo faturamento, quero ver na prévia o custo, o CSP e o Atendido calculado de cada TUSS antes de importar, para conferir o resultado.
6. Como responsável pelo faturamento, quero que a prévia recalcule na hora quando eu mudo o % máx CSP, para testar limites diferentes sem reenviar a planilha.
7. Como responsável pelo faturamento, quero ver na prévia quantas linhas ficaram Sim e quantas ficaram Não, para ter noção do impacto do limite escolhido.
8. Como responsável pelo faturamento, quero que, num TUSS com vários exames de custos diferentes, a conta use o exame mais caro, para que "Sim" signifique que todos os exames daquele TUSS cabem no limite.
9. Como responsável pelo faturamento, quero ver na prévia qual exame definiu o CSP de um TUSS compartilhado, para entender por que ele ficou Não.
10. Como responsável pelo faturamento, quero que exames excluídos daquela fonte pagadora não entrem na conta do maior custo, para que um exame que a fonte não oferece não derrube o Atendido dos demais.
11. Como responsável pelo faturamento, quero que exames com linha própria naquela fonte + tabela não entrem na conta, porque o preço importado não vale para eles.
12. Como responsável pelo faturamento, quero que um valor cobrado zero ou vazio resulte em Não, para que um preço ausente nunca vire convênio aceito.
13. Como responsável pelo faturamento, quero que um exame sem custo cadastrado resulte em Não com aviso "custo não cadastrado", para que a falta de custo não vire CSP 0% e Sim por engano.
14. Como responsável pelo faturamento, quero ser avisado na prévia de cada TUSS que tem linha de um exame só na mesma fonte + tabela, para saber que essa linha não será alterada pela importação.
15. Como responsável pelo faturamento, quero que uma planilha antiga com a coluna Atendido continue sendo aceita, com a coluna ignorada, para não refazer planilhas já prontas.
16. Como responsável pelo faturamento, quero baixar o modelo de planilha já no formato de três colunas, para preparar a próxima tabela certo.
17. Como responsável pelo faturamento, quero que a reimportação de uma tabela sobrescreva o Atendido que estava marcado à mão, porque a importação é a fonte da verdade daquela tabela.
18. Como responsável pelo faturamento, quero continuar podendo mudar o Atendido à mão depois da importação, para tratar exceções que a regra não cobre.
19. Como responsável pelo faturamento, quero que mudar o custo de um exame na aba Exames não altere Atendidos já gravados, para que a tabela de um convênio só mude quando eu reimportar ou editar.
20. Como usuário do gerador de orçamento, quero que os convênios aceitos de cada exame reflitam o Atendido calculado, para que o orçamento informe só convênios que o laboratório realmente atende.
21. Como responsável pelo faturamento, quero que TUSS não cadastrados em Exames continuem marcados como inválidos e fora da importação, como hoje.
22. Como responsável pelo faturamento, quero que um TUSS repetido na planilha continue valendo pela última ocorrência, como hoje.

## Implementation Decisions

- **Planilha**: colunas obrigatórias passam a ser TUSS, Nome do Exame e Valor. A coluna Atendido, se presente, é ignorada sem erro. O modelo baixável é atualizado.
- **Campo % máx CSP**: obrigatório, numérico, sem valor padrão, em porcentagem. Vale só para aquela importação — não é salvo. O botão Importar fica desabilitado enquanto o campo estiver vazio ou inválido.
- **Regra**: `atendido = csp <= limite`, com `csp = custoUsado / valor * 100`, comparado sem arredondar.
- **Custo usado**: maior custo total (direto + indireto) entre os exames que a linha geral do TUSS **cobre** naquela fonte + tabela — mesma regra de cobertura da tela (exames do TUSS, menos os excluídos daquela linha e os que têm linha própria na mesma fonte + tabela). Quando a linha geral ainda não existe (TUSS novo para a fonte), não há exclusões a considerar; exames com linha própria continuam fora.
- **Valor personalizado por exame** (ajuste de valor só daquele exame) não entra no CSP: a conta usa o valor da planilha, que é o que a importação grava.
- **Casos sem cálculo**: valor ≤ 0 → Não. Custo usado igual a 0 (ou nenhum exame coberto com custo) → Não, com aviso "custo não cadastrado".
- **Módulo de domínio** (o mesmo da validação/upsert da importação, testável sem React nem Supabase) ganha uma função pura que, dados as linhas validadas da planilha, os exames, as linhas de preço existentes da fonte + tabela, as exclusões e o limite, devolve por TUSS: custo usado, CSP, exame que definiu o CSP, Atendido calculado e avisos (custo não cadastrado; nomes dos exames com linha própria que não serão alterados). A prévia e a gravação consomem o mesmo resultado.
- A linha validada deixa de carregar `atendido` vindo da planilha; o Atendido que vai para o upsert é o calculado.
- **Gravação**: inalterada — só linhas gerais do TUSS da fonte + tabela escolhidas; insere TUSS novo, atualiza valor e atendido do existente. Linhas de um exame só não são tocadas.
- **Efeito colateral aceito**: o gerador de orçamento passa a refletir o Atendido calculado, sem mudança de código no backend.

## Testing Decisions

- Bom teste aqui verifica comportamento externo da função de domínio (entradas → resultado por TUSS), não a forma interna do cálculo.
- **Testado**: a nova função de cálculo do Atendido no módulo de domínio da importação. Casos: limite inclusivo; TUSS com um exame; TUSS compartilhado usando o maior custo e apontando o exame; exame excluído fora da conta; exame com linha própria fora da conta e listado no aviso; valor 0 → Não; custo 0 → Não com aviso; TUSS novo sem linha geral existente.
- Atualizar os testes existentes de validação para o formato de três colunas (coluna Atendido ignorada).
- Prior art: os testes do módulo de domínio da importação de fontes pagadoras e os de busca/cobertura de exames por fonte pagadora.
- Sem teste de componente React nem de Supabase — mesmo padrão do Controle de Custos.

## Out of Scope

- Salvar o % máx CSP (por fonte, por tabela ou global).
- Recalcular o Atendido automaticamente quando o custo de um exame muda.
- Atendido por exame dentro de um TUSS compartilhado (continua um por linha).
- Importação de linhas de um exame só.
- Cadastro de tabela associada e vencimento de contrato (spec `controle-custos-tabela-associada`).

## Further Notes

- Pedido do Marcos Jr. (faturamento). Decisões fechadas em sessão de grilling (Q1–Q8, Q14–Q16).
- Esta entrega vem antes da `controle-custos-tabela-associada`; quando aquela chegar, o campo de tabela associada do modal de importação passa a ser escolha de lista, sem mudar a regra de CSP.
