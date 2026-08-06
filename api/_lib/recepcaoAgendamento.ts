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
import { computarDisponibilidade, diasRetroativosOperador } from './disponibilidade.js';
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

// Corpo aceito pela correção de identidade (espelha CorrigirIdentidadePayload,
// menos `autorizadoPor`: esse NÃO vem do cliente, sai da sessão — ver abaixo).
export interface CorrigirIdentidadeBody {
  pacienteId?: string;
  cpf?: string;
  dataNascimento?: string;
  motivo?: string;
  documentoConferido?: string;
}

// Quem está do outro lado da sessão — vira `autorizadoPor` na trilha do LAB-HUB.
interface OperadorAutorizado {
  id: string;
  nome: string;
  email: string;
}

// ── Autorização ───────────────────────────────────────────────────────────────
// ATENÇÃO: `token` é o JWT de SESSÃO do operador, não a FLOWLAB_API_KEY. Ver o
// cabeçalho de api/analises-clinicas/get-documentos.ts.
//
// `permissoes` é anyOf: basta uma das keys (admin passa sempre). A correção de
// identidade usa uma key própria, então a busca de pacientes — que ela precisa —
// aceita as duas.
async function identificarOperador(
  token: string | null,
  permissoes: string[],
  acao: string,
): Promise<{ erro: FlowResult } | { operador: OperadorAutorizado }> {
  if (!token) {
    return { erro: { status: 401, payload: { success: false, error: 'Token de autenticação ausente.' } } };
  }
  const supabase = getSupabaseAdminClient();

  const { data: caller, error: callerErr } = await supabase.auth.getUser(token);
  if (callerErr || !caller?.user) {
    return { erro: { status: 401, payload: { success: false, error: 'Sessão inválida ou expirada.' } } };
  }

  const { data: callerProfile } = await supabase
    .from('user_profiles')
    .select('name, email, role, custom_roles(permissions)')
    .eq('id', caller.user.id)
    .single();

  const callerPermissions: string[] =
    (callerProfile?.custom_roles as { permissions?: string[] } | null)?.permissions ?? [];
  const authorized =
    callerProfile?.role === 'admin' || permissoes.some((p) => callerPermissions.includes(p));

  if (!authorized) {
    return { erro: { status: 403, payload: { success: false, error: `Sem permissão para ${acao}.` } } };
  }

  return {
    operador: {
      id: caller.user.id,
      nome: (callerProfile?.name as string | undefined)?.trim() || 'Operador sem nome',
      email: (callerProfile?.email as string | undefined) ?? caller.user.email ?? '',
    },
  };
}

// Fachada histórica: só o veredito, sem a identidade. Exportada — os handlers do
// Envio ao Apoio (api/_lib/apoio/) usam a mesma regra (canManageColetas).
export async function autorizarOperador(token: string | null): Promise<FlowResult | null> {
  const r = await identificarOperador(token, ['canManageColetas'], 'criar agendamentos');
  return 'erro' in r ? r.erro : null;
}

// ── Disponibilidade para o operador ─────────────────────────────────────────────
// Mesma grade que o paciente vê (get-disponibilidade), mas autorizada pelo JWT do
// operador — o SPA não pode portar a FLOWLAB_API_KEY. É dado 100% do FlowLab
// (ac_postos/ac_agendamentos), então NÃO há ida ao LAB-HUB aqui.
//
// A diferença de conteúdo é a janela retroativa (AGENDA_RETROATIVO_DIAS): o
// operador lança o que já aconteceu — ontem, ou hoje de manhã —, coisa que o
// paciente nunca pode fazer.
export async function disponibilidadeOperador(token: string | null): Promise<FlowResult> {
  const erroAuth = await autorizarOperador(token);
  if (erroAuth) return erroAuth;

  try {
    const postos = await computarDisponibilidade({ retroativoDias: diasRetroativosOperador() });
    return { status: 200, payload: { success: true, postos } };
  } catch (err) {
    console.error('[recepcaoAgendamento/disponibilidade] erro:', describeError(err));
    return { status: 500, payload: { success: false, error: 'Erro interno' } };
  }
}

