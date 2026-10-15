// Cliente da API pública do Granola (plano §3): lista as notas de uma pasta e busca uma
// nota com o resumo. fetch injetado e nunca lança exceção (padrão de requestsDigestWhatsApp).

const BASE = 'https://public-api.granola.ai/v1';
const TEMPO_LIMITE_MS = 20_000;
/** A API aceita page_size de 1 a 30. */
const TAMANHO_PAGINA = 30;
/** Teto de páginas por sincronização — a pasta da TI tem poucas notas por semana. */
const MAX_PAGINAS = 20;

export interface ResumoNotaGranola {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface NotaGranola extends ResumoNotaGranola {
  web_url: string | null;
  summary_markdown: string | null;
  summary_text: string | null;
  calendar_event: { event_title?: string | null; scheduled_start_time?: string | null } | null;
  attendees: { name?: string | null; email?: string | null }[] | null;
}

export type Resultado<T> = { ok: true; dados: T } | { ok: false; status: number | null; erro: string };

type Fetch = typeof fetch;

export interface OpcoesGranola {
  apiKey: string | undefined;
  fetch?: Fetch;
}

/** O que o Granola diz no corpo do erro: {"details":[{"field":"updated_after","issue":"Invalid date"}]} → "updated_after: Invalid date". */
function detalheDoErro(corpo: unknown): string | null {
  const c = corpo as { message?: unknown; details?: { field?: unknown; issue?: unknown }[] } | null;
  if (!c || typeof c !== 'object') return null;
  const itens = Array.isArray(c.details) ? c.details.map((d) => [d.field, d.issue].filter((x) => typeof x === 'string').join(': ')).filter(Boolean) : [];
  const texto = itens.length ? itens.join('; ') : typeof c.message === 'string' ? c.message : '';
  return texto ? texto.slice(0, 200) : null;
}

/**
 * O filtro de data como a API aceita: ISO com "Z" ("2026-10-05T18:52:59.797Z"). O Postgres devolve
 * o cursor como "2026-10-05T18:52:59.797+00:00", que ela recusa com 400 "Invalid date" (15/Out).
 */
export function paraDataGranola(valor: string): string | null {
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function pedir<T>(f: Fetch, apiKey: string, caminho: string): Promise<Resultado<T>> {
  try {
    const resp = await f(`${BASE}${caminho}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    });
    if (!resp.ok) {
      const motivo =
        resp.status === 401 ? 'chave do Granola inválida ou revogada' :
        resp.status === 403 ? 'a chave do Granola não tem acesso a esta pasta' :
        resp.status === 429 ? 'limite de requisições do Granola atingido' :
        `Granola respondeu HTTP ${resp.status}`;
      const detalhe = detalheDoErro(await resp.json().catch(() => null));
      return { ok: false, status: resp.status, erro: detalhe ? `${motivo} (${detalhe})` : motivo };
    }
    return { ok: true, dados: (await resp.json()) as T };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, status: null, erro: `Falha ao falar com o Granola: ${msg}` };
  }
}

export function criarClienteGranola(opcoes: OpcoesGranola) {
  const f = opcoes.fetch ?? fetch;
  const apiKey = opcoes.apiKey?.trim();

  return {
    /** Notas da pasta (e subpastas) atualizadas depois de `atualizadasDepois`, seguindo o cursor. */
    async listarNotas(params: { pastaId: string; atualizadasDepois?: string | null }): Promise<Resultado<ResumoNotaGranola[]>> {
      if (!apiKey) return { ok: false, status: null, erro: 'GRANOLA_API_KEY não configurada.' };
      const notas: ResumoNotaGranola[] = [];
      let cursor: string | null = null;
      const depois = params.atualizadasDepois ? paraDataGranola(params.atualizadasDepois) : null;
      for (let pagina = 0; pagina < MAX_PAGINAS; pagina += 1) {
        const q = new URLSearchParams({ folder_id: params.pastaId, page_size: String(TAMANHO_PAGINA) });
        if (depois) q.set('updated_after', depois);
        if (cursor) q.set('cursor', cursor);
        const r = await pedir<{ notes?: ResumoNotaGranola[]; hasMore?: boolean; cursor?: string | null }>(f, apiKey, `/notes?${q}`);
        if ('erro' in r) return { ok: false, status: r.status, erro: r.erro };
        notas.push(...(r.dados.notes ?? []));
        if (!r.dados.hasMore || !r.dados.cursor) return { ok: true, dados: notas };
        cursor = r.dados.cursor;
      }
      return { ok: true, dados: notas };
    },

    /** Uma nota com o resumo (sem transcrição: o resumo basta, §3). */
    async buscarNota(id: string): Promise<Resultado<NotaGranola>> {
      if (!apiKey) return { ok: false, status: null, erro: 'GRANOLA_API_KEY não configurada.' };
      if (!/^not_[A-Za-z0-9]+$/.test(id)) return { ok: false, status: null, erro: `Id de nota inválido: ${id}` };
      return pedir<NotaGranola>(f, apiKey, `/notes/${encodeURIComponent(id)}`);
    },
  };
}

export type ClienteGranola = ReturnType<typeof criarClienteGranola>;
