// api/_lib/faturamento/bdLab.ts
// Fonte de dados da aba Faturamento → Faturas: o MySQL de backup do laboratório
// (mesmo banco de api/_lib/apoio/bdLab.ts, envs DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME).
//
// Por que não a API do apLIS: o comando `faturamentoLoteListar` devolve os
// procedimentos já AGREGADOS por lote, sem nenhum identificador de requisição, e o
// `requisicaoListar` ignora um filtro por lote. Não existe caminho na API que ligue
// lote → requisições. No banco esse elo é a coluna `requisicao.Lote`, o que permite
// a estrutura que a tela precisa: lote → requisições → procedimentos.
//
// Equivalência conferida contra a API real (lotes 6423 / 6427 / 6428): o `VlrLote` do
// apLIS é exatamente `SUM(fatrequisicaoprocedimento.ValorLiquido)` das requisições do
// lote — 9.320,79 / 3.729,91 / 3.588,65 nos dois lados. E `COUNT(fatlote)` de
// julho/2026 = 211, igual ao `registros` que a API devolvia.
//
// Peculiaridades do banco que motivam o código abaixo:
//   - DECIMAL volta como string ("9320.7900") no mysql2 → converter com Number();
//   - datas são DATETIME e o mysql2 as converte usando o fuso do processo; como o
//     Vercel roda em UTC e a máquina de dev em America/Sao_Paulo, o MESMO registro
//     viraria dias diferentes. Por isso todas as datas saem formatadas pelo próprio
//     MySQL (DATE_FORMAT → 'YYYY-MM-DD'), sem passar por Date;
//   - `ValorCobrado`/`ValorRecebido` são esparsos (só preenchem depois do retorno da
//     operadora); `ValorLiquido` é o que está sempre lá e é o que a API espelha;
//   - a NF/RPS mora em `fatrps`, ligada por `fatlote.IdRPS` (NÃO por `fatrps.IdLote`,
//     que veio nulo nos lotes conferidos). `IdPreFatura` está sempre nulo neste cliente;
//   - `fattabelaprocedimento` tem uma linha por (tabela de preço, código), então a
//     descrição do mesmo código varia conforme o convênio da requisição. A descrição
//     é lida pelo caminho do convênio, que é o que o apLIS também faz;
//   - o backup atrasa ~1 dia (maior DtaCriacao em 04/08 com hoje em 05/08), então
//     lotes abertos hoje ainda não aparecem. A tela avisa a data do dado mais recente.

import mysql from 'mysql2/promise';

/** Timeout de conexão. O túnel pode estar fora do ar; falha rápido. */
const CONNECT_TIMEOUT_MS = 8_000;

export const MAX_TAMANHO = 200;
export const TAMANHO_PADRAO = 50;
/** Teto de lotes por título — compartilhado entre a criação (titulo-criar) e a
 *  revalidação ao vivo do envio (titulo-lotes-envio), que nunca recebe mais
 *  lotes do que um título pode ter tido na criação. */
export const MAX_LOTES_TITULO = 50;
/** Teto do termo de busca: ele vira 7 predicados LIKE, não faz sentido aceitar texto longo. */
export const MAX_BUSCA = 100;

// Tabela de código STLOT ("Status de Lote") do apLIS, lida de tabelacodigoitem.
// `fatlote.Status` guarda só o número.
export const STLOT_LABELS: Record<number, string> = {
  1: 'Em Processamento',
  2: 'Conciliação',
  3: 'Faturado',
  4: 'Recebido',
  5: 'Cancelado',
  6: 'Exportado TOTVS',
  7: 'Recebido - parcial',
  8: 'Prejuízo',
};

export interface LoteFaturamento {
  idLote: number;
  status: number;
  statusLabel: string;
  /** ISO YYYY-MM-DD — formatado no MySQL, ver nota de fuso no topo. */
  dtaCriacao: string | null;
  dtaFechamento: string | null;
  dtaEnvio: string | null;
  dtaCancelamento: string | null;
  protocolo: string | null;
  /** `protocolo` não vazio e repetido em outro lote, excluindo protocolo em
   *  formato de data (ver `protocoloEhData`) — issue 10 do feedback. */
  protocoloDuplicado: boolean;
  /** Em quantos lotes este protocolo aparece; null quando não duplicado. */
  protocoloDuplicadoContagem: number | null;
  /** `IdLote` dos OUTROS lotes com o mesmo protocolo (exclui o próprio); null
   *  quando não duplicado — issue 13 do feedback. */
  protocoloDuplicadoLotes: number[] | null;
  nfeNumero: string | null;
  nfeCodigoVerificacao: string | null;
  numeroRPS: number | null;
  dtaVencimento: string | null;
  prestador: string | null;
  valor: number;
  qtdRequisicoes: number;
  fontePagadora: {
    /** `fatinstituicao.IdInstituicao` — vira `operadoras.aplis_id` no título. */
    id: number | null;
    nome: string | null;
    razaoSocial: string | null;
    cpfCnpj: string | null;
  };
}

/** Fonte pagadora do apLIS, espelhada em `operadoras`. */
export interface FontePagadora {
  id: number;
  nome: string | null;
  razaoSocial: string | null;
  cpfCnpj: string | null;
}

export type FontesPagadorasResultado =
  | { fontes: FontePagadora[] }
  | { erro: { status: number; mensagem: string } };

export interface ProcedimentoRequisicao {
  codigo: string | null;
  descricao: string | null;
  quantidade: number;
  valorUnitario: number;
  valor: number;
  numGuia: string | null;
  motivoGlosa: string | null;
  /** Descrição do catálogo `fatmotivoglosa` (via `IdMotivoGlosa`) — `motivoGlosa` às
   *  vezes vem só com o código numérico (ex.: "1001"), sem texto nenhum; isto dá o
   *  texto completo pra exibir em tooltip mesmo nesses casos. */
  motivoGlosaDescricao: string | null;
  /** `fatrequisicaoprocedimento.ValorRecebido` — 0 quando glosado integralmente. */
  valorRecebido: number;
  dtaRecebido: string | null;
  /** `valorRecebido < valor` — inclui glosa integral (valorRecebido = 0). */
  pendente: boolean;
  /** `valor - valorRecebido`, nunca negativo; 0 quando não pendente. */
  valorPendente: number;
}

export interface RequisicaoLote {
  idRequisicao: number;
  codRequisicao: string | null;
  dtaSolicitacao: string | null;
  dtaFinalizacao: string | null;
  numGuiaConvenio: string | null;
  paciente: string | null;
  valor: number;
  procedimentos: ProcedimentoRequisicao[];
  /** `requisicao.CodEventoFatur` — sinal auxiliar (tabela `eventofatur`; 5 = RECEBIDO,
   *  6 = GLOSADO ainda SEM RECURSO), alinhado à planilha do setor. */
  codEventoFatur: number | null;
  eventoFaturLabel: string | null;
  /** Algum procedimento com `pendente = true`. */
  pendente: boolean;
  /** Soma do `valorPendente` dos procedimentos. */
  valorPendente: number;
}

export interface LotesMeta {
  pagina: number;
  tamanho: number;
  qtdPaginas: number;
  registros: number;
  /** Data do lote mais recente que existe no backup — mede o atraso da réplica. */
  dadoAte: string | null;
  /** Só quando somenteSemTitulo=1: quantos lotes desta página foram ocultados por
   *  já ter título. `registros`/`qtdPaginas` continuam contando SEM esse filtro. */
  filtrados?: number;
}

export interface ListarLotesParams {
  periodoIni?: string;
  periodoFim?: string;
  idLote?: number;
  /** Vários lotes de uma vez, pelo IdLote do apLIS. Usado pela criação de título,
   *  que precisa do snapshot de N lotes sem abrir N conexões. Ignora o período. */
  idsLote?: number[];
  statusLote?: number;
  pagina?: number;
  tamanho?: number;
  /** Termo de busca textual: procura em paciente, fonte pagadora, código da requisição,
   *  número da guia e IdLote. Ignora acentuação e maiúsculas/minúsculas. */
  busca?: string;
  /** Ignora o cache em memória e o regrava. É o que o botão "Atualizar" da tela usa —
   *  sem isto ele devolveria a mesma resposta durante os 3 min de TTL. */
  ignorarCache?: boolean;
  /** Só lotes com protocolo duplicado (ver `LoteFaturamento.protocoloDuplicado`).
   *  Filtro de tela, sem efeito em bloqueio de operação. */
  somenteProtocoloDuplicado?: boolean;
  /** Calcula `protocoloDuplicado`/`protocoloDuplicadoContagem` de cada lote (custa
   *  uma agregação sobre TODA a fatlote — ver `protocolosDuplicados`). Opt-in: a
   *  aba Faturas liga; a criação de título (que só lê idLote/status/valor/guias)
   *  não precisa pagar esse full scan a cada snapshot. Ligado automaticamente
   *  quando `somenteProtocoloDuplicado` é usado, senão o filtro não teria o que
   *  filtrar. */
  comProtocoloDuplicado?: boolean;
}

// Discriminado pela PRESENÇA de `erro` (idiom de recepcaoAgendamento.ts): o tsconfig
// da api roda com strict:false e sem strictNullChecks o TS não estreita união por
// discriminante booleano — `in` estreita.
// `erro.status` é 502 quando o banco está inalcançável: a falha não é do cliente.
export type ListarLotesResultado =
  | { lotes: LoteFaturamento[]; meta: LotesMeta }
  | { erro: { status: number; mensagem: string } };

export type DetalharLoteResultado =
  | { requisicoes: RequisicaoLote[] }
  | { erro: { status: number; mensagem: string } };

export function bdLabConfigurado(): boolean {
  return Boolean(process.env.DB_HOST?.trim() && process.env.DB_USER?.trim());
}

async function conectar(): Promise<mysql.Connection> {
  return mysql.createConnection({
    host: (process.env.DB_HOST ?? '').trim(),
    port: Number((process.env.DB_PORT ?? '3306').trim()),
    user: (process.env.DB_USER ?? '').trim(),
    password: (process.env.DB_PASSWORD ?? '').trim(),
    database: (process.env.DB_NAME ?? 'lab').trim(),
    charset: 'utf8mb4',
    connectTimeout: CONNECT_TIMEOUT_MS,
  });
}

/**
 * Roda `consulta` com uma conexão dedicada e sempre a encerra. Nunca lança: erro de
 * túnel/consulta volta como `{ erro }`, mesmo contrato do cliente antigo.
 */
