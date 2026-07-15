// api/_lib/documentosCheckin.ts
// Lista, para a conferência de recepção, os documentos que o paciente enviou pelo
// app do LAB-HUB. Agnóstico de framework: retorna { status, payload }, para servir
// tanto a função Vercel quanto o middleware de dev do Vite.
//
// Fluxo:
//   1. Autoriza o chamador (JWT de sessão do operador) → exige canManageColetas.
//   2. Resolve agendamentoId (id do FlowLab) → labhub_id.
//   3. Busca no LAB-HUB: GET /api/v1/integracao/agendamentos/:labhubId/documentos.
//
// Os bytes ficam só no LAB-HUB (LGPD: uma cópia, um lugar para apagar). O bucket é
// privado e sem policy de storage — este endpoint é o único caminho, e o que ele
// devolve são signed URLs frescas de ~15min.

import { getSupabaseAdminClient } from './supabase.js';
import { requireEnv } from './labhubIntegration.js';
import { describeError } from './errors.js';

// Espelha DocumentoFlowLab de @lab-hub/shared (packages/shared/src/index.ts:184) e
// DocumentoCheckin de src/modules/analises-clinicas/types.ts. Os três contratos são
// sincronizados à mão — não há pacote compartilhado entre os repos.
interface DocumentoFlowLab {
  id: string;
  tipo: string;
  nomeArquivo: string;
  mimeType: string;
  tamanhoBytes: number;
  criadoEm: string;
  url: string;
  expiraEm: string;
}

interface DocumentosFlowLabResponse {
  agendamentoLabhubId: string;
  documentos: DocumentoFlowLab[];
}

interface FlowResult {
  status: number;
  payload: Record<string, unknown>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Mesmo timeout das outras chamadas ao LAB-HUB (deliver-coleta.ts).
const LABHUB_TIMEOUT_MS = 10000;

export async function listarDocumentosCheckin(
  token: string | null,
  agendamentoId: string | undefined,
): Promise<FlowResult> {
  const supabase = getSupabaseAdminClient();

  // ── 1. Autorização ──────────────────────────────────────────────────────────
  // ATENÇÃO: aqui `token` é o JWT de SESSÃO do operador, não a FLOWLAB_API_KEY.
  // Ver o comentário de cabeçalho de api/analises-clinicas/get-documentos.ts.
  if (!token) {
    return { status: 401, payload: { success: false, error: 'Token de autenticação ausente.' } };
  }

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
    return { status: 403, payload: { success: false, error: 'Sem permissão para ver documentos da coleta.' } };
  }

  // ── 2. Resolução do agendamento ─────────────────────────────────────────────
  // O parâmetro é o id do FlowLab, NUNCA o labhub_id: o cliente não escolhe a chave
  // que vai ao LAB-HUB. Ela é resolvida aqui, a partir de uma linha que o FlowLab já
  // tem. Aceitar labhubId do cliente abriria enumeração de documentos de qualquer
  // paciente — a checagem de permissão acima não distingue um agendamento do outro.
  if (!agendamentoId || !UUID_RE.test(agendamentoId)) {
    return { status: 400, payload: { success: false, error: 'Parâmetro inválido: agendamentoId.' } };
  }

  const { data: agendamento, error: agErr } = await supabase
    .from('ac_agendamentos')
    .select('labhub_id')
    .eq('id', agendamentoId)
    .maybeSingle();

  if (agErr) {
    console.error('[documentosCheckin] falha ao carregar agendamento:', describeError(agErr));
    return { status: 500, payload: { success: false, error: 'Erro interno.' } };
  }
  if (!agendamento) {
    return { status: 404, payload: { success: false, error: 'Agendamento não encontrado.' } };
  }

  // ── 3. Busca no LAB-HUB ─────────────────────────────────────────────────────
  // Header x-api-key (não Authorization): no LAB-HUB, Bearer significa sempre JWT de
  // paciente — ver apps/api/src/middlewares/apiKey.ts.
  const url = `${requireEnv('LABHUB_API_URL')}/api/v1/integracao/agendamentos/${agendamento.labhub_id}/documentos`;

  let resp: Response;
  try {
    resp = await fetch(url, {
      headers: { 'x-api-key': requireEnv('FLOWLAB_API_KEY') },
      signal: AbortSignal.timeout(LABHUB_TIMEOUT_MS),
    });
  } catch (err) {
    console.error('[documentosCheckin] LAB-HUB não respondeu:', describeError(err));
    return { status: 504, payload: { success: false, error: 'O LAB-HUB não respondeu. Tente de novo.' } };
  }

  if (!resp.ok) {
    return mapearErroLabhub(resp);
  }

  const body = (await resp.json().catch(() => null)) as DocumentosFlowLabResponse | null;
  if (!body || !Array.isArray(body.documentos)) {
    console.error('[documentosCheckin] resposta do LAB-HUB em formato inesperado');
    return { status: 502, payload: { success: false, error: 'Integração com o LAB-HUB indisponível.' } };
  }

  // Repassa só os documentos: o navegador não precisa do agendamentoLabhubId, que é
  // a chave do outro sistema.
  return { status: 200, payload: { success: true, documentos: body.documentos } };
}

/**
 * Traduz o erro do LAB-HUB para algo que faça sentido ao operador no balcão.
 * A causa real vai ao log; a mensagem devolvida nunca culpa o operador por um
 * problema nosso de configuração.
 */
function mapearErroLabhub(resp: Response): FlowResult {
  switch (resp.status) {
    // Chave errada ou dessincronizada entre os dois lados: erro de configuração
    // nosso, não do operador. Vira 502 porque, para o navegador, o serviço a
    // montante é que está quebrado.
    case 401:
      console.error('[documentosCheckin] LAB-HUB recusou a FLOWLAB_API_KEY — chaves dessincronizadas?');
      return { status: 502, payload: { success: false, error: 'Integração com o LAB-HUB indisponível.' } };

    // Mandamos um uuid inválido: bug nosso, o labhub_id do banco está corrompido.
    case 400:
      console.error('[documentosCheckin] LAB-HUB recusou o labhubId como inválido');
      return { status: 502, payload: { success: false, error: 'Integração com o LAB-HUB indisponível.' } };

    // Informação real: o agendamento existe aqui mas sumiu de lá.
    case 404:
      return { status: 404, payload: { success: false, error: 'Agendamento não encontrado no LAB-HUB.' } };

    case 429:
      return { status: 503, payload: { success: false, error: 'Muitas consultas. Tente em instantes.' } };

    default:
      console.error('[documentosCheckin] LAB-HUB respondeu', resp.status);
      return { status: 502, payload: { success: false, error: 'LAB-HUB indisponível.' } };
  }
}
