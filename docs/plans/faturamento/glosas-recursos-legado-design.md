# Glosas e Recursos — histórico do legado (backup apLIS)

Documento de planejamento a partir de um pedido em 11/08/2026 (branch
`feature/faturamento-lotes-aplis`): trazer para a tela "Glosas e Recursos" as
glosas e recursos que já existem no MySQL de backup do laboratório, além das
glosas nativas que a tela já mostra hoje. Levantamento de schema + volumetria
real no banco (não só a estrutura) fechou as decisões abaixo numa sessão de
grilling com o stakeholder.

**Status**: planejado, nada implementado ainda.

---

## 1. Contexto — o que já existe

A tela "Glosas e Recursos" (`GlosasRecursos.tsx` + `useGlosas.ts`, rota
`/faturamento/glosas`) já é uma feature completa e real, não mockada: lista
glosas da tabela `glosas` (Supabase), com fluxo de status
(`aberta → em_recurso → revertida/definitiva`), cards de totais e o modal
"Iniciar Recurso". Essa tabela só é alimentada **manualmente** — lançamento
avulso via `BaixaModal.tsx` (RPC `fat_registrar_baixa`) — nada nela vem do
backup.

Existe um precedente arquitetural direto no mesmo módulo: a aba **Faturas**
(`useFaturamentoLotes` → `/api/faturamento/lotes` →
`api/_lib/faturamento/bdLab.ts`) lê os lotes de faturamento **ao vivo do MySQL
de backup do laboratório, sem nunca persistir no Supabase**. Só quando o
usuário decide agir (criar um Título), o lote vira uma linha nativa em
`notas`. Este documento estende o mesmo padrão para glosas e recursos.

`requisicoes.aplis_id` (Supabase) já existe como chave de correlação com o
legado, mas **não será usada nesta entrega** — decisão 4 abaixo manteve o
histórico do legado como consulta pura, sem adoção para o Supabase.

---

## 2. Levantamento no backup — volumetria real

Consulta direta ao MySQL de backup (env `DB_HOST`/`DB_PORT`/`DB_USER`/
`DB_PASSWORD`/`DB_NAME`, mesmo túnel que `bdLab.ts` usa), não só o
`schema-backup-banco.csv`:

| Tabela | Linhas | Observação |
|---|---:|---|
| `fatrequisicaoprocedimento` (com `IdMotivoGlosa` preenchido) | 23.387 | **Fonte escolhida** — motivo de glosa "vivo" na requisição. Já parcialmente lido por `bdLab.ts` (campo `motivoGlosa` no detalhe de lote). |
| `fatdemonstrativoguiaprocedimento` (com `VlrGlosa` > 0) | 54.042 de 154.770 | Fonte alternativa, **não escolhida** — glosa registrada na conciliação do demonstrativo de pagamento importado, outro momento do processo. |
| `fatloterecurso` | 425 | Recursos já protocolados. `Status`: 18× `1`, 405× `2`, 2× `4` — sem tabela de label conhecida (ver item 8, riscos). `IdPrestador` é sempre `1` (banco de um laboratório só); `IdFontePagadora` tem 4 valores distintos, dominante `1122` (370 lotes). |
| `fatloterecursoprocedimento` | 3.893 | Procedimentos dentro de cada lote de recurso, com `Justificativa` em texto livre real (ex.: *"Códificação incorreta na hora do faturamento..."*). |
| `fatmotivoglosa` | 715 | Catálogo com `Codigo` + `Descricao` legível. |
| `fatmotivoglosainstituicao` | 0 | **Vazia — fora de escopo.** |
| `fatmotivoglosajustificativa` | 0 | **Vazia — fora de escopo.** |
| `fatdemonstrativo` | 4.177 | Cabeçalho dos demonstrativos importados — só relevante se a fonte alternativa acima fosse escolhida. Fora de escopo. |

