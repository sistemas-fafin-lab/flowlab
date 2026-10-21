# 01: Atendido calculado por % máx CSP na importação

**What to build:** Na importação de tabela de fonte pagadora, o usuário sobe uma planilha só com TUSS, Nome do Exame e Valor, informa um % máx CSP obrigatório, e o Atendido de cada TUSS é calculado (CSP = custo / valor; até o limite, inclusive, é Sim). A prévia mostra Custo, CSP % e Atendido calculado, recalculando na hora quando o limite muda, e a gravação usa o Atendido calculado. Ver spec: `../spec.md`.

**Blocked by:** None (can start immediately)

**Status:** done (21/Out/2026; conferido no navegador — prévia, limite e avisos; gravação não testada)

- [x] Modelo baixável com as colunas TUSS, Nome do Exame e Valor; colunas obrigatórias passam a ser essas três.
- [x] Planilha antiga com a coluna Atendido é aceita, e a coluna é ignorada.
- [x] Campo % máx CSP obrigatório, numérico, sem padrão e não salvo; Importar desabilitado enquanto vazio/inválido.
- [x] Função pura no domínio da importação calcula, por TUSS, custo usado, CSP e Atendido a partir de: linhas validadas, exames, linhas de preço da fonte + tabela, exclusões e limite.
- [x] Custo usado = maior custo total entre os exames que a linha geral do TUSS cobre naquela fonte + tabela (sem os excluídos daquela linha e sem os que têm linha própria na mesma fonte + tabela); TUSS novo para a fonte: só exclui os de linha própria.
- [x] CSP usa o valor da planilha (valor personalizado por exame não entra); comparação sem arredondar; limite inclusivo.
- [x] Valor ≤ 0 → Não; custo usado 0 → Não.
- [x] Prévia mostra Custo, CSP % e Atendido calculado por linha válida, recalculando ao mudar o limite.
- [x] Gravação: upsert como hoje (só linhas gerais do TUSS; linhas de exame não são tocadas), com o Atendido calculado sobrescrevendo o existente.
- [x] Testes da função cobrindo: limite inclusivo, TUSS com um exame, TUSS compartilhado pelo maior custo, exame excluído fora, exame com linha própria fora, valor 0, custo 0, TUSS novo.
- [x] Testes existentes de validação atualizados para três colunas.
