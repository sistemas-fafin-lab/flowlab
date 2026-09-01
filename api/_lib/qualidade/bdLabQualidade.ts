// api/_lib/qualidade/bdLabQualidade.ts
// Fonte de dados dos handlers de Qualidade: o MESMO MySQL de backup do
// laboratório usado por api/_lib/faturamento/bdLab.ts e api/_lib/apoio/bdLab.ts
// (envs DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME) — não o endpoint HTTP do
// apLIS (api/_lib/apoio/aplis.ts só expõe `requisicaoListar`, sem listagem por
// período nem os campos de domínio de que Ocorrências/Cortesias/IHQ/Câncer
// precisam). Mapeamento de tabelas conferido contra o dump de schema real do
// banco (import_files/schema-backup-banco.csv) — NÃO conferido contra dado ao
// vivo (sem acesso a uma conexão real neste ambiente), então os pontos mais
// arriscados ficam documentados caso a caso abaixo.
//
// ── Tabelas usadas, por submódulo ──────────────────────────────────────────
// Ocorrências : ocorrencia (+ requisicao para CodRequisicao)
// Cortesias   : requisicaoautorizacao (+ requisicao, fatconvenio, evento,
//               fatrequisicaoprocedimento)
// IHQ         : requisicao + evento (heurística: DesEvento contém "IHQ") +
//               medico + blocorequisicao/requisicaopeca (peça disponível)
// Câncer      : requisicaodiagnostico (Positivo=1) + requisicao + diagnostico
//               + requisicaopeca + topografia + paciente
//
// ── Pontos em aberto (revisar com dado real antes de confiar 100%) ─────────
// 1. Cortesias: `requisicaoautorizacao` tem chave composta (IdRequisicao,
//    Tipo) e não existe, no schema, uma tabela de descrição para `Tipo`/
//    `IdMotivo` que confirme qual valor identifica espificamente uma
//    autorização de CORTESIA (vs. outros tipos de autorização que a mesma
//    tabela pode guardar). Filtrado por `APLIS_CORTESIA_TIPO_AUTORIZACAO`
//    (opcional) — sem essa env, o sync traz TODAS as autorizações do
//    período; a curadoria (status "descartada") é a rede de segurança para
//    quem não for cortesia de fato. Configurar a env assim que o valor
//    correto for confirmado com o time do LIS.
// 2. Ocorrências: não foi encontrada, no schema, uma tabela de descrição
//    para `ocorrencia.Origem` (não é `tabelacodigoitem` — CodTabela
//    desconhecido) — `categoria_origem_lis` sai sempre `null` e
//    `categoria_origem_generica` sempre `true` até essa tabela ser
//    identificada.
// 3. IHQ: não há uma coluna/flag direta que marque "esta requisição é uma
//    solicitação de IHQ" — heurística: `evento.DesEvento LIKE '%IHQ%'`.
//    `status_lis` só distingue concluído (`DtaFinalizacao` preenchida) de em
//    andamento — não há sinal de cancelamento no schema, então "cancelado"
//    nunca é inferido (evita marcar errado).

import mysql from 'mysql2/promise';

const CONNECT_TIMEOUT_MS = 8_000;