Achado importante: `frp.DesMotivoGlosa` (em `fatrequisicaoprocedimento`) já é
um texto descritivo lançado no legado (ex.:
`"400 | Em Analise | Procedimento necessita analise PDMA"`), diferente da
`Descricao` do catálogo `fatmotivoglosa` para o mesmo `IdMotivoGlosa`
(ex.: `"DOCUMENTAÇÃO EM ANÁLISE"`). São dois textos complementares, não
duplicados — ver seção 4.

---

## 3. Decisões registradas (rastreabilidade)

| Pergunta | Decisão |
|---|---|
| Padrão de leitura do legado | Read-through ao vivo do MySQL de backup, mesmo padrão de `useFaturamentoLotes`/`bdLab.ts` — nada persiste no Supabase |
| Fonte de verdade da glosa | `fatrequisicaoprocedimento` (motivo na requisição) — não `fatdemonstrativoguiaprocedimento` |
| Catálogo `fatmotivoglosa` | Entra, como enriquecimento (código oficial + descrição do catálogo) ao lado do texto operacional `DesMotivoGlosa` |
| `fatmotivoglosainstituicao` / `fatmotivoglosajustificativa` | Fora de escopo — tabelas vazias |
| `fatdemonstrativo*` | Fora de escopo — fonte alternativa não escolhida |
| Ações sobre itens do legado | **Nenhuma por enquanto** — só consulta/histórico. Sem "adotar" para `glosas` nativa nesta entrega |
| Lotes de recurso (`fatloterecurso`) | Seção própria (lista separada), não mesclada como campo extra na lista de glosas |
| Local na UI | Dentro da própria tela "Glosas e Recursos", em abas: **"Nativas"** (o que já existe) e **"Histórico (apLIS)"** (novo) |
| Filtro de período das glosas do legado | Obrigatório, mesmo componente/presets já usados em Faturas (mês atual / 30 dias / 90 dias / custom) — necessário para limitar 23 mil linhas |
| Filtro dos lotes de recurso | Sem período obrigatório (só 425 linhas no total) — filtros simples (status, fonte pagadora, busca) |
| Permissão | Reaproveita `canViewBilling` (mesma da tela hoje) |

---

## 4. Arquitetura

```
GlosasRecursos.tsx (abas: Nativas | Histórico (apLIS))
 ├─ aba Nativas       → useGlosas.ts            → tabela `glosas` (Supabase, sem mudança)
 └─ aba Histórico
     ├─ HistoricoGlosasLegado.tsx  → useGlosasLegado.ts   → GET /api/faturamento/glosas-legado
     └─ HistoricoRecursosLegado.tsx→ useRecursosLegado.ts → GET /api/faturamento/recursos-legado

/api/faturamento/glosas-legado    → api/_lib/handlers/faturamento-glosas-legado.ts    → bdLab.ts:listarGlosasLegado
/api/faturamento/recursos-legado  → api/_lib/handlers/faturamento-recursos-legado.ts  → bdLab.ts:listarRecursosLegado
```

Ambas as rotas seguem exatamente o esqueleto de `faturamento-lotes.ts`:
`autorizarFaturamento(tokenDoHeader(...))` (permissão `canViewBilling`),
`Cache-Control: no-store` na resposta (dado financeiro), cache em memória
`TTL_PADRAO`/`TTL_BUSCA` dentro de `bdLab.ts` (idêntico ao de lotes).

---

## 5. Backend — `api/_lib/faturamento/bdLab.ts`

### 5.1 `listarGlosasLegado`

Novos tipos (mesmo estilo de `RequisicaoLote`/`ProcedimentoRequisicao` já
existentes no arquivo):

