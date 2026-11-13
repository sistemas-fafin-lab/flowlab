// api/_lib/labBrainChamados.ts
// O LAB-BRAIN abre chamados de TI no FlowLab, server-to-server, em nome do
// solicitante, e acompanha a situação deles. Spec: .scratch/lab-brain-chamados/spec.md.
//
// Rotas (despachadas por api/integracoes/[action].ts):
//   POST /api/integracoes/lab-brain-chamado-criar
//   GET  /api/integracoes/lab-brain-chamado-consultar?id_externo=
//
// Ordem de cada chamada (D8): método → chave (LAB_BRAIN_CHAMADOS_API_KEY) →
// permissão no manifesto (`chamados.criar` ou `chamados.ler`) → corpo ou query → cota + auditoria
// (integracao_registrar_chamada, integração `lab-brain-chamados`) → operação.
// 401, 403 e 400 não consomem cota nem entram na auditoria.
// Guia: docs/integracoes/LAB_BRAIN_CHAMADOS.md.
//
// O chamado nasce igual ao da tela (ITRequestManagement): pendente, fora do
// Kanban (kanban_hidden) até o TI promover, no nome do solicitante. O que muda
// é `origem = 'lab-brain'` e o `id_externo`, únicos juntos: reenviar o mesmo
// `id_externo` devolve o chamado que já existe (200) em vez de criar outro.
//
// Chamado novo (201) agenda em segundo plano a sugestão de promoção na fila da EVA
// (labBrainSugestao.ts); aprovar a sugestão o põe no Kanban. O reenvio (200) não agenda nada.
// Spec: .scratch/lab-brain-aprovacao-eva/spec.md.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { SupabaseClient } from '@supabase/supabase-js';
import { waitUntil } from '@vercel/functions';
import { isBearerApiKeyValid } from './bearerAuth.js';
import { getSupabaseAdminClient } from './supabase.js';
import { describeError } from './errors.js';
import { autorizarAgente, recusarSemCota } from './agentes/rotaAgente.js';
import { AGENTE_LAB_BRAIN, primeiro, registrarChamada, type Cota } from './labBrainApoio.js';
import { criarSugestaoDePromocao } from './labBrainSugestao.js';

/** Valor de it_requests.origem para os chamados abertos pelo LAB-BRAIN. Mesmo valor em src/components/IT/OrigemChamadoBadge.tsx. */
export const ORIGEM_LAB_BRAIN = 'lab-brain';
/** Cota própria dos chamados, dividida entre criação e consulta (D9). */
export const COTA_LAB_BRAIN_CHAMADOS: Cota = { integracao: 'lab-brain-chamados', limitePorMinuto: 10 };

const ROTA_CRIACAO = 'lab-brain-chamado-criar';
const LOG_CRIACAO = `[integracoes/${ROTA_CRIACAO}]`;
const ROTA_CONSULTA = 'lab-brain-chamado-consultar';
const LOG_CONSULTA = `[integracoes/${ROTA_CONSULTA}]`;

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

