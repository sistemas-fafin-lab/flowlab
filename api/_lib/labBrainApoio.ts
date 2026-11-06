// api/_lib/labBrainApoio.ts
// Consulta server-to-server do LAB-BRAIN às tabelas do Envio ao Álvaro
// (ac_apoio_requisicoes, ac_apoio_fila, ac_apoio_exames). Somente leitura.
//
// Rotas (despachadas por api/integracoes/[action].ts):
//   GET /api/integracoes/lab-brain-apoio-requisicao?cod=<nº LIS>
//   GET /api/integracoes/lab-brain-apoio-fila?status=&desde=&ate=&limite=&pagina=
//   GET /api/integracoes/lab-brain-apoio-exames
//
// Ordem de cada chamada: método → chave (LAB_BRAIN_API_KEY) → parâmetros →
// cota + auditoria (integracao_registrar_chamada) → consulta. 401 e 400 não
// consomem cota nem entram na auditoria. Guia: docs/apoio-alvaro/INTEGRACAO_LAB_BRAIN.md.
//
// Fora do payload de propósito: xml_envio e alvaro_response (XML/resposta crua
// do webservice), filename (paths do storage) e preco do catálogo.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isBearerApiKeyValid } from './bearerAuth.js';
import { buscarTodasPaginado } from './supabasePaginado.js';
import { getSupabaseAdminClient } from './supabase.js';
import { describeError } from './errors.js';

export const LAB_BRAIN_INTEGRACAO = 'lab-brain';
export const LAB_BRAIN_LIMITE_POR_MINUTO = 120;
const JANELA_SEGUNDOS = 60;

const STATUS_FILA = ['aguardando', 'enviando', 'enviado', 'erro'] as const;
type StatusFila = (typeof STATUS_FILA)[number];

export const LIMITE_PADRAO_FILA = 50;
export const LIMITE_MAXIMO_FILA = 200;
/** Máximo de itens da fila devolvidos junto com uma requisição. */
const MAX_FILA_POR_REQUISICAO = 50;

const COLUNAS_REQUISICAO =
  'codigo_lis, codigo_os, nome, datanasc, data_coleta, laudo, created_at, updated_at';
const COLUNAS_FILA =
  'id, status, origem, numero_requisicao, agendamento_id, paciente, medico, exames, ' +
  'erro_mensagem, resumo, created_at, updated_at';
const COLUNAS_EXAMES = 'cod_exame, descricao_exame, descricao_material, cod_material, updated_at';

/** Brasil sem horário de verão desde 2019: o dia do laboratório é sempre -03:00. */
const FUSO_LAB = '-03:00';

export type RecursoLabBrain = 'requisicao' | 'fila' | 'exames';

export interface FiltrosFila {
  status: StatusFila | null;
  desde: string | null; // YYYY-MM-DD
  ate: string | null; // YYYY-MM-DD
  limite: number;
  pagina: number;
}

type Parametros =
  | { recurso: 'requisicao'; cod: string }
  | { recurso: 'fila'; filtros: FiltrosFila }
  | { recurso: 'exames' };

// api/tsconfig.json roda com strict: false — sem strictNullChecks o `ok` booleano
// não discrimina a união, por isso o handler testa `'erro' in parse`.
type ResultadoParse = { ok: true; valor: Parametros } | { ok: false; erro: string };

export function isLabBrainApiKeyValid(req: VercelRequest): boolean {
  return isBearerApiKeyValid(req, 'LAB_BRAIN_API_KEY');
}

// ─── Parâmetros ──────────────────────────────────────────────────────────────

function primeiro(valor: string | string[] | undefined): string | undefined {
  const v = Array.isArray(valor) ? valor[0] : valor;
  const limpo = v?.trim();
  return limpo ? limpo : undefined;
}

function dataValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const d = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor;
}

function inteiro(valor: string | undefined, padrao: number, min: number, max: number): number | null {
  if (valor === undefined) return padrao;
  if (!/^\d+$/.test(valor)) return null;
  const n = Number(valor);
  return n >= min && n <= max ? n : null;
}