```ts
export interface GlosaRequisicaoLegado {
  idRequisicaoProcedimento: number;
  idRequisicao: number;
  codRequisicao: string | null;
  numGuiaConvenio: string | null;
  paciente: string | null;
  dtaSolicitacao: string | null;      // YYYY-MM-DD
  procedimentoCodigo: string | null;
  procedimentoDescricao: string | null;
  valor: number;                       // frp.ValorLiquido
  idMotivoGlosa: number | null;
  motivoCodigo: number | null;         // fatmotivoglosa.Codigo
  motivoDescricao: string | null;      // fatmotivoglosa.Descricao (catálogo oficial)
  desMotivoGlosa: string | null;       // frp.DesMotivoGlosa (texto operacional)
  fontePagadora: { id: number | null; nome: string | null };
}

export interface ListarGlosasLegadoParams {
  periodoIni: string;   // YYYY-MM-DD, obrigatório
  periodoFim: string;   // YYYY-MM-DD, obrigatório
  fontePagadoraId?: number;
  pagina?: number;
  tamanho?: number;
  busca?: string;        // paciente, CodRequisicao, NumGuiaConvenio
  ignorarCache?: boolean;
}

export type ListarGlosasLegadoResultado =
  | { glosas: GlosaRequisicaoLegado[]; meta: LotesMeta }
  | { erro: { status: number; mensagem: string } };
```

Consulta (variação de `SQL_DETALHE`, que já faz exatamente este join —
diferença é o `WHERE` global por período em vez de por `Lote`):

```sql
SELECT frp.IdRequisicaoProcedimento, r.IdRequisicao, r.CodRequisicao,
       r.NumGuiaConvenio, p.NomPaciente,
       DATE_FORMAT(r.DtaSolicitacao, '%Y-%m-%d') AS DtaSolicitacao,
       tp.Codigo AS ProcCodigo, tp.Descricao AS ProcDescricao,
       frp.ValorLiquido,
       frp.IdMotivoGlosa, frp.DesMotivoGlosa,
       fmg.Codigo AS MotivoCodigo, fmg.Descricao AS MotivoDescricao,
       fi.IdInstituicao, fi.NomFantasia, fi.RazaoSocial
  FROM requisicao r
  JOIN fatrequisicaoprocedimento frp ON frp.IdRequisicao = r.IdRequisicao
  LEFT JOIN paciente p ON p.CodPaciente = r.CodPaciente
  LEFT JOIN fatconvenioprocedimento cp ON cp.IdConvenioProcedimento = frp.IdConvenioProcedimento
  LEFT JOIN fattabelaprocedimento tp ON tp.IdTabelaProcedimento = cp.IdTabelaProcedimento
  LEFT JOIN fatmotivoglosa fmg ON fmg.IdMotivoGlosa = frp.IdMotivoGlosa
  LEFT JOIN fatinstituicao fi ON fi.IdInstituicao = r.IdFontePagadora
 WHERE frp.IdMotivoGlosa IS NOT NULL
   AND r.DtaSolicitacao BETWEEN ? AND ?
   -- + AND fi.IdInstituicao = ?          (quando fontePagadoraId)
   -- + AND (p.NomPaciente LIKE ? OR r.CodRequisicao LIKE ? OR r.NumGuiaConvenio LIKE ?)  (quando busca)
 ORDER BY r.DtaSolicitacao DESC
 LIMIT ? OFFSET ?
```

Todos os nomes de tabela/coluna acima (`requisicao`, `fatrequisicaoprocedimento`,
`fatconvenioprocedimento`, `fattabelaprocedimento`, `fatmotivoglosa`,
`fatinstituicao`, `paciente`) foram conferidos no
`schema-backup-banco.csv` e no `SQL_DETALHE` já existente em `bdLab.ts` — é o
mesmo join que `detalharLote` já faz, só trocando o filtro `r.Lote = ?` pelo
período. `COUNT(*)` da mesma query (sem `LIMIT`) alimenta `meta.registros`,
igual a `listarLotes`.

### 5.2 `listarRecursosLegado`