async function comConexao<T>(
  rotulo: string,
  consulta: (conn: mysql.Connection) => Promise<T>,
): Promise<T | { erro: { status: number; mensagem: string } }> {
  if (!bdLabConfigurado()) {
    return { erro: { status: 502, mensagem: 'Banco do laboratório não configurado (DB_HOST/DB_USER).' } };
  }
  let conn: mysql.Connection | null = null;
  try {
    conn = await conectar();
    return await consulta(conn);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[faturamento/bdLab] ${rotulo}: ${msg}`);
    return { erro: { status: 502, mensagem: `Não foi possível consultar o banco do laboratório: ${msg}` } };
  } finally {
    if (conn) await conn.end().catch(() => undefined);
  }
}

/** DECIMAL/BIGINT vêm como string no mysql2. */
function numero(bruto: unknown): number {
  if (bruto === null || bruto === undefined || bruto === '') return 0;
  const n = Number(bruto);
  return Number.isFinite(n) ? n : 0;
}

function inteiroOuNulo(bruto: unknown): number | null {
  if (bruto === null || bruto === undefined || bruto === '') return null;
  const n = Number(bruto);
  return Number.isFinite(n) ? n : null;
}

/** Trata '' como ausente: várias colunas do apLIS guardam string vazia em vez de NULL. */
function texto(bruto: unknown): string | null {
  if (bruto === null || bruto === undefined) return null;
  const s = String(bruto).trim();
  return s === '' ? null : s;
}

// Datas já saem 'YYYY-MM-DD' do MySQL; só normaliza o vazio.
const dataIso = texto;

// Faixa de ano aceita para um protocolo em formato de data — larga o bastante para
// cobrir o histórico da fatlote (achado das pendências: lotes desde dez/2020) sem
// deixar passar lixo óbvio como "00002026" teria se só checássemos dia/mês.
const ANO_MINIMO_PROTOCOLO_DATA = 1900;
const ANO_MAXIMO_PROTOCOLO_DATA = 2099;

/**
 * Protocolo em formato de data válida: 8 dígitos `DDMMYYYY` que formam uma data de
 * calendário real (dia 01–31, mês 01–12, ano plausível — E o dia tem que existir
 * naquele mês, tipo 31/04 não vale). AMHP-DF e Medigest usam esse formato
 * legitimamente compartilhado entre lotes (issue 10 do feedback) — protocolos assim
 * NUNCA contam como duplicidade, mesmo repetidos entre vários lotes ou operadoras.
 *
 * A validação de calendário (via `Date`, não só faixa numérica) importa: sem ela um
 * protocolo realmente duplicado que por coincidência caísse numa "data" inexistente
 * (ex.: 31042026) escaparia da marcação — a faixa dia<=31/mês<=12 sozinha aceitaria.
 */
export function protocoloEhData(protocolo: string): boolean {
  if (!/^\d{8}$/.test(protocolo)) return false;
  const dia = Number(protocolo.slice(0, 2));
  const mes = Number(protocolo.slice(2, 4));
  const ano = Number(protocolo.slice(4, 8));
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return false;
  if (ano < ANO_MINIMO_PROTOCOLO_DATA || ano > ANO_MAXIMO_PROTOCOLO_DATA) return false;
  const data = new Date(ano, mes - 1, dia);
  return data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === dia;
}

/** Tipos que o `execute` do mysql2 aceita como bind — só isto entra nas consultas. */
type ParametroSql = string | number;

// Cache em memória das consultas. Em Vercel Serverless a instância sobrevive entre
// requisições enquanto está quente; o TTL evita servir dado velho demais (o backup
// atrasa ~1 dia, então 3 min é seguro). As buscas com termo textual têm TTL mais curto
// porque o operador espera resposta imediata ao digitar.
interface EntradaCache<T> { resultado: T; ts: number; }
const cacheLotes = new Map<string, EntradaCache<ListarLotesResultado>>();
const cacheDetalhe = new Map<string, EntradaCache<DetalharLoteResultado>>();
const TTL_PADRAO = 3 * 60_000; // 3 min
const TTL_BUSCA = 60_000;      // 1 min quando há termo de busca
const MAX_ENTRADAS = 128;

function chaveListar(params: ListarLotesParams): string {
  return `lotes|${params.periodoIni ?? ''}|${params.periodoFim ?? ''}|${params.idLote ?? ''}|${(params.idsLote ?? []).join('.')}|${params.statusLote ?? ''}|${params.pagina ?? ''}|${params.tamanho ?? ''}|${params.busca ?? ''}|${params.somenteProtocoloDuplicado ? 1 : 0}|${params.comProtocoloDuplicado ? 1 : 0}`;
}

function doCache<T>(cache: Map<string, EntradaCache<T>>, chave: string, resultado: T): void {
  if (cache.size >= MAX_ENTRADAS) {
    const primeira = cache.keys().next().value;
    if (primeira !== undefined) cache.delete(primeira);
  }
  cache.set(chave, { resultado, ts: Date.now() });
}

function daCache<T>(cache: Map<string, EntradaCache<T>>, chave: string, temBusca: boolean): T | null {
  const entrada = cache.get(chave);
  if (!entrada) return null;
  const ttl = temBusca ? TTL_BUSCA : TTL_PADRAO;
  if (Date.now() - entrada.ts > ttl) {
    cache.delete(chave);
    return null;
  }
  return entrada.resultado;
}

// Protocolos duplicados são propriedade GLOBAL do lote, não do período filtrado:
// dois lotes podem compartilhar protocolo em janelas de tempo bem distantes (achado
// real: protocolo 760054 repetido entre ASSEFAZ e Medigest em dez/2024, fora de
// qualquer janela de 12 meses). Por isso a contagem roda sobre TODA a fatlote, numa
// única agregação (GROUP BY) em vez de subconsulta correlacionada por linha — cache
// à parte da listagem, mesmo TTL, para não pagar esse full scan a cada combinação de
// filtro/página.
let cacheProtocolosDuplicados: { mapa: Map<string, number[]>; ts: number } | null = null;

/** Protocolo (já trimado — ver TRIM no SELECT, mesmo tratamento de `texto()`) →
 *  quantos lotes o compartilham, só para os que NÃO são formato de data (ver
 *  `protocoloEhData`) e aparecem em mais de um lote.
 *
 *  `ignorarCache` fura o TTL deste mapa — usado pelo botão "Atualizar" da aba
 *  Faturas (mesmo `ignorarCache` da listagem em si), não pela criação de título:
 *  essa já força `ignorarCache` na LISTAGEM por outro motivo (snapshot do título
 *  tem que ser o estado atual dos lotes) mas nunca lê `protocoloDuplicado`, então
 *  nem chama esta função — ver `comProtocoloDuplicado` em `listarLotes`. */
async function protocolosDuplicados(
  conn: mysql.Connection,
  ignorarCache: boolean,
): Promise<Map<string, number[]>> {
  if (!ignorarCache && cacheProtocolosDuplicados
      && Date.now() - cacheProtocolosDuplicados.ts <= TTL_PADRAO) {
    return cacheProtocolosDuplicados.mapa;
  }
  // TRIM no GROUP BY: sem isso, um protocolo com espaço a mais gravado por engano
  // ("760054" vs " 760054") formaria um grupo à parte da contagem, e o filtro
  // `TRIM(l.Protocolo) IN (...)` de filtroLotes (que usa esta mesma lista) deixaria
  // de bater com o valor cru da coluna.
  //
  // GROUP_CONCAT trunca em 1024 bytes por padrão (group_concat_max_len) — um
  // protocolo com dezenas de lotes no grupo cortaria a lista e faria o próprio
  // IdLote sobrar como "duplicado com" ele mesmo, além de subcontar. A sessão do
  // pool não tem esse limite elevado em nenhum outro lugar, então garante aqui.
  await conn.execute('SET SESSION group_concat_max_len = 1000000');
  // GROUP_CONCAT traz os IdLote do grupo — issue 13 do feedback: o badge de
  // duplicidade precisa apontar QUAIS lotes, não só quantos.
  const [linhas] = await conn.execute<mysql.RowDataPacket[]>(
    `SELECT TRIM(Protocolo) AS Protocolo,
            GROUP_CONCAT(IdLote ORDER BY IdLote) AS Lotes
       FROM fatlote
      WHERE Protocolo IS NOT NULL AND TRIM(Protocolo) <> ''
      GROUP BY TRIM(Protocolo)
     HAVING COUNT(*) > 1`,
    [],
  );
  const mapa = new Map<string, number[]>();
  for (const linha of linhas) {
    const protocolo = texto(linha.Protocolo);
    if (!protocolo || protocoloEhData(protocolo)) continue;
    const lotes = texto(linha.Lotes)?.split(',').map((n) => Number(n)) ?? [];
    mapa.set(protocolo, lotes);
  }
  cacheProtocolosDuplicados = { mapa, ts: Date.now() };
  return mapa;
}

// O termo de busca é sempre bind (`?`), então não há injeção — mas `%` e `_` digitados
// pelo operador continuariam valendo como curinga do LIKE: buscar "%" traria todos os
// lotes e "_" casaria qualquer caractere. O escape usa `!` em vez de `\` para não
// depender do sql_mode do servidor (com NO_BACKSLASH_ESCAPES ligado, `\` é literal).
const ESCAPE_BUSCA = '!';

function escaparLike(termo: string): string {
  return termo.replace(/[!%_]/g, (c) => `${ESCAPE_BUSCA}${c}`);
}

/** Predicado LIKE de busca sobre `expressao`, ignorando acento e caixa. Consome um `?`. */
function like(expressao: string): string {
  return `${expressao} COLLATE utf8mb4_unicode_ci LIKE CONCAT('%', ?, '%') ESCAPE '${ESCAPE_BUSCA}'`;
}

/**
 * Cláusula WHERE + parâmetros comuns à listagem e à contagem.
 * `periodoFim` é inclusivo: `< periodoFim + 1 dia` pega o dia inteiro sem depender de
 * como o DATETIME guarda a hora.
 */
function filtroLotes(
  params: ListarLotesParams,
  protocolosDuplicadosList: string[],
): { where: string; valores: ParametroSql[] } {
  const condicoes: string[] = [];
  const valores: ParametroSql[] = [];

  if (params.idsLote !== undefined && params.idsLote.length > 0) {
    // Math.trunc porque estes entram como bind mas alimentam um IN construído aqui.
    const ids = params.idsLote.map((n) => Math.trunc(n));
    condicoes.push(`l.IdLote IN (${ids.map(() => '?').join(', ')})`);
    valores.push(...ids);
  } else if (params.idLote !== undefined) {
    condicoes.push('l.IdLote = ?');
    valores.push(params.idLote);
  } else {
    condicoes.push('l.DtaCriacao >= ?');
    valores.push(`${params.periodoIni} 00:00:00`);
    condicoes.push('l.DtaCriacao < DATE_ADD(?, INTERVAL 1 DAY)');
    valores.push(`${params.periodoFim} 00:00:00`);
  }
  if (params.statusLote !== undefined) {
    condicoes.push('l.Status = ?');
    valores.push(params.statusLote);
  }
  if (params.somenteProtocoloDuplicado) {
    // Lista vazia = nenhum protocolo duplicado existe agora: `1 = 0` em vez de um
    // `IN ()` vazio, que o mysql2 não aceita como SQL válido.
    if (protocolosDuplicadosList.length === 0) {
      condicoes.push('1 = 0');
    } else {
      condicoes.push(`TRIM(l.Protocolo) IN (${protocolosDuplicadosList.map(() => '?').join(', ')})`);
      valores.push(...protocolosDuplicadosList);
    }
  }
  if (params.busca !== undefined && params.busca.trim() !== '') {
    const termo = escaparLike(params.busca.trim().slice(0, MAX_BUSCA));
    const likeBusca: string[] = [];
    const adiciona = (sql: string): void => {
      likeBusca.push(sql);
      valores.push(termo);
    };

    // Lote e fonte pagadora — a fonte usa EXISTS para funcionar também na COUNT(*), que
    // não tem os LEFT JOINs da listagem.
    adiciona(like('CAST(l.IdLote AS CHAR)'));
    adiciona(`EXISTS (SELECT 1 FROM fatinstituicao fp
                       WHERE fp.IdInstituicao = l.IdFontePagadora AND ${like('fp.NomFantasia')})`);
    adiciona(`EXISTS (SELECT 1 FROM fatinstituicao fp
                       WHERE fp.IdInstituicao = l.IdFontePagadora AND ${like('fp.RazaoSocial')})`);
    // Paciente, código da requisição e guia — todos entram pelo índice de requisicao.Lote,
    // então o LIKE com curinga à esquerda só varre as requisições daquele lote.
    adiciona(`EXISTS (SELECT 1 FROM requisicao r
                       WHERE r.Lote = l.IdLote AND ${like('r.CodRequisicao')})`);
    adiciona(`EXISTS (SELECT 1 FROM requisicao r
                       WHERE r.Lote = l.IdLote AND ${like('r.NumGuiaConvenio')})`);
    adiciona(`EXISTS (SELECT 1 FROM requisicao r
                       JOIN paciente p ON p.CodPaciente = r.CodPaciente
                       WHERE r.Lote = l.IdLote AND ${like('p.NomPaciente')})`);
    adiciona(`EXISTS (SELECT 1 FROM requisicao r
                       JOIN fatrequisicaoautorizacao fra ON fra.IdRequisicao = r.IdRequisicao
                       WHERE r.Lote = l.IdLote AND ${like('fra.NumGuia')})`);
    condicoes.push(`(${likeBusca.join(' OR ')})`);
  }
  return { where: condicoes.join(' AND '), valores };
}

// Valor e contagem de requisições vêm por subconsulta correlacionada, não por JOIN +
// GROUP BY: agrupar o cabeçalho junto de fatrequisicaoprocedimento multiplicaria as
// linhas do LEFT JOIN de fatrps e distorceria as somas. `requisicao.Lote` é indexado,
// e a página de 200 em janela de 12 meses mediu 635ms.
//
// A contagem só considera requisição que tenha procedimento cobrado — é exatamente o
// que detalharLote devolve, então o número da coluna sempre bate com o que aparece ao
// expandir a linha. Existem requisições no lote sem nenhuma linha em
// fatrequisicaoprocedimento (2 em 4.598 em julho/2026); elas valem R$ 0 na cobrança, e
// contá-las faria o lote 6193 anunciar "1 requisição" e abrir vazio.
const SQL_LISTA = `
  SELECT l.IdLote, l.Status, l.IdFontePagadora,
         DATE_FORMAT(l.DtaCriacao,      '%Y-%m-%d') AS DtaCriacao,
         DATE_FORMAT(l.DtaFechamento,   '%Y-%m-%d') AS DtaFechamento,
         DATE_FORMAT(l.DtaEnvio,        '%Y-%m-%d') AS DtaEnvio,
         DATE_FORMAT(l.DtaCancelamento, '%Y-%m-%d') AS DtaCancelamento,
         l.Protocolo,
         fp.NomFantasia, fp.RazaoSocial, fp.CNPJ,
         lab.RazaoSocial AS Prestador,
         rps.NumeroRPS, rps.NFeNumero, rps.NFeCodigoVerificacao,
         DATE_FORMAT(rps.DataVencimento, '%Y-%m-%d') AS DataVencimento,
         (SELECT COUNT(*) FROM requisicao r
           WHERE r.Lote = l.IdLote
             AND EXISTS (SELECT 1 FROM fatrequisicaoprocedimento f
                          WHERE f.IdRequisicao = r.IdRequisicao)) AS QtdRequisicoes,
         (SELECT COALESCE(SUM(frp.ValorLiquido), 0)
            FROM requisicao r
            JOIN fatrequisicaoprocedimento frp ON frp.IdRequisicao = r.IdRequisicao
           WHERE r.Lote = l.IdLote) AS Valor
    FROM fatlote l
    LEFT JOIN fatinstituicao fp  ON fp.IdInstituicao  = l.IdFontePagadora
    LEFT JOIN fatinstituicao lab ON lab.IdInstituicao = l.IdLaboratorio
    LEFT JOIN fatrps rps         ON rps.IdRPS         = l.IdRPS
   WHERE %WHERE%
   ORDER BY l.DtaCriacao DESC, l.IdLote DESC
   LIMIT %LIMIT% OFFSET %OFFSET%`;

function normalizarLote(linha: mysql.RowDataPacket, duplicados: Map<string, number[]>): LoteFaturamento {
  const status = inteiroOuNulo(linha.Status) ?? 0;
  const protocolo = texto(linha.Protocolo);
  const idLote = numero(linha.IdLote);
  // Grupo inteiro (inclui o próprio lote); o campo exposto na resposta é só o
  // resto do grupo — ver `protocoloDuplicadoLotes`.
  const grupo = protocolo ? duplicados.get(protocolo) ?? [] : [];
  const contagemDuplicado = grupo.length;
  const outrosLotes = grupo.filter((id) => id !== idLote);
  return {
    idLote,
    status,
    // Código fora da tabela conhecida ainda tem que renderizar algo legível.
    statusLabel: STLOT_LABELS[status] ?? `Status ${status}`,
    dtaCriacao: dataIso(linha.DtaCriacao),
    dtaFechamento: dataIso(linha.DtaFechamento),
    dtaEnvio: dataIso(linha.DtaEnvio),
    dtaCancelamento: dataIso(linha.DtaCancelamento),
    protocolo,
    protocoloDuplicado: contagemDuplicado > 0,
    protocoloDuplicadoContagem: contagemDuplicado > 0 ? contagemDuplicado : null,
    protocoloDuplicadoLotes: contagemDuplicado > 0 ? outrosLotes : null,
    nfeNumero: texto(linha.NFeNumero),
    nfeCodigoVerificacao: texto(linha.NFeCodigoVerificacao),
    numeroRPS: inteiroOuNulo(linha.NumeroRPS),
    dtaVencimento: dataIso(linha.DataVencimento),
    prestador: texto(linha.Prestador),
    valor: numero(linha.Valor),
    qtdRequisicoes: numero(linha.QtdRequisicoes),
    fontePagadora: {
      id: inteiroOuNulo(linha.IdFontePagadora),
      nome: texto(linha.NomFantasia),
      razaoSocial: texto(linha.RazaoSocial),
      cpfCnpj: texto(linha.CNPJ),
    },
  };
}

/**
 * Fontes pagadoras ativas, para espelhar em `operadoras`.
 *
 * `FontePagadora = 1` separa convênios de laboratórios de apoio e do próprio
 * prestador, que dividem a mesma tabela `fatinstituicao`.
 *
 * Sem cache: roda só no botão de sincronizar, e servir um dado de 3 minutos
 * atrás seria justamente o que o operador está tentando evitar ao clicar.
 */
export async function listarFontesPagadoras(): Promise<FontesPagadorasResultado> {
  return comConexao('listarFontesPagadoras', async (conn) => {
    const [linhas] = await conn.execute<mysql.RowDataPacket[]>(
      `SELECT IdInstituicao, NomFantasia, RazaoSocial, CNPJ
         FROM fatinstituicao
        WHERE FontePagadora = 1 AND COALESCE(Inativo, 0) = 0
        ORDER BY NomFantasia`,
      [],
    );
    return {
      fontes: linhas.map((linha) => ({
        id: numero(linha.IdInstituicao),
        nome: texto(linha.NomFantasia),
        razaoSocial: texto(linha.RazaoSocial),
        cpfCnpj: texto(linha.CNPJ),
      })),
    };
  });
}

/** Lista os lotes de faturamento paginados, já normalizados. */
export async function listarLotes(params: ListarLotesParams): Promise<ListarLotesResultado> {
  const pagina = params.pagina ?? 1;
  const tamanho = params.tamanho ?? TAMANHO_PADRAO;

  // `ignorarCache` não entra em chaveListar de propósito: a releitura tem que
  // sobrescrever a MESMA entrada, senão o "Atualizar" gravaria numa chave paralela e a
  // navegação normal continuaria vendo o dado velho.
  const chave = chaveListar(params);
  const temBusca = Boolean(params.busca?.trim());
  const cacheHit = params.ignorarCache ? null : daCache(cacheLotes, chave, temBusca);
  if (cacheHit) return cacheHit;

  return comConexao('listarLotes', async (conn) => {
    // Só paga o full scan de protocolosDuplicados quando alguém de fato vai usar o
    // resultado — comProtocoloDuplicado (aba Faturas) ou somenteProtocoloDuplicado
    // (que sem o mapa não teria o que filtrar). A criação de título (idsLote) não
    // liga nenhum dos dois: ela só lê idLote/status/valor/guias do snapshot.
    const precisaDuplicados = Boolean(params.comProtocoloDuplicado || params.somenteProtocoloDuplicado);
    const duplicados = precisaDuplicados
      ? await protocolosDuplicados(conn, Boolean(params.ignorarCache))
      : new Map<string, number[]>();
    const { where, valores } = filtroLotes(params, [...duplicados.keys()]);

    // Diferente do apLIS, que saturava o total em 2000: aqui a contagem é exata.
    const [contagem] = await conn.execute<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) AS n FROM fatlote l WHERE ${where}`,
      valores,
    );
    const registros = numero(contagem[0]?.n);

    // LIMIT/OFFSET entram interpolados, não como placeholder: em prepared statement o
    // mysql2 manda os dois como string e o MySQL responde "Incorrect arguments to
    // mysqld_stmt_execute". São inteiros já validados pelo handler, e o Math.trunc
    // fecha a porta de qualquer forma — nenhum texto do cliente chega aqui.
    const limite = Math.trunc(tamanho);
    const deslocamento = Math.trunc((pagina - 1) * tamanho);
    const [linhas] = await conn.execute<mysql.RowDataPacket[]>(
      SQL_LISTA
        .replace('%WHERE%', where)
        .replace('%LIMIT%', String(limite))
        .replace('%OFFSET%', String(deslocamento)),
      valores,
    );

    // Mostra ao operador até quando o backup está atualizado (a réplica atrasa ~1 dia).
    const [recente] = await conn.execute<mysql.RowDataPacket[]>(
      `SELECT DATE_FORMAT(MAX(DtaCriacao), '%Y-%m-%d') AS mx FROM fatlote`,
      [],
    );

    return {
      lotes: linhas.map((linha) => normalizarLote(linha, duplicados)),
      meta: {
        pagina,
        tamanho,
        qtdPaginas: tamanho > 0 ? Math.ceil(registros / tamanho) : 0,
        registros,
        dadoAte: dataIso(recente[0]?.mx),
      },
    };
  }).then((resultado) => {
    if (!('erro' in resultado)) doCache(cacheLotes, chave, resultado);
    return resultado;
  });
}

