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
    nome: string | null;
    razaoSocial: string | null;
    cpfCnpj: string | null;
  };
}

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
}

export interface ListarLotesParams {
  periodoIni?: string;
  periodoFim?: string;
  idLote?: number;
  statusLote?: number;
  pagina?: number;
  tamanho?: number;
  /** Termo de busca textual: procura em paciente, fonte pagadora, código da requisição,
   *  número da guia e IdLote. Ignora acentuação e maiúsculas/minúsculas. */
  busca?: string;
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

/**
 * Cláusula WHERE + parâmetros comuns à listagem e à contagem.
 * `periodoFim` é inclusivo: `< periodoFim + 1 dia` pega o dia inteiro sem depender de
 * como o DATETIME guarda a hora.
 */
function filtroLotes(params: ListarLotesParams): { where: string; valores: ParametroSql[] } {
  const condicoes: string[] = [];
  const valores: ParametroSql[] = [];

  if (params.idLote !== undefined) {
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
    const termo = params.busca.trim();
    const likeBusca: string[] = [];
    // lote e fonte pagadora — a fonte usa EXISTS para funcionar também na COUNT(*) que
    // não tem os LEFT JOINs da listagem.
    likeBusca.push('CAST(l.IdLote AS CHAR) COLLATE utf8mb4_unicode_ci LIKE CONCAT(\'%\', ?, \'%\')');      valores.push(termo);
    likeBusca.push('EXISTS (SELECT 1 FROM fatinstituicao fp WHERE fp.IdInstituicao = l.IdFontePagadora AND fp.NomFantasia COLLATE utf8mb4_unicode_ci LIKE CONCAT(\'%\', ?, \'%\'))');  valores.push(termo);
    likeBusca.push('EXISTS (SELECT 1 FROM fatinstituicao fp WHERE fp.IdInstituicao = l.IdFontePagadora AND fp.RazaoSocial COLLATE utf8mb4_unicode_ci LIKE CONCAT(\'%\', ?, \'%\'))'); valores.push(termo);
    // paciente, código da requisição, guia do convênio
    likeBusca.push('EXISTS (SELECT 1 FROM requisicao r WHERE r.Lote = l.IdLote AND r.CodRequisicao COLLATE utf8mb4_unicode_ci LIKE CONCAT(\'%\', ?, \'%\'))');      valores.push(termo);
    likeBusca.push('EXISTS (SELECT 1 FROM requisicao r WHERE r.Lote = l.IdLote AND r.NumGuiaConvenio COLLATE utf8mb4_unicode_ci LIKE CONCAT(\'%\', ?, \'%\'))');    valores.push(termo);
    likeBusca.push('EXISTS (SELECT 1 FROM requisicao r JOIN paciente p ON p.CodPaciente = r.CodPaciente WHERE r.Lote = l.IdLote AND p.NomPaciente COLLATE utf8mb4_unicode_ci LIKE CONCAT(\'%\', ?, \'%\'))'); valores.push(termo);
    likeBusca.push('EXISTS (SELECT 1 FROM requisicao r JOIN fatrequisicaoautorizacao fra ON fra.IdRequisicao = r.IdRequisicao WHERE r.Lote = l.IdLote AND fra.NumGuia COLLATE utf8mb4_unicode_ci LIKE CONCAT(\'%\', ?, \'%\'))'); valores.push(termo);
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
  SELECT l.IdLote, l.Status,
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
      nome: texto(linha.NomFantasia),
      razaoSocial: texto(linha.RazaoSocial),
      cpfCnpj: texto(linha.CNPJ),
    },
  };
}

/** Lista os lotes de faturamento paginados, já normalizados. */
export async function listarLotes(params: ListarLotesParams): Promise<ListarLotesResultado> {
  const pagina = params.pagina ?? 1;
  const tamanho = params.tamanho ?? TAMANHO_PADRAO;
  const { where, valores } = filtroLotes(params);

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
  });
}

// Uma consulta só, achatada (requisição × procedimento), agrupada em memória: são
// dezenas de linhas por lote (o maior lote de julho deu 50) e duas viagens ao túnel
// custariam mais que o agrupamento.
//
// O caminho do código do procedimento é
// fatrequisicaoprocedimento → fatconvenioprocedimento → fattabelaprocedimento, ou
// seja, a descrição vem da tabela de preço do convênio daquela requisição.
// `fatrequisicaoautorizacao` entra por IdRequisicaoProcedimento para trazer o número
// da guia autorizada de cada item.
const SQL_DETALHE = `
  SELECT r.IdRequisicao, r.CodRequisicao,
         DATE_FORMAT(r.DtaSolicitacao, '%Y-%m-%d') AS DtaSolicitacao,
         DATE_FORMAT(r.DtaFinalizacao, '%Y-%m-%d') AS DtaFinalizacao,
         r.NumGuiaConvenio, p.NomPaciente,
         tp.Codigo, tp.Descricao,
         frp.Quantidade, frp.ValorUnitario, frp.ValorLiquido,
         frp.DesMotivoGlosa, fra.NumGuia
    FROM requisicao r
    LEFT JOIN paciente p ON p.CodPaciente = r.CodPaciente
    JOIN fatrequisicaoprocedimento frp ON frp.IdRequisicao = r.IdRequisicao
    LEFT JOIN fatconvenioprocedimento cp ON cp.IdConvenioProcedimento = frp.IdConvenioProcedimento
    LEFT JOIN fattabelaprocedimento tp ON tp.IdTabelaProcedimento = cp.IdTabelaProcedimento
    LEFT JOIN fatrequisicaoautorizacao fra ON fra.IdRequisicaoProcedimento = frp.IdRequisicaoProcedimento
   WHERE r.Lote = ?
   ORDER BY r.CodRequisicao, tp.Codigo`;

/** Requisições de um lote, cada uma com seus procedimentos cobrados. */
export async function detalharLote(idLote: number): Promise<DetalharLoteResultado> {
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
  });
}