```ts
export interface ProcedimentoRecursoLegado {
  idProcedimento: number;
  idRequisicao: number;
  numGuia: string | null;
  valorRecurso: number;
  idMotivoGlosa: number | null;
  motivoDescricao: string | null;   // via fatmotivoglosa
  justificativa: string | null;
}

export interface LoteRecursoLegado {
  idLoteRecurso: number;
  status: number;                    // valor cru — ver risco no item 8
  statusLabel: string;               // derivado, ver abaixo
  dtaCriacao: string | null;
  dtaEnvio: string | null;
  dtaFinalizacao: string | null;
  dtaCancelamento: string | null;
  protocolo: string | null;
  protocoloRecursado: string | null;
  fontePagadora: { id: number | null; nome: string | null };
  valorTotal: number;                 // SUM(VlrRecurso) dos procedimentos
  qtdProcedimentos: number;
  procedimentos?: ProcedimentoRecursoLegado[]; // sob demanda, mesmo padrão de detalharLote
}

export interface ListarRecursosLegadoParams {
  status?: number;
  fontePagadoraId?: number;
  busca?: string;         // protocolo, NumGuia
  pagina?: number;
  tamanho?: number;
  ignorarCache?: boolean;
}
```

`fatloterecurso` tem só 425 linhas — a listagem principal não precisa
paginar no banco (`tamanho` default cobre tudo; `MAX_TAMANHO` existente já
limita a 200, então mantém paginação por segurança, mas sem exigir período).
`statusLabel` **não** deriva de `Status` (não há tabela de código conhecida —
risco 8.1); deriva das datas, mesmo raciocínio de `STLOT_LABELS` mas local:

```
DtaCancelamento preenchida → "Cancelado"
DtaFinalizacao preenchida  → "Finalizado"
DtaEnvio preenchida        → "Enviado"
(nenhuma)                  → "Criado"
```

Detalhe por lote (procedimentos) carregado sob demanda ao expandir a linha,
espelhando `detalharLote`/`/api/faturamento/lote-detalhe` — não faz sentido
trazer os 3.893 procedimentos de uma vez com a listagem de 425 lotes.

```sql
-- listagem (sem procedimentos)
SELECT lr.IdLoteRecurso, lr.Status,
       DATE_FORMAT(lr.DtaCriacao, '%Y-%m-%d') AS DtaCriacao,
       DATE_FORMAT(lr.DtaEnvio, '%Y-%m-%d') AS DtaEnvio,
       DATE_FORMAT(lr.DtaFinalizacao, '%Y-%m-%d') AS DtaFinalizacao,
       DATE_FORMAT(lr.DtaCancelamento, '%Y-%m-%d') AS DtaCancelamento,
       lr.Protocolo, lr.ProtocoloRecursado,
       fi.IdInstituicao, fi.NomFantasia, fi.RazaoSocial,
       (SELECT COUNT(*) FROM fatloterecursoprocedimento lrp WHERE lrp.IdLoteRecurso = lr.IdLoteRecurso) AS QtdProcedimentos,
       (SELECT SUM(lrp.VlrRecurso) FROM fatloterecursoprocedimento lrp WHERE lrp.IdLoteRecurso = lr.IdLoteRecurso) AS ValorTotal
  FROM fatloterecurso lr
  LEFT JOIN fatinstituicao fi ON fi.IdInstituicao = lr.IdFontePagadora
 ORDER BY lr.DtaCriacao DESC
 LIMIT ? OFFSET ?

-- detalhe (procedimentos de um lote)
SELECT lrp.IdProcedimento, lrp.IdRequisicao, lrp.NumGuia, lrp.VlrRecurso,
       lrp.IdMotivoGlosa, fmg.Descricao AS MotivoDescricao, lrp.Justificativa
  FROM fatloterecursoprocedimento lrp
  LEFT JOIN fatmotivoglosa fmg ON fmg.IdMotivoGlosa = lrp.IdMotivoGlosa
 WHERE lrp.IdLoteRecurso = ?
```

---

## 6. API — `api/_lib/handlers/` + dispatcher

Dois handlers novos, cada um espelhando `faturamento-lotes.ts` /
`faturamento-lote-detalhe.ts` (whitelist de query params, validação de
formato de data, `autorizarFaturamento`, `Cache-Control: no-store`):

