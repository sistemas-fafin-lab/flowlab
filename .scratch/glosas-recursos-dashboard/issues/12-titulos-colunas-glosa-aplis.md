# 12: Títulos: colunas Glosado, Glosa recebida e Glosa acatada vindas do apLIS

Spec: `.scratch/glosas-recursos-dashboard/spec.md`

**What to build:** em Contas a Receber → Títulos, a coluna "Glosado" passa a vir da foto (glosa fixada das requisições em status 6 dos lotes do título). Ao lado entram "Glosa recebida" (valor deferido dos recursos das requisições do título) e "Glosa acatada" (saldo negativo das requisições em status 18 e 8). Os cards de total do recorte somam as três. Nesta etapa, o saldo do título não muda.

**Blocked by:** 02

**Status:** done

- [x] As três colunas são calculadas por lote de faturamento do título a partir da foto.
- [x] Os totais do recorte (todas as páginas, não só a atual) incluem Glosado, Glosa recebida e Glosa acatada.
- [x] O saldo do título continua com a regra atual. A mudança do saldo é feita no ticket 13.
- [x] Testes do módulo de regras cobrem as somas por lote.

## Notas da implementação

- **Regra:** `recursoGlosa.somarGlosasPorLote(requisicoes)` (testada) soma as três colunas por lote de faturamento original. `somarGlosasDoTitulo(idsLote, porLote)` (testada) junta os lotes de um título; lote fora da foto conta 0. `GLOSAS_ZERADAS` é o zero comum.
- **Leitura:** `POST /api/faturamento/titulos-glosas-aplis` com `{ lotes: number[] }` (`lotes.aplis_id`) devolve `porLote`, lido da foto em fatias de 200 ids. É POST porque o recorte inteiro pode ter milhares de lotes.
- **Tela:** o hook `useContasReceber` já percorria o recorte inteiro para os cards. Agora junta também os lotes de cada título (`nota_lote(lotes(aplis_id))`) e faz uma única chamada à rota.
  - As colunas usam `TituloReceber.glosasAplis`. Os cards "Total glosado", "Glosa recebida" e "Glosa acatada" usam `totais.glosas`.
  - Se a leitura falhar, a lista continua, as três colunas mostram "—" e aparece um aviso âmbar.
  - O saldo segue `notas.valor_saldo`. `valorGlosado` (tabela `glosas`) continua no tipo, para a baixa e a linha expandida, até a issue 13.
- **Decisões, para revisar:**
  - **Glosa recebida:** é o valor das Revertidas do Dashboard: `statusDashboard === 'revertida'` com ΔRec, ou o valor do lápis. O 34/17 sem base conta 0 até o lápis. Uma requisição acatada (18) depois de um recebimento parcial entra só em Glosa acatada, como no Dashboard.
  - **Totais:** são a soma das colunas dos títulos. Um lote ligado a dois títulos conta nos dois.
  - **Lote ainda não sincronizado:** aparece como R$ 0,00, não "—".
- **Pontos em aberto:**
  - O handler repete o mapeamento linha → `RequisicaoFoto` dos outros handlers. Agora são sete cópias, e a extração para `recursoGlosa` fica pendente.
  - No 34/17, um ΔRec negativo (recebido caiu depois da fixação) entraria negativo na Glosa recebida, como já acontece nas Revertidas do Dashboard.
  - A lista espera a leitura da foto para aparecer. Num recorte grande, as fatias são lidas uma depois da outra.
  - A conferência com dados reais não foi feita: a base de dev não tem as tabelas da foto (migrations não aplicadas).

