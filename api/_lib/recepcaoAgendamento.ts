// api/_lib/recepcaoAgendamento.ts
// Proxy da criação de agendamento pela recepção (walk-in / encaixe) contra o
// LAB-HUB: busca de pacientes (typeahead) e criação do agendamento. Agnóstico de
// framework: retorna { status, payload } para servir tanto a função Vercel quanto
// o middleware de dev do Vite.
//
// A FLOWLAB_API_KEY é server-side, então o SPA não fala com o LAB-HUB direto.
// Espelha documentosCheckin.ts: (1) autoriza pelo JWT de SESSÃO do operador
// (canManageColetas — NÃO a FLOWLAB_API_KEY), (2) repassa ao LAB-HUB com x-api-key.

import { getSupabaseAdminClient } from './supabase.js';
import { requireEnv } from './labhubIntegration.js';
import { computarDisponibilidade } from './disponibilidade.js';
import { describeError } from './errors.js';

export interface FlowResult {
  status: number;
  payload: Record<string, unknown>;
}

// Mesmo timeout das outras chamadas ao LAB-HUB (deliver-coleta.ts / documentosCheckin.ts).
const LABHUB_TIMEOUT_MS = 10000;

// Item da busca (espelha PacienteBuscaItem de @lab-hub/shared). Contratos
// sincronizados à mão — não há pacote compartilhado entre os repos.
interface PacienteBuscaItem {
  id: string;
  nome: string;
  cpfMascarado: string;
  dataNascimento: string;
}

// Corpo aceito pela criação (espelha CriarAgendamentoRecepcaoPayload). Repassado
// ao LAB-HUB, que revalida com zod; aqui só garantimos o mínimo p/ não chamar à toa.
export interface CriarAgendamentoRecepcaoBody {
  pacienteId?: string;
  nome?: string;
  cpf?: string;
  dataNascimento?: string;
  telefone?: string;
  postoFlowlabId?: string;
  dataHora?: string;
}

// ── Autorização ───────────────────────────────────────────────────────────────
// ATENÇÃO: `token` é o JWT de SESSÃO do operador, não a FLOWLAB_API_KEY. Ver o
// cabeçalho de api/analises-clinicas/get-documentos.ts. Retorna null se autorizado,
// ou um FlowResult de erro pronto para devolver. Exportada: os handlers do Envio
// ao Apoio (api/_lib/apoio/) usam a mesma regra (canManageColetas).
export async function autorizarOperador(token: string | null): Promise<FlowResult | null> {
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
    return { status: 403, payload: { success: false, error: 'Sem permissão para criar agendamentos.' } };
  }
  return null;
}

// ── Disponibilidade para o operador ─────────────────────────────────────────────
// Mesma grade que o paciente vê (get-disponibilidade), mas autorizada pelo JWT do
// operador — o SPA não pode portar a FLOWLAB_API_KEY. É dado 100% do FlowLab
// (ac_postos/ac_agendamentos), então NÃO há ida ao LAB-HUB aqui.
export async function disponibilidadeOperador(token: string | null): Promise<FlowResult> {
  const erroAuth = await autorizarOperador(token);
  if (erroAuth) return erroAuth;

  try {
    const postos = await computarDisponibilidade();
    return { status: 200, payload: { success: true, postos } };
  } catch (err) {
    console.error('[recepcaoAgendamento/disponibilidade] erro:', describeError(err));
    return { status: 500, payload: { success: false, error: 'Erro interno' } };
  }
}

// ── GET /integracao/pacientes/buscar ────────────────────────────────────────────
export async function buscarPacientesRecepcao(
  token: string | null,
  q: string | undefined,
): Promise<FlowResult> {
  const erroAuth = await autorizarOperador(token);
  if (erroAuth) return erroAuth;

  const termo = (q ?? '').trim();
  if (termo.length < 2) {
    return { status: 400, payload: { success: false, error: 'Busca precisa de ao menos 2 caracteres.' } };
  }

  const url = `${requireEnv('LABHUB_API_URL')}/api/v1/integracao/pacientes/buscar?q=${encodeURIComponent(termo)}`;

  let resp: Response;
  try {
    resp = await fetch(url, {
      headers: { 'x-api-key': requireEnv('FLOWLAB_API_KEY') },
      signal: AbortSignal.timeout(LABHUB_TIMEOUT_MS),
    });
  } catch (err) {
    console.error('[recepcaoAgendamento/buscar] LAB-HUB não respondeu:', describeError(err));
    return { status: 504, payload: { success: false, error: 'O LAB-HUB não respondeu. Tente de novo.' } };
  }

  if (!resp.ok) {
    return mapearErroLabhub(resp);
  }

  const body = (await resp.json().catch(() => null)) as { pacientes?: PacienteBuscaItem[] } | null;
  if (!body || !Array.isArray(body.pacientes)) {
    console.error('[recepcaoAgendamento/buscar] resposta do LAB-HUB em formato inesperado');
    return { status: 502, payload: { success: false, error: 'Integração com o LAB-HUB indisponível.' } };
  }

  return { status: 200, payload: { success: true, pacientes: body.pacientes } };
}

