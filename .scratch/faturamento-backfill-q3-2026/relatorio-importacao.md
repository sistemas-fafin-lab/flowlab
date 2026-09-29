# Backfill histórico de Contas a Receber — Jul/Ago/Set 2026

Status: migration ajustada após 3 rodadas de colisão em produção (a última
via pré-checagem em lote, não tentativa de push); pronta para nova
tentativa de `supabase db push`.

## Origem

Planilha do cliente `Faturamento x Recebimentos - 2026 - 3° Trimestre.xlsx`
(Google Sheets), controle manual feito pelo setor de faturamento antes da
tela real "Contas a Receber" existir no FlowLab. 552 linhas nas abas JULHO/
AGOSTO/SETEMBRO, uma linha por lote/guia enviado a uma operadora.

## O que foi entregue

1. `supabase/migrations/20260911100000_backfill_contas_receber_q3_2026.sql`
   — 445 títulos (operadoras/lotes/notas/recebimentos/glosas), sem PII.
   3 lotes colidiram em produção depois da primeira leva de 12 exclusões
   (`aplis_id` 6526, 6537 e 6577 — os dois primeiros descobertos por
   tentativa de push falha, o terceiro por pré-checagem via SELECT; ver
   seção de exclusões abaixo); já removidos do arquivo — pronta para nova
   tentativa.
2. `supabase/scripts/backfill-requisicoes-contas-receber-q3-2026.ts` — busca
   paciente/procedimento reais no apLIS (MySQL, somente leitura) e grava em
   `requisicoes`. Roda **depois** da migration acima:
   ```
   npx tsx supabase/scripts/backfill-requisicoes-contas-receber-q3-2026.ts --dry-run
   npx tsx supabase/scripts/backfill-requisicoes-contas-receber-q3-2026.ts
   ```
   Precisa de `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` (escrita) e
   `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_NAME` (leitura apLIS, já
   configuradas no `.env` do projeto).

## Como os 552 linhas da planilha viraram 445 títulos

| Categoria | Linhas |
|---|---|
| Importadas (viram título) | 445 |
| Placeholder vazio (ex.: "Sem data provável", sem valor) | 90 |
| Célula quebrada (`#VALUE!` + "DEVOLVIDO" em vez de número) | 1 |
| Conflito de lote não resolvível (ver abaixo) | 1 |
| Já existe título real cadastrado no sistema (ver abaixo) | 15 |
| **Total** | **552** |

## Excluídas: já existe título real no sistema (15 linhas)

Na primeira tentativa de rodar a migration em produção, o banco recusou por
`duplicate key value violates unique constraint "lotes_aplis_id_key"` — o
lote 6563 já existia em `lotes`. Isso significa que, para esses lotes, um
operador **já cadastrou o título de verdade pela tela**, antes deste
backfill rodar. Conferi contra a lista completa dos 460 lotes candidatos e
vieram exatamente 12 colisões — removidas do backfill (não dá pra duplicar
a mesma transação real duas vezes) e também removidas da lista de lotes que
o script de requisições processa (esses já têm requisições reais geradas
pelo fluxo operacional normal):

| Aba | Linha | Convênio | Lote apLIS | Valor Enviado |
|---|---|---|---|---|
| AGOSTO | 42 | AMHPDF TRF - PEND 2025 | 6563 | R$ 79,93 |
| AGOSTO | 51 | AMHPDF - STM | 6480 | R$ 79,91 |
| AGOSTO | 67 | AMHPDF - PROASA | 6479 | R$ 2.220,74 |
| AGOSTO | 125 | BRADESCO | 6669 | R$ 405,13 |
| AGOSTO | 150 | CAMARA | 6665 | R$ 1.993,61 |
| SETEMBRO | 72 | ASSEFAZ | 6711 | R$ 2.389,47 |
| SETEMBRO | 108 | FASCAL | 6713 | R$ 2.405,16 |
| SETEMBRO | 128 | PMDF | 6715 | R$ 70,62 |
| SETEMBRO | 166 | TRT PERIÓDICO | 6684 | R$ 52,20 |
| SETEMBRO | 167 | TRT | 6683 | R$ 1.539,93 |
| SETEMBRO | 168 | TRT | 6696 | R$ 898,69 |
| SETEMBRO | 169 | TRT | 6707 | R$ 85,08 |

