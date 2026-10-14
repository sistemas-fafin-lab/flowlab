// Cliente do WAHA da EVA (issue 12, plano §11.2). Só o script da VPS o usa: a Vercel não
// alcança o WAHA, que fica em 127.0.0.1:3000 (D9). Recebe o fetch por injeção e nunca
// lança: toda falha volta como { ok: false, erro } (RNF05). A chave nunca vai para o erro.

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface ConfigWaha {
  /** http://127.0.0.1:3000 — o localhost da VPS, nunca a URL do ngrok. */
  url: string;
  apiKey?: string;
  /** eva (a sessão do número da EVA no WAHA) */
  sessao: string;
  /** Tempo máximo de cada chamada (padrão 15 s). */
  timeoutMs?: number;
}

export type Falha = { ok: false; erro: string };

/** Os motivos de falha de conexão mais comuns, em português, para o log da VPS. */
const MOTIVOS: Record<string, string> = {
  ECONNREFUSED: 'conexão recusada: nada escutando nessa porta',
  ENOTFOUND: 'endereço não encontrado',
  EHOSTUNREACH: 'máquina inalcançável',
  ETIMEDOUT: 'tempo esgotado na conexão',
  ECONNRESET: 'conexão interrompida',
};

export interface ClienteWaha {
  /** GET /api/sessions/{sessao} → WORKING, SCAN_QR_CODE, STARTING, FAILED, STOPPED… */
  sessao(): Promise<{ ok: true; status: string } | Falha>;
  /** GET /api/contacts/check-exists — resolve o chatId certo (9º dígito, §3). */
  verificarNumero(digitos: string): Promise<{ ok: true; existe: boolean; chatId: string | null } | Falha>;
  /** POST /api/sendText */
  enviarTexto(chatId: string, texto: string): Promise<{ ok: true; id: string | null } | Falha>;
  /** GET /api/{sessao}/groups — os grupos do número da EVA, para escolher o da equipe (D29). */
  listarGrupos(): Promise<{ ok: true; grupos: GrupoWaha[] } | Falha>;
}

export interface GrupoWaha { id: string; nome: string }

/** Grupos guardados por execução: o bastante para escolher o da equipe numa lista. */
export const MAX_GRUPOS = 200;

const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/**
 * A lista de grupos vem num formato por engine: WEBJS (id._serialized, name), NOWEB (um objeto
 * por id, com subject) e GOWS (JID, Name). Fica só o que tem id de grupo (@g.us), sem repetir.
 */
export function lerGrupos(dados: unknown): GrupoWaha[] {
  const lista = Array.isArray(dados) ? dados : dados && typeof dados === 'object' ? Object.values(dados as Record<string, unknown>) : [];
  const vistos = new Set<string>();
  const grupos: GrupoWaha[] = [];
  for (const bruto of lista) {
    const g = (bruto ?? {}) as Record<string, unknown>;
    const idObj = g.id as { _serialized?: unknown } | undefined;
    const id = texto(g.id) ?? texto(idObj?._serialized) ?? texto(g.JID) ?? texto(g.jid);
    if (!id || !/@g\.us$/.test(id) || vistos.has(id)) continue;
    const nomeObj = g.GroupName as { Name?: unknown } | undefined;
    const nome = texto(g.name) ?? texto(g.subject) ?? texto(g.Name) ?? texto(g.Subject) ?? texto(nomeObj?.Name) ?? id;
    vistos.add(id);
    grupos.push({ id, nome: nome.slice(0, 120) });
    if (grupos.length >= MAX_GRUPOS) break;
  }
  return grupos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** O WAHA devolve o id da mensagem em formatos diferentes conforme o engine. */
export function idDaMensagem(resposta: unknown): string | null {
  const r = resposta as { id?: unknown; key?: { id?: unknown } } | null;
  if (!r) return null;
  if (typeof r.id === 'string') return r.id;
  const id = r.id as { _serialized?: unknown; id?: unknown } | undefined;
  if (id && typeof id._serialized === 'string') return id._serialized;
  if (id && typeof id.id === 'string') return id.id;
  if (r.key && typeof r.key.id === 'string') return r.key.id;
  return null;
}

export function criarClienteWaha(cfg: ConfigWaha, fetchImpl: FetchLike = fetch): ClienteWaha {
  const base = cfg.url.replace(/\/+$/, '');
  const cabecalhos = (json = false): Record<string, string> => ({
    Accept: 'application/json',
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(cfg.apiKey ? { 'X-Api-Key': cfg.apiKey } : {}),
  });

  async function chamar(caminho: string, init: RequestInit = {}): Promise<{ ok: true; dados: unknown } | Falha> {
    try {
      const resposta = await fetchImpl(`${base}${caminho}`, { ...init, signal: AbortSignal.timeout(cfg.timeoutMs ?? 15_000) });
      const texto = await resposta.text().catch(() => '');
      if (!resposta.ok) {
        const detalhe = texto.replace(/\s+/g, ' ').slice(0, 200);
        return { ok: false, erro: `WAHA HTTP ${resposta.status}${detalhe ? ` — ${detalhe}` : ''}` };
      }
      try {
        return { ok: true, dados: texto ? JSON.parse(texto) : null };
      } catch {
        return { ok: true, dados: texto };
      }
    } catch (e) {
      const nome = e instanceof Error ? e.name : '';
      if (nome === 'TimeoutError' || nome === 'AbortError') return { ok: false, erro: `WAHA não respondeu a tempo em ${base}.` };
      // O fetch do Node só diz "fetch failed"; o motivo de verdade (ECONNREFUSED…) vem em `cause`.
      const causa = (e as { cause?: { code?: unknown; message?: unknown } })?.cause;
      const motivo = typeof causa?.code === 'string' ? (MOTIVOS[causa.code] ?? causa.code) : typeof causa?.message === 'string' ? causa.message : e instanceof Error ? e.message : String(e);
      return { ok: false, erro: `Sem conexão com o WAHA em ${base} (${motivo}).` };
    }
  }

  return {
    async sessao() {
      const r = await chamar(`/api/sessions/${encodeURIComponent(cfg.sessao)}`, { headers: cabecalhos() });
      if ('erro' in r) return r;
      const status = (r.dados as { status?: unknown } | null)?.status;
      return typeof status === 'string' ? { ok: true, status } : { ok: false, erro: 'O WAHA não informou a situação da sessão.' };
    },

    async verificarNumero(digitos) {
      const q = new URLSearchParams({ phone: digitos.replace(/\D/g, ''), session: cfg.sessao });
      const r = await chamar(`/api/contacts/check-exists?${q}`, { headers: cabecalhos() });
      if ('erro' in r) return r;
      const d = (r.dados ?? {}) as { numberExists?: unknown; chatId?: unknown };
      return { ok: true, existe: d.numberExists === true, chatId: typeof d.chatId === 'string' ? d.chatId : null };
    },

    async enviarTexto(chatId, texto) {
      const r = await chamar('/api/sendText', {
        method: 'POST',
        headers: cabecalhos(true),
        body: JSON.stringify({ session: cfg.sessao, chatId, text: texto }),
      });
      if ('erro' in r) return r;
      return { ok: true, id: idDaMensagem(r.dados) };
    },

    async listarGrupos() {
      const r = await chamar(`/api/${encodeURIComponent(cfg.sessao)}/groups`, { headers: cabecalhos() });
      if ('erro' in r) return r;
      return { ok: true, grupos: lerGrupos(r.dados) };
    },
  };
}
