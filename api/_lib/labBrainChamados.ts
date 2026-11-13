// api/_lib/labBrainChamados.ts
// O LAB-BRAIN abre chamados de TI no FlowLab, server-to-server, em nome do
// solicitante. Spec: .scratch/lab-brain-chamados/spec.md.
//
// Rota (despachada por api/integracoes/[action].ts):
//   POST /api/integracoes/lab-brain-chamado-criar
//
// Ordem de cada chamada (D8): método → chave (LAB_BRAIN_CHAMADOS_API_KEY) →
// permissão `chamados.criar` no manifesto → corpo → cota + auditoria
// (integracao_registrar_chamada, integração `lab-brain-chamados`) → operação.
// 401, 403 e 400 não consomem cota nem entram na auditoria.
// Guia: docs/integracoes/LAB_BRAIN_CHAMADOS.md.
//
// O chamado nasce igual ao da tela (ITRequestManagement): pendente, fora do
// Kanban (kanban_hidden) até o TI promover, no nome do solicitante. O que muda
// é `origem = 'lab-brain'` e o `id_externo`, únicos juntos: reenviar o mesmo
// `id_externo` devolve o chamado que já existe (200) em vez de criar outro.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isBearerApiKeyValid } from './bearerAuth.js';
import { getSupabaseAdminClient } from './supabase.js';
import { describeError } from './errors.js';
import { agentePode } from './agentes/permissoes.js';
import { AGENTE_LAB_BRAIN, registrarChamada, type Cota } from './labBrainApoio.js';

/** Valor de it_requests.origem para os chamados abertos pelo LAB-BRAIN. Mesmo valor em src/components/IT/OrigemChamadoBadge.tsx. */
export const ORIGEM_LAB_BRAIN = 'lab-brain';
/** Cota própria de escrita, dividida entre criação e consulta (D9). */
export const COTA_LAB_BRAIN_CHAMADOS: Cota = { integracao: 'lab-brain-chamados', limitePorMinuto: 10 };

const ROTA = 'lab-brain-chamado-criar';
const LOG = `[integracoes/${ROTA}]`;

const MAX_TITULO = 255;
const MAX_DESCRICAO = 5000;
const MAX_EMAIL = 255;
const MAX_ID_EXTERNO = 255;
const PRIORIDADES = ['low', 'medium', 'high', 'critical'] as const;
const TIPOS = ['suporte', 'desenvolvimento'] as const;

type Prioridade = (typeof PRIORIDADES)[number];
type Tipo = (typeof TIPOS)[number];

export interface NovoChamado {
  titulo: string;
  descricao: string;
  solicitanteEmail: string;
  idExterno: string;
  prioridade: Prioridade;
  tipo: Tipo;
}

// api/tsconfig.json roda com strict: false: o handler testa `'erro' in parse`.
type ResultadoParse = { ok: true; valor: NovoChamado } | { ok: false; erro: string };

export function isLabBrainChamadosApiKeyValid(req: VercelRequest): boolean {
  return isBearerApiKeyValid(req, 'LAB_BRAIN_CHAMADOS_API_KEY');
}

// ─── Corpo ───────────────────────────────────────────────────────────────────

/** Texto obrigatório, sem espaço sobrando, até `max` caracteres; null se inválido. */
function texto(valor: unknown, max: number): string | null {
  if (typeof valor !== 'string') return null;
  const limpo = valor.trim();
  return limpo && limpo.length <= max ? limpo : null;
}

function opcao<T extends string>(valor: unknown, opcoes: readonly T[], padrao: T): T | null {
  if (valor === undefined || valor === null) return padrao;
  return typeof valor === 'string' && (opcoes as readonly string[]).includes(valor) ? (valor as T) : null;
}

export function parseCorpo(body: unknown): ResultadoParse {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, erro: 'Corpo JSON obrigatório.' };
  }
  const b = body as Record<string, unknown>;

  const titulo = texto(b.titulo, MAX_TITULO);
  if (titulo === null) return { ok: false, erro: `Campo titulo obrigatório (até ${MAX_TITULO} caracteres).` };

  const descricao = texto(b.descricao, MAX_DESCRICAO);
  if (descricao === null) {
    return { ok: false, erro: `Campo descricao obrigatório (até ${MAX_DESCRICAO} caracteres).` };
  }

  const solicitanteEmail = texto(b.solicitante_email, MAX_EMAIL);
  if (solicitanteEmail === null || !/^[^\s@]+@[^\s@]+$/.test(solicitanteEmail)) {
    return { ok: false, erro: 'Campo solicitante_email obrigatório (um e-mail válido).' };
  }

  const idExterno = texto(b.id_externo, MAX_ID_EXTERNO);
  if (idExterno === null) {
    return { ok: false, erro: `Campo id_externo obrigatório (até ${MAX_ID_EXTERNO} caracteres).` };
  }

  const prioridade = opcao(b.prioridade, PRIORIDADES, 'medium');
  if (prioridade === null) return { ok: false, erro: `Campo prioridade deve ser um de: ${PRIORIDADES.join(', ')}.` };

  const tipo = opcao(b.tipo, TIPOS, 'suporte');
  if (tipo === null) return { ok: false, erro: `Campo tipo deve ser um de: ${TIPOS.join(', ')}.` };

  return { ok: true, valor: { titulo, descricao, solicitanteEmail, idExterno, prioridade, tipo } };
}