export function bdLabQualidadeConfigurado(): boolean {
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

export interface ErroConsultaLis {
  erro: { status: number; mensagem: string };
}

/** Roda `consulta` com uma conexão dedicada e sempre a encerra. Nunca lança. */
async function comConexao<T>(rotulo: string, consulta: (conn: mysql.Connection) => Promise<T>): Promise<T | ErroConsultaLis> {
  if (!bdLabQualidadeConfigurado()) {
    return { erro: { status: 502, mensagem: 'Banco do laboratório não configurado (DB_HOST/DB_USER).' } };
  }
  let conn: mysql.Connection | null = null;
  try {
    conn = await conectar();
    return await consulta(conn);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[qualidade/bdLabQualidade] ${rotulo}: ${msg}`);
    return { erro: { status: 502, mensagem: `Não foi possível consultar o banco do laboratório: ${msg}` } };
  } finally {
    if (conn) await conn.end().catch(() => undefined);
  }
}

export function ehErroConsulta<T>(resultado: T | ErroConsultaLis): resultado is ErroConsultaLis {
  return typeof resultado === 'object' && resultado !== null && 'erro' in resultado;
}

/** DECIMAL/BIGINT vêm como string no mysql2. */
function numero(bruto: unknown): number | null {
  if (bruto === null || bruto === undefined || bruto === '') return null;
  const n = Number(bruto);
  return Number.isFinite(n) ? n : null;
}

function inteiroOuNulo(bruto: unknown): number | null {
  return numero(bruto);
}

/** Trata '' como ausente: várias colunas do apLIS guardam string vazia em vez de NULL. */
function texto(bruto: unknown): string | null {
  if (bruto === null || bruto === undefined) return null;
  const s = String(bruto).trim();
  return s === '' ? null : s;
}

// Datas já saem formatadas do MySQL via DATE_FORMAT — 'YYYY-MM-DD' na maioria
// dos campos, 'YYYY-MM-DD HH:MM:SS' nos 4 campos timestamptz da issue 08
// (DtaPrevistaSetor/DtaRecorteColoracao/DtaConsensoCriado/DtaBlocoDanificado
// — DtaPrevistaSetor carrega hora real no LIS, ex. '19:00:00', não meia-noite
// fixa) — em ambos os casos `dataIso` só normaliza o vazio, sem reformatar.
const dataIso = texto;

/** `fim` inclusivo: `< fim + 1 dia` pega o dia inteiro sem depender de como o DATETIME guarda a hora. */
function condicaoPeriodo(coluna: string, inicio: string, fim: string): { sql: string; valores: string[] } {
  return {
    sql: `${coluna} >= ? AND ${coluna} < DATE_ADD(?, INTERVAL 1 DAY)`,
    valores: [`${inicio} 00:00:00`, `${fim} 00:00:00`],
  };
}

/**
 * Uma requisição pode ter mais de uma linha positiva em
 * `requisicaodiagnostico` (mais de uma peça com laudo publicado) — o LEFT
 * JOIN de `listarDiagnosticosPositivosLis`/`buscarDetalhesCancerLis` então
 * devolve mais de uma linha para o mesmo `CodRequisicao`. Sem isto, o
 * upsert de `qa_cancer_casos` (chave única por `cod_requisicao`) falhava
 * inteiro com "ON CONFLICT DO UPDATE command cannot affect row a second
 * time", e o export CSV do RHC ficava com a última linha que o MySQL
 * decidisse devolver, sem critério. Fica com a linha mais completa (laudo
 * + topografia presentes), de forma determinística — achado de code
 * review (o caso em si permanece 1 só; nenhuma linha é descartada da
 * listagem de Ocorrências/Cortesias/IHQ, só da agregação por requisição
 * aqui).
 */
function maisCompleta<T extends { textoLaudo: string | null; descricaoTopografiaLis: string | null }>(atual: T, nova: T): T {
  const completude = (linha: T) => (linha.textoLaudo !== null ? 1 : 0) + (linha.descricaoTopografiaLis !== null ? 1 : 0);
  return completude(nova) > completude(atual) ? nova : atual;
}

// ── Ocorrências ─────────────────────────────────────────────────────────────

export interface OcorrenciaLis {
  idOcorrenciaLis: number;
  numCod: number | null;
  dtaOcorrencia: string;
  codRequisicao: string | null;
  descricaoLis: string | null;
  acaoImediataLis: string | null;
  cauDescricaoLis: string | null;
}

export type ListarOcorrenciasResultado = { ocorrencias: OcorrenciaLis[] } | ErroConsultaLis;

export async function listarOcorrenciasLis(inicio: string, fim: string): Promise<ListarOcorrenciasResultado> {
  return comConexao('listarOcorrenciasLis', async (conn) => {
    const periodo = condicaoPeriodo('o.DtaOcorrencia', inicio, fim);
    const [linhas] = await conn.execute<mysql.RowDataPacket[]>(
      `SELECT o.IdOcorrencia, o.NumCod,
              DATE_FORMAT(o.DtaOcorrencia, '%Y-%m-%d') AS DtaOcorrencia,
              r.CodRequisicao, o.Descricao, o.AcaoImediata, o.CauDescricao
         FROM ocorrencia o
         LEFT JOIN requisicao r ON r.IdRequisicao = o.IdRequisicao
        WHERE ${periodo.sql}
        ORDER BY o.DtaOcorrencia DESC`,
      periodo.valores,
    );
    return {
      ocorrencias: linhas.map((linha) => ({
        idOcorrenciaLis: numero(linha.IdOcorrencia) ?? 0,
        numCod: inteiroOuNulo(linha.NumCod),
        dtaOcorrencia: dataIso(linha.DtaOcorrencia) ?? inicio,
        codRequisicao: texto(linha.CodRequisicao),
        descricaoLis: texto(linha.Descricao),
        acaoImediataLis: texto(linha.AcaoImediata),
        cauDescricaoLis: texto(linha.CauDescricao),
      })),
    };
  });
}

// ── Cortesias ────────────────────────────────────────────────────────────────

export interface AutorizacaoCortesiaLis {
  idRequisicaoLis: number;
  codRequisicao: string;
  dtaSolicitacao: string;
  dtaAutorizacao: string | null;
  clinicaIdLis: number | null;
  clinicaNome: string | null;
  exameNome: string | null;
  autorizadoPorLis: string | null;
  observacoesLis: string | null;
  /** `fatrequisicaoprocedimento.ValorBruto` — preço cheio antes do desconto. */
  valorParticular: number | null;
  /** `fatrequisicaoprocedimento.ValorCobrado`. */
  valorCobrado: number | null;
  /** `fatrequisicaoprocedimento.ValorDesconto` — quanto foi concedido de cortesia. */
  valorConcedido: number | null;
}

export type ListarCortesiasResultado = { cortesias: AutorizacaoCortesiaLis[] } | ErroConsultaLis;

export async function listarAutorizacoesCortesiaLis(inicio: string, fim: string): Promise<ListarCortesiasResultado> {
  return comConexao('listarAutorizacoesCortesiaLis', async (conn) => {
    const periodo = condicaoPeriodo('ra.DtaCriacao', inicio, fim);
    const tipo = (process.env.APLIS_CORTESIA_TIPO_AUTORIZACAO ?? '').trim();
    const filtroTipo = tipo !== '' ? 'AND ra.Tipo = ?' : '';
    const valores = tipo !== '' ? [...periodo.valores, Number(tipo)] : periodo.valores;

    // Uma autorização (ra) pode ter mais de uma linha em
    // fatrequisicaoprocedimento (mais de um procedimento faturado sob a
    // mesma cortesia) — o LEFT JOIN sem agregação devolvia N linhas por
    // CodRequisicao e o upsert de qa_cortesias (chave única por
    // cod_requisicao) quebrava. Agrega por SUM: valor total dos
    // procedimentos cobertos por esta autorização (achado de code review).
    const [linhas] = await conn.execute<mysql.RowDataPacket[]>(
      `SELECT r.IdRequisicao, r.CodRequisicao,
              DATE_FORMAT(ra.DtaCriacao, '%Y-%m-%d') AS DtaSolicitacao,
              DATE_FORMAT(ra.DtaFinalizacao, '%Y-%m-%d') AS DtaAutorizacao,
              r.IdConvenio, fc.NomConvenio, ev.DesEvento,
              ra.Solicitante, ra.Observacao,
              SUM(fp.ValorBruto) AS ValorBruto, SUM(fp.ValorCobrado) AS ValorCobrado, SUM(fp.ValorDesconto) AS ValorDesconto
         FROM requisicaoautorizacao ra
         JOIN requisicao r ON r.IdRequisicao = ra.IdRequisicao
         LEFT JOIN fatconvenio fc ON fc.IdConvenio = r.IdConvenio
         LEFT JOIN evento ev ON ev.CodEvento = r.CodEvento
         LEFT JOIN fatrequisicaoprocedimento fp ON fp.IdRequisicao = ra.IdRequisicao
        WHERE ${periodo.sql} ${filtroTipo}
        GROUP BY r.IdRequisicao, r.CodRequisicao, ra.DtaCriacao, ra.DtaFinalizacao, r.IdConvenio, fc.NomConvenio, ev.DesEvento, ra.Solicitante, ra.Observacao
        ORDER BY ra.DtaCriacao DESC`,
      valores,
    );
    return {
      cortesias: linhas.map((linha) => ({
        idRequisicaoLis: numero(linha.IdRequisicao) ?? 0,
        codRequisicao: texto(linha.CodRequisicao) ?? '',
        dtaSolicitacao: dataIso(linha.DtaSolicitacao) ?? inicio,
        dtaAutorizacao: dataIso(linha.DtaAutorizacao),
        clinicaIdLis: inteiroOuNulo(linha.IdConvenio),
        clinicaNome: texto(linha.NomConvenio),
        exameNome: texto(linha.DesEvento),
        autorizadoPorLis: texto(linha.Solicitante),
        observacoesLis: texto(linha.Observacao),
        valorParticular: numero(linha.ValorBruto),
        valorCobrado: numero(linha.ValorCobrado),
        valorConcedido: numero(linha.ValorDesconto),
      })),
    };
  });
}

// ── IHQ ──────────────────────────────────────────────────────────────────────

export interface SolicitacaoIhqLis {
  idRequisicaoIhq: number;
  codRequisicaoIhq: string;
  codPaciente: number | null;
  dtaAdmissao: string;
  dtaSolicitacaoBloco: string;
  medicoSolicitante: string | null;
  /** Só distingue concluído de em andamento — sem sinal de cancelamento no schema (ver cabeçalho). */
  statusLis: 'concluido' | 'em_andamento';
  /** `true` quando já existe ao menos 1 bloco/peça vinculado a esta requisição. */
  temPeca: boolean;
}

export type ListarIhqResultado = { solicitacoes: SolicitacaoIhqLis[] } | ErroConsultaLis;

/** Heurística: requisição cujo exame (`evento.DesEvento`) contém "IHQ" — ver cabeçalho do arquivo. */
export async function listarSolicitacoesIhqLis(inicio: string, fim: string): Promise<ListarIhqResultado> {
  return comConexao('listarSolicitacoesIhqLis', async (conn) => {
    const periodo = condicaoPeriodo('r.DtaSolicitacao', inicio, fim);
    const [linhas] = await conn.execute<mysql.RowDataPacket[]>(
      `SELECT r.IdRequisicao, r.CodRequisicao, r.CodPaciente,
              DATE_FORMAT(r.DtaSolicitacao, '%Y-%m-%d') AS DtaSolicitacao,
              r.DtaFinalizacao, med.NomMedico,
              (SELECT COUNT(*) FROM requisicaopeca rp WHERE rp.IdRequisicao = r.IdRequisicao) AS QtdPeca
         FROM requisicao r
         JOIN evento ev ON ev.CodEvento = r.CodEvento
         LEFT JOIN medico med ON med.CodMedico = r.CodMedico
        WHERE ev.DesEvento LIKE '%IHQ%' AND ${periodo.sql}
        ORDER BY r.DtaSolicitacao DESC`,
      periodo.valores,
    );
    return {
      solicitacoes: linhas.map((linha) => ({
        idRequisicaoIhq: numero(linha.IdRequisicao) ?? 0,
        codRequisicaoIhq: texto(linha.CodRequisicao) ?? '',
        codPaciente: inteiroOuNulo(linha.CodPaciente),
        dtaAdmissao: dataIso(linha.DtaSolicitacao) ?? inicio,
        dtaSolicitacaoBloco: dataIso(linha.DtaSolicitacao) ?? inicio,
        medicoSolicitante: texto(linha.NomMedico),
        statusLis: linha.DtaFinalizacao ? 'concluido' : 'em_andamento',
        temPeca: (numero(linha.QtdPeca) ?? 0) > 0,
      })),
    };
  });
}

export interface CandidataVinculoLis {
  codRequisicaoOriginal: string;
  dtaSolicitacao: string;
  temPeca: boolean;
}

export type BuscarCandidatasResultado = { candidatas: CandidataVinculoLis[] } | ErroConsultaLis;

/**
 * Candidatas a biópsia original do MESMO paciente numa janela ao redor da
 * admissão, exceto a própria requisição de IHQ. Devolve TODAS as
 * requisições da janela (com ou sem peça) — `nivelConfiancaVinculo`
 * (ihqRegras.ts) precisa da mistura para diferenciar `media` de `baixa`;
 * filtrar aqui por `temPeca` colapsaria essa regra (achado de code review).
 * Ordenado pela proximidade a `dtaAdmissao`, não por data mais recente —
 * senão um paciente com muitas requisições na janela poderia estourar o
 * LIMIT antes de alcançar a candidata mais plausível.
 */
export async function buscarCandidatasVinculoIhqLis(
  codPaciente: number,
  dtaAdmissao: string,
  codRequisicaoIhq: string,
  janelaDias: number,
): Promise<BuscarCandidatasResultado> {
  return comConexao('buscarCandidatasVinculoIhqLis', async (conn) => {
    const [linhas] = await conn.execute<mysql.RowDataPacket[]>(
      `SELECT r.CodRequisicao, DATE_FORMAT(r.DtaSolicitacao, '%Y-%m-%d') AS DtaSolicitacao,
              (SELECT COUNT(*) FROM requisicaopeca rp WHERE rp.IdRequisicao = r.IdRequisicao) AS QtdPeca
         FROM requisicao r
        WHERE r.CodPaciente = ?
          AND r.CodRequisicao <> ?
          AND r.DtaSolicitacao >= DATE_SUB(?, INTERVAL ? DAY)
          AND r.DtaSolicitacao <= DATE_ADD(?, INTERVAL ? DAY)
        ORDER BY ABS(DATEDIFF(r.DtaSolicitacao, ?)) ASC
        LIMIT 50`,
      [codPaciente, codRequisicaoIhq, dtaAdmissao, janelaDias, dtaAdmissao, janelaDias, dtaAdmissao],
    );
    return {
      candidatas: linhas.map((linha) => ({
        codRequisicaoOriginal: texto(linha.CodRequisicao) ?? '',
        dtaSolicitacao: dataIso(linha.DtaSolicitacao) ?? dtaAdmissao,
        temPeca: (numero(linha.QtdPeca) ?? 0) > 0,
      })),
    };
  });
}

/** Confirma que `codRequisicao` existe e devolve o `CodPaciente` dono, para validar contra a requisição de IHQ. */
export async function buscarCodPacientePorRequisicaoLis(codRequisicao: string): Promise<{ codPaciente: number | null } | ErroConsultaLis> {
  return comConexao('buscarCodPacientePorRequisicaoLis', async (conn) => {
    const [linhas] = await conn.execute<mysql.RowDataPacket[]>(
      `SELECT CodPaciente FROM requisicao WHERE CodRequisicao = ? LIMIT 1`,
      [codRequisicao],
    );
    return { codPaciente: linhas[0] ? inteiroOuNulo(linhas[0].CodPaciente) : null };
  });
}

// ── Câncer ───────────────────────────────────────────────────────────────────

export interface DiagnosticoPositivoLis {
  idRequisicaoLis: number;
  codRequisicao: string;
  dtaDiagnostico: string;
  dtaColeta: string | null;
  codInternacionalDiagnostico: string | null;
  textoLaudo: string | null;
  descricaoTopografiaLis: string | null;
  nomePacienteLis: string;
  sexoLis: number | null;
  cpfLis: string | null;
}

export type ListarDiagnosticosResultado = { casos: DiagnosticoPositivoLis[] } | ErroConsultaLis;

/**
 * Universo do funil (R2/P1 — todos os positivos ficam visíveis, nunca
 * filtrados por heurística): `requisicaodiagnostico.Positivo = 1` no
 * período. `textoLaudo`/`descricaoTopografiaLis` alimentam
 * `avaliarCandidaturaCancer`/`sugerirTopografia` (api/_lib/qualidade/cancerRegras.ts).
 */
export async function listarDiagnosticosPositivosLis(inicio: string, fim: string): Promise<ListarDiagnosticosResultado> {
  return comConexao('listarDiagnosticosPositivosLis', async (conn) => {
    const periodo = condicaoPeriodo('r.DtaSolicitacao', inicio, fim);
    const [linhas] = await conn.execute<mysql.RowDataPacket[]>(
      `SELECT r.IdRequisicao, r.CodRequisicao,
              DATE_FORMAT(r.DtaSolicitacao, '%Y-%m-%d') AS DtaDiagnostico,
              DATE_FORMAT(r.DtaColeta, '%Y-%m-%d') AS DtaColeta,
              d.CodInternacional, rd.DesLaudo,
              top.DesTopografia,
              p.NomPaciente, p.Sexo, p.CPF
         FROM requisicaodiagnostico rd
         JOIN requisicao r ON r.IdRequisicao = rd.IdRequisicao
         JOIN paciente p ON p.CodPaciente = r.CodPaciente
         LEFT JOIN diagnostico d ON d.CodDiagnostico = rd.CodDiagnostico
         LEFT JOIN requisicaopeca rp ON rp.IdPeca = rd.IdPeca
         LEFT JOIN topografia top ON top.CodTopografia = rp.CodTopografia
        WHERE rd.Positivo = 1 AND ${periodo.sql}
        ORDER BY r.DtaSolicitacao DESC`,
      periodo.valores,
    );
    const porRequisicao = new Map<string, DiagnosticoPositivoLis>();
    for (const linha of linhas) {
      const caso: DiagnosticoPositivoLis = {
        idRequisicaoLis: inteiroOuNulo(linha.IdRequisicao) ?? 0,
        codRequisicao: texto(linha.CodRequisicao) ?? '',
        dtaDiagnostico: dataIso(linha.DtaDiagnostico) ?? inicio,
        dtaColeta: dataIso(linha.DtaColeta),
        codInternacionalDiagnostico: texto(linha.CodInternacional),
        textoLaudo: texto(linha.DesLaudo),
        descricaoTopografiaLis: texto(linha.DesTopografia),
        nomePacienteLis: texto(linha.NomPaciente) ?? '',
        sexoLis: inteiroOuNulo(linha.Sexo),
        cpfLis: texto(linha.CPF),
      };
      if (!caso.codRequisicao) continue;
      const existente = porRequisicao.get(caso.codRequisicao);
      porRequisicao.set(caso.codRequisicao, existente ? maisCompleta(existente, caso) : caso);
    }
    return { casos: Array.from(porRequisicao.values()) };
  });
}

export interface DetalheCancerLis {
  nomePacienteLis: string;
  sexoLis: number | null;
  cpfLis: string | null;
  nomeMaeLis: string | null;
  dataNascimentoLis: string | null;
  patologistaLaudoLis: string | null;
  textoLaudo: string | null;
  codInternacionalDiagnostico: string | null;
  descricaoTopografiaLis: string | null;
}

export type BuscarDetalheCancerResultado = { detalhe: DetalheCancerLis } | { detalhe: null } | ErroConsultaLis;

export async function buscarDetalheCancerLis(codRequisicao: string): Promise<BuscarDetalheCancerResultado> {
  return comConexao('buscarDetalheCancerLis', async (conn) => {
    const [linhas] = await conn.execute<mysql.RowDataPacket[]>(
      `SELECT p.NomPaciente, p.Sexo, p.CPF, p.NomMae, DATE_FORMAT(p.DtaNascimento, '%Y-%m-%d') AS DtaNascimento,
              med.NomMedico AS PatologistaLaudo, rd.DesLaudo, d.CodInternacional, top.DesTopografia
         FROM requisicao r
         JOIN paciente p ON p.CodPaciente = r.CodPaciente
         LEFT JOIN requisicaodiagnostico rd ON rd.IdRequisicao = r.IdRequisicao AND rd.Positivo = 1
         LEFT JOIN diagnostico d ON d.CodDiagnostico = rd.CodDiagnostico
         LEFT JOIN requisicaopeca rp ON rp.IdPeca = rd.IdPeca
         LEFT JOIN topografia top ON top.CodTopografia = rp.CodTopografia
         LEFT JOIN medico med ON med.CodMedico = r.IdPatologista
        WHERE r.CodRequisicao = ?
        LIMIT 1`,
      [codRequisicao],
    );
    const linha = linhas[0];
    if (!linha) return { detalhe: null };
    return {
      detalhe: {
        nomePacienteLis: texto(linha.NomPaciente) ?? '',
        sexoLis: inteiroOuNulo(linha.Sexo),
        cpfLis: texto(linha.CPF),
        nomeMaeLis: texto(linha.NomMae),
        dataNascimentoLis: dataIso(linha.DtaNascimento),
        patologistaLaudoLis: texto(linha.PatologistaLaudo),
        textoLaudo: texto(linha.DesLaudo),
        codInternacionalDiagnostico: texto(linha.CodInternacional),
        descricaoTopografiaLis: texto(linha.DesTopografia),
      },
    };
  });
}

export type BuscarDetalhesCancerResultado = { detalhes: Record<string, DetalheCancerLis> } | ErroConsultaLis;

/**
 * Versão em lote de `buscarDetalheCancerLis` — 1 conexão/consulta para N
 * códigos, em vez de 1 conexão por caso (gerar-exportacao-cancer.ts pode
 * processar centenas de casos elegíveis por trimestre; abrir/fechar conexão
 * por caso arrisca estourar o tempo da function — achado de code review).
 */
export async function buscarDetalhesCancerLis(codigos: readonly string[]): Promise<BuscarDetalhesCancerResultado> {
  if (codigos.length === 0) return { detalhes: {} };
  return comConexao('buscarDetalhesCancerLis', async (conn) => {
    const placeholders = codigos.map(() => '?').join(', ');
    const [linhas] = await conn.execute<mysql.RowDataPacket[]>(
      `SELECT r.CodRequisicao, p.NomPaciente, p.Sexo, p.CPF, p.NomMae, DATE_FORMAT(p.DtaNascimento, '%Y-%m-%d') AS DtaNascimento,
              med.NomMedico AS PatologistaLaudo, rd.DesLaudo, d.CodInternacional, top.DesTopografia
         FROM requisicao r
         JOIN paciente p ON p.CodPaciente = r.CodPaciente
         LEFT JOIN requisicaodiagnostico rd ON rd.IdRequisicao = r.IdRequisicao AND rd.Positivo = 1
         LEFT JOIN diagnostico d ON d.CodDiagnostico = rd.CodDiagnostico
         LEFT JOIN requisicaopeca rp ON rp.IdPeca = rd.IdPeca
         LEFT JOIN topografia top ON top.CodTopografia = rp.CodTopografia
         LEFT JOIN medico med ON med.CodMedico = r.IdPatologista
        WHERE r.CodRequisicao IN (${placeholders})`,
      [...codigos],
    );
    const detalhes: Record<string, DetalheCancerLis> = {};
    for (const linha of linhas) {
      const cod = texto(linha.CodRequisicao);
      if (!cod) continue;
      const detalhe: DetalheCancerLis = {
        nomePacienteLis: texto(linha.NomPaciente) ?? '',
        sexoLis: inteiroOuNulo(linha.Sexo),
        cpfLis: texto(linha.CPF),
        nomeMaeLis: texto(linha.NomMae),
        dataNascimentoLis: dataIso(linha.DtaNascimento),
        patologistaLaudoLis: texto(linha.PatologistaLaudo),
        textoLaudo: texto(linha.DesLaudo),
        codInternacionalDiagnostico: texto(linha.CodInternacional),
        descricaoTopografiaLis: texto(linha.DesTopografia),
      };
      // Mesmo caso de linhas duplicadas por CodRequisicao de
      // listarDiagnosticosPositivosLis (ver `maisCompleta`) — aqui alimenta
      // o CSV de exportação ao RHC, então nunca escolhe a linha "que o
      // MySQL devolveu por último" sem critério.
      const existente = detalhes[cod];
      detalhes[cod] = existente ? maisCompleta(existente, detalhe) : detalhe;
    }
    return { detalhes };
  });
}

// ── Requisições (Indicadores) ─────────────────────────────────────────────────

/**
 * Seção derivada de `exame.CodExameTipo` (catálogo estável por exame no LIS,
 * conferido ao vivo em 2026-09-01) — NUNCA de `evento`/`setor`, que refletem
 * o passo atual do fluxo, não o tipo do exame (ver cabeçalho da migration
 * 20260901120000_qualidade_requisicoes_indicadores.sql para o detalhe dos
 * códigos). Mantido como Map em vez de faixa numérica porque os códigos não
 * são contíguos nem ordenados por seção.
 */
const SECAO_POR_COD_EXAME_TIPO = new Map<number, SecaoRequisicaoLis>([
  [1, 'patologia_ap'], // ANÁTOMO PATOLÓGICO
  [8, 'patologia_ap'], // HISTOPATOLÓGICO
  [9, 'patologia_ap'], // BIÓPSIA SIMPLES
  [10, 'patologia_ap'], // FRAGMENTOS MÚLTIPLOS
  [11, 'patologia_ap'], // MARGENS PEÇAS
  [19, 'patologia_ap'], // PAAF
  [2, 'histologia_citologia'], // CITOPATOLOGIA
  [3, 'ihq_parceiro'], // IMUNOISTOQUÍMICA
  [5, 'ihq_parceiro'], // EXAMES REALIZADOS POR PARCEIROS
  [6, 'biologia_molecular'], // CAPTURA HÍBRIDA
  [7, 'biologia_molecular'], // PAINEL DE HIBRIDIZAÇÃO
  [18, 'biologia_molecular'], // PCR
]);

// CodEvento de requisicaohistorico, conferidos ao vivo em 2026-09-01 —
// estáveis (chave técnica do LIS), diferente de DesEvento (texto editável).
const COD_EVENTO_AMOSTRA_RECEBIDA = 20; // 'Triagem de Amostra - Recebida'
const COD_EVENTO_ADMISSAO = 1; // 'Admissão'
const COD_EVENTO_RETIFICACAO = 54; // 'Retificação de laudo'
// Issue 08 (Patologia/AP) — conferidos ao vivo em 2026-09-01 contra o mesmo backup.
const COD_EVENTO_RECORTE_COLORACAO = 3; // 'Corte - Coloração Esp. / Novos Cortes'
const COD_PROBLEMA_BLOCO_DANIFICADO = 19; // 'Bloco danificado ou quebrado'
// Issue 09 (Histologia/Citologia) — conferidos ao vivo em 2026-09-01 contra o
// mesmo backup. CodEvento=1000 é quase exclusivo de CITOPATOLOGIA neste LIS
// (2681/2681 requisições nos últimos 90 dias) — por isso mora aqui, não em
// Patologia/AP (ver cabeçalho da migration 20260901140000).
const COD_EVENTO_MICROSCOPIA_AGUARDANDO = 1000; // 'Microscopia - Aguarda Liberação'
const COD_PROBLEMA_AMOSTRA_NAO_RECEBIDA = 4; // 'Amostra não recebida'
const COD_PROBLEMA_MATERIAL_DEVOLVIDO_NAO_CONFORME = 27; // 'Devolução de Material NÃO Conforme'

export type SecaoRequisicaoLis = 'biologia_molecular' | 'patologia_ap' | 'histologia_citologia' | 'ihq_parceiro';

export interface RequisicaoIndicadorLis {
  idRequisicaoLis: number;
  codRequisicao: string;
  codExameTipoLis: number | null;
  exameTipoNomeLis: string | null;
  secaoLis: SecaoRequisicaoLis | null;
  dtaSolicitacao: string;
  dtaColeta: string | null;
  dtaAmostraRecebida: string | null;
  dtaAdmissao: string | null;
  dtaPrevista: string | null;
  dtaLiberacao: string | null;
  patologistaNomeLis: string | null;
  retificado: boolean;
  dtaRetificacao: string | null;
  /** Issue 08 (Patologia/AP) — prazo OPERACIONAL do setor, distinto de dtaPrevista (prazo ao cliente). */
  dtaPrevistaSetor: string | null;
  recorteColoracao: boolean;
  dtaRecorteColoracao: string | null;
  consensoPendente: boolean;
  dtaConsensoCriado: string | null;
  /** Reaproveitado pela issue 09 (Histologia/Citologia) — mesmo CodProblema=19, dois usos. */
  blocoDanificado: boolean;
  dtaBlocoDanificado: string | null;
  /** Issue 09 (Histologia/Citologia) — bloco/lamina.DtaCriacao via blocorequisicao/laminarequisicao, sem filtro de data própria (mesma simplificação de recorte único das demais colunas, ver comentário acima da query). */
  numBlocos: number;
  numLaminas: number;
  /** MIN(lamina.DtaCriacao) — usada por "Tempo de Processamento" (dtaAmostraRecebida → 1ª lâmina pronta). */
  dtaPrimeiraLaminaPronta: string | null;
  /** CodEvento=1000 ("Microscopia - Aguarda Liberação") — realocado de Patologia/AP para Histologia/Citologia (ver cabeçalho da migration 20260901140000). */
  dtaMicroscopiaAguardando: string | null;
  /** CodProblema=4 ("Amostra não recebida"). */
  amostraNaoRecebida: boolean;
  dtaAmostraNaoRecebida: string | null;
  /** CodProblema=27 ("Devolução de Material NÃO Conforme"). */
  materialDevolvidoNaoConforme: boolean;
  dtaMaterialDevolvido: string | null;
}

export type ListarRequisicoesResultado = { requisicoes: RequisicaoIndicadorLis[] } | ErroConsultaLis;

/**
 * Universo: toda requisição SOLICITADA no período (`r.DtaSolicitacao`) —
 * mesma simplificação de recorte único já usada por Ocorrências/Cortesias/
 * IHQ (ver limitação documentada em requisicoesIndicadores.ts): eventos que
 * acontecem bem depois da solicitação (liberação, retificação) continuam
 * contados na linha, mesmo que caiam fora do período do usuário.
 */
export async function listarRequisicoesLis(inicio: string, fim: string): Promise<ListarRequisicoesResultado> {
  return comConexao('listarRequisicoesLis', async (conn) => {
    const periodo = condicaoPeriodo('r.DtaSolicitacao', inicio, fim);
    // 3 subqueries correlacionadas (1 por evento), NÃO 1 derived table
    // agregada por IdRequisicao — testado ao vivo contra o MySQL de backup
    // (requisicaohistorico tem ~2M linhas): a versão "agregar tudo 1 vez com
    // GROUP BY" escaneia a tabela INTEIRA (sem filtro de período possível
    // antes do JOIN com `r`) e levou ~40s num período de 1 mês; a versão
    // correlacionada abaixo aproveita o índice em `IdRequisicao` por linha
    // já filtrada pelo período de `r` e levou <1s no mesmo teste. Não trocar
    // sem medir de novo contra dado real.
    // Issue 08 (Patologia/AP) acrescentou mais 4 subqueries do mesmo formato
    // (recorte/coloração, consenso pendente + criado, bloco danificado) —
    // reconferido ao vivo com todas as 7 juntas: ~1.35s para 3 meses/~13k
    // linhas, mesma ordem de grandeza do teste original.
    // Issue 09 (Histologia/Citologia) acrescentou mais 6 (blocos produzidos,
    // lâminas produzidas + primeira pronta, microscopia aguardando, amostra
    // não recebida, material devolvido) — mesmo padrão correlacionado, não a
    // query separada com GROUP BY que o projeto de referência usou para
    // blocos/lâminas (aqui o padrão já testado e documentado acima é o
    // correlacionado; não há motivo para desviar só para estas duas).
    const [linhas] = await conn.execute<mysql.RowDataPacket[]>(
      `SELECT r.IdRequisicao, r.CodRequisicao, et.CodExameTipo, et.NomExameTipo,
              DATE_FORMAT(r.DtaSolicitacao, '%Y-%m-%d') AS DtaSolicitacao,
              DATE_FORMAT(r.DtaColeta, '%Y-%m-%d') AS DtaColeta,
              DATE_FORMAT(r.DtaPrevista, '%Y-%m-%d') AS DtaPrevista,
              DATE_FORMAT(r.Dta1aLiberacao, '%Y-%m-%d') AS DtaLiberacao,
              DATE_FORMAT(r.DtaPrevistaSetor, '%Y-%m-%d %H:%i:%s') AS DtaPrevistaSetor,
              med.NomMedico AS PatologistaNome,
              DATE_FORMAT(
                (SELECT MIN(rh.DtaEvento) FROM requisicaohistorico rh
                  WHERE rh.IdRequisicao = r.IdRequisicao AND rh.CodEvento = ?),
                '%Y-%m-%d'
              ) AS DtaAmostraRecebida,
              DATE_FORMAT(
                (SELECT MIN(rh.DtaEvento) FROM requisicaohistorico rh
                  WHERE rh.IdRequisicao = r.IdRequisicao AND rh.CodEvento = ?),
                '%Y-%m-%d'
              ) AS DtaAdmissao,
              DATE_FORMAT(
                (SELECT MAX(rh.DtaEvento) FROM requisicaohistorico rh
                  WHERE rh.IdRequisicao = r.IdRequisicao AND rh.CodEvento = ?),
                '%Y-%m-%d'
              ) AS DtaRetificacao,
              DATE_FORMAT(
                (SELECT MAX(rh.DtaEvento) FROM requisicaohistorico rh
                  WHERE rh.IdRequisicao = r.IdRequisicao AND rh.CodEvento = ?),
                '%Y-%m-%d %H:%i:%s'
              ) AS DtaRecorteColoracao,
              (SELECT COUNT(*) FROM consenso c
                 JOIN consensodetalhe cd ON cd.IdConsenso = c.IdConsenso
                WHERE c.IdRequisicao = r.IdRequisicao AND cd.DtaResposta IS NULL
              ) AS ConsensoPendenteQtd,
              DATE_FORMAT(
                (SELECT MIN(c.DtaCriacao) FROM consenso c WHERE c.IdRequisicao = r.IdRequisicao),
                '%Y-%m-%d %H:%i:%s'
              ) AS DtaConsensoCriado,
              DATE_FORMAT(
                (SELECT MAX(rp.DtaProblema) FROM requisicaoproblema rp
                  WHERE rp.IdRequisicao = r.IdRequisicao AND rp.CodProblema = ?),
                '%Y-%m-%d %H:%i:%s'
              ) AS DtaBlocoDanificado,
              (SELECT COUNT(*) FROM blocorequisicao br
                 JOIN bloco b ON b.IdBloco = br.IdBloco
                WHERE br.IdRequisicao = r.IdRequisicao
              ) AS NumBlocos,
              (SELECT COUNT(*) FROM laminarequisicao lr
                 JOIN lamina la ON la.IdLamina = lr.IdLamina
                WHERE lr.IdRequisicao = r.IdRequisicao
              ) AS NumLaminas,
              DATE_FORMAT(
                (SELECT MIN(la.DtaCriacao) FROM laminarequisicao lr
                   JOIN lamina la ON la.IdLamina = lr.IdLamina
                  WHERE lr.IdRequisicao = r.IdRequisicao),
                '%Y-%m-%d %H:%i:%s'
              ) AS DtaPrimeiraLaminaPronta,
              DATE_FORMAT(
                (SELECT MAX(rh.DtaEvento) FROM requisicaohistorico rh
                  WHERE rh.IdRequisicao = r.IdRequisicao AND rh.CodEvento = ?),
                '%Y-%m-%d %H:%i:%s'
              ) AS DtaMicroscopiaAguardando,
              DATE_FORMAT(
                (SELECT MAX(rp.DtaProblema) FROM requisicaoproblema rp
                  WHERE rp.IdRequisicao = r.IdRequisicao AND rp.CodProblema = ?),
                '%Y-%m-%d %H:%i:%s'
              ) AS DtaAmostraNaoRecebida,
              DATE_FORMAT(
                (SELECT MAX(rp.DtaProblema) FROM requisicaoproblema rp
                  WHERE rp.IdRequisicao = r.IdRequisicao AND rp.CodProblema = ?),
                '%Y-%m-%d %H:%i:%s'
              ) AS DtaMaterialDevolvido
         FROM requisicao r
         LEFT JOIN exame ex ON ex.CodExame = r.CodExame
         LEFT JOIN exametipo et ON et.CodExameTipo = ex.CodExameTipo
         LEFT JOIN medico med ON med.CodMedico = r.IdPatologista
        WHERE ${periodo.sql}
        ORDER BY r.DtaSolicitacao DESC`,
      [
        COD_EVENTO_AMOSTRA_RECEBIDA,
        COD_EVENTO_ADMISSAO,
        COD_EVENTO_RETIFICACAO,
        COD_EVENTO_RECORTE_COLORACAO,
        COD_PROBLEMA_BLOCO_DANIFICADO,
        COD_EVENTO_MICROSCOPIA_AGUARDANDO,
        COD_PROBLEMA_AMOSTRA_NAO_RECEBIDA,
        COD_PROBLEMA_MATERIAL_DEVOLVIDO_NAO_CONFORME,
        ...periodo.valores,
      ],
    );
    return {
      requisicoes: linhas.map((linha) => {
        const codExameTipoLis = inteiroOuNulo(linha.CodExameTipo);
        const dtaRetificacao = dataIso(linha.DtaRetificacao);
        const dtaRecorteColoracao = dataIso(linha.DtaRecorteColoracao);
        const dtaBlocoDanificado = dataIso(linha.DtaBlocoDanificado);
        const dtaAmostraNaoRecebida = dataIso(linha.DtaAmostraNaoRecebida);
        const dtaMaterialDevolvido = dataIso(linha.DtaMaterialDevolvido);
        return {
          idRequisicaoLis: numero(linha.IdRequisicao) ?? 0,
          codRequisicao: texto(linha.CodRequisicao) ?? '',
          codExameTipoLis,
          exameTipoNomeLis: texto(linha.NomExameTipo),
          secaoLis: codExameTipoLis !== null ? (SECAO_POR_COD_EXAME_TIPO.get(codExameTipoLis) ?? null) : null,
          dtaSolicitacao: dataIso(linha.DtaSolicitacao) ?? inicio,
          dtaColeta: dataIso(linha.DtaColeta),
          dtaAmostraRecebida: dataIso(linha.DtaAmostraRecebida),
          dtaAdmissao: dataIso(linha.DtaAdmissao),
          dtaPrevista: dataIso(linha.DtaPrevista),
          dtaLiberacao: dataIso(linha.DtaLiberacao),
          patologistaNomeLis: texto(linha.PatologistaNome),
          retificado: dtaRetificacao !== null,
          dtaRetificacao,
          dtaPrevistaSetor: dataIso(linha.DtaPrevistaSetor),
          recorteColoracao: dtaRecorteColoracao !== null,
          dtaRecorteColoracao,
          consensoPendente: (numero(linha.ConsensoPendenteQtd) ?? 0) > 0,
          dtaConsensoCriado: dataIso(linha.DtaConsensoCriado),
          blocoDanificado: dtaBlocoDanificado !== null,
          dtaBlocoDanificado,
          numBlocos: numero(linha.NumBlocos) ?? 0,
          numLaminas: numero(linha.NumLaminas) ?? 0,
          dtaPrimeiraLaminaPronta: dataIso(linha.DtaPrimeiraLaminaPronta),
          dtaMicroscopiaAguardando: dataIso(linha.DtaMicroscopiaAguardando),
          amostraNaoRecebida: dtaAmostraNaoRecebida !== null,
          dtaAmostraNaoRecebida,
          materialDevolvidoNaoConforme: dtaMaterialDevolvido !== null,
          dtaMaterialDevolvido,
        };
      }),
    };
  });
}

// ── PII sob demanda (Cortesias/IHQ) ──────────────────────────────────────────

export type BuscarNomesResultado = { nomes: Record<string, string> } | ErroConsultaLis;

/** Nome do paciente por `CodRequisicao`, em lote — nunca persistido nas tabelas `qa_*` (P10). */
export async function buscarNomesPacientesPorRequisicoesLis(codigos: readonly string[]): Promise<BuscarNomesResultado> {
  if (codigos.length === 0) return { nomes: {} };
  return comConexao('buscarNomesPacientesPorRequisicoesLis', async (conn) => {
    const placeholders = codigos.map(() => '?').join(', ');
    const [linhas] = await conn.execute<mysql.RowDataPacket[]>(
      `SELECT r.CodRequisicao, p.NomPaciente
         FROM requisicao r
         JOIN paciente p ON p.CodPaciente = r.CodPaciente
        WHERE r.CodRequisicao IN (${placeholders})`,
      [...codigos],
    );
    const nomes: Record<string, string> = {};
    for (const linha of linhas) {
      const cod = texto(linha.CodRequisicao);
      const nome = texto(linha.NomPaciente);
      if (cod && nome) nomes[cod] = nome;
    }
    return { nomes };
  });
}
