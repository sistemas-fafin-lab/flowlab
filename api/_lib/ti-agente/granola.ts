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
      return { ok: false, status: resp.status, erro: motivo };
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
      for (let pagina = 0; pagina < MAX_PAGINAS; pagina += 1) {
        const q = new URLSearchParams({ folder_id: params.pastaId, page_size: String(TAMANHO_PAGINA) });
        if (params.atualizadasDepois) q.set('updated_after', params.atualizadasDepois);
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
