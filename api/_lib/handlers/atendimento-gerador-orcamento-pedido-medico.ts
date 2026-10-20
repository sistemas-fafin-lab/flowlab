/**
 * API Route: POST /api/atendimento/gerador-orcamento-pedido-medico
 *
 * Leitura do pedido médico por IA no Gerador de Orçamento. Mesmo fluxo do envio ao
 * apoio (apoio-process-image): o navegador sobe as fotos/PDFs direto no bucket
 * privado 'atendimento-pedidos-medicos' e manda aqui só os paths — o corpo não
 * esbarra no limite da Vercel. O handler baixa os arquivos com service role, chama
 * o Gemini com o prompt versionado (api/_lib/atendimento/promptPedidoMedico.ts) e
 * os nomes da lista de preços, e casa a resposta com a lista
 * (api/_lib/atendimento/leituraPedidoMedico.ts).
 *
 * Os arquivos são APAGADOS do bucket ao fim, com sucesso ou falha (dado de saúde de
 * paciente não fica guardado). Só depois de autorizar e validar os paths: quem não
 * pode usar a rota não apaga nada, e cada usuário só lê (e apaga) arquivos da
 * própria pasta (`<user id>/...`, também exigida pela policy de upload).
 *
 * Autorização: header `Authorization: Bearer <access_token>` da SESSÃO do usuário
 * (exige canUseGeradorOrcamento). Regra em api/_lib/atendimento/autorizacao.ts.
 * Body: { paths: string[] (1..5, todos em `<user id>/`) } — resposta:
 * { success, exames: [{ nomeNoPedido, item: { tuss, nome } | null }] }.
 *
 * Variáveis de ambiente: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY,
 *   GEMINI_MODEL (opcional).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '../supabase.js';
import { describeError } from '../errors.js';
import { autorizarGeradorOrcamento, tokenDoHeader } from '../atendimento/autorizacao.js';
import { buildOrcamentoParticular } from '../orcamentoParticular.js';
import { montarPromptPedidoMedico } from '../atendimento/promptPedidoMedico.js';
import { casarExamesLidos, lerRespostaIa } from '../atendimento/leituraPedidoMedico.js';
import {
  lerPedidoMedicoComGemini,
  TempoEsgotadoIaError,
  type ArquivoPedidoMedico,
} from '../atendimento/geminiPedidoMedico.js';

const BUCKET = 'atendimento-pedidos-medicos';
const MAX_ARQUIVOS = 5;

/** Falha com status e mensagem pronta para a tela. */
class FalhaLeitura extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function extrairPaths(body: unknown, userId: string): string[] | null {
  const paths = (body as { paths?: unknown })?.paths;
  if (!Array.isArray(paths) || paths.length === 0 || paths.length > MAX_ARQUIVOS) return null;
  const limpos: string[] = [];
  for (const p of paths) {
    if (typeof p !== 'string' || !p.trim() || p.includes('..')) return null;
    if (!p.trim().startsWith(`${userId}/`)) return null;
    limpos.push(p.trim());
  }
  return limpos;
}

// O bucket só aceita imagens e PDF (allowed_mime_types); a extensão cobre um blob sem tipo.
function mimeDoArquivo(blob: Blob, path: string): string {
  const tipo = (blob.type || '').toLowerCase();
  if (tipo === 'application/pdf' || tipo.startsWith('image/')) return tipo;
  return path.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
}

async function baixarArquivos(supabase: SupabaseClient, paths: string[]): Promise<ArquivoPedidoMedico[]> {
  const arquivos: ArquivoPedidoMedico[] = [];
  for (const path of paths) {
    const { data, error } = await supabase.storage.from(BUCKET).download(path);
    if (error || !data) throw new FalhaLeitura(400, 'Um dos arquivos enviados não foi encontrado. Envie de novo.');
    arquivos.push({ data: Buffer.from(await data.arrayBuffer()), mimeType: mimeDoArquivo(data, path) });
  }
  return arquivos;
}

async function lerPedido(supabase: SupabaseClient, paths: string[]) {
  const arquivos = await baixarArquivos(supabase, paths);

  // Item sem nome não é orçável (a tela também o descarta).
  const lista = (await buildOrcamentoParticular(supabase, { incluirCusto: false })).filter(
    (i): i is typeof i & { nome: string } => !!i.nome,
  );

  let texto: string;
  try {
    texto = await lerPedidoMedicoComGemini(arquivos, montarPromptPedidoMedico(lista.map((i) => i.nome)));
  } catch (err) {
    if (err instanceof TempoEsgotadoIaError) {
      throw new FalhaLeitura(504, 'A IA demorou demais para ler o pedido. Tente de novo.');
    }
    console.error('[atendimento/gerador-orcamento-pedido-medico] falha do Gemini:', describeError(err));
    throw new FalhaLeitura(502, 'A IA não conseguiu ler o pedido agora. Tente de novo em instantes.');
  }

  const exames = casarExamesLidos(lerRespostaIa(texto), lista);
  if (!exames) {
    console.error('[atendimento/gerador-orcamento-pedido-medico] resposta sem lista de exames:', texto.slice(0, 500));
    throw new FalhaLeitura(502, 'A IA não devolveu uma lista de exames. Tente com uma foto mais nítida.');
  }
  return exames.map(({ nomeNoPedido, item }) => ({
    nomeNoPedido,
    item: item ? { tuss: item.tuss, nome: item.nome } : null,
  }));
}

async function apagarArquivos(supabase: SupabaseClient, paths: string[]): Promise<void> {
  try {
    const { error } = await supabase.storage.from(BUCKET).remove(paths);
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error('[atendimento/gerador-orcamento-pedido-medico] falha ao apagar arquivos:', describeError(err));
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ success: false, error: 'Método não permitido' });
    return;
  }

  let supabase: SupabaseClient;
  let userId: string;
  try {
    const autorizacao = await autorizarGeradorOrcamento(tokenDoHeader(req.headers.authorization));
    if ('falha' in autorizacao) {
      res.status(autorizacao.falha.status).json(autorizacao.falha.payload);
      return;
    }
    userId = autorizacao.acesso.userId;
    supabase = getSupabaseAdminClient();
  } catch (err) {
    console.error('[atendimento/gerador-orcamento-pedido-medico] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
    return;
  }

  const paths = extrairPaths(req.body, userId);
  if (!paths) {
    res.status(400).json({ success: false, error: `Envie de 1 a ${MAX_ARQUIVOS} arquivos do pedido médico.` });
    return;
  }

  // Apaga antes de responder: depois da resposta a Vercel pode congelar a função.
  const desfecho = await lerPedido(supabase, paths).then(
    (exames) => ({ exames }),
    (erro: unknown) => ({ erro }),
  );
  await apagarArquivos(supabase, paths);

  if ('exames' in desfecho) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true, exames: desfecho.exames });
  } else if (desfecho.erro instanceof FalhaLeitura) {
    res.status(desfecho.erro.status).json({ success: false, error: desfecho.erro.message });
  } else {
    console.error('[atendimento/gerador-orcamento-pedido-medico] erro:', describeError(desfecho.erro));
    res.status(500).json({ success: false, error: 'Erro interno ao ler o pedido médico.' });
  }
}
