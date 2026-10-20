# Spec: vínculo do catálogo de exames com cobrança/teste do apLIS, e leitura pela Admissão

Status: ready-for-agent

## Problem Statement

O Sistema de Admissão envia cada requisição de convênio ao AEL (robô que confere elegibilidade e preenche a Guia SP/SADT). Hoje os procedimentos vão só como texto (`"PCR - Genotipagem HPV 28 - PCR"`), e o robô para em "Pendências" porque não sabe qual TUSS pedir no portal do convênio.

O apLIS liga a cobrança aos testes (é o modal de testes que abre ao escolher PCR na admissão), mas **não liga o teste ao TUSS**: na tabela de preço da ASSEFAZ (`IdTabelaPreco = 1`) nenhuma linha de `fattabelaprocedimento` tem `IdTeste`, e a cobrança 30 (PCR) nem aparece. Algumas cobranças também têm mais de um TUSS (1 biópsia → 40601110/40601196; 2 peça → 40601200/40601226/40601110), e escolher entre eles depende do caso.

O Controle de Custos do flowlab é a fonte correta de TUSS por convênio (`custo_exames.tuss` + `custo_fontes_pagadoras`), mas `custo_exames` veio de uma planilha e não tem nenhum id do apLIS. Não há como dizer "a cobrança X / teste Y do apLIS é este exame do catálogo".

## Solution

- O catálogo de exames (`custo_exames`) ganha o vínculo com o apLIS: id da cobrança (`fatexametipo.IdExameTipo`) e, opcionalmente, id do teste (`patteste.IdTeste`). Editável na aba Exames do Controle de Custos.
- Uma migração pré-preenche as cobranças que têm um TUSS só na tabela de preço da ASSEFAZ, lidas do apLIS. Cobranças com TUSS ambíguo (1 e 2) ficam sem vínculo de propósito.
- Os testes do PCR (e de outras cobranças com testes, como 19 CAPTURA HÍBRIDA) são ligados à mão na tela, com a informação da usuária que preenche as guias.
- Um endpoint só-leitura, server-to-server, entrega à Admissão o que ela precisa para resolver o TUSS: exames com vínculo, linhas de fontes pagadoras e exclusões. A Admissão copia isso para o Supabase dela periodicamente; o flowlab não é chamado no fluxo de aprovação.

## User Stories

1. Como responsável pelo faturamento, quero informar em cada exame do catálogo a cobrança do apLIS a que ele corresponde, para que outros sistemas saibam qual TUSS usar para aquela cobrança.
2. Como responsável pelo faturamento, quero informar também o teste do apLIS (quando a cobrança tem testes, como o PCR), para que cada teste tenha seu próprio TUSS.
3. Como responsável pelo faturamento, quero escolher a cobrança e o teste por nome (autocomplete), e não digitar ids, para não errar o vínculo.
4. Como responsável pelo faturamento, quero ser impedido de ligar o mesmo par cobrança/teste a dois exames, para que nunca haja dúvida sobre qual TUSS vale.
5. Como responsável pelo faturamento, quero ver na tabela de exames quais já estão ligados ao apLIS e quais não, para saber o que falta preencher.
6. Como responsável pelo faturamento, quero filtrar os exames sem vínculo, para completar o mapeamento aos poucos.
7. Como responsável pelo faturamento, quero remover um vínculo errado, para que a Admissão pare de mandar aquele TUSS.
8. Como responsável pelo faturamento, quero que as cobranças da ASSEFAZ com TUSS único já venham ligadas, para não começar do zero.
9. Como responsável pelo faturamento, quero que as cobranças com TUSS que depende do caso (biópsia, peça) fiquem sem vínculo, para que nenhum sistema escolha um TUSS errado por elas.
10. Como usuária que preenche as guias, quero que os testes do PCR (vaginose bacteriana, genotipagem HPV 28…) sejam ligados ao TUSS que eu uso no portal da ASSEFAZ, para que o robô do AEL peça o mesmo.
11. Como Sistema de Admissão, quero ler por um endpoint com chave própria os exames com vínculo, as linhas de fontes pagadoras e as exclusões, para montar o TUSS sem acessar o banco do flowlab.
12. Como Sistema de Admissão, quero que o endpoint devolva tudo num payload só, sem paginação, para que a cópia seja completa e atômica.
13. Como mantenedor do flowlab, quero que a chave da Admissão seja diferente das outras chaves de integração, para poder revogá-la sem afetar a Tabela Particular nem o LAB-HUB.
14. Como mantenedor do flowlab, quero que o endpoint não exponha valores negociados nem custos, para que a Admissão só receba o que precisa.
15. Como mantenedor do flowlab, quero que um pedido sem chave ou com chave errada receba 401, e qualquer método diferente de GET receba 405, como nos outros endpoints de integração.

## Implementation Decisions

- **Schema (`custo_exames`):** duas colunas novas, `aplis_id_exame_tipo INTEGER NULL` e `aplis_id_teste INTEGER NULL`.
  - `aplis_id_teste` só pode estar preenchido se `aplis_id_exame_tipo` estiver (CHECK).
  - Unicidade do par (`aplis_id_exame_tipo`, `aplis_id_teste`) entre os exames ligados, tratando "sem teste" como um valor (índice único parcial, ou `COALESCE(aplis_id_teste, 0)`). Uma cobrança pode ter um exame "sem teste" e vários exames "com teste X".
  - Comentário nas colunas explicando o significado (ids do apLIS, não do flowlab) e que vínculo vazio = "não mandar TUSS".
