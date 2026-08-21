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

// Datas já saem 'YYYY-MM-DD' do MySQL (DATE_FORMAT); só normaliza o vazio.
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
      `SELECT r.CodRequisicao,
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
        GROUP BY r.CodRequisicao, ra.DtaCriacao, ra.DtaFinalizacao, r.IdConvenio, fc.NomConvenio, ev.DesEvento, ra.Solicitante, ra.Observacao
        ORDER BY ra.DtaCriacao DESC`,
      valores,
    );
    return {
      cortesias: linhas.map((linha) => ({
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
      `SELECT r.CodRequisicao, r.CodPaciente,
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