// ── GET /integracao/pacientes/buscar ────────────────────────────────────────────
// Aceita canManageColetas OU canCorrigirIdentidade: a tela de correção de
// identidade precisa do mesmo typeahead para achar o paciente, e quem só corrige
// identidade não faz check-in.
export async function buscarPacientesRecepcao(
  token: string | null,
  q: string | undefined,
): Promise<FlowResult> {
  const auth = await identificarOperador(
    token,
    ['canManageColetas', 'canCorrigirIdentidade'],
    'buscar pacientes',
  );
  if ('erro' in auth) return auth.erro;

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

// ── POST /integracao/pacientes/:pacienteId/correcao-identidade ──────────────────
//
// Corrige CPF/data de nascimento de um paciente que JÁ vinculou conta no LAB-HUB.
// Depois do claim os dois campos são imutáveis lá (trigger de 20260730120000); a
// RPC chamada por esta rota é a única saída, e ela exige e registra a autorização.
//
// Por que a operação é da recepção e não do portal: nenhum dado que o sistema
// guarda prova que o CPF novo pertence a quem pede — CPF antigo, nascimento,
// e-mail, telefone e até código por SMS são todos coisas que o dono da conta já
// tem. Quem prova é o operador olhando o documento físico.
//
// `autorizadoPor` sai da SESSÃO, nunca do corpo da requisição: é trilha de
// auditoria permanente e append-only no LAB-HUB, e um campo de trilha que o
// chamador escolhe não vale como trilha.
export async function corrigirIdentidadePaciente(
  token: string | null,
  body: CorrigirIdentidadeBody,
): Promise<FlowResult> {
  const auth = await identificarOperador(
    token,
    ['canCorrigirIdentidade'],
    'corrigir identidade de paciente',
  );
  if ('erro' in auth) return auth.erro;

  // Validação mínima local (o LAB-HUB revalida tudo com zod, inclusive os dígitos
  // verificadores do CPF). Evita ida à rede quando o form nem está completo.
  const pacienteId = (body.pacienteId ?? '').trim();
  const cpf = (body.cpf ?? '').replace(/\D/g, '');
  const dataNascimento = (body.dataNascimento ?? '').trim();
  const motivo = (body.motivo ?? '').trim();
  const documentoConferido = (body.documentoConferido ?? '').trim();

  if (!pacienteId) {
    return { status: 400, payload: { success: false, error: 'Selecione o paciente.' } };
  }
  if (cpf.length !== 11) {
    return { status: 400, payload: { success: false, error: 'Informe o CPF completo.' } };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataNascimento)) {
    return { status: 400, payload: { success: false, error: 'Informe a data de nascimento.' } };
  }
  if (motivo.length < 5) {
    return { status: 400, payload: { success: false, error: 'Descreva o motivo da correção.' } };
  }
  if (!documentoConferido) {
    return { status: 400, payload: { success: false, error: 'Informe o documento conferido.' } };
  }

  // O LAB-HUB limita `autorizadoPor` a 120 caracteres.
  const autorizadoPor = `${auth.operador.nome}${auth.operador.email ? ` <${auth.operador.email}>` : ''}`.slice(0, 120);

  const url = `${requireEnv('LABHUB_API_URL')}/api/v1/integracao/pacientes/${encodeURIComponent(pacienteId)}/correcao-identidade`;

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': requireEnv('FLOWLAB_API_KEY'),
      },
      body: JSON.stringify({ cpf, dataNascimento, motivo, autorizadoPor, documentoConferido }),
      signal: AbortSignal.timeout(LABHUB_TIMEOUT_MS),
    });
  } catch (err) {
    console.error('[recepcaoAgendamento/correcao] LAB-HUB não respondeu:', describeError(err));
    return { status: 504, payload: { success: false, error: 'O LAB-HUB não respondeu. Tente de novo.' } };
  }

  if (!resp.ok) {
    // 400/404/409 são recusas que o operador precisa ler na íntegra — a RPC
    // classifica por SQLSTATE e a mensagem diz o que houve ("nada a corrigir",
    // CPF já pertencente a outro cadastro (409), que é caso de FUSÃO e não de
    // correção). Os demais são falha nossa/infra.
    //
    // Paciente SEM conta vinculada já não é recusa desde 31/07/2026: a RPC
    // recusava e mandava "corrija direto no cadastro", lugar que não existe em
    // lado nenhum. Hoje corrige pelo mesmo caminho, com a mesma trilha.
    if (resp.status === 400 || resp.status === 404 || resp.status === 409) {
      const errBody = (await resp.json().catch(() => null)) as
        | { message?: string; error?: string }
        | null;
      const msg =
        errBody?.message || errBody?.error || 'Não foi possível corrigir. Revise os dados.';
      return { status: resp.status, payload: { success: false, error: msg } };
    }
    return mapearErroLabhub(resp);
  }

  const corrigido = (await resp.json().catch(() => null)) as Record<string, unknown> | null;
  if (!corrigido || typeof corrigido.correcaoId !== 'string') {
    console.error('[recepcaoAgendamento/correcao] resposta do LAB-HUB em formato inesperado');
    return { status: 502, payload: { success: false, error: 'Integração com o LAB-HUB indisponível.' } };
  }

  // Eco operacional. A trilha permanente é a do LAB-HUB (`correcoes_identidade`);
  // aqui não vai CPF nenhum — nem o antigo, nem o novo.
  console.info(
    '[recepcaoAgendamento/correcao] identidade corrigida',
    JSON.stringify({
      correcaoId: corrigido.correcaoId,
      pacienteId,
      operadorId: auth.operador.id,
      documentoConferido,
      laudosInvalidados: corrigido.laudosInvalidados,
    }),
  );

  return { status: 200, payload: { success: true, ...corrigido } };
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
