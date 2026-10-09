# 09 — Importação de despesas por Excel

**What to build:** na aba Despesas, "Importar" baixa o modelo
`modelo_importacao_gastos_ti.xlsx` (abas Despesas, Instruções e Listas), recebe o
arquivo preenchido e mostra uma pré-visualização linha a linha (ok, aviso ou erro, com
número da linha e motivo). Nada é gravado antes da confirmação. Categorias
desconhecidas podem ser criadas na hora ("Criar estas categorias", desmarcado por
padrão). A gravação é tudo ou nada para as linhas válidas, e no fim um relatório lista
as linhas que ficaram de fora.

Não existe planilha atual (D13): o modelo é o da §7.1 do plano, inteiro.

Plano: §7.1, RF15, D5, D13. Padrão: `src/components/CostControl/PayorImportModal.tsx`
+ `domain/importacaoFontesPagadoras.ts`.

**Blocked by:** 03 (só precisa das tabelas da Fase 1; pode ser antecipada)

**Status:** done (sem migration nova; tela não conferida no navegador)

- [x] Modelo gerado no navegador com as 24 colunas, a aba Instruções com 3 exemplos completos e a aba Listas com as categorias ativas no momento do download.
- [x] `domain/importacao.ts` (+ teste) cobrindo os casos da §11: formatos de valor, competência em vários formatos e data serial do Excel, cabeçalho com e sem acento, categoria desconhecida com e sem criação, fornecedor por CNPJ e por nome, linha repetida, despesa que já existe (desmarcada por padrão), Única com Fim preenchido, linha com erro não bloqueia as demais.
- [x] `ImportarDespesasModal` com pré-visualização, contadores e seleção das linhas.
- [x] Inserção numa única chamada; categorias novas criadas antes, no fim da ordem (`criarCategoriasEmLote`, posições seguidas numa instrução).
- [x] "Baixar relatório" com as linhas de fora e o motivo.
- [x] `npx tsc --noEmit`, `npm run lint` e `npm test` sem erros novos.

## Comments

**01/Out/2026 — implementado.**

**Regras puras:**
- `domain/importacao.ts` (16 testes):
  - `COLUNAS_MODELO`, que é a fonte única das 24 colunas, e `mapearCabecalhos`, que ignora acento, maiúsculas e `*`.
  - `lerCompetencia` aceita 10/2026, 1-2027, out/2026, "Outubro de 2026", data e serial do Excel. `lerData` faz o mesmo para datas.
  - `analisarPlanilha` gera erros com o nome da coluna da planilha e reaproveita `validarDespesa`, então valem as mesmas regras do formulário.
  - `categoriasDesconhecidas` alimenta a opção "Criar estas categorias".
- `domain/modeloImportacao.ts` (6 testes): abas Instruções e Listas e o relatório. Um teste garante que os 3 exemplos do modelo importam sem erro.
- `planilhaImportacao.ts` (6 testes de ida e volta por arquivo `.xlsx` real, gerado e relido com a biblioteca `xlsx`):
  - modelo com 3 abas e "Despesas" só com o cabeçalho;
  - exemplos colados importam;
  - célula de **data** do Excel vira a competência e a data certas;
  - CSV é lido;
  - cabeçalho faltando e arquivo ilegível dão mensagem clara.

**O teste de ida e volta pegou um caso real:** sem uma aba chamada "Despesas" (por exemplo, aba renomeada), a "primeira aba" passava a ser "Instruções". A leitura agora procura, nesta ordem: a aba "Despesas", a primeira aba com todas as colunas obrigatórias e, por último, a primeira do arquivo, só para a mensagem de erro.

**Tela:**
- Botões "Importar" e "Exportar" no cabeçalho da aba Despesas.
- O modal tem contadores de linhas ok, com aviso e com erro. Linha com erro não pode ser marcada, e a despesa que já existe vem desmarcada.
- Se a gravação das despesas falhar depois de criar categorias novas, a mensagem avisa que as categorias ficaram e podem ser reaproveitadas.
- O sucesso aparece num aviso verde na página.

**Verificação:**
- `npm test`: 74 arquivos, 764 testes passando.
- `tsc`: nenhum erro em `gastos-ti`.
- `eslint` limpo.
- Build do Vite: ok.