Numa segunda tentativa de `supabase db push` (após corrigir os 12 acima),
o banco recusou de novo pelo mesmo motivo, para o lote 6526; numa terceira
tentativa, o mesmo aconteceu para o lote 6537. Nenhuma das duas colisões
apareceu na conferência manual contra os 460 candidatos que pegou as 12
primeiras (provavelmente porque os títulos reais foram cadastrados pela
tela entre a conferência original e essas tentativas de push). Removidas
do arquivo da mesma forma:

| Aba | Linha | Convênio | Lote apLIS | Valor Enviado |
|---|---|---|---|---|
| AGOSTO | 137 | CASSI | 6526 | R$ 11.270,22 |
| AGOSTO | 138 | CASSI | 6537 | R$ 12.746,72 |

Depois dessas duas, em vez de continuar tentando `supabase db push` um
lote de cada vez, rodamos uma pré-checagem única: `SELECT aplis_id FROM
lotes WHERE aplis_id = ANY(ARRAY[...445 ids restantes...]::text[])` direto
no SQL editor de produção. Achou mais uma colisão, dessa vez sem precisar
de nenhuma tentativa de push:

| Aba | Linha | Convênio | Lote apLIS | Valor Enviado |
|---|---|---|---|---|
| AGOSTO | 230 | TST | 6577 | R$ 16.089,54 |

Vale conferir manualmente se o título já cadastrado no sistema pra esses 15
lotes bate com o valor/status da planilha (o valor da planilha pode ser
mais atualizado que o que o operador registrou na hora, ou vice-versa) —
este backfill não sobrescreve título já existente, só não duplica.

A pré-checagem acima, rodada contra os 445 `aplis_id` que restaram após
essa remoção, não voltou mais nenhuma linha — não há indício de outra
colisão pendente no momento em que foi rodada. Como o sistema real
continua operando em paralelo, ainda é possível que apareça mais uma
colisão nova entre agora e a hora do `supabase db push` efetivo; se
acontecer, o tratamento é o mesmo dos 15 casos acima.

Operadora e número de lote **não** vieram do texto do convênio na planilha
(inconsistente: espaços, "PENDÊNCIA", nome de atendente etc.) — foram
resolvidos consultando o apLIS de verdade (`fatlote`/`fatinstituicao`) pelo
número de Lote ou Protocolo da planilha. Isso revelou que várias variações
de nome na planilha são, no apLIS, a mesma fonte pagadora: todos os
"AMHPDF - X" (BACEN, SERPRO, CASEMBRAPA, TRF, STM, PROASA, CARE PLUS, OMINT,
UNAFISCO, PETROBRÁS, AFFEGO, NOTREDAME etc.) são `IdFontePagadora=1025`
(AMHP-DF); "LUMINAR" e "E-VIDA" também são o mesmo (`1049`); "BRADESCO" na
planilha na verdade cobre **dois** registros reais diferentes no apLIS
(`1000` e `1122`, matriz/filial).

## Linhas com correção automática (lote da planilha não batia com o apLIS)

Nestes casos o número de "Lote" digitado na planilha não existe no apLIS,
mas o "Protocolo" da mesma linha identificou o lote real de forma
inequívoca — prováveis erros de digitação:

- JULHO linha 203 (TRT): lote digitado `6261` → lote real `6162`
- AGOSTO linha 171 (PMDF): lote digitado `54291` → lote real `5429`
- AGOSTO linha 184 (PLAN ASSISTE - REENVIO) e AGOSTO linha 183 (PLAN
  ASSISTE): planilha não tinha número de lote nenhum nessas duas linhas —
  identificadas só pelo Protocolo (lotes reais `6329` e `6466`)

## Excluída: conflito de lote (1 linha)

**AGOSTO linha 86** (AMHPDF - CARE PLUS, protocolo 44723495, valor
R$ 2.087,02): a planilha aponta lote `6511`, mas esse lote já pertence de
fato a outra linha (AGOSTO linha 26, protocolo 44727614, valor R$ 4.510,06)
— confirmado no apLIS. O protocolo desta linha (44723495) não existe no
apLIS. Não foi possível identificar o lote real; **não foi importada**.
Vale conferir com o cliente qual é o lote correto dessa cobrança.