// ─── Operação ────────────────────────────────────────────────────────────────

interface ChamadoCriado {
  id: string;
  codigo: string;
}

type Solicitante = { userId: string } | { recusa: string };

/** Só id e código saem para o agente, qualquer que seja a linha lida. */
function resposta(linha: unknown): ChamadoCriado {
  const { id, codigo } = linha as ChamadoCriado;
  return { id, codigo };
}

async function buscarPorIdExterno(supabase: SupabaseClient, idExterno: string): Promise<ChamadoCriado | null> {
  const { data, error } = await supabase
    .from('it_requests')
    .select('id, codigo')
    .eq('origem', ORIGEM_LAB_BRAIN)
    .eq('id_externo', idExterno)
    .maybeSingle();
  if (error) throw new Error(`Falha ao ler it_requests: ${describeError(error)}`);
  return data ? resposta(data) : null;
}

/** `%` e `_` do e-mail são texto, não curinga do ILIKE. */
function escaparIlike(termo: string): string {
  return termo.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * O solicitante é o usuário do FlowLab com esse e-mail, sem diferenciar
 * maiúsculas (D1). Removido ou desativado = recusa, como a EVA faz no WhatsApp.
 * O e-mail não é único em user_profiles: vale o perfil ativo, se houver.
 */
async function buscarSolicitante(supabase: SupabaseClient, email: string): Promise<Solicitante> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, deleted_at, disabled_at')
    .ilike('email', escaparIlike(email))
    .limit(10);
  if (error) throw new Error(`Falha ao ler user_profiles: ${describeError(error)}`);

  const perfis = (data ?? []) as Array<{ id: string; deleted_at: string | null; disabled_at: string | null }>;
  const ativo = perfis.find((p) => !p.deleted_at && !p.disabled_at);
  if (ativo) return { userId: ativo.id };
  if (perfis.length > 0) {
    return { recusa: 'O solicitante está removido ou desativado no FlowLab. Peça a um administrador para reativá-lo.' };
  }
  return { recusa: 'Nenhum usuário do FlowLab tem esse e-mail. Confira o e-mail ou peça o cadastro da pessoa.' };
}

const VIOLACAO_UNICA = '23505';

/** Cria o chamado; `existente` quando o mesmo id_externo chegou antes, por outra chamada. */
async function inserirChamado(
  supabase: SupabaseClient,
  chamado: NovoChamado,
  userId: string,
): Promise<{ criado: ChamadoCriado } | { existente: ChamadoCriado }> {
  const { data, error } = await supabase
    .from('it_requests')
    .insert({
      title: chamado.titulo,
      description: chamado.descricao,
      request_type: chamado.tipo,
      priority: chamado.prioridade,
      requested_by: userId,
      kanban_hidden: true,
      origem: ORIGEM_LAB_BRAIN,
      id_externo: chamado.idExterno,
    })
    .select('id, codigo')
    .single();

  if (error && (error as { code?: string }).code === VIOLACAO_UNICA) {
    const existente = await buscarPorIdExterno(supabase, chamado.idExterno);
    if (existente) return { existente };
  }
  if (error) throw new Error(`Falha ao gravar it_requests: ${describeError(error)}`);
  return { criado: resposta(data) };
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function criarChamadoHandler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ success: false, error: 'Método não permitido' });
    return;
  }

  let autorizado: boolean;
  try {
    autorizado = isLabBrainChamadosApiKeyValid(req);
  } catch (err) {
    console.error(`${LOG} erro de configuração:`, describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
    return;
  }
  if (!autorizado) {
    res.status(401).json({ success: false, error: 'Não autorizado' });
    return;
  }

  if (!agentePode(AGENTE_LAB_BRAIN, 'chamados.criar')) {
    res.status(403).json({ success: false, error: 'Operação não permitida para este agente' });
    return;
  }

  const parse = parseCorpo(req.body);
  if ('erro' in parse) {
    res.status(400).json({ success: false, error: parse.erro });
    return;
  }
  const chamado = parse.valor;

  try {
    const supabase = getSupabaseAdminClient();

    // Na auditoria vai o que identifica o pedido; título e descrição ficam no chamado.
    const resultadoCota = await registrarChamada(
      supabase,
      ROTA,
      {
        id_externo: chamado.idExterno,
        solicitante_email: chamado.solicitanteEmail,
        prioridade: chamado.prioridade,
        tipo: chamado.tipo,
      },
      COTA_LAB_BRAIN_CHAMADOS,
    );
    if (!resultadoCota.permitido) {
      res.setHeader('Retry-After', String(resultadoCota.retryAfter));
      res.status(429).json({
        success: false,
        error: `Limite de ${COTA_LAB_BRAIN_CHAMADOS.limitePorMinuto} chamadas por minuto atingido.`,
      });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');

    const jaExiste = await buscarPorIdExterno(supabase, chamado.idExterno);
    if (jaExiste) {
      res.status(200).json(jaExiste);
      return;
    }

    const solicitante = await buscarSolicitante(supabase, chamado.solicitanteEmail);
    if ('recusa' in solicitante) {
      res.status(422).json({ success: false, error: solicitante.recusa });
      return;
    }

    const resultado = await inserirChamado(supabase, chamado, solicitante.userId);
    if ('existente' in resultado) {
      res.status(200).json(resultado.existente);
      return;
    }
    res.status(201).json(resultado.criado);
  } catch (err) {
    console.error(`${LOG} erro:`, describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