export function parseParametros(
  recurso: RecursoLabBrain,
  query: VercelRequest['query'],
): ResultadoParse {
  if (recurso === 'exames') return { ok: true, valor: { recurso } };

  if (recurso === 'requisicao') {
    const cod = primeiro(query.cod);
    if (!cod || !/^[A-Za-z0-9._-]{1,40}$/.test(cod)) {
      return { ok: false, erro: 'Parâmetro cod obrigatório (até 40 letras, números, ponto, hífen ou _).' };
    }
    return { ok: true, valor: { recurso, cod } };
  }

  const status = primeiro(query.status) ?? null;
  if (status !== null && !(STATUS_FILA as readonly string[]).includes(status)) {
    return { ok: false, erro: `Parâmetro status deve ser um de: ${STATUS_FILA.join(', ')}.` };
  }
  const desde = primeiro(query.desde) ?? null;
  const ate = primeiro(query.ate) ?? null;
  if ((desde !== null && !dataValida(desde)) || (ate !== null && !dataValida(ate))) {
    return { ok: false, erro: 'Parâmetros desde e ate devem estar no formato AAAA-MM-DD.' };
  }
  if (desde !== null && ate !== null && desde > ate) {
    return { ok: false, erro: 'Parâmetro desde não pode ser depois de ate.' };
  }
  const limite = inteiro(primeiro(query.limite), LIMITE_PADRAO_FILA, 1, LIMITE_MAXIMO_FILA);
  if (limite === null) {
    return { ok: false, erro: `Parâmetro limite deve ser um inteiro de 1 a ${LIMITE_MAXIMO_FILA}.` };
  }
  const pagina = inteiro(primeiro(query.pagina), 1, 1, 100_000);
  if (pagina === null) return { ok: false, erro: 'Parâmetro pagina deve ser um inteiro a partir de 1.' };

  return {
    ok: true,
    valor: { recurso, filtros: { status: status as StatusFila | null, desde, ate, limite, pagina } },
  };
}

// ─── Cota + auditoria ────────────────────────────────────────────────────────

export interface ResultadoCota {
  permitido: boolean;
  retryAfter: number;
}

export async function registrarChamada(
  supabase: SupabaseClient,
  rota: string,
  parametros: Record<string, unknown>,
): Promise<ResultadoCota> {
  const { data, error } = await supabase.rpc('integracao_registrar_chamada', {
    p_integracao: LAB_BRAIN_INTEGRACAO,
    p_rota: rota,
    p_parametros: parametros,
    p_limite: LAB_BRAIN_LIMITE_POR_MINUTO,
    p_janela_segundos: JANELA_SEGUNDOS,
  });
  if (error) throw new Error(`Falha ao registrar chamada: ${describeError(error)}`);
  const linha = (Array.isArray(data) ? data[0] : data) as
    | { permitido?: boolean; retry_after?: number }
    | null
    | undefined;
  if (!linha) throw new Error('Falha ao registrar chamada: RPC sem retorno');
  return { permitido: linha.permitido === true, retryAfter: Number(linha.retry_after) || 1 };
}

// ─── Consultas ───────────────────────────────────────────────────────────────

export async function buscarRequisicao(supabase: SupabaseClient, cod: string) {
  const [requisicao, fila] = await Promise.all([
    supabase.from('ac_apoio_requisicoes').select(COLUNAS_REQUISICAO).eq('codigo_lis', cod).maybeSingle(),
    supabase
      .from('ac_apoio_fila')
      .select(COLUNAS_FILA)
      .eq('numero_requisicao', cod)
      .order('updated_at', { ascending: false })
      .limit(MAX_FILA_POR_REQUISICAO),
  ]);
  if (requisicao.error) throw new Error(`Falha ao ler ac_apoio_requisicoes: ${describeError(requisicao.error)}`);
  if (fila.error) throw new Error(`Falha ao ler ac_apoio_fila: ${describeError(fila.error)}`);

  const itens = fila.data ?? [];
  if (!requisicao.data && itens.length === 0) return null;
  return {
    cod_requisicao: cod,
    enviada_alvaro: requisicao.data !== null,
    requisicao: requisicao.data,
    fila: itens,
  };
}