/** A sugestão da EVA não segura a resposta: falhar ao agendar só vai para o log. */
function agendarSugestao(supabase: SupabaseClient, chamado: NovoChamado, criado: ChamadoCriado): void {
  try {
    waitUntil(
      criarSugestaoDePromocao(supabase, {
        id: criado.id,
        codigo: criado.codigo,
        titulo: chamado.titulo,
        prioridade: chamado.prioridade,
      }),
    );
  } catch (err) {
    console.error(`${LOG_CRIACAO} waitUntil indisponível; o chamado ${criado.codigo} fica sem sugestão:`, describeError(err));
  }
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function criarChamadoHandler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const porta = {
    metodo: 'POST',
    chaveValida: isLabBrainChamadosApiKeyValid,
    agente: AGENTE_LAB_BRAIN,
    operacao: 'chamados.criar',
    log: LOG_CRIACAO,
  } as const;
  if (!autorizarAgente(req, res, porta)) return;

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
      ROTA_CRIACAO,
      {
        id_externo: chamado.idExterno,
        solicitante_email: chamado.solicitanteEmail,
        prioridade: chamado.prioridade,
        tipo: chamado.tipo,
      },
      COTA_LAB_BRAIN_CHAMADOS,
    );
    if (recusarSemCota(res, resultadoCota, COTA_LAB_BRAIN_CHAMADOS.limitePorMinuto)) return;

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
    agendarSugestao(supabase, chamado, resultado.criado);
    res.status(201).json(resultado.criado);
  } catch (err) {
    console.error(`${LOG_CRIACAO} erro:`, describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}

// ─── Consulta ────────────────────────────────────────────────────────────────

/** O que o LAB-BRAIN vê de um chamado (D7): nada de descrição, solicitante, comentários ou anexos. */
export interface SituacaoChamado {
  codigo: string;
  situacao: string;
  /** null enquanto o chamado está fora do Kanban (kanban_hidden). */
  coluna_kanban: string | null;
  prioridade: string;
  /** Nomes dos responsáveis separados por vírgula; null sem responsável. */
  responsavel: string | null;
  /** Só quando a situação é resolved ou cancelled (o motivo da rejeição pela EVA). */
  resolucao: string | null;
  atualizado_em: string;
}

interface LinhaSituacao {
  codigo: string;
  status: string;
  kanban_status: string;
  kanban_hidden: boolean;
  priority: string;
  assigned_to: string[] | null;
  resolution: string | null;
  updated_at: string;
}

/** Resolvido traz a resolução; cancelado, o motivo de quem rejeitou a sugestão da EVA. */
const SITUACOES_COM_RESOLUCAO = new Set(['resolved', 'cancelled']);

async function nomesDosResponsaveis(supabase: SupabaseClient, ids: string[]): Promise<string | null> {
  if (ids.length === 0) return null;
  const { data, error } = await supabase.from('user_profiles').select('id, name').in('id', ids);
  if (error) throw new Error(`Falha ao ler user_profiles: ${describeError(error)}`);
  const nomePorId = new Map(((data ?? []) as Array<{ id: string; name: string | null }>).map((p) => [p.id, p.name]));
  // Na ordem de assigned_to; quem sumiu de user_profiles fica de fora.
  const nomes = ids.map((id) => nomePorId.get(id)?.trim()).filter((n): n is string => !!n);
  return nomes.length > 0 ? nomes.join(', ') : null;
}

/** Só enxerga chamados abertos pelo LAB-BRAIN (D7); qualquer outro é "não encontrado". */
export function parseConsulta(
  query: VercelRequest['query'],
): { ok: true; valor: { idExterno: string } } | { ok: false; erro: string } {
  const idExterno = texto(primeiro(query.id_externo), MAX_ID_EXTERNO);
  if (idExterno === null) {
    return { ok: false, erro: `Parâmetro id_externo obrigatório (até ${MAX_ID_EXTERNO} caracteres).` };
  }
  return { ok: true, valor: { idExterno } };
}

async function buscarSituacao(supabase: SupabaseClient, idExterno: string): Promise<SituacaoChamado | null> {
  const { data, error } = await supabase
    .from('it_requests')
    .select('codigo, status, kanban_status, kanban_hidden, priority, assigned_to, resolution, updated_at')
    .eq('origem', ORIGEM_LAB_BRAIN)
    .eq('id_externo', idExterno)
    .maybeSingle();
  if (error) throw new Error(`Falha ao ler it_requests: ${describeError(error)}`);
  if (!data) return null;

  const linha = data as LinhaSituacao;
  return {
    codigo: linha.codigo,
    situacao: linha.status,
    coluna_kanban: linha.kanban_hidden ? null : linha.kanban_status,
    prioridade: linha.priority,
    responsavel: await nomesDosResponsaveis(supabase, linha.assigned_to ?? []),
    resolucao: SITUACOES_COM_RESOLUCAO.has(linha.status) ? linha.resolution : null,
    atualizado_em: linha.updated_at,
  };
}

export async function consultarChamadoHandler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const porta = {
    metodo: 'GET',
    chaveValida: isLabBrainChamadosApiKeyValid,
    agente: AGENTE_LAB_BRAIN,
    operacao: 'chamados.ler',
    log: LOG_CONSULTA,
  } as const;
  if (!autorizarAgente(req, res, porta)) return;

  const parse = parseConsulta(req.query ?? {});
  if ('erro' in parse) {
    res.status(400).json({ success: false, error: parse.erro });
    return;
  }
  const { idExterno } = parse.valor;

  try {
    const supabase = getSupabaseAdminClient();

    const resultadoCota = await registrarChamada(
      supabase,
      ROTA_CONSULTA,
      { id_externo: idExterno },
      COTA_LAB_BRAIN_CHAMADOS,
    );
    if (recusarSemCota(res, resultadoCota, COTA_LAB_BRAIN_CHAMADOS.limitePorMinuto)) return;

    res.setHeader('Cache-Control', 'no-store');
    const situacao = await buscarSituacao(supabase, idExterno);
    if (!situacao) {
      res.status(404).json({ success: false, error: 'Chamado não encontrado entre os abertos pelo LAB-BRAIN.' });
      return;
    }
    res.status(200).json(situacao);
  } catch (err) {
    console.error(`${LOG_CONSULTA} erro:`, describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