// Uma consulta só, achatada (requisição × procedimento), agrupada em memória: são
// dezenas de linhas por lote (o maior lote de julho deu 50) e duas viagens ao túnel
// custariam mais que o agrupamento.
//
// O caminho do código do procedimento é
// fatrequisicaoprocedimento → fatconvenioprocedimento → fattabelaprocedimento, ou
// seja, a descrição vem da tabela de preço do convênio daquela requisição.
//
// A guia autorizada vem por SUBCONSULTA, não por JOIN: em
// fatrequisicaoautorizacao o IdRequisicaoProcedimento é índice não-único e nulável
// (schema-backup-banco.csv), ou seja, o banco permite N autorizações por procedimento.
// Com LEFT JOIN cada autorização extra duplicaria a linha e o `req.valor` somaria o
// mesmo ValorLiquido duas vezes — a requisição apareceria valendo mais do que vale.
// O COALESCE ainda cobre o outro lado da mesma coluna: quando a autorização é da
// requisição inteira (IdRequisicaoProcedimento NULL) o JOIN por procedimento não
// achava nada e a guia sumia da tela mesmo existindo no banco.
const SQL_DETALHE = `
  SELECT r.IdRequisicao, r.CodRequisicao,
         DATE_FORMAT(r.DtaSolicitacao, '%Y-%m-%d') AS DtaSolicitacao,
         DATE_FORMAT(r.DtaFinalizacao, '%Y-%m-%d') AS DtaFinalizacao,
         r.NumGuiaConvenio, p.NomPaciente,
         tp.Codigo, tp.Descricao,
         frp.Quantidade, frp.ValorUnitario, frp.ValorLiquido,
         frp.ValorRecebido, DATE_FORMAT(frp.DtaRecebido, '%Y-%m-%d') AS DtaRecebido,
         frp.DesMotivoGlosa, fmg.Descricao AS MotivoGlosaDescricao,
         r.CodEventoFatur, ef.DesEvento AS DesEventoFatur,
         COALESCE(
           (SELECT fra.NumGuia FROM fatrequisicaoautorizacao fra
             WHERE fra.IdRequisicaoProcedimento = frp.IdRequisicaoProcedimento
               AND COALESCE(fra.NumGuia, '') <> ''
             ORDER BY fra.DtaAutorizacao DESC, fra.IdRequisicaoAutorizacao DESC
             LIMIT 1),
           (SELECT fra.NumGuia FROM fatrequisicaoautorizacao fra
             WHERE fra.IdRequisicao = r.IdRequisicao
               AND fra.IdRequisicaoProcedimento IS NULL
               AND COALESCE(fra.NumGuia, '') <> ''
             ORDER BY fra.DtaAutorizacao DESC, fra.IdRequisicaoAutorizacao DESC
             LIMIT 1)
         ) AS NumGuia
    FROM requisicao r
    LEFT JOIN paciente p ON p.CodPaciente = r.CodPaciente
    JOIN fatrequisicaoprocedimento frp ON frp.IdRequisicao = r.IdRequisicao
    LEFT JOIN fatconvenioprocedimento cp ON cp.IdConvenioProcedimento = frp.IdConvenioProcedimento
    LEFT JOIN fattabelaprocedimento tp ON tp.IdTabelaProcedimento = cp.IdTabelaProcedimento
    LEFT JOIN eventofatur ef ON ef.CodEvento = r.CodEventoFatur
    LEFT JOIN fatmotivoglosa fmg ON fmg.IdMotivoGlosa = frp.IdMotivoGlosa
   WHERE r.Lote = ?
   ORDER BY r.CodRequisicao, tp.Codigo`;

