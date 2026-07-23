// Módulo Análises Clínicas — chamadas autenticadas da tela Envio ao Apoio.
// As três actions passam pela API (não pelo supabase-js) porque dependem de
// segredos server-side (GEMINI_API_KEY, APLIS_*, AOL_*): OCR, regeração de XML e
// envio real ao Álvaro. Upload dos arquivos vai direto ao bucket privado
// 'ac-apoio-requisicoes' — a API recebe só os paths.

import { supabase } from '../../lib/supabase';
import type {
  ApoioExameExtraido,
  ApoioLogEntry,
  ApoioPipelineResult,
  ApoioTransferResultado,
} from './types';

export const BUCKET_APOIO_REQUISICOES = 'ac-apoio-requisicoes';

async function chamarApoioApi<T>(action: string, body: Record<string, unknown>): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Sessão expirada. Faça login novamente.');

  const res = await fetch(`/api/analises-clinicas/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const payload = (await res.json().catch(() => ({}))) as T & { success?: boolean; error?: string; erro?: string };
  if (!res.ok || payload.success === false) {
    throw new Error(payload.error || payload.erro || `Falha na chamada ${action} (HTTP ${res.status}).`);
  }
  return payload;
}

/** Sobe os arquivos da requisição para o bucket privado; retorna os paths. */
export async function uploadArquivosRequisicao(files: File[]): Promise<string[]> {
  const pasta = crypto.randomUUID();
  const paths: string[] = [];
  for (const file of files) {
    // Nome saneado: o path do storage não aceita qualquer caractere
    const nomeSeguro = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${pasta}/${nomeSeguro}`;
    const { error } = await supabase.storage
      .from(BUCKET_APOIO_REQUISICOES)
      .upload(path, file, { contentType: file.type || undefined });
    if (error) throw new Error(`Falha no upload de ${file.name}: ${error.message}`);
    paths.push(path);
  }
  return paths;
}

/** Roda o pipeline OCR → apLIS → XML sobre os arquivos já no bucket. */
export function processarRequisicao(
  paths: string[],
  numeroRequisicao: string | null,
): Promise<ApoioPipelineResult> {
  return chamarApoioApi<ApoioPipelineResult>('apoio-process-image', {
    paths,
    numero_requisicao: numeroRequisicao ?? undefined,
  });
}

export interface RebuildXmlResposta {
  success: boolean;
  xml: string;
  log: ApoioLogEntry[];
  total_exames: number;
}

/** Regenera o XML com a seleção de exames e as correções do operador. */
export function regerarXml(
  rawResult: ApoioPipelineResult,
  examesSelecionados: ApoioExameExtraido[],
  overrides: Record<string, string>,
): Promise<RebuildXmlResposta> {
  return chamarApoioApi<RebuildXmlResposta>('apoio-rebuild-xml', {
    raw_result: rawResult,
    exames_selecionados: examesSelecionados,
    overrides,
  });
}

/** Envia itens da fila ao Álvaro (cria OS reais no apoio!). */
export async function transferirParaAlvaro(ids: string[]): Promise<ApoioTransferResultado[]> {
  const resposta = await chamarApoioApi<{ resultados: ApoioTransferResultado[] }>(
    'apoio-transferir',
    { ids },
  );
  return resposta.resultados ?? [];
}
