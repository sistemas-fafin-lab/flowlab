/**
 * API Route: POST /api/analises-clinicas/apoio-transferir
 *
 * ENVIA as requisições da fila (ac_apoio_fila) ao Álvaro — port do /transferir do
 * envio_alvaro. Para cada id: marca 'enviando', injeta as credenciais AOL no XML
 * (server-side), faz o PUT, avalia HTTP + regras de negócio da resposta e grava o
 * desfecho ('enviado' ou 'erro'). Em sucesso, upserta ac_apoio_requisicoes
 * (codigo_lis → idAlvaro) — o elo para buscar o laudo depois.
 *
 * ATENÇÃO: cria OS de verdade no laboratório de apoio. Sem retry automático: o
 * operador reenvia pela UI depois de corrigir o motivo do erro.
 *
 * Autorização: JWT de SESSÃO do operador (canManageColetas).
 * Body: { ids: string[] } — resposta: { success, resultados: [{id, ok, ...}] }.
 *
 * Variáveis de ambiente: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   AOL_BASE_URL (opcional), AOL_IDAGENTE, AOL_SENHA, AOL_CHAVE.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '../supabase.js';
import { autorizarOperador } from '../recepcaoAgendamento.js';
import { describeError } from '../errors.js';
import { enviarSolicitacaoAol } from '../apoio/aol.js';
import { avaliarRespostaAol, extrairIdAlvaro, extrairDadosXmlEnvio } from '../apoio/xmlAol.js';

interface ItemFila {
  id: string;
  status: string;
  numero_requisicao: string | null;
  paciente: Record<string, unknown> | null;
  xml_envio: string | null;
  created_at: string;
  updated_at: string;
}

interface ResultadoItem {
  id: string;
  ok: boolean;
  http_status?: number;
  alvaro_response?: string;
  erro?: string;
  requisicoes_salvo?: boolean;
  requisicoes_erro?: string;
}

// Upsert do vínculo requisição LIS → OS do Álvaro (port de _persistir_requisicao_enviada).
async function persistirRequisicaoEnviada(
  supabase: SupabaseClient,
  item: ItemFila,
  respostaTexto: string,
  httpStatus: number,
): Promise<void> {
  const dadosXml = extrairDadosXmlEnvio(item.xml_envio ?? '');
  const paciente = item.paciente ?? {};

  const codigoLis = String(item.numero_requisicao ?? '').trim() || dadosXml.codigo_lis;
  const codigoOs = extrairIdAlvaro(respostaTexto);
  if (!codigoLis) throw new Error('Não foi possível determinar codigo_lis da requisição');
  if (!codigoOs) throw new Error('Não foi possível extrair idAlvaro (codigo_os) da resposta');

  const nome =
    String(paciente.nome ?? '').trim() || dadosXml.nome || 'NAO INFORMADO';
  const datanasc =
    String(paciente.datanasc ?? '').trim() || dadosXml.datanasc || '1900-01-01';
  const dataColeta =
    dadosXml.data_coleta || item.updated_at || item.created_at || '1970-01-01T00:00:00+00:00';

  const { error } = await supabase.from('ac_apoio_requisicoes').upsert(
    {
      codigo_lis: codigoLis,
      codigo_os: codigoOs,
      nome,
      datanasc,
      data_coleta: dataColeta,
      laudo: { http_status: httpStatus, resposta_alvaro: respostaTexto },
    },
    { onConflict: 'codigo_lis' },
  );
  if (error) throw new Error(error.message);
}

async function enviarItem(supabase: SupabaseClient, itemId: string): Promise<ResultadoItem> {
  const { data: rows, error: erroBusca } = await supabase
    .from('ac_apoio_fila')
    .select('id,status,numero_requisicao,paciente,xml_envio,created_at,updated_at')
    .eq('id', itemId)
    .limit(1);
  if (erroBusca) return { id: itemId, ok: false, erro: erroBusca.message };

  const item = rows?.[0] as ItemFila | undefined;
  if (!item) return { id: itemId, ok: false, erro: 'Registro não encontrado' };

  const statusAtual = (item.status ?? '').trim().toLowerCase();
  if (statusAtual !== 'aguardando' && statusAtual !== 'enviando') {
    return { id: itemId, ok: false, erro: `Status atual não permite envio: ${statusAtual || 'desconhecido'}` };
  }
  if (!item.xml_envio?.trim()) {
    return { id: itemId, ok: false, erro: 'Item sem XML de envio' };
  }

  await supabase.from('ac_apoio_fila').update({ status: 'enviando' }).eq('id', itemId);

  const { httpStatus, texto } = await enviarSolicitacaoAol(item.xml_envio);
  const { ok: okRegra, erro: erroRegra } = avaliarRespostaAol(texto, httpStatus);
  const okFinal = httpStatus >= 200 && httpStatus < 300 && okRegra;

  await supabase
    .from('ac_apoio_fila')
    .update({
      status: okFinal ? 'enviado' : 'erro',
      alvaro_response: texto,
      erro_mensagem: okFinal ? null : erroRegra || `HTTP ${httpStatus}`,
    })
    .eq('id', itemId);

  const resultado: ResultadoItem = {
    id: itemId,
    ok: okFinal,
    http_status: httpStatus,
    alvaro_response: texto,
  };
  if (!okFinal) resultado.erro = erroRegra || `HTTP ${httpStatus}`;

  if (okFinal) {
    try {
      await persistirRequisicaoEnviada(supabase, item, texto, httpStatus);
      resultado.requisicoes_salvo = true;
    } catch (err) {
      // Envio já aconteceu — não vira 'erro' na fila, mas o operador precisa saber
      resultado.requisicoes_salvo = false;
      resultado.requisicoes_erro = describeError(err);
      console.error(`[apoio-transferir] falha ao salvar ac_apoio_requisicoes (id=${itemId}):`, describeError(err));
    }
  }
  return resultado;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ success: false, error: 'Método não permitido' });
    return;
  }

  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const erroAuth = await autorizarOperador(token);
  if (erroAuth) {
    res.status(erroAuth.status).json(erroAuth.payload);
    return;
  }

  const ids = (req.body as { ids?: unknown })?.ids;
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((i) => typeof i === 'string')) {
    res.status(400).json({ success: false, error: "Informe 'ids' com os itens da fila a enviar." });
    return;
  }

  try {
    const supabase = getSupabaseAdminClient();
    const resultados: ResultadoItem[] = [];
    // Sequencial de propósito: espelha o legado e evita rajada contra o webservice
    for (const itemId of ids) {
      try {
        resultados.push(await enviarItem(supabase, itemId));
      } catch (err) {
        const msg = describeError(err);
        await supabase
          .from('ac_apoio_fila')
          .update({ status: 'erro', erro_mensagem: msg })
          .eq('id', itemId);
        resultados.push({ id: itemId, ok: false, erro: msg });
      }
    }
    res.status(200).json({ success: true, resultados });
  } catch (err) {
    console.error('[analises-clinicas/apoio-transferir] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno ao enviar ao apoio.' });
  }
}