- `faturamento-glosas-legado.ts` — `GET /api/faturamento/glosas-legado`
  (`periodoIni`/`periodoFim` obrigatórios, `fontePagadoraId`, `pagina`,
  `tamanho`, `busca`).
- `faturamento-recursos-legado.ts` — `GET /api/faturamento/recursos-legado`
  (listagem, sem período obrigatório) + `?idLoteRecurso=` para o detalhe
  (mesmo formato de `lote-detalhe`, ou uma rota irmã
  `recurso-legado-detalhe` se preferir separar — decisão de implementação,
  sem impacto no resto do desenho).

Registrar as duas em `api/faturamento/[action].ts`:

```ts
import faturamentoGlosasLegado from '../_lib/handlers/faturamento-glosas-legado.js';
import faturamentoRecursosLegado from '../_lib/handlers/faturamento-recursos-legado.js';
// ...
const ROTAS: Record<string, Handler> = {
  lotes: faturamentoLotes,
  'lote-detalhe': faturamentoLoteDetalhe,
  'titulo-criar': faturamentoTituloCriar,
  'operadoras-sync': faturamentoOperadorasSync,
  'glosas-legado': faturamentoGlosasLegado,
  'recursos-legado': faturamentoRecursosLegado,
};
```

Fica em 6 rotas dentro da mesma function — ainda bem abaixo do limite de 12
functions do plano Vercel citado no comentário do dispatcher (o dispatcher
já resolve isso: novas actions não custam function nova).

---

## 7. Tipos compartilhados — `src/modules/billing/types/index.ts`

