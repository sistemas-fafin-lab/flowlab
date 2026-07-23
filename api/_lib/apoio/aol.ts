// api/_lib/apoio/aol.ts
// Envio da solicitação ao webservice AOL do Álvaro (port de /transferir do
// envio_alvaro). O XML chega com placeholders e as credenciais reais (AOL_*)
// entram aqui, server-side, imediatamente antes do PUT.

import { injetarCredenciais } from './xmlAol.js';

const AOL_URL_PADRAO = 'https://webservice.alvaro.com.br';
const TIMEOUT_MS = 30000;

export interface RespostaAol {
  httpStatus: number;
  texto: string;
}

function basicAuth(): string | null {
  const idagente = (process.env.AOL_IDAGENTE ?? '').trim();
  const senha = (process.env.AOL_SENHA ?? '').trim();
  if (!idagente || !senha) return null;
  return 'Basic ' + Buffer.from(`${idagente}:${senha}`).toString('base64');
}

/** PUT /webserviceaol/rest/producao — inclui a solicitação de exames no Álvaro. */
export async function enviarSolicitacaoAol(xmlComPlaceholders: string): Promise<RespostaAol> {
  const base = (process.env.AOL_BASE_URL ?? '').trim().replace(/\/+$/, '') || AOL_URL_PADRAO;
  const headers: Record<string, string> = {
    'Content-Type': 'text/xml; charset=UTF-8',
    Accept: 'application/xml',
  };
  const auth = basicAuth();
  if (auth) headers.Authorization = auth;

  const resposta = await fetch(`${base}/webserviceaol/rest/producao`, {
    method: 'PUT',
    headers,
    body: injetarCredenciais(xmlComPlaceholders),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return { httpStatus: resposta.status, texto: await resposta.text() };
}