function novaRequisicaoLote(linha: mysql.RowDataPacket): RequisicaoLote {
  return {
    idRequisicao: numero(linha.IdRequisicao),
    codRequisicao: texto(linha.CodRequisicao),
    dtaSolicitacao: dataIso(linha.DtaSolicitacao),
    dtaFinalizacao: dataIso(linha.DtaFinalizacao),
    numGuiaConvenio: texto(linha.NumGuiaConvenio),
    paciente: texto(linha.NomPaciente),
    valor: 0,
    procedimentos: [],
    codEventoFatur: inteiroOuNulo(linha.CodEventoFatur),
    eventoFaturLabel: texto(linha.DesEventoFatur),
    pendente: false,
    valorPendente: 0,
  };
}

/** Pendente = ValorRecebido < ValorLiquido (issue 09: inclui glosa integral, VR = 0).
 *  `valorPendente` é `valorLiquido - valorRecebido`, nunca negativo. Exportada pura
 *  para teste direto, sem precisar de uma linha de mysql2 ou conexão de banco. */
export function calcularPendenciaProcedimento(
  valorLiquido: number,
  valorRecebido: number,
): { pendente: boolean; valorPendente: number } {
  const pendente = valorRecebido < valorLiquido;
  const valorPendente = pendente ? Math.round((valorLiquido - valorRecebido) * 100) / 100 : 0;
  return { pendente, valorPendente };
}

/** Acumula um procedimento (linha de SQL_DETALHE) na requisição, mutando `req`. */
function acumularProcedimento(req: RequisicaoLote, linha: mysql.RowDataPacket): void {
  const valor = numero(linha.ValorLiquido);
  // `numero()` trata NULL como 0 — aqui isso funde dois estados do apLIS (ValorRecebido
  // ainda NULL, operadora não retornou; e ValorRecebido = 0, glosa integral já
  // retornada). Não dá pra distinguir sem outra coluna, e a regra da issue 09 quer os
  // dois como pendente mesmo: nenhum dos dois é dinheiro recebido.
  const valorRecebido = numero(linha.ValorRecebido);
  const { pendente, valorPendente } = calcularPendenciaProcedimento(valor, valorRecebido);

  // Somar em ponto flutuante vaza resíduo (404,84 + 46,13 = 450.96999999999997) e
  // o contrato da rota não deve carregar isso; o total do lote não passa por aqui,
  // vem somado pelo DECIMAL do MySQL.
  req.valor = Math.round((req.valor + valor) * 100) / 100;
  if (pendente) {
    req.pendente = true;
    req.valorPendente = Math.round((req.valorPendente + valorPendente) * 100) / 100;
  }
  req.procedimentos.push({
    codigo: texto(linha.Codigo),
    descricao: texto(linha.Descricao),
    quantidade: numero(linha.Quantidade),
    valorUnitario: numero(linha.ValorUnitario),
    valor,
    numGuia: texto(linha.NumGuia),
    motivoGlosa: texto(linha.DesMotivoGlosa),
    motivoGlosaDescricao: texto(linha.MotivoGlosaDescricao),
    valorRecebido,
    dtaRecebido: dataIso(linha.DtaRecebido),
    pendente,
    valorPendente,
  });
}

export type DetalharVariosResultado =
  | { porLote: Record<number, RequisicaoLote[]> }
  | { erro: { status: number; mensagem: string } };

/**
 * Mesmo detalhe de `detalharLote`, para vários lotes numa conexão só.
 *
 * A criação de um título precisa das guias de todos os lotes selecionados; com
 * `detalharLote` num laço seriam N conexões ao túnel, cada uma pagando o
 * handshake. Aqui é uma consulta só.
 *
 * Não usa nem grava o cache: o snapshot do título tem que ser o estado do banco
 * agora, não o de até 3 minutos atrás.
 */
export async function detalharVariosLotes(idsLote: number[]): Promise<DetalharVariosResultado> {
  const ids = idsLote.map((n) => Math.trunc(n));
  if (ids.length === 0) return { porLote: {} };

  return comConexao('detalharVariosLotes', async (conn) => {
    const [linhas] = await conn.execute<mysql.RowDataPacket[]>(
      SQL_DETALHE.replace('WHERE r.Lote = ?', `WHERE r.Lote IN (${ids.map(() => '?').join(', ')})`)
        .replace('SELECT r.IdRequisicao,', 'SELECT r.Lote, r.IdRequisicao,'),
      ids,
    );

    const porLote: Record<number, RequisicaoLote[]> = {};
    const porRequisicao = new Map<number, RequisicaoLote>();
    for (const linha of linhas) {
      const idLote = numero(linha.Lote);
      const idRequisicao = numero(linha.IdRequisicao);
      let req = porRequisicao.get(idRequisicao);
      if (!req) {
        req = novaRequisicaoLote(linha);
        porRequisicao.set(idRequisicao, req);
        (porLote[idLote] ??= []).push(req);
      }
      acumularProcedimento(req, linha);
    }

    return { porLote };
  });
}

/** Requisições de um lote, cada uma com seus procedimentos cobrados. */
export async function detalharLote(
  idLote: number,
  ignorarCache = false,
): Promise<DetalharLoteResultado> {
  const chave = `detalhe|${idLote}`;
  const cacheHit = ignorarCache ? null : daCache(cacheDetalhe, chave, false);
  if (cacheHit) return cacheHit;

  return comConexao('detalharLote', async (conn) => {
    const [linhas] = await conn.execute<mysql.RowDataPacket[]>(SQL_DETALHE, [idLote]);

    const porRequisicao = new Map<number, RequisicaoLote>();
    for (const linha of linhas) {
      const idRequisicao = numero(linha.IdRequisicao);
      let req = porRequisicao.get(idRequisicao);
      if (!req) {
        req = novaRequisicaoLote(linha);
        porRequisicao.set(idRequisicao, req);
      }
      acumularProcedimento(req, linha);
    }

    return { requisicoes: [...porRequisicao.values()] };
  }).then((resultado) => {
    if (!('erro' in resultado)) doCache(cacheDetalhe, chave, resultado);
    return resultado;
  });
}

// ============================================================================
// PENDÊNCIAS — lotes sem NF/RPS fora da janela normal (aba "Pendências")
// ============================================================================
// Regra decidida com o financeiro: lote em status ativo (1 Em Processamento, 2
// Conciliação, 3 Faturado, 6 Exportado TOTVS, 7 Recebido - parcial), sem NF/RPS
// vinculado (`fatlote.IdRPS` nulo), criado até o fim do mês retrasado (M-2) — os
// dois meses mais recentes ainda estão no fluxo normal de fechamento e não são
// pendência. Cancelado (5) e Prejuízo (8) nunca entram: não vão gerar NF.
//
// NÃO inclui Recebido (4), mesmo sem IdRPS. Achado do levantamento (ago/2026, ver
// docs/plans/faturamento/pendencias-nao-faturadas-design.md): 3.188 lotes
// "Recebidos" sem IdRPS, distribuídos de forma constante desde dez/2020 até hoje —
// não é um lote de migração isolado. Lotes "Recebidos" COM IdRPS, ao contrário, só
// aparecem a partir de out/2025. A leitura é que a nota fiscal desses lotes mais
// antigos foi emitida FORA do apLIS e nunca foi religada ao lote: o pagamento já
// aconteceu, só falta o vínculo — não é uma pendência de cobrança.
//
// O cutoff (fim de M-2) é calculado no PRÓPRIO MySQL a partir de CURDATE(), pelo
// mesmo motivo do DATE_FORMAT no resto do arquivo: calcular em Date do Node
// puxaria o fuso do processo (UTC no Vercel, America/Sao_Paulo em dev), e um
// request na virada do mês poderia decidir um cutoff diferente dependendo de onde
// rodou.

export interface LotePendencia {
  idLote: number;
  status: number;
  statusLabel: string;
  dtaCriacao: string | null;
  valor: number;
  qtdRequisicoes: number;
  fontePagadora: { id: number | null; nome: string | null; razaoSocial: string | null };
}

export interface PendenciasMeta {
  pagina: number;
  tamanho: number;
  qtdPaginas: number;
  registros: number;
  /** Soma do valor de TODOS os lotes que casam o filtro, não só a página atual —
   *  é o número que o widget-resumo do Dashboard mostra. */
  valorTotal: number;
  /** Fim de M-2 — data de corte da regra, calculada no MySQL a partir de CURDATE(). */
  cutoff: string;
}