function inicioDoDia(data: string): string {
  return new Date(`${data}T00:00:00${FUSO_LAB}`).toISOString();
}

function inicioDoDiaSeguinte(data: string): string {
  const d = new Date(`${data}T00:00:00${FUSO_LAB}`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

export async function listarFila(supabase: SupabaseClient, filtros: FiltrosFila) {
  const inicio = (filtros.pagina - 1) * filtros.limite;
  // Pede um a mais para saber se há próxima página sem um count(*).
  let consulta = supabase
    .from('ac_apoio_fila')
    .select(COLUNAS_FILA)
    .order('updated_at', { ascending: false })
    .order('id', { ascending: true })
    .range(inicio, inicio + filtros.limite);
  if (filtros.status) consulta = consulta.eq('status', filtros.status);
  if (filtros.desde) consulta = consulta.gte('updated_at', inicioDoDia(filtros.desde));
  if (filtros.ate) consulta = consulta.lt('updated_at', inicioDoDiaSeguinte(filtros.ate));

  const { data, error } = await consulta;
  if (error) throw new Error(`Falha ao ler ac_apoio_fila: ${describeError(error)}`);
  const linhas = data ?? [];
  return {
    itens: linhas.slice(0, filtros.limite),
    pagina: filtros.pagina,
    limite: filtros.limite,
    tem_mais: linhas.length > filtros.limite,
  };
}

export async function listarExames(supabase: SupabaseClient) {
  const exames = await buscarTodasPaginado(supabase, 'ac_apoio_exames', COLUNAS_EXAMES);
  return { exames };
}

// ─── Handler ─────────────────────────────────────────────────────────────────

function parametrosAuditoria(p: Parametros): Record<string, unknown> {
  if (p.recurso === 'requisicao') return { cod: p.cod };
  if (p.recurso === 'fila') return { ...p.filtros };
  return {};
}

export function criarHandlerLabBrainApoio(recurso: RecursoLabBrain) {
  const rota = `lab-brain-apoio-${recurso}`;
  const log = `[integracoes/${rota}]`;

  return async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      res.status(405).json({ success: false, error: 'Método não permitido' });
      return;
    }

    let autorizado: boolean;
    try {
      autorizado = isLabBrainApiKeyValid(req);
    } catch (err) {
      console.error(`${log} erro de configuração:`, describeError(err));
      res.status(500).json({ success: false, error: 'Erro interno' });
      return;
    }
    if (!autorizado) {
      res.status(401).json({ success: false, error: 'Não autorizado' });
      return;
    }

    const parse = parseParametros(recurso, req.query ?? {});
    if ('erro' in parse) {
      res.status(400).json({ success: false, error: parse.erro });
      return;
    }
    const params = parse.valor;

    try {
      const supabase = getSupabaseAdminClient();

      const cota = await registrarChamada(supabase, rota, parametrosAuditoria(params));
      if (!cota.permitido) {
        res.setHeader('Retry-After', String(cota.retryAfter));
        res.status(429).json({
          success: false,
          error: `Limite de ${LAB_BRAIN_LIMITE_POR_MINUTO} chamadas por minuto atingido.`,
        });
        return;
      }

      res.setHeader('Cache-Control', 'no-store');
      if (params.recurso === 'requisicao') {
        const resultado = await buscarRequisicao(supabase, params.cod);
        if (!resultado) {
          res.status(404).json({ success: false, error: 'Requisição não encontrada no Envio ao Álvaro.' });
          return;
        }
        res.status(200).json(resultado);
      } else if (params.recurso === 'fila') {
        res.status(200).json(await listarFila(supabase, params.filtros));
      } else {
        res.status(200).json(await listarExames(supabase));
      }
    } catch (err) {
      console.error(`${log} erro:`, describeError(err));
      res.status(500).json({ success: false, error: 'Erro interno' });
    }
  };
}
