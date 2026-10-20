# 01: Ligar exame do catálogo a cobrança/teste do apLIS na tela

**What to build:** na aba Exames do Controle de Custos, a responsável pelo faturamento escolhe, para cada exame do catálogo, a cobrança do apLIS (`fatexametipo`) e, quando houver, o teste (`patteste`) a que ele corresponde. A tabela mostra quais exames já estão ligados e permite filtrar os que não estão. O mesmo par cobrança/teste não pode ficar em dois exames. Ver `../spec.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `custo_exames` tem `aplis_id_exame_tipo` e `aplis_id_teste` (nulos), com CHECK "teste só com cobrança" e unicidade do par (sem teste conta como valor)
- [ ] Comentários nas colunas dizem que são ids do apLIS e que vínculo vazio = não mandar TUSS
- [ ] Formulário do exame tem "Cobrança no apLIS" e "Teste no apLIS" com autocomplete por nome; testes filtrados pela cobrança escolhida (`fatexameexametipo` → `patteste`, ativos, com a exceção 19 → 22)
- [ ] Cobranças e testes vêm do MySQL do lab pelo acesso já existente (`bdLab`)
- [ ] Tabela de exames mostra indicador "Ligado ao apLIS" e tem filtro "sem vínculo"
- [ ] Ligar um par já usado mostra "Esta cobrança/teste já está ligada ao exame X" em vez de erro genérico
- [ ] Remover o vínculo (limpar os campos) funciona