export interface ListarLotesPendentesParams {
  /** YYYY-MM-DD — limite inferior opcional. */
  desde?: string;
  /** YYYY-MM-DD — limite superior opcional; nunca ESTENDE o cutoff de M-2, só pode
   *  encurtar a janela (ver `ateEfetivo` em `listarLotesPendentes`). */
  ate?: string;
  operadoraId?: number;
  pagina?: number;
  tamanho?: number;
  ignorarCache?: boolean;
}

export type ListarLotesPendentesResultado =
  | { lotes: LotePendencia[]; meta: PendenciasMeta }
  | { erro: { status: number; mensagem: string } };

// Códigos STLOT que ainda podem virar uma NF — ver a nota da regra acima.
const STATUS_PENDENCIA = [1, 2, 3, 6, 7];

const cachePendencias = new Map<string, EntradaCache<ListarLotesPendentesResultado>>();

function chavePendencias(params: ListarLotesPendentesParams): string {
  return `pendencias|${params.desde ?? ''}|${params.ate ?? ''}|${params.operadoraId ?? ''}|${params.pagina ?? ''}|${params.tamanho ?? ''}`;
}

function normalizarLotePendencia(linha: mysql.RowDataPacket): LotePendencia {
  const status = inteiroOuNulo(linha.Status) ?? 0;
  return {
    idLote: numero(linha.IdLote),
    status,
    statusLabel: STLOT_LABELS[status] ?? `Status ${status}`,
    dtaCriacao: dataIso(linha.DtaCriacao),
    valor: numero(linha.Valor),
    qtdRequisicoes: numero(linha.QtdRequisicoes),
    fontePagadora: {
      id: inteiroOuNulo(linha.IdFontePagadora),
      nome: texto(linha.NomFantasia),
      razaoSocial: texto(linha.RazaoSocial),
    },
  };
}

/** Lotes pendentes (sem NF/RPS, fora da janela normal), paginados. Mais antigo
 *  primeiro — é o que o financeiro precisa resolver com mais urgência. */
