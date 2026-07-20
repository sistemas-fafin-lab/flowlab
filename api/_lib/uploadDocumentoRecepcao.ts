// api/_lib/uploadDocumentoRecepcao.ts
// Upload de documento do paciente pela recepção do FlowLab, contra o LAB-HUB.
// Agnóstico de framework: retorna { status, payload } para servir tanto a função
// Vercel quanto o middleware de dev do Vite.
//
// Espelha documentosCheckin.ts / recepcaoAgendamento.ts:
//   1. Autoriza pelo JWT de SESSÃO do operador (canManageColetas — NÃO a
//      FLOWLAB_API_KEY).
//   2. Resolve o labhub_id A PARTIR do id do FlowLab — o cliente NUNCA escolhe a
//      chave que vai ao LAB-HUB (ver o cabeçalho de documentosCheckin.ts).
//   3. Repassa os bytes ao LAB-HUB com x-api-key.
//
// Os bytes NÃO ficam no FlowLab: passam direto para o LAB-HUB, onde vivem os
// documentos (LGPD — uma cópia, um lugar para apagar).

import { getSupabaseAdminClient } from './supabase.js';
import { requireEnv } from './labhubIntegration.js';
import { describeError } from './errors.js';

interface FlowResult {
  status: number;
  payload: Record<string, unknown>;
}

// Upload é mais pesado que as consultas (deliver-*/documentosCheckin usam 10s):
// timeout maior para tolerar o tráfego dos bytes.
const LABHUB_TIMEOUT_MS = 20000;

// Casa com o teto do bucket e do upload do paciente no LAB-HUB (routes/documentos.ts).
const TAMANHO_MAX_BYTES = 10 * 1024 * 1024;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Espelha o CHECK de documentos.tipo no LAB-HUB (schemas/documento.ts).
const TIPOS_VALIDOS = new Set(['identidade', 'carteirinha', 'pedido_medico', 'outro']);

// ── Autorização ───────────────────────────────────────────────────────────────
// ATENÇÃO: `token` é o JWT de SESSÃO do operador, não a FLOWLAB_API_KEY. Idêntica a
// recepcaoAgendamento.autorizarOperador — replicada de propósito, para cada arquivo
// documentar (e garantir) o invariante do "Bearer = sessão do operador".
async function autorizarOperador(token: string | null): Promise<FlowResult | null> {
  if (!token) {
    return { status: 401, payload: { success: false, error: 'Token de autenticação ausente.' } };
  }
  const supabase = getSupabaseAdminClient();

  const { data: caller, error: callerErr } = await supabase.auth.getUser(token);
  if (callerErr || !caller?.user) {
    return { status: 401, payload: { success: false, error: 'Sessão inválida ou expirada.' } };
  }

  const { data: callerProfile } = await supabase
    .from('user_profiles')
    .select('role, custom_roles(permissions)')
    .eq('id', caller.user.id)
    .single();

  const callerPermissions: string[] =
    (callerProfile?.custom_roles as { permissions?: string[] } | null)?.permissions ?? [];
  const authorized =
    callerProfile?.role === 'admin' || callerPermissions.includes('canManageColetas');

  if (!authorized) {
    return { status: 403, payload: { success: false, error: 'Sem permissão para anexar documentos.' } };
  }
  return null;
}