Espelhar os tipos de `bdLab.ts` (mesmo padrão que `LoteFaturamento`/
`RequisicaoLote`/`ProcedimentoRequisicao` já seguem — "sincronizado à mão,
porque o SPA e as functions não compartilham pacote de tipos"):

- `GlosaRequisicaoLegado`, `ListarGlosasLegadoParams`/`GlosasLegadoFiltros`
- `LoteRecursoLegado`, `ProcedimentoRecursoLegado`, `RecursosLegadoFiltros`
- `ViewSalvaTela` ganha `'glosas-legado'` **só se** o filtro de período dessa
  aba também precisar entrar em Views Salvas — decisão de UX a confirmar na
  implementação (não fazia parte do pedido original).

---

## 8. Frontend

- `src/modules/faturamento/hooks/useGlosasLegado.ts` — mesmo esqueleto de
  `useFaturamentoLotes.ts` (token da sessão, cache de sessão por chave de
  filtro, guarda de requisição em voo).
- `src/modules/faturamento/hooks/useRecursosLegado.ts` — idem, mais
  `buscarProcedimentos(idLoteRecurso)` sob demanda (mesmo padrão de
  `buscarRequisicoes` em `useFaturamentoLotes`).
- `GlosasRecursos.tsx` ganha abas (`useState<'nativas' | 'legado'>`); o
  conteúdo atual do componente vira a aba "Nativas" sem mudança de
  comportamento.
- `HistoricoGlosasLegado.tsx` (novo): seletor de período (reaproveitar o
  componente de presets de `FaturasDashboard.tsx`, mês atual/30/90 dias/
  custom), lista de `GlosaRequisicaoLegado` — cada linha mostra
  `desMotivoGlosa` como texto principal e `motivoCodigo`/`motivoDescricao`
  do catálogo como detalhe secundário (ex.: badge com o código ANS).
- `HistoricoRecursosLegado.tsx` (novo): lista de `LoteRecursoLegado` com
  `statusLabel`, protocolo, datas e valor total; linha expansível carrega os
  procedimentos (`Justificativa`, motivo, guia) sob demanda, mesmo padrão de
  expansão de linha que `FaturasDashboard.tsx` já usa para lotes de
  faturamento.
- Sem novas ações de escrita nesta entrega (decisão 4) — as duas telas novas
  são 100% leitura.

---

## 9. Fora de escopo desta entrega

- `fatdemonstrativo`, `fatdemonstrativoguia`, `fatdemonstrativoguiaprocedimento`
  — fonte de glosa alternativa não escolhida.
- `fatmotivoglosainstituicao`, `fatmotivoglosajustificativa` — tabelas vazias.
- Qualquer ação ("iniciar recurso", editar, adotar) a partir de um item do
  legado — fica só consulta/histórico.
- Padronizar o campo `motivo` do lançamento manual de glosa (`BaixaModal`)
  com o catálogo `fatmotivoglosa` — não foi pedido nesta rodada.
- Views salvas para a aba "Histórico (apLIS)".

---

## 10. Riscos / itens a confirmar na implementação

1. **`fatloterecurso.Status`** — não há tabela de código (`tabelacodigoitem`
   ou similar) localizada para os valores `1`/`2`/`4`. O `statusLabel`
   proposto (seção 5.2) deriva das colunas de data em vez do código cru;
   vale confirmar com quem opera o legado se os rótulos ("Criado"/
   "Enviado"/"Finalizado"/"Cancelado") batem com o vocabulário real antes de
   fechar a UI.
2. **`r.IdFontePagadora` como join de `fatinstituicao`** — confirmado que a
   coluna existe direto em `requisicao` (schema CSV), então não precisa
   passar pelo `fatlote` como a listagem de lotes faz. Vale um teste rápido
   comparando o nome da fonte pagadora resultante com o que já aparece hoje
   no detalhe de lote (`motivoGlosa`/fonte pagadora), que usa o mesmo dado
   por outro caminho.
3. **Volume de 23.387 linhas em `fatrequisicaoprocedimento`** sem período —
   o filtro de período é obrigatório justamente para isso; confirmar que o
   índice em `DtaSolicitacao` (`MUL` no schema) é suficiente para a consulta
   não pesar no túnel (mesma preocupação que já existe em `listarLotes`).
4. **Duplicidade de leitura** — como a fonte escolhida é
   `fatrequisicaoprocedimento` e não `fatdemonstrativoguiaprocedimento`, uma
   guia com glosa registrada só no demonstrativo de pagamento (e não na
   requisição) **não aparecerá** nesta tela. Se isso gerar reclamação de
   "falta glosa" depois de publicado, é sinal de que a decisão da seção 3
   precisa ser revisitada (trazer a segunda fonte como complemento).
5. **[Resolvido pós-publicação, 24/08]** `IdMotivoGlosa IS NOT NULL` sozinho
   trazia negativa de autorização junto com glosa real — feedback do setor ao
   ver "3051 DOCUMENTAÇÃO EM ANÁLISE" (`DesMotivoGlosa` "400 | Em Analise |
   Procedimento necessita analise PDMA") listado como "glosa". Duas correções
   intermediárias foram cogitadas e substituídas até o cliente fechar a regra
   final:
   - 1ª tentativa: heurística `DtaRecebido`/`ValorRecebido` preenchido.
   - 2ª tentativa: `fatlote.Status IN (3, 4, 6, 7)` ("já enviado ao
     convênio" — Faturado/Recebido/Exportado TOTVS/Recebido-parcial).
   - **Regra final do cliente**: só o status 3 (Faturado), literal — não os
     demais status pós-envio. Implementado em `filtroGlosasLegado`
     (`api/_lib/faturamento/bdLab.ts`) com `JOIN fatlote fl` +
     `fl.Status = 3`. Volume real: cai de ~26 mil pra **2.699 linhas** — bem
     menor que a opção "já enviado" (~25 mil), mas foi a instrução explícita
     do cliente, então prevalece sobre a leitura "mais lotes é mais seguro"
     que orientou a 2ª tentativa.
   Ligado ao item 6 do feedback do setor
   (`.scratch/faturamento-feedback-usuario/spec.md`) — resolve o sintoma
   reportado nesta tela; a reclassificação completa (glosa × negativa de
   autorização × procedimento não autorizado) para o restante do módulo
   segue estacionada aguardando o documento "Zero Glosa".