export async function listarLotesPendentes(
  params: ListarLotesPendentesParams,
): Promise<ListarLotesPendentesResultado> {
  const pagina = params.pagina ?? 1;
  const tamanho = params.tamanho ?? TAMANHO_PADRAO;

  const chave = chavePendencias(params);
  const cacheHit = params.ignorarCache ? null : daCache(cachePendencias, chave, false);
  if (cacheHit) return cacheHit;

  return comConexao('listarLotesPendentes', async (conn) => {
    const [cutoffLinhas] = await conn.execute<mysql.RowDataPacket[]>(
      `SELECT DATE_FORMAT(LAST_DAY(CURDATE() - INTERVAL 2 MONTH), '%Y-%m-%d') AS cutoff`,
      [],
    );
    const cutoff = String(cutoffLinhas[0]?.cutoff);
    // `ate` do cliente só pode ENCURTAR a janela, nunca estendê-la além do cutoff.
    const ateEfetivo = params.ate && params.ate < cutoff ? params.ate : cutoff;

    const condicoes = [
      'l.IdRPS IS NULL',
      `l.Status IN (${STATUS_PENDENCIA.join(', ')})`,
      'l.DtaCriacao < DATE_ADD(?, INTERVAL 1 DAY)',
    ];
    const valores: ParametroSql[] = [ateEfetivo];
    if (params.desde) {
      condicoes.push('l.DtaCriacao >= ?');
      valores.push(`${params.desde} 00:00:00`);
    }
    if (params.operadoraId !== undefined) {
      condicoes.push('l.IdFontePagadora = ?');
      valores.push(params.operadoraId);
    }
    const where = condicoes.join(' AND ');

    // O total (sem LIMIT — o widget-resumo do Dashboard precisa da pendência
    // inteira, não só da página exibida na tabela) soma por LEFT JOIN + GROUP BY
    // num único passe, em vez de uma subconsulta correlacionada reexecutada por
    // lote: com milhares de lotes pendentes essa é a diferença entre uma consulta
    // e milhares delas a cada carregamento do Dashboard.
    const [contagem] = await conn.execute<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) AS n, COALESCE(SUM(t.ValorLote), 0) AS ValorTotal
         FROM (
           SELECT l.IdLote, COALESCE(SUM(frp.ValorLiquido), 0) AS ValorLote
             FROM fatlote l
             LEFT JOIN requisicao r ON r.Lote = l.IdLote
             LEFT JOIN fatrequisicaoprocedimento frp ON frp.IdRequisicao = r.IdRequisicao
            WHERE ${where}
            GROUP BY l.IdLote
         ) t`,
      valores,
    );
    const registros = numero(contagem[0]?.n);
    const valorTotal = numero(contagem[0]?.ValorTotal);

    const limite = Math.trunc(tamanho);
    const deslocamento = Math.trunc((pagina - 1) * tamanho);
    const [linhas] = await conn.execute<mysql.RowDataPacket[]>(
      `SELECT l.IdLote, l.Status, l.IdFontePagadora,
              DATE_FORMAT(l.DtaCriacao, '%Y-%m-%d') AS DtaCriacao,
              fp.NomFantasia, fp.RazaoSocial,
              (SELECT COUNT(*) FROM requisicao r
                WHERE r.Lote = l.IdLote
                  AND EXISTS (SELECT 1 FROM fatrequisicaoprocedimento f WHERE f.IdRequisicao = r.IdRequisicao)) AS QtdRequisicoes,
              (SELECT COALESCE(SUM(frp.ValorLiquido), 0)
                 FROM requisicao r
                 JOIN fatrequisicaoprocedimento frp ON frp.IdRequisicao = r.IdRequisicao
                WHERE r.Lote = l.IdLote) AS Valor
         FROM fatlote l
         LEFT JOIN fatinstituicao fp ON fp.IdInstituicao = l.IdFontePagadora
        WHERE ${where}
        ORDER BY l.DtaCriacao ASC, l.IdLote ASC
        LIMIT ${limite} OFFSET ${deslocamento}`,
      valores,
    );

    return {
      lotes: linhas.map(normalizarLotePendencia),
      meta: {
        pagina,
        tamanho,
        qtdPaginas: tamanho > 0 ? Math.ceil(registros / tamanho) : 0,
        registros,
        valorTotal,
        cutoff,
      },
    };
  }).then((resultado) => {
    if (!('erro' in resultado)) doCache(cachePendencias, chave, resultado);
    return resultado;
  });
}

export interface RequisicaoPendencia {
  idRequisicao: number;
  codRequisicao: string | null;
  dtaSolicitacao: string | null;
  dtaFinalizacao: string | null;
  numGuiaConvenio: string | null;
  paciente: string | null;
  valor: number;
  /** Só preenchido no raro caso (~1,6% dos lotes pendentes, ver design doc) em que
   *  a requisição já tem RPS/NF individual lançado em fatrpsrequisicao/fatrps,
   *  mesmo o LOTE não tendo (fatlote.IdRPS nulo) — sinal pro operador conferir
   *  antes de cobrar de novo. */
  numeroRPS: number | null;
  nfeNumero: string | null;
}

export type DetalharLotePendenciaResultado =
  | { requisicoes: RequisicaoPendencia[] }
  | { erro: { status: number; mensagem: string } };

const cacheDetalhePendencia = new Map<string, EntradaCache<DetalharLotePendenciaResultado>>();

// `r.Lote = ? AND EXISTS (...)` repete o filtro de QtdRequisicoes em
// listarLotesPendentes de propósito: sem ele, uma requisição sem nenhuma linha em
// fatrequisicaoprocedimento apareceria aqui mas não entraria na contagem da
// listagem, e o número da coluna "Requisições" divergiria do que a expansão
// mostra — o mesmo cuidado que o comentário de SQL_LISTA (acima) já documenta
// para a aba Faturas.
//
// `rps.DataCancelamento IS NULL` nas duas subconsultas de NF/RPS: um RPS
// cancelado não pode virar sinal de "já foi cobrado" — mostraria a badge verde
// numa requisição que ainda precisa ser faturada.
const SQL_DETALHE_PENDENCIA = `
  SELECT r.IdRequisicao, r.CodRequisicao,
         DATE_FORMAT(r.DtaSolicitacao, '%Y-%m-%d') AS DtaSolicitacao,
         DATE_FORMAT(r.DtaFinalizacao, '%Y-%m-%d') AS DtaFinalizacao,
         r.NumGuiaConvenio, p.NomPaciente,
         COALESCE((SELECT SUM(frp.ValorLiquido) FROM fatrequisicaoprocedimento frp
                    WHERE frp.IdRequisicao = r.IdRequisicao), 0) AS Valor,
         (SELECT rps.NumeroRPS FROM fatrpsrequisicao frr JOIN fatrps rps ON rps.IdRPS = frr.IdRps
           WHERE frr.IdRequisicao = r.IdRequisicao AND rps.DataCancelamento IS NULL
           ORDER BY rps.DataEmissao DESC LIMIT 1) AS NumeroRPS,
         (SELECT rps.NFeNumero FROM fatrpsrequisicao frr JOIN fatrps rps ON rps.IdRPS = frr.IdRps
           WHERE frr.IdRequisicao = r.IdRequisicao AND rps.DataCancelamento IS NULL
           ORDER BY rps.DataEmissao DESC LIMIT 1) AS NFeNumero
    FROM requisicao r
    LEFT JOIN paciente p ON p.CodPaciente = r.CodPaciente
   WHERE r.Lote = ?
     AND EXISTS (SELECT 1 FROM fatrequisicaoprocedimento f WHERE f.IdRequisicao = r.IdRequisicao)
   ORDER BY r.CodRequisicao`;

/** Requisições de um lote pendente, com a situação de NF individual quando existe
 *  (ver `RequisicaoPendencia.numeroRPS`/`nfeNumero`). Rota própria, separada de
 *  `detalharLote`: essa consulta não precisa dos procedimentos por requisição
 *  (só o total), e evita colocar 2 subconsultas novas na rota de Faturas, que já é
 *  usada por outras telas e tem seu tempo medido. */
export async function detalharLotePendencia(
  idLote: number,
  ignorarCache = false,
): Promise<DetalharLotePendenciaResultado> {
  const chave = `detalhePendencia|${idLote}`;
  const cacheHit = ignorarCache ? null : daCache(cacheDetalhePendencia, chave, false);
  if (cacheHit) return cacheHit;

  return comConexao('detalharLotePendencia', async (conn) => {
    const [linhas] = await conn.execute<mysql.RowDataPacket[]>(SQL_DETALHE_PENDENCIA, [idLote]);
    const requisicoes: RequisicaoPendencia[] = linhas.map((linha) => ({
      idRequisicao: numero(linha.IdRequisicao),
      codRequisicao: texto(linha.CodRequisicao),
      dtaSolicitacao: dataIso(linha.DtaSolicitacao),
      dtaFinalizacao: dataIso(linha.DtaFinalizacao),
      numGuiaConvenio: texto(linha.NumGuiaConvenio),
      paciente: texto(linha.NomPaciente),
      valor: numero(linha.Valor),
      numeroRPS: inteiroOuNulo(linha.NumeroRPS),
      nfeNumero: texto(linha.NFeNumero),
    }));
    return { requisicoes };
  }).then((resultado) => {
    if (!('erro' in resultado)) doCache(cacheDetalhePendencia, chave, resultado);
    return resultado;
  });
}

// ============================================================================
// PENDÊNCIAS — PARTICULARES (aba Contas a Receber → Pendências → Particulares)
// ============================================================================
// Espelha a subtab "recebido" da planilha do setor (issue 08 do feedback):
// requisições da fonte pagadora PARTICULAR com laudo já liberado ao cliente e
// sem NF emitida. Diferente de `listarLotesPendentes` acima, a unidade aqui é a
// REQUISIÇÃO, não o lote — a maioria dos particulares (verificado: ~60% do
// recorte "evento liberado") nunca chega a entrar num `fatlote` (pagamento é
// direto no balcão), então esperar por um lote sem IdRPS deixaria de fora
// justamente o caso mais comum.
//
// Fonte pagadora: só 1102 (PARTICULAR, ativa). A 101 é a mesma razão social mas
// está INATIVA no apLIS (fatinstituicao.Inativo = 1) — confirmado no banco real,
// não é erro de digitação, são dois IDs legítimos; a regra do grilling fixou 1102.
export const ID_FONTE_PAGADORA_PARTICULAR = 1102;

// "Laudo liberado" = requisicao.CodEvento num destes códigos (tabela `evento`),
// regra da subtab "recebido" que o setor já usa hoje. Referência de contexto:
// evento 1040 "Requisição para pagamento no particular" (rótulo com typo no
// banco: "Requsição") não entra aqui — é o evento SEGUINTE, que o setor lança
// manualmente depois de cobrar; não faz sentido como filtro de pendência.
const EVENTOS_LAUDO_LIBERADO_PARTICULAR = [11, 56, 16, 1000, 9, 19];

export interface RequisicaoParticularPendencia {
  idRequisicao: number;
  codRequisicao: string | null;
  dtaSolicitacao: string | null;
  dtaFinalizacao: string | null;
  paciente: string | null;
  valor: number;
  codEvento: number;
  eventoLabel: string | null;
  /** Lote do apLIS, quando a requisição chegou a entrar num — a maioria não entra. */
  idLote: number | null;
}

export interface ListarParticularesPendentesParams {
  /** YYYY-MM-DD — sobre DtaSolicitacao. */
  desde?: string;
  ate?: string;
  pagina?: number;
  tamanho?: number;
  ignorarCache?: boolean;
}

export interface ParticularesPendentesMeta {
  pagina: number;
  tamanho: number;
  qtdPaginas: number;
  registros: number;
  /** Soma do valor de TODAS as requisições que casam o filtro, não só a página
   *  atual — é o número que o widget-resumo do Dashboard mostra. */
  valorTotal: number;
}

export type ListarParticularesPendentesResultado =
  | { requisicoes: RequisicaoParticularPendencia[]; meta: ParticularesPendentesMeta }
  | { erro: { status: number; mensagem: string } };

const cacheParticularesPendentes = new Map<string, EntradaCache<ListarParticularesPendentesResultado>>();

function chaveParticularesPendentes(params: ListarParticularesPendentesParams): string {
  return `particularesPendentes|${params.desde ?? ''}|${params.ate ?? ''}|${params.pagina ?? ''}|${params.tamanho ?? ''}`;
}

// `r.Lote IS NULL OR (l.IdRPS IS NULL AND l.Status IN STATUS_PENDENCIA)` cobre os
// dois formatos de "sem NF" do particular: nunca entrou em lote, ou entrou mas o
// lote não tem RPS/NF ainda E ainda está num status que pode virar NF. O filtro de
// status é o MESMO `STATUS_PENDENCIA` de `listarLotesPendentes` acima, pelo mesmo
// motivo: verificado no banco que 344 dos 756 particulares que entram em lote têm
// lote Status=4 (Recebido) sem IdRPS — é o achado do design doc de
// `listarLotesPendentes` (NF emitida fora do apLIS, nunca religada), não uma
// pendência real. Sem esse filtro, lote Recebido/Cancelado/Prejuízo entraria
// como falso positivo.
//
// O `NOT EXISTS` cobre o caso raro (ver design doc de `listarLotesPendentes`) de
// a requisição já ter um RPS/NFe individual lançado fora do fluxo de lote —
// `rps.DataCancelamento IS NULL` porque um RPS cancelado não é "já cobrado".
const SQL_PARTICULARES_PENDENTES_WHERE = `
  r.IdFontePagadora = ${ID_FONTE_PAGADORA_PARTICULAR}
  AND r.CodEvento IN (${EVENTOS_LAUDO_LIBERADO_PARTICULAR.join(', ')})
  AND (r.Lote IS NULL OR (l.IdRPS IS NULL AND l.Status IN (${STATUS_PENDENCIA.join(', ')})))
  AND EXISTS (SELECT 1 FROM fatrequisicaoprocedimento f WHERE f.IdRequisicao = r.IdRequisicao)
  AND NOT EXISTS (
    SELECT 1 FROM fatrpsrequisicao frr JOIN fatrps rps ON rps.IdRPS = frr.IdRps
    WHERE frr.IdRequisicao = r.IdRequisicao AND rps.DataCancelamento IS NULL
  )`;

function normalizarParticularPendencia(linha: mysql.RowDataPacket): RequisicaoParticularPendencia {
  return {
    idRequisicao: numero(linha.IdRequisicao),
    codRequisicao: texto(linha.CodRequisicao),
    dtaSolicitacao: dataIso(linha.DtaSolicitacao),
    dtaFinalizacao: dataIso(linha.DtaFinalizacao),
    paciente: texto(linha.NomPaciente),
    valor: numero(linha.Valor),
    codEvento: numero(linha.CodEvento),
    eventoLabel: texto(linha.DesEvento),
    idLote: inteiroOuNulo(linha.Lote),
  };
}

/** Requisições particulares com laudo liberado e sem NF, paginadas. Mais antiga
 *  primeiro — é a que está esperando cobrança há mais tempo. */
export async function listarParticularesPendentes(
  params: ListarParticularesPendentesParams,
): Promise<ListarParticularesPendentesResultado> {
  const pagina = params.pagina ?? 1;
  const tamanho = params.tamanho ?? TAMANHO_PADRAO;

  const chave = chaveParticularesPendentes(params);
  const cacheHit = params.ignorarCache ? null : daCache(cacheParticularesPendentes, chave, false);
  if (cacheHit) return cacheHit;

  return comConexao('listarParticularesPendentes', async (conn) => {
    const condicoes = [SQL_PARTICULARES_PENDENTES_WHERE];
    const valores: ParametroSql[] = [];
    if (params.desde) {
      condicoes.push('r.DtaSolicitacao >= ?');
      valores.push(`${params.desde} 00:00:00`);
    }
    if (params.ate) {
      condicoes.push('r.DtaSolicitacao < DATE_ADD(?, INTERVAL 1 DAY)');
      valores.push(`${params.ate} 00:00:00`);
    }
    const where = condicoes.join(' AND ');

    // Mesma troca de subconsulta correlacionada por LEFT JOIN + GROUP BY de
    // listarLotesPendentes acima, e pelo mesmo motivo: o total ignora LIMIT.
    const [contagem] = await conn.execute<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) AS n, COALESCE(SUM(t.ValorReq), 0) AS ValorTotal
         FROM (
           SELECT r.IdRequisicao, COALESCE(SUM(frp.ValorLiquido), 0) AS ValorReq
             FROM requisicao r
             LEFT JOIN fatlote l ON l.IdLote = r.Lote
             LEFT JOIN fatrequisicaoprocedimento frp ON frp.IdRequisicao = r.IdRequisicao
            WHERE ${where}
            GROUP BY r.IdRequisicao
         ) t`,
      valores,
    );
    const registros = numero(contagem[0]?.n);
    const valorTotal = numero(contagem[0]?.ValorTotal);

    const limite = Math.trunc(tamanho);
    const deslocamento = Math.trunc((pagina - 1) * tamanho);
    const [linhas] = await conn.execute<mysql.RowDataPacket[]>(
      `SELECT r.IdRequisicao, r.CodRequisicao,
              DATE_FORMAT(r.DtaSolicitacao, '%Y-%m-%d') AS DtaSolicitacao,
              DATE_FORMAT(r.DtaFinalizacao, '%Y-%m-%d') AS DtaFinalizacao,
              p.NomPaciente, r.CodEvento, ev.DesEvento, r.Lote,
              COALESCE((SELECT SUM(frp.ValorLiquido) FROM fatrequisicaoprocedimento frp
                         WHERE frp.IdRequisicao = r.IdRequisicao), 0) AS Valor
         FROM requisicao r
         LEFT JOIN fatlote l ON l.IdLote = r.Lote
         LEFT JOIN paciente p ON p.CodPaciente = r.CodPaciente
         LEFT JOIN evento ev ON ev.CodEvento = r.CodEvento
        WHERE ${where}
        ORDER BY r.DtaSolicitacao ASC, r.IdRequisicao ASC
        LIMIT ${limite} OFFSET ${deslocamento}`,
      valores,
    );

    return {
      requisicoes: linhas.map(normalizarParticularPendencia),
      meta: {
        pagina,
        tamanho,
        qtdPaginas: tamanho > 0 ? Math.ceil(registros / tamanho) : 0,
        registros,
        valorTotal,
      },
    };
  }).then((resultado) => {
    if (!('erro' in resultado)) doCache(cacheParticularesPendentes, chave, resultado);
    return resultado;
  });
}

// ============================================================================
// GLOSAS E RECURSOS — histórico do legado (aba "Histórico (apLIS)")
// ============================================================================
// Leitura ao vivo, mesmo padrão acima: nada é persistido no Supabase.
// Fonte da glosa: fatrequisicaoprocedimento.IdMotivoGlosa (não
// fatdemonstrativoguiaprocedimento — decisão registrada no design doc, a glosa
// lançada só na conciliação do demonstrativo de pagamento não aparece aqui).
// Ver docs/plans/faturamento/glosas-recursos-legado-design.md.

export interface GlosaRequisicaoLegado {
  idRequisicaoProcedimento: number;
  idRequisicao: number;
  codRequisicao: string | null;
  numGuiaConvenio: string | null;
  paciente: string | null;
  dtaSolicitacao: string | null;
  procedimentoCodigo: string | null;
  procedimentoDescricao: string | null;
  valor: number;
  idMotivoGlosa: number | null;
  /** Código oficial do catálogo `fatmotivoglosa` (ex.: código ANS). */
  motivoCodigo: number | null;
  /** Descrição do catálogo — complementar a `desMotivoGlosa`, não redundante:
   *  ver achado da seção 2 do design doc. */
  motivoDescricao: string | null;
  /** Texto lançado na própria requisição, geralmente mais operacional/específico. */
  desMotivoGlosa: string | null;
  fontePagadora: { id: number | null; nome: string | null };
}

export interface ListarGlosasLegadoParams {
  periodoIni: string;
  periodoFim: string;
  fontePagadoraId?: number;
  pagina?: number;
  tamanho?: number;
  busca?: string;
  ignorarCache?: boolean;
}

export type ListarGlosasLegadoResultado =
  | { glosas: GlosaRequisicaoLegado[]; meta: LotesMeta }
  | { erro: { status: number; mensagem: string } };