export async function uploadDocumentoRecepcao(
  token: string | null,
  agendamentoId: string | undefined,
  tipo: string | undefined,
  nomeArquivo: string | undefined,
  buffer: Buffer,
): Promise<FlowResult> {
  const erroAuth = await autorizarOperador(token);
  if (erroAuth) return erroAuth;

  // Validação local antes de qualquer ida ao LAB-HUB.
  if (!agendamentoId || !UUID_RE.test(agendamentoId)) {
    return { status: 400, payload: { success: false, error: 'Parâmetro inválido: agendamentoId.' } };
  }
  if (!tipo || !TIPOS_VALIDOS.has(tipo)) {
    return { status: 400, payload: { success: false, error: 'Tipo de documento inválido.' } };
  }
  if (!buffer || buffer.length === 0) {
    return { status: 400, payload: { success: false, error: 'Arquivo ausente.' } };
  }
  if (buffer.length > TAMANHO_MAX_BYTES) {
    return { status: 413, payload: { success: false, error: 'Arquivo maior que 10 MB.' } };
  }

  const supabase = getSupabaseAdminClient();

  // Resolve o labhub_id a partir do id do FlowLab. O parâmetro é SEMPRE o id do
  // FlowLab (ac_agendamentos.id), nunca o labhub_id: o cliente não escolhe a chave
  // que vai ao outro sistema.
  const { data: agendamento, error: agErr } = await supabase
    .from('ac_agendamentos')
    .select('labhub_id')
    .eq('id', agendamentoId)
    .maybeSingle();

  if (agErr) {
    console.error('[uploadDocumentoRecepcao] falha ao carregar agendamento:', describeError(agErr));
    return { status: 500, payload: { success: false, error: 'Erro interno.' } };
  }
  if (!agendamento) {
    return { status: 404, payload: { success: false, error: 'Agendamento não encontrado.' } };
  }
  // Agendamento nativo do FlowLab (criado à mão, sem LAB-HUB): não há paciente lá
  // para anexar. Só agendamentos vindos do LAB-HUB têm documentos.
  if (!agendamento.labhub_id) {
    return {
      status: 409,
      payload: {
        success: false,
        error: 'Agendamento sem vínculo com o LAB-HUB; não é possível anexar documentos.',
      },
    };
  }

  const url = `${requireEnv('LABHUB_API_URL')}/api/v1/integracao/agendamentos/${agendamento.labhub_id}/documentos?tipo=${encodeURIComponent(tipo)}`;

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: {
        // Header x-api-key (não Authorization): no LAB-HUB, Bearer = JWT de paciente.
        'x-api-key': requireEnv('FLOWLAB_API_KEY'),
        'content-type': 'application/octet-stream',
        ...(nomeArquivo ? { 'x-nome-arquivo': encodeURIComponent(nomeArquivo) } : {}),
      },
      body: buffer,
      signal: AbortSignal.timeout(LABHUB_TIMEOUT_MS),
    });
  } catch (err) {
    console.error('[uploadDocumentoRecepcao] LAB-HUB não respondeu:', describeError(err));
    return { status: 504, payload: { success: false, error: 'O LAB-HUB não respondeu. Tente de novo.' } };
  }

  if (!resp.ok) {
    // 400/413 são acionáveis pelo operador (formato não suportado / arquivo grande):
    // repassa a mensagem do LAB-HUB. Os demais são falha nossa/infra e viram genérico.
    if (resp.status === 400 || resp.status === 413) {
      const errBody = (await resp.json().catch(() => null)) as
        | { message?: string; error?: string }
        | null;
      const msg = errBody?.message || errBody?.error || 'Documento recusado. Confira o arquivo.';
      return { status: resp.status, payload: { success: false, error: msg } };
    }
    return mapearErroLabhub(resp);
  }

  const criado = (await resp.json().catch(() => null)) as Record<string, unknown> | null;
  return { status: 201, payload: { success: true, documento: criado } };
}

/**
 * Traduz erros "de infra" do LAB-HUB para o operador (401 = chaves dessincronizadas,
 * 429 = rate limit, etc.). Os 400/413 acionáveis são tratados no chamador.
 */
function mapearErroLabhub(resp: Response): FlowResult {
  switch (resp.status) {
    case 401:
      console.error('[uploadDocumentoRecepcao] LAB-HUB recusou a FLOWLAB_API_KEY — chaves dessincronizadas?');
      return { status: 502, payload: { success: false, error: 'Integração com o LAB-HUB indisponível.' } };

    case 404:
      return { status: 404, payload: { success: false, error: 'Agendamento não encontrado no LAB-HUB.' } };

    case 429:
      return { status: 503, payload: { success: false, error: 'Muitos envios. Tente em instantes.' } };

    default:
      console.error('[uploadDocumentoRecepcao] LAB-HUB respondeu', resp.status);
      return { status: 502, payload: { success: false, error: 'LAB-HUB indisponível.' } };
  }
}
