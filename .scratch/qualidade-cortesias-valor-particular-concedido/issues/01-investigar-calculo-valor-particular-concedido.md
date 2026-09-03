Status: done
Type: investigation

# Investigar: qual cálculo de Valor Particular/Concedido de Cortesias está correto

## Onde

- `api/_lib/qualidade/bdLabQualidade.ts` (`listarAutorizacoesCortesiaLis`,
  ~linha 195-234) — implementação atual deste repo.
- Para comparação: `api/_lib/qualidade/bdLabCortesias.ts` do projeto de
  origem `Flowlab_Controle_Qualidade` (branch `main`, commit `ad2efd4`).

## O que fazer

1. Rodar as duas queries (esta e a de origem) contra o mesmo `CodRequisicao`
   de teste no MySQL de backup do LIS e comparar os valores de Valor
   Particular/Concedido resultantes — usar como referência o
   `CodRequisicao 0040002289003 / 0200012764000` citado no commit de origem
   como "confirmado com exemplo real pelo usuário", se existir neste
   ambiente.
2. Confirmar com quem tem contexto de negócio de Cortesias/Faturamento:
   - Valor Particular deveria vir de `fatrequisicaoprocedimento.ValorUnitario`
     (tabela de preço do procedimento) ou de `ValorBruto` (valor bruto
     lançado na requisição)? São colunas diferentes — checar se
     representam a mesma coisa neste schema ou se divergem em algum
     cenário.
   - Valor Concedido deveria ser sempre igual ao Valor Particular (isenção
     integral, como o projeto de origem passou a assumir) ou pode ser um
     desconto parcial real (`ValorDesconto`, como este repo calcula hoje)?
3. Se a conclusão for que a regra deste repo está errada: abrir issue de fix
   com a correção necessária em `bdLabQualidade.ts` (fora do escopo desta
   issue de investigação).
4. Se a conclusão for que as regras são intencionalmente diferentes (ex.:
   este repo cobre um cenário de negócio que o de origem não cobre): registrar
   a decisão aqui e fechar como `wontfix` do lado do port.

## Critérios de aceite

- Decisão documentada nos Comments abaixo, com exemplo real de
  `CodRequisicao` comparado nos dois cálculos.
- Se resultar em fix, uma nova issue é aberta referenciando esta.

## Comments

### 2026-09-03 — Investigação concluída, rodando as duas queries contra o MySQL de backup real

Conexão disponível neste ambiente (`DB_HOST`/`DB_USER` do `.env`, mesmo backup
usado pelo repo de origem). Rodei consultas diretas em `fatrequisicaoprocedimento`
e `requisicaoautorizacao`, não a query completa de `bdLabCortesias.ts` (que
depende de parâmetros de `tarefa`/convênio específicos do sync de origem, não
portados aqui) — o suficiente para comparar as colunas de valor em si.

**Exemplo citado no commit de origem (`CodRequisicao 0040002289003 /
0200012764000`):**

- `0040002289003` (IdRequisicao 200478, `requisicaoautorizacao.Tipo=3`,
  `Autorizado=1`, `IdConvenio=100`) — linha única em
  `fatrequisicaoprocedimento`: `ValorUnitario=128`, `ValorBruto=128`,
  `ValorCobrado=NULL`, `ValorDesconto=NULL`.
- `0200012764000` (IdRequisicao 51856, `Tipo=3`, mas `Autorizado=NULL` —
  autorização nunca finalizada, de 2022) — linha única:
  `ValorUnitario=NULL`, `ValorBruto=0`, `ValorCobrado=182`,
  `ValorDesconto=NULL`. Não serve de referência para a regra de Particular/
  Concedido (autorização pendente, não uma cortesia efetivamente concedida) —
  no commit de origem esse par valida a correção nº 2 (Valor Cobrado sem
  filtro de convênio), não a nº 1.

**Amostra mais ampla, 25 cortesias `Tipo=3 AND Autorizado=1` reais (datas
variadas):** em todas, `ValorCobrado` e `ValorDesconto` vieram `NULL`;
`ValorUnitario` bateu com `ValorBruto` em quase todas — exceto
`0100025938002` (IdRequisicao 200484), onde `ValorUnitario=195` mas
`ValorBruto=390`, porque `Quantidade=2` na linha de
`fatrequisicaoprocedimento`.

**Confirmação em toda a tabela `fatrequisicaoprocedimento` (295.806 linhas):**

- `ValorDesconto` não-nulo/≠0: **0 linhas**. A coluna nunca é preenchida
  neste banco — bate com o comentário do projeto de origem ("a tabela de
  preço do convênio de cortesia nunca foi mantida no LIS").
- Linhas com `Quantidade > 1`: 34.760. Nessas, `ValorBruto = ValorUnitario ×
  Quantidade` em **100%** dos casos (0 divergências) — `ValorBruto` já
  contempla quantidade, `ValorUnitario` sozinho não.

**Decisão:**

1. **Valor Concedido está errado neste repo.** `ValorDesconto` nunca é
   preenchido para nenhuma linha do banco (cortesia ou não) — o cálculo
   atual (`SUM(fp.ValorDesconto)`) sempre resulta em `NULL`/0 para toda
   cortesia real, o que é enganoso (parece "nenhum desconto concedido"
   quando na verdade a isenção foi integral). A regra do projeto de origem
   está certa: Valor Concedido = Valor Particular (isenção integral, nunca
   parcial) — sustentada empiricamente pelo fato de `ValorCobrado` também
   ser sempre `NULL` nas cortesias autorizadas (nada foi cobrado do
   paciente).
2. **Valor Particular está certo neste repo — não portar a mudança do
   projeto de origem.** Este repo usa `SUM(fp.ValorBruto)`, que já
   multiplica por `Quantidade` corretamente (confirmado em 100% das 34.760
   linhas com quantidade > 1 do banco inteiro). O projeto de origem mudou
   para `SUM(fp.ValorUnitario)`, que **subestima** o valor particular em
   qualquer procedimento de cortesia com `Quantidade > 1` (ex.:
   `0100025938002` sairia 195 lá, contra 390 real aqui). Isso é uma
   regressão do fix de origem, não algo a copiar.

**Ação:** issue de fix aberta como
`.scratch/qualidade-cortesias-valor-particular-concedido/issues/02-fix-valor-concedido-igual-a-valor-particular.md`,
corrigindo só o Valor Concedido (`valorConcedido` = `valorParticular`, em vez
de `SUM(fp.ValorDesconto)`). Valor Particular permanece `SUM(fp.ValorBruto)`,
sem alteração.