const cacheGlosasLegado = new Map<string, EntradaCache<ListarGlosasLegadoResultado>>();

function chaveGlosasLegado(params: ListarGlosasLegadoParams): string {
  return `glosasLegado|${params.periodoIni}|${params.periodoFim}|${params.fontePagadoraId ?? ''}|${params.pagina ?? ''}|${params.tamanho ?? ''}|${params.busca ?? ''}`;
}

/** Mesmo raciocínio de `filtroLotes`: sem EXISTS aqui porque paciente/fonte pagadora
 *  já entram por LEFT JOIN 1:1 (um CodPaciente/IdFontePagadora só casa uma linha),
 *  diferente de fatlote onde a busca precisa varrer requisições por fora. */
function filtroGlosasLegado(
  params: ListarGlosasLegadoParams,
): { where: string; valores: ParametroSql[] } {
  const condicoes: string[] = ['frp.IdMotivoGlosa IS NOT NULL'];
  const valores: ParametroSql[] = [];

  condicoes.push('r.DtaSolicitacao >= ?');
  valores.push(`${params.periodoIni} 00:00:00`);
  condicoes.push('r.DtaSolicitacao < DATE_ADD(?, INTERVAL 1 DAY)');
  valores.push(`${params.periodoFim} 00:00:00`);

  if (params.fontePagadoraId !== undefined) {
    condicoes.push('r.IdFontePagadora = ?');
    valores.push(params.fontePagadoraId);
  }
  if (params.busca !== undefined && params.busca.trim() !== '') {
    const termo = escaparLike(params.busca.trim().slice(0, MAX_BUSCA));
    // Mesmas colunas exibidas na tabela do Histórico — fonte pagadora, procedimento e
    // motivo entram aqui porque cp/tp/fmg/fi já são LEFT JOIN 1:1 (ver comentário acima
    // da função), tanto na listagem quanto na contagem.
    const likeBusca = [
      like('p.NomPaciente'),
      like('r.CodRequisicao'),
      like('r.NumGuiaConvenio'),
      like('fi.NomFantasia'),
      like('fi.RazaoSocial'),
      like('tp.Codigo'),
      like('tp.Descricao'),
      like('fmg.Descricao'),
      like('frp.DesMotivoGlosa'),
    ];
    valores.push(...likeBusca.map(() => termo));
    condicoes.push(`(${likeBusca.join(' OR ')})`);
  }

  return { where: condicoes.join(' AND '), valores };
}

const SQL_LISTA_GLOSAS_LEGADO = `
  SELECT frp.IdRequisicaoProcedimento, r.IdRequisicao, r.CodRequisicao,
         r.NumGuiaConvenio, p.NomPaciente,
         DATE_FORMAT(r.DtaSolicitacao, '%Y-%m-%d') AS DtaSolicitacao,
         tp.Codigo AS ProcCodigo, tp.Descricao AS ProcDescricao,
         frp.ValorLiquido,
         frp.IdMotivoGlosa, frp.DesMotivoGlosa,
         fmg.Codigo AS MotivoCodigo, fmg.Descricao AS MotivoDescricao,
         r.IdFontePagadora, fi.NomFantasia, fi.RazaoSocial
    FROM requisicao r
    JOIN fatrequisicaoprocedimento frp ON frp.IdRequisicao = r.IdRequisicao
    LEFT JOIN paciente p ON p.CodPaciente = r.CodPaciente
    LEFT JOIN fatconvenioprocedimento cp ON cp.IdConvenioProcedimento = frp.IdConvenioProcedimento
    LEFT JOIN fattabelaprocedimento tp ON tp.IdTabelaProcedimento = cp.IdTabelaProcedimento
    LEFT JOIN fatmotivoglosa fmg ON fmg.IdMotivoGlosa = frp.IdMotivoGlosa
    LEFT JOIN fatinstituicao fi ON fi.IdInstituicao = r.IdFontePagadora
   WHERE %WHERE%
   ORDER BY r.DtaSolicitacao DESC, frp.IdRequisicaoProcedimento DESC
   LIMIT %LIMIT% OFFSET %OFFSET%`;

function normalizarGlosaLegado(linha: mysql.RowDataPacket): GlosaRequisicaoLegado {
  return {
    idRequisicaoProcedimento: numero(linha.IdRequisicaoProcedimento),
    idRequisicao: numero(linha.IdRequisicao),
    codRequisicao: texto(linha.CodRequisicao),
    numGuiaConvenio: texto(linha.NumGuiaConvenio),
    paciente: texto(linha.NomPaciente),
    dtaSolicitacao: dataIso(linha.DtaSolicitacao),
    procedimentoCodigo: texto(linha.ProcCodigo),
    procedimentoDescricao: texto(linha.ProcDescricao),
    valor: numero(linha.ValorLiquido),
    idMotivoGlosa: inteiroOuNulo(linha.IdMotivoGlosa),
    motivoCodigo: inteiroOuNulo(linha.MotivoCodigo),
    motivoDescricao: texto(linha.MotivoDescricao),
    desMotivoGlosa: texto(linha.DesMotivoGlosa),
    fontePagadora: {
      id: inteiroOuNulo(linha.IdFontePagadora),
      nome: texto(linha.NomFantasia) ?? texto(linha.RazaoSocial),
    },
  };
}

/**
 * Glosas do legado (fatrequisicaoprocedimento com IdMotivoGlosa preenchido),
 * paginadas por período. Período obrigatório: sem ele a consulta varreria as
 * 23 mil linhas com motivo de glosa preenchido (ver risco 3 do design doc).
 */
export async function listarGlosasLegado(
  params: ListarGlosasLegadoParams,
): Promise<ListarGlosasLegadoResultado> {
  const pagina = params.pagina ?? 1;
  const tamanho = params.tamanho ?? TAMANHO_PADRAO;
  const { where, valores } = filtroGlosasLegado(params);

  const chave = chaveGlosasLegado(params);
  const temBusca = Boolean(params.busca?.trim());
  const cacheHit = params.ignorarCache ? null : daCache(cacheGlosasLegado, chave, temBusca);
  if (cacheHit) return cacheHit;

  return comConexao('listarGlosasLegado', async (conn) => {
    const [contagem] = await conn.execute<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) AS n
         FROM requisicao r
         JOIN fatrequisicaoprocedimento frp ON frp.IdRequisicao = r.IdRequisicao
         LEFT JOIN paciente p ON p.CodPaciente = r.CodPaciente
         LEFT JOIN fatconvenioprocedimento cp ON cp.IdConvenioProcedimento = frp.IdConvenioProcedimento
         LEFT JOIN fattabelaprocedimento tp ON tp.IdTabelaProcedimento = cp.IdTabelaProcedimento
         LEFT JOIN fatmotivoglosa fmg ON fmg.IdMotivoGlosa = frp.IdMotivoGlosa
         LEFT JOIN fatinstituicao fi ON fi.IdInstituicao = r.IdFontePagadora
        WHERE ${where}`,
      valores,
    );
    const registros = numero(contagem[0]?.n);

    const limite = Math.trunc(tamanho);
    const deslocamento = Math.trunc((pagina - 1) * tamanho);
    const [linhas] = await conn.execute<mysql.RowDataPacket[]>(
      SQL_LISTA_GLOSAS_LEGADO
        .replace('%WHERE%', where)
        .replace('%LIMIT%', String(limite))
        .replace('%OFFSET%', String(deslocamento)),
      valores,
    );

    const [recente] = await conn.execute<mysql.RowDataPacket[]>(
      `SELECT DATE_FORMAT(MAX(DtaSolicitacao), '%Y-%m-%d') AS mx FROM requisicao`,
      [],
    );

    return {
      glosas: linhas.map(normalizarGlosaLegado),
      meta: {
        pagina,
        tamanho,
        qtdPaginas: tamanho > 0 ? Math.ceil(registros / tamanho) : 0,
        registros,
        dadoAte: dataIso(recente[0]?.mx),
      },
    };
  }).then((resultado) => {
    if (!('erro' in resultado)) doCache(cacheGlosasLegado, chave, resultado);
    return resultado;
  });
}

// --- Lotes de recurso (fatloterecurso) — seção própria, sem período obrigatório ---

export interface ProcedimentoRecursoLegado {
  idProcedimento: number;
  idRequisicao: number;
  numGuia: string | null;
  valorRecurso: number;
  idMotivoGlosa: number | null;
  motivoDescricao: string | null;
  justificativa: string | null;
}

/**
 * `statusLabel` não deriva do código cru: não há tabela de label conhecida para
 * `fatloterecurso.Status` (risco 1 do design doc). Deriva das colunas de data.
 */
function statusLabelRecurso(linha: mysql.RowDataPacket): string {
  if (texto(linha.DtaCancelamento)) return 'Cancelado';
  if (texto(linha.DtaFinalizacao)) return 'Finalizado';
  if (texto(linha.DtaEnvio)) return 'Enviado';
  return 'Criado';
}

export interface LoteRecursoLegado {
  idLoteRecurso: number;
  status: number;
  statusLabel: string;
  dtaCriacao: string | null;
  dtaEnvio: string | null;
  dtaFinalizacao: string | null;
  dtaCancelamento: string | null;
  protocolo: string | null;
  protocoloRecursado: string | null;
  fontePagadora: { id: number | null; nome: string | null };
  valorTotal: number;
  qtdProcedimentos: number;
}

export interface ListarRecursosLegadoParams {
  status?: number;
  fontePagadoraId?: number;
  busca?: string;
  pagina?: number;
  tamanho?: number;
  ignorarCache?: boolean;
}

export type ListarRecursosLegadoResultado =
  | { recursos: LoteRecursoLegado[]; meta: LotesMeta }
  | { erro: { status: number; mensagem: string } };

export type DetalharRecursoLegadoResultado =
  | { procedimentos: ProcedimentoRecursoLegado[] }
  | { erro: { status: number; mensagem: string } };

const cacheRecursosLegado = new Map<string, EntradaCache<ListarRecursosLegadoResultado>>();
const cacheDetalheRecurso = new Map<string, EntradaCache<DetalharRecursoLegadoResultado>>();

function chaveRecursosLegado(params: ListarRecursosLegadoParams): string {
  return `recursosLegado|${params.status ?? ''}|${params.fontePagadoraId ?? ''}|${params.pagina ?? ''}|${params.tamanho ?? ''}|${params.busca ?? ''}`;
}

function filtroRecursosLegado(
  params: ListarRecursosLegadoParams,
): { where: string; valores: ParametroSql[] } {
  const condicoes: string[] = ['1=1'];
  const valores: ParametroSql[] = [];

  if (params.status !== undefined) {
    condicoes.push('lr.Status = ?');
    valores.push(params.status);
  }
  if (params.fontePagadoraId !== undefined) {
    condicoes.push('lr.IdFontePagadora = ?');
    valores.push(params.fontePagadoraId);
  }
  if (params.busca !== undefined && params.busca.trim() !== '') {
    const termo = escaparLike(params.busca.trim().slice(0, MAX_BUSCA));
    const likeBusca: string[] = [];
    const adiciona = (sql: string): void => {
      likeBusca.push(sql);
      valores.push(termo);
    };
    adiciona(like('CAST(lr.IdLoteRecurso AS CHAR)'));
    adiciona(like('lr.Protocolo'));
    adiciona(like('lr.ProtocoloRecursado'));
    adiciona(like('fi.NomFantasia'));
    adiciona(like('fi.RazaoSocial'));
    adiciona(`EXISTS (SELECT 1 FROM fatloterecursoprocedimento lrpb
                       WHERE lrpb.IdLoteRecurso = lr.IdLoteRecurso AND ${like('lrpb.NumGuia')})`);
    condicoes.push(`(${likeBusca.join(' OR ')})`);
  }

  return { where: condicoes.join(' AND '), valores };
}

const SQL_LISTA_RECURSOS_LEGADO = `
  SELECT lr.IdLoteRecurso, lr.Status,
         DATE_FORMAT(lr.DtaCriacao,      '%Y-%m-%d') AS DtaCriacao,
         DATE_FORMAT(lr.DtaEnvio,        '%Y-%m-%d') AS DtaEnvio,
         DATE_FORMAT(lr.DtaFinalizacao,  '%Y-%m-%d') AS DtaFinalizacao,
         DATE_FORMAT(lr.DtaCancelamento, '%Y-%m-%d') AS DtaCancelamento,
         lr.Protocolo, lr.ProtocoloRecursado,
         lr.IdFontePagadora, fi.NomFantasia, fi.RazaoSocial,
         (SELECT COUNT(*) FROM fatloterecursoprocedimento lrp
           WHERE lrp.IdLoteRecurso = lr.IdLoteRecurso) AS QtdProcedimentos,
         (SELECT COALESCE(SUM(lrp.VlrRecurso), 0) FROM fatloterecursoprocedimento lrp
           WHERE lrp.IdLoteRecurso = lr.IdLoteRecurso) AS ValorTotal
    FROM fatloterecurso lr
    LEFT JOIN fatinstituicao fi ON fi.IdInstituicao = lr.IdFontePagadora
   WHERE %WHERE%
   ORDER BY lr.DtaCriacao DESC, lr.IdLoteRecurso DESC
   LIMIT %LIMIT% OFFSET %OFFSET%`;

function normalizarRecursoLegado(linha: mysql.RowDataPacket): LoteRecursoLegado {
  const status = inteiroOuNulo(linha.Status) ?? 0;
  return {
    idLoteRecurso: numero(linha.IdLoteRecurso),
    status,
    statusLabel: statusLabelRecurso(linha),
    dtaCriacao: dataIso(linha.DtaCriacao),
    dtaEnvio: dataIso(linha.DtaEnvio),
    dtaFinalizacao: dataIso(linha.DtaFinalizacao),
    dtaCancelamento: dataIso(linha.DtaCancelamento),
    protocolo: texto(linha.Protocolo),
    protocoloRecursado: texto(linha.ProtocoloRecursado),
    fontePagadora: {
      id: inteiroOuNulo(linha.IdFontePagadora),
      nome: texto(linha.NomFantasia) ?? texto(linha.RazaoSocial),
    },
    valorTotal: numero(linha.ValorTotal),
    qtdProcedimentos: numero(linha.QtdProcedimentos),
  };
}

/**
 * Lotes de recurso (fatloterecurso). Só 425 linhas no total (levantamento do
 * design doc) — não precisa de período obrigatório como as glosas.
 */
export async function listarRecursosLegado(
  params: ListarRecursosLegadoParams,
): Promise<ListarRecursosLegadoResultado> {
  const pagina = params.pagina ?? 1;
  const tamanho = params.tamanho ?? TAMANHO_PADRAO;
  const { where, valores } = filtroRecursosLegado(params);

  const chave = chaveRecursosLegado(params);
  const temBusca = Boolean(params.busca?.trim());
  const cacheHit = params.ignorarCache ? null : daCache(cacheRecursosLegado, chave, temBusca);
  if (cacheHit) return cacheHit;

  return comConexao('listarRecursosLegado', async (conn) => {
    const [contagem] = await conn.execute<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) AS n
         FROM fatloterecurso lr
         LEFT JOIN fatinstituicao fi ON fi.IdInstituicao = lr.IdFontePagadora
        WHERE ${where}`,
      valores,
    );
    const registros = numero(contagem[0]?.n);

    const limite = Math.trunc(tamanho);
    const deslocamento = Math.trunc((pagina - 1) * tamanho);
    const [linhas] = await conn.execute<mysql.RowDataPacket[]>(
      SQL_LISTA_RECURSOS_LEGADO
        .replace('%WHERE%', where)
        .replace('%LIMIT%', String(limite))
        .replace('%OFFSET%', String(deslocamento)),
      valores,
    );

    const [recente] = await conn.execute<mysql.RowDataPacket[]>(
      `SELECT DATE_FORMAT(MAX(DtaCriacao), '%Y-%m-%d') AS mx FROM fatloterecurso`,
      [],
    );

    return {
      recursos: linhas.map(normalizarRecursoLegado),
      meta: {
        pagina,
        tamanho,
        qtdPaginas: tamanho > 0 ? Math.ceil(registros / tamanho) : 0,
        registros,
        dadoAte: dataIso(recente[0]?.mx),
      },
    };
  }).then((resultado) => {
    if (!('erro' in resultado)) doCache(cacheRecursosLegado, chave, resultado);
    return resultado;
  });
}