## Excluída: célula quebrada (1 linha)

**JULHO linha 167** (PLAN ASSISTE, protocolo PEG 82105): "Valor Recebido"
contém o texto "DEVOLVIDO" em vez de número, e "Saldo Pendente" é um erro de
fórmula (`#VALUE!`) na planilha original. Não importada (decisão do
usuário: ignorar e listar). Nota: esta guia aparenta ter sido reenviada com
sucesso em AGOSTO linha 184 (mesmo protocolo/lote 6329) — essa reimportação
já está incluída normalmente.

## Datas corrigidas (formato manual malformado na planilha)

- JULHO linha 31 (AMHPDF - CASEMBRAPA, lote 6313): Data Faturamento
  digitada como número puro "17072026" → 17/07/2026. **Este caso
  especificamente quebrou a primeira tentativa de rodar a migration**
  (`invalid input syntax for type date: "17072026.0"`, linha 150 do arquivo)
  — o parser original só tratava esse formato malformado quando vinha como
  texto, não quando a planilha guardava como número puro. Corrigido e
  reconferido: varri as 460 linhas de novo, sistematicamente, nos 3 campos
  de data (faturamento/provável pagamento/recebimento) e nenhum outro caso
  igual apareceu. A migration no repositório já está com a correção.
- JULHO linha 34: Data Faturamento "1707/2026" → 17/07/2026
- JULHO linha 172: Data Faturamento "16/072026" → 16/07/2026
- JULHO linha 197: Data Recebimento "27/08/0206" → 27/08/2026
- Onde "Data Provável Pagamento" veio vazia ou "—" (35 linhas), usei a
  própria Data de Faturamento como `data_vencimento`/`data_prevista` (não
  há outro dado na planilha pra estimar isso).

## Decisões de mapeamento que merecem sua revisão

- **Status do título** não foi copiado da planilha ("No prazo"/"Vencido"/
  "DEVOLVIDO" não tinham como mapear 1:1 para o enum real). Em vez disso,
  os valores reais de recebimento/glosa foram inseridos e o **trigger do
  próprio sistema** (`fat_recalcular_nota`) calcula o status — mesma lógica
  do fluxo operacional ao vivo.
- **Glosas** (11 linhas com valor de glosa): nenhuma das 11 tinha "Valor
  Acatado", "Primeiro/Segundo Recurso" preenchidos na planilha — todas
  entraram com `status='aberta'` (não resolvida), a opção mais conservadora
  disponível no enum. Se alguma já foi de fato revertida ou definitiva,
  precisa de ajuste manual.
- **Refaturamento** (8 linhas marcadas "sim"): não há coluna própria no
  schema real — ficou registrado como texto em `observacoes`.
- **Operadora "SELECT"** (apLIS `IdFontePagadora=1365`, 1 título, aba
  AGOSTO): não está na whitelist de 32 fontes pagadoras aprovadas pelo
  setor (`20260903110000_operadoras_considerada_meta.sql`). Foi criada com
  `is_considerada_meta=false` (política já documentada naquela migration
  para fonte nova/desconhecida) — o título existe mas **não conta** nos
  KPIs/dashboard de meta até alguém decidir marcá-la manualmente.
- **AMHPDF LIFE EMPRESARIAL** (2 linhas, AGOSTO): não foi possível
  encontrar o lote real no apLIS nem por ID nem por Protocolo — a operadora
  foi inferida pelo nome (AMHP-DF, `1025`), consistente com as outras 126
  linhas "AMHPDF - *" que bateram 100% com essa mesma fonte pagadora via
  apLIS real. Baixo risco, mas sinalizando por transparência.
- **Guias/requisições** (paciente, procedimento): não vêm da planilha (que
  é por lote agregado) — o script separado busca no apLIS. Se algum lote
  vier sem nenhuma requisição encontrada (réplica do apLIS atrasa ~1 dia),
  o script avisa no relatório final.
