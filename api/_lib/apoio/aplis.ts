// api/_lib/apoio/aplis.ts
// Cliente do apLIS (LIS atual do laboratório) — port de _aplis_* do envio_alvaro.
// Um único endpoint POST com envelope {ver, cmd, dat}; usado para conferir a
// requisição digitada/ocr contra o cadastro oficial (requisicaoListar).
//
// Env: APLIS_BASE_URL (default https://lab.aplis.inf.br/api/integracao.php),
//      APLIS_TOKEN OU APLIS_USUARIO+APLIS_SENHA (Basic).
// Obs.: o worker billing-sync usa outras envs (APLIS_API_URL/USERNAME/PASSWORD) —
// processos distintos, nomes mantidos como no envio_alvaro para reusar o .env.

import type { PipelineLog } from './log.js';

const APLIS_URL_PADRAO = 'https://lab.aplis.inf.br/api/integracao.php';
const TIMEOUT_MS = 15000;

// Item bruto de dat.lista[0] + normalização usada pelo pipeline.
export interface RequisicaoAplis {
  nome: string | null;
  cpf: string | null;
  datanasc: string | null;
  sexo: string | null;
  email: string | null;
  medico_nome: string | null;
  medico_crm: string | null;
  data_solicitacao: string | null;
  convenio: string | null;
  num_guia: string | null;
  status: string | null;
  id_requisicao: string | null;
  cod_requisicao: string | null;
  exames: unknown[];
  _raw: Record<string, unknown>;
}

function headerAutorizacao(): string | null {
  const token = (process.env.APLIS_TOKEN ?? '').trim();
  if (token) {
    return token.startsWith('Bearer ') || token.startsWith('Basic ') ? token : `Bearer ${token}`;
  }
  const usuario = (process.env.APLIS_USUARIO ?? '').trim();
  const senha = (process.env.APLIS_SENHA ?? '').trim();
  if (usuario && senha) {
    return 'Basic ' + Buffer.from(`${usuario}:${senha}`).toString('base64');
  }
  return null;
}

async function aplisPost(
  cmd: string,
  dat: Record<string, unknown>,
  log: PipelineLog,
): Promise<Record<string, unknown>> {
  const url = (process.env.APLIS_BASE_URL ?? '').trim().replace(/\/+$/, '') || APLIS_URL_PADRAO;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  const auth = headerAutorizacao();
  if (auth) headers.Authorization = auth;

  log.send(`APLIS → ${url}`, { cmd, dat });
  try {
    const resposta = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ver: 1, cmd, dat }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const corpo = await resposta.text();
    log.recv(`APLIS HTTP ${resposta.status} (${corpo.length} bytes)`, corpo.slice(0, 1500));
    try {
      return JSON.parse(corpo) as Record<string, unknown>;
    } catch (err) {
      log.error(`Resposta APLIS não é JSON: ${String(err)}`, corpo.slice(0, 500));
      return { _erro: `JSON inválido: ${String(err)}`, _raw: corpo };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`APLIS conexão: ${msg}`);
    return { _erro: `Conexão: ${msg}` };
  }
}

/** Busca a requisição pelo código via 'requisicaoListar'; null quando não achar. */
export async function buscarRequisicaoAplis(
  codRequisicao: string,
  log: PipelineLog,
): Promise<RequisicaoAplis | null> {
  log.info(`Consultando APLIS — requisicaoListar | codRequisicao: ${codRequisicao}`);

  const resposta = await aplisPost('requisicaoListar', { codRequisicao }, log);
  if (resposta._erro) {
    log.error(`Falha na chamada APLIS: ${String(resposta._erro)}`);
    return null;
  }

  const dat = (resposta.dat ?? {}) as Record<string, unknown>;
  if (!dat.sucesso) {
    log.error(`APLIS sucesso=0 | codErro=${String(dat.codErro ?? '')} | ${String(dat.msgErro ?? 'Resposta sem sucesso')}`, dat);
    return null;
  }

  const lista = Array.isArray(dat.lista) ? (dat.lista as Record<string, unknown>[]) : [];
  if (lista.length === 0) {
    log.warn(`APLIS: lista vazia para requisição '${codRequisicao}'`);
    return null;
  }

  const item = lista[0];
  log.ok('APLIS encontrou requisição', {
    NomPaciente: item.NomPaciente,
    CPF: item.CPF,
    CRM: item.CRM,
    CRMUF: item.CRMUF,
    DtaSolicitacao: item.DtaSolicitacao,
    DesEvento: item.DesEvento,
  });
  return normalizarAplis(item);
}

// Ex. de item real: { IdRequisicao: 181957, CodRequisicao: '0040001616008',
//   DtaSolicitacao: '08/04/2026 13:54', NomPaciente: '...', CPF: '...',
//   CRM: '8002', CRMUF: 'DF', ... }
function normalizarAplis(item: Record<string, unknown>): RequisicaoAplis {
  const str = (v: unknown): string | null => {
    if (v === null || v === undefined || v === '' || v === '-') return null;
    return String(v).trim();
  };

  const crm = str(item.CRM);
  const uf = str(item.CRMUF);
  const crmCompleto = crm && uf ? `${crm}-${uf}` : crm;

  // "08/04/2026 13:54" → só a data
  const dataSolRaw = str(item.DtaSolicitacao) ?? str(item.DtaFinalizacao);
  const dataSol = dataSolRaw ? dataSolRaw.split(' ')[0] : null;

  return {
    nome: str(item.NomPaciente),
    cpf: str(item.CPF),
    datanasc: null, // requisicaoListar não retorna
    sexo: null,
    email: null,
    medico_nome: null, // nome completo do médico não retorna aqui
    medico_crm: crmCompleto,
    data_solicitacao: dataSol,
    convenio: null,
    num_guia: str(item.NumExterno),
    status: str(item.DesEvento),
    id_requisicao: str(item.IdRequisicao),
    cod_requisicao: str(item.CodRequisicao),
    exames: [], // a listagem não traz exames individuais
    _raw: item,
  };
}