const SQL_DETALHE_RECURSO = `
  SELECT lrp.IdProcedimento, lrp.IdRequisicao, lrp.NumGuia, lrp.VlrRecurso,
         lrp.IdMotivoGlosa, fmg.Descricao AS MotivoDescricao, lrp.Justificativa
    FROM fatloterecursoprocedimento lrp
    LEFT JOIN fatmotivoglosa fmg ON fmg.IdMotivoGlosa = lrp.IdMotivoGlosa
   WHERE lrp.IdLoteRecurso = ?
   ORDER BY lrp.IdProcedimento`;

/** Procedimentos de um lote de recurso, sob demanda ao expandir a linha —
 *  mesmo padrão de `detalharLote`. */
export async function detalharRecursoLegado(
  idLoteRecurso: number,
  ignorarCache = false,
): Promise<DetalharRecursoLegadoResultado> {
  const chave = `detalheRecurso|${idLoteRecurso}`;
  const cacheHit = ignorarCache ? null : daCache(cacheDetalheRecurso, chave, false);
  if (cacheHit) return cacheHit;

  return comConexao('detalharRecursoLegado', async (conn) => {
    const [linhas] = await conn.execute<mysql.RowDataPacket[]>(SQL_DETALHE_RECURSO, [idLoteRecurso]);

    const procedimentos: ProcedimentoRecursoLegado[] = linhas.map((linha) => ({
      idProcedimento: numero(linha.IdProcedimento),
      idRequisicao: numero(linha.IdRequisicao),
      numGuia: texto(linha.NumGuia),
      valorRecurso: numero(linha.VlrRecurso),
      idMotivoGlosa: inteiroOuNulo(linha.IdMotivoGlosa),
      motivoDescricao: texto(linha.MotivoDescricao),
      justificativa: texto(linha.Justificativa),
    }));

    return { procedimentos };
  }).then((resultado) => {
    if (!('erro' in resultado)) doCache(cacheDetalheRecurso, chave, resultado);
    return resultado;
  });
}

// --- Imagens da requisição (requisicaoimagem) — usado pelo botão "Ver imagens" nos
// dois históricos acima (glosas tem IdRequisicao na própria linha; recursos só no
// procedimento, ao expandir). Levantamento no banco: ~1,09M linhas, mas só ~1,4% tem
// o blob (`Img`) preenchido — o resto nunca foi digitalizado no apLIS. `DtaImg` fica
// nulo até a digitalização acontecer, o que pode levar alguns dias mesmo para
// requisições já antigas; a réplica em si atrasa ~1 dia (nota do topo do arquivo).
// Por isso a lista sempre devolve todas as linhas (mesmo sem imagem ainda), com
// `disponivel` indicando se o arquivo já pode ser baixado.

export interface ImagemRequisicaoLegado {
  id: number;
  nomeArquivo: string;
  extensao: string | null;
  tipo: number | null;
  /** Data em que o arquivo foi digitalizado/anexado — null enquanto `disponivel` é false. */
  data: string | null;
  disponivel: boolean;
}

export type ListarImagensRequisicaoLegadoResultado =
  | { imagens: ImagemRequisicaoLegado[] }
  | { erro: { status: number; mensagem: string } };

const SQL_LISTA_IMAGENS_REQUISICAO = `
  SELECT IdRequisicaoImagem, NomArquivo, ExtArquivo, Tipo,
         DATE_FORMAT(DtaImg, '%Y-%m-%d') AS DtaImg,
         (Img IS NOT NULL) AS Disponivel
    FROM requisicaoimagem
   WHERE IdRequisicao = ? AND Inativo = 0
   ORDER BY IdRequisicaoImagem`;

/** Só metadados — sem o blob, que pode ser grande e só é buscado ao abrir a imagem. */
export async function listarImagensRequisicaoLegado(
  idRequisicao: number,
): Promise<ListarImagensRequisicaoLegadoResultado> {
  return comConexao('listarImagensRequisicaoLegado', async (conn) => {
    const [linhas] = await conn.execute<mysql.RowDataPacket[]>(SQL_LISTA_IMAGENS_REQUISICAO, [idRequisicao]);
    const imagens: ImagemRequisicaoLegado[] = linhas.map((linha) => ({
      id: numero(linha.IdRequisicaoImagem),
      nomeArquivo: texto(linha.NomArquivo) ?? `imagem-${numero(linha.IdRequisicaoImagem)}`,
      extensao: texto(linha.ExtArquivo),
      tipo: inteiroOuNulo(linha.Tipo),
      data: dataIso(linha.DtaImg),
      disponivel: Boolean(linha.Disponivel),
    }));
    return { imagens };
  });
}

export interface ArquivoImagemRequisicaoLegado {
  bytes: Buffer;
  extensao: string | null;
  nomeArquivo: string;
}

export type BuscarImagemRequisicaoLegadoResultado =
  | { arquivo: ArquivoImagemRequisicaoLegado | null }
  | { erro: { status: number; mensagem: string } };

const SQL_ARQUIVO_IMAGEM_REQUISICAO = `
  SELECT Img, ExtArquivo, NomArquivo
    FROM requisicaoimagem
   WHERE IdRequisicaoImagem = ? AND Inativo = 0`;

/** `arquivo: null` quando a linha existe mas ainda não foi digitalizada (Img nulo)
 *  ou quando o id não existe/está inativo. */
export async function buscarImagemRequisicaoLegado(
  idRequisicaoImagem: number,
): Promise<BuscarImagemRequisicaoLegadoResultado> {
  return comConexao('buscarImagemRequisicaoLegado', async (conn) => {
    const [linhas] = await conn.execute<mysql.RowDataPacket[]>(SQL_ARQUIVO_IMAGEM_REQUISICAO, [
      idRequisicaoImagem,
    ]);
    const linha = linhas[0];
    if (!linha || linha.Img == null) return { arquivo: null };
    return {
      arquivo: {
        bytes: linha.Img as Buffer,
        extensao: texto(linha.ExtArquivo),
        nomeArquivo: texto(linha.NomArquivo) ?? `imagem-${idRequisicaoImagem}`,
      },
    };
  });
}
