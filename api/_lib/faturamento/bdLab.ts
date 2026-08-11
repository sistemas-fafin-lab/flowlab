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
  return `lotes|${params.periodoIni ?? ''}|${params.periodoFim ?? ''}|${params.idLote ?? ''}|${(params.idsLote ?? []).join('.')}|${params.statusLote ?? ''}|${params.pagina ?? ''}|${params.tamanho ?? ''}|${params.busca ?? ''}`;
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
function filtroLotes(params: ListarLotesParams): { where: string; valores: ParametroSql[] } {
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

function normalizarLote(linha: mysql.RowDataPacket): LoteFaturamento {
  const status = inteiroOuNulo(linha.Status) ?? 0;
  return {
    idLote: numero(linha.IdLote),
    status,
    // Código fora da tabela conhecida ainda tem que renderizar algo legível.
    statusLabel: STLOT_LABELS[status] ?? `Status ${status}`,
    dtaCriacao: dataIso(linha.DtaCriacao),
    dtaFechamento: dataIso(linha.DtaFechamento),
    dtaEnvio: dataIso(linha.DtaEnvio),
    dtaCancelamento: dataIso(linha.DtaCancelamento),
    protocolo: texto(linha.Protocolo),
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
  const { where, valores } = filtroLotes(params);

  // `ignorarCache` não entra em chaveListar de propósito: a releitura tem que
  // sobrescrever a MESMA entrada, senão o "Atualizar" gravaria numa chave paralela e a
  // navegação normal continuaria vendo o dado velho.
  const chave = chaveListar(params);
  const temBusca = Boolean(params.busca?.trim());
  const cacheHit = params.ignorarCache ? null : daCache(cacheLotes, chave, temBusca);
  if (cacheHit) return cacheHit;

  return comConexao('listarLotes', async (conn) => {
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
      lotes: linhas.map(normalizarLote),
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
         frp.DesMotivoGlosa,
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
   WHERE r.Lote = ?
   ORDER BY r.CodRequisicao, tp.Codigo`;

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
        req = {
          idRequisicao,
          codRequisicao: texto(linha.CodRequisicao),
          dtaSolicitacao: dataIso(linha.DtaSolicitacao),
          dtaFinalizacao: dataIso(linha.DtaFinalizacao),
          numGuiaConvenio: texto(linha.NumGuiaConvenio),
          paciente: texto(linha.NomPaciente),
          valor: 0,
          procedimentos: [],
        };
        porRequisicao.set(idRequisicao, req);
        (porLote[idLote] ??= []).push(req);
      }

      const valor = numero(linha.ValorLiquido);
      req.valor = Math.round((req.valor + valor) * 100) / 100;
      req.procedimentos.push({
        codigo: texto(linha.Codigo),
        descricao: texto(linha.Descricao),
        quantidade: numero(linha.Quantidade),
        valorUnitario: numero(linha.ValorUnitario),
        valor,
        numGuia: texto(linha.NumGuia),
        motivoGlosa: texto(linha.DesMotivoGlosa),
      });
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
        req = {
          idRequisicao,
          codRequisicao: texto(linha.CodRequisicao),
          dtaSolicitacao: dataIso(linha.DtaSolicitacao),
          dtaFinalizacao: dataIso(linha.DtaFinalizacao),
          numGuiaConvenio: texto(linha.NumGuiaConvenio),
          paciente: texto(linha.NomPaciente),
          valor: 0,
          procedimentos: [],
        };
        porRequisicao.set(idRequisicao, req);
      }

      const valor = numero(linha.ValorLiquido);
      // Somar em ponto flutuante vaza resíduo (404,84 + 46,13 = 450.96999999999997) e
      // o contrato da rota não deve carregar isso; o total do lote não passa por aqui,
      // vem somado pelo DECIMAL do MySQL.
      req.valor = Math.round((req.valor + valor) * 100) / 100;
      req.procedimentos.push({
        codigo: texto(linha.Codigo),
        descricao: texto(linha.Descricao),
        quantidade: numero(linha.Quantidade),
        valorUnitario: numero(linha.ValorUnitario),
        valor,
        numGuia: texto(linha.NumGuia),
        motivoGlosa: texto(linha.DesMotivoGlosa),
      });
    }

    return { requisicoes: [...porRequisicao.values()] };
  }).then((resultado) => {
    if (!('erro' in resultado)) doCache(cacheDetalhe, chave, resultado);
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