// ── POST /integracao/agendamentos ───────────────────────────────────────────────
export async function criarAgendamentoRecepcao(
  token: string | null,
  body: CriarAgendamentoRecepcaoBody,
): Promise<FlowResult> {
  const erroAuth = await autorizarOperador(token);
  if (erroAuth) return erroAuth;

  // Validação mínima local (o LAB-HUB revalida tudo com zod). Evita uma ida ao
  // LAB-HUB quando o form nem tem posto/data ou paciente.
  if (!body.postoFlowlabId || !body.dataHora) {
    return { status: 400, payload: { success: false, error: 'Informe o posto e a data/hora.' } };
  }
  const temExistente = Boolean(body.pacienteId);
  const temNovo = Boolean(body.nome && body.cpf && body.dataNascimento);
  if (!temExistente && !temNovo) {
    return {
      status: 400,
      payload: { success: false, error: 'Selecione um paciente ou informe nome, CPF e data de nascimento.' },
    };
  }

  const url = `${requireEnv('LABHUB_API_URL')}/api/v1/integracao/agendamentos`;

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': requireEnv('FLOWLAB_API_KEY'),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(LABHUB_TIMEOUT_MS),
    });
  } catch (err) {
    console.error('[recepcaoAgendamento/criar] LAB-HUB não respondeu:', describeError(err));
    return { status: 504, payload: { success: false, error: 'O LAB-HUB não respondeu. Tente de novo.' } };
  }

  if (!resp.ok) {
    // 400/404 vêm de dados que o operador escolheu (posto/horário/CPF/paciente):
    // repassa a mensagem do LAB-HUB (ex.: "Horário indisponível"). Os demais status
    // são falha nossa/infra e viram um erro genérico.
    if (resp.status === 400 || resp.status === 404) {
      const errBody = (await resp.json().catch(() => null)) as
        | { message?: string; error?: string }
        | null;
      const msg =
        errBody?.message || errBody?.error || 'Não foi possível criar o agendamento. Revise os dados.';
      return { status: resp.status, payload: { success: false, error: msg } };
    }
    return mapearErroLabhub(resp);
  }

  const criado = (await resp.json().catch(() => null)) as Record<string, unknown> | null;
  if (!criado || typeof criado.agendamentoLabhubId !== 'string') {
    console.error('[recepcaoAgendamento/criar] resposta do LAB-HUB em formato inesperado');
    return { status: 502, payload: { success: false, error: 'Integração com o LAB-HUB indisponível.' } };
  }

  return { status: 201, payload: { success: true, ...criado } };
}

/**
 * Traduz erros "de infra" do LAB-HUB para o operador (401 = chaves
 * dessincronizadas, 429 = rate limit, etc.). Os 400/404 acionáveis pelo operador
 * são tratados no chamador (criar repassa a mensagem; buscar já validou `q`).
 */
function mapearErroLabhub(resp: Response): FlowResult {
  switch (resp.status) {
    case 401:
      console.error('[recepcaoAgendamento] LAB-HUB recusou a FLOWLAB_API_KEY — chaves dessincronizadas?');
      return { status: 502, payload: { success: false, error: 'Integração com o LAB-HUB indisponível.' } };

    case 429:
      return { status: 503, payload: { success: false, error: 'Muitas consultas. Tente em instantes.' } };

    default:
      console.error('[recepcaoAgendamento] LAB-HUB respondeu', resp.status);
      return { status: 502, payload: { success: false, error: 'LAB-HUB indisponível.' } };
  }
}
