# 06: Unificação das tabelas associadas duplicadas

**What to build:** As tabelas duplicadas da mesma fonte são unificadas exatamente como o faturamento decidiu no levantamento: as linhas passam para a tabela que fica, o preço escolhido prevalece em cada conflito, e exclusões e valores personalizados por exame acompanham a linha que fica. Depois disso, a fonte Particular não mostra mais Part/Particular/PARTICULAR/PART como tabelas separadas (salvo o que o mapa mantiver separado). Ver spec: `../spec.md`.

**Blocked by:** 01 — Cadastro de tabelas associadas; 04 — Tela, orçamento e exportação por id; 05 — Levantamento das tabelas duplicadas

**Status:** ready-for-agent

- [x] Função pura de planejamento: recebe linhas atuais, mapa de junção e escolhas de preço; devolve os conflitos sem resposta **ou** as operações (apontar linhas para a tabela que fica, remover linhas perdedoras, remapear exclusões e valores personalizados, remover cadastros vazios).
- [x] Testes: sem conflitos → operações; conflito sem escolha → bloqueio; escolha aplicada → linha perdedora removida e ajustes remapeados; nome fora do mapa intocado.
- [ ] Migração gerada a partir de um plano sem conflitos, aplicando o mapa e as escolhas registrados no ticket 05.
- [ ] Conferência pós-migração: nenhum par (tabela, TUSS) ou (tabela, exame) duplicado; Tabela Particular do orçamento com os preços escolhidos.

## Comments

- Do ticket 03: a migração `20261021190000` protege toda tabela da fonte "Particular" cujo nome, sem diferenciar maiúsculas, é "particular" (mesmo critério do backend do orçamento), então hoje "Particular" **e** "PARTICULAR". Para juntar as duas, a migração da unificação precisa desligar `trigger_custo_tabelas_associadas_regras` durante a junção (`ALTER TABLE … DISABLE TRIGGER …` / `ENABLE` no fim). Também precisa desligar a regra "inativa não recebe linhas novas" se for apontar linhas para uma tabela inativa.

- 2026-10-22 — Função pura e gerador prontos; a migração em si espera o ticket 05.
  - `planejarUnificacao` (`src/components/CostControl/domain/unificacaoTabelas.ts`) + testes. Conflito = mesma chave ((tabela, exame) para linha de exame, (tabela, TUSS sem espaços nas pontas) para linha geral) com `valor`, `atendido` ou `elegivel_desconto_particular` diferente. Sem conflito, fica a linha do destino; uma escolha registrada manda mesmo sem diferença.
  - Gerador: `supabase/scripts/unificar-tabelas-associadas.ts <mapa.json> <saida.sql> [--backup <pasta>]`. Com conflito sem escolha, lista os conflitos e não gera nada. A migração gerada:
    1. confere que linhas, exclusões e valores personalizados das tabelas do mapa são os que o plano leu;
    2. desliga `trigger_custo_tabelas_associadas_regras` e a sincronia das linhas durante a junção;
    3. faz a junção;
    4. confere a unicidade nos destinos, o texto igual ao cadastro, a remoção das origens e o preço de cada escolha.
  - O mapa e as escolhas do ticket 05 precisam virar o JSON descrito no cabeçalho do script. Exemplo: `{"mapa":[{"fontePagadora":"Particular","destino":"Particular","origens":["PARTICULAR"]}],"escolhas":[]}`.
  - Pelo backup de 2026-10-21, juntar todo o grupo Particular (`PARTICULAR`, `part`, `PART`, `''`) em "Particular" não tem conflito de preço. Só o exame do TUSS 40601200 existe em "Particular" e em "PART", R$ 1000 nos dois. Juntar `PART`/`part` ainda depende da confirmação pedida no ticket 05.
  - **Decisão em aberto:** quando uma linha sai, as exclusões e os valores personalizados dela passam para a linha que fica, como a spec manda. Se a linha que fica já tem ajuste para o mesmo exame, o dela prevalece. Isso pode mudar o preço escolhido para aquele exame. Confirmar com o faturamento.