- **Pré-preenchimento:** migração (ou script versionado, no padrão de `supabase/scripts/`) que liga as cobranças da tabela de preço 1 (ASSEFAZ) com exatamente um `Codigo` ativo em `fattabelaprocedimento` ao exame de `custo_exames` com esse `tuss`. Na consulta de 2026-10-20 eram: 3 → 40601129, 6 → 40601153, 7 → 40601269, 12 → 40601250, 13 → 40601137, 15 → 40601161, 18 → 40601285, 19 → 40601293, 23 → 40601323. Ficam de fora por ter mais de um TUSS: 1 (40601110/40601196), 2 (40601200/40601226/40601110), 8 (40601170 painel/40601188 isolada) e 25 (40601218/40601226 margens).
  - Só liga quando houver **exatamente um** exame com aquele TUSS no catálogo. TUSS compartilhado por vários nomes (ex. 40601200 tem 13 exames) fica para a tela.
  - O script lista no fim o que ligou e o que deixou de fora, para conferência humana.
- **Tela (aba Exames, `ExamFormModal`/`ExamTable`):** campos "Cobrança no apLIS" e "Teste no apLIS" com autocomplete. A lista de cobranças e testes vem do MySQL do lab, pelo mesmo acesso que o flowlab já usa (`bdLab`): cobranças ativas de `fatexametipo` e testes ativos ligados a elas por `fatexameexametipo` → `patteste`, mais a exceção 19 → 22 usada na Admissão. Coluna/indicador "Ligado ao apLIS" e filtro "sem vínculo" na tabela. Violação de unicidade vira mensagem clara ("Esta cobrança/teste já está ligada ao exame X").
- **Endpoint `GET /api/integracoes/tuss-exames`:** mesmo padrão de `orcamento-particular` (Vercel function, `getSupabaseAdminClient`, `Cache-Control: no-store`, erros genéricos).
  - Autorização: `Authorization: Bearer <ADMISSAO_API_KEY>`, chave dedicada.
  - Resposta, sem paginação:

    ```ts
    {
      exames: { id: string; tuss: string; aplis_id_exame_tipo: number; aplis_id_teste: number | null }[]; // só os ligados
      fontes_pagadoras: { id: string; tabela_associada: string; tuss: string; exame_id: string | null; atendido: boolean }[];
      exclusoes: { payor_id: string; exame_id: string }[];
      gerado_em: string; // ISO
    }
    ```

  - Sem `valor`, `custo_*`, `nome` de exame nem `fonte_pagadora` no payload.
  - A montagem do payload é uma função em `api/_lib/` que recebe o client e devolve o objeto, testável com um client falso.
- **Regra de cobertura** (aplicada pela Admissão, registrada aqui porque é a mesma de `examesPorFontePagadora`): para um convênio (`tabela_associada`), o exame é coberto por uma "linha de exame" (`exame_id` = exame), com precedência, ou por uma "linha geral do TUSS" (`exame_id` nulo, mesmo `tuss`) sem exclusão para aquele exame. `atendido = false` = não coberto pelo plano.

## Testing Decisions

- Bom teste aqui: chama a função/handler pela interface pública e confere a resposta; não confere SQL nem a ordem de chamadas internas.
- **Função de montagem do payload:** client falso devolvendo linhas; confere que só exames ligados entram, que campos de valor/custo não aparecem e que as três listas vêm completas.
- **Handler:** 405 para não-GET, 401 sem chave/chave errada, 500 genérico quando a chave não está configurada ou o banco falha, 200 com o payload. Prior art: `api/integracoes/orcamento-particular.test.ts` e `api/_lib/orcamentoParticular.test.ts`.
- **Script de pré-preenchimento:** a escolha "cobrança com um TUSS só → exame único com esse TUSS" é uma função pura (linhas do apLIS + catálogo → vínculos + descartes), testada sem banco: TUSS único, cobrança com dois TUSS, TUSS compartilhado por vários exames, TUSS que não existe no catálogo.
- **Tela:** sem teste automatizado próprio, a não ser que `ExamFormModal` já tenha; nesse caso, um caso para o erro de unicidade.

## Out of Scope

- Vínculos para outras tabelas de preço (22, 28, 29 têm `IdTeste` no apLIS, mas são de convênios fora do AEL). O catálogo tem um TUSS por exame; TUSS diferente por convênio para o mesmo teste fica para quando um segundo convênio entrar no AEL.
- Escrever qualquer coisa no apLIS.
- Mudar o cálculo de preço, orçamento particular ou análises do Controle de Custos.
- A cópia, a resolução do TUSS e o envio ao AEL (spec da Admissão: `projeto-admissao/.scratch/tuss-procedimentos-ael/spec.md`).

## Further Notes

- Dependência da usuária que preenche as guias: qual teste do PCR vira 40601285 e qual vira 40601293 na ASSEFAZ (caso da guia manual 15476262). É a issue `03-mapear-textos-para-tuss-no-ael` da Admissão, que passa a ser respondida preenchendo esta tela.
- Ordem de entrega: este spec primeiro (o endpoint precisa existir para a Admissão sincronizar).
- Configurar `ADMISSAO_API_KEY` na Vercel e passar o mesmo valor para o `.env` da Admissão.
