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

export interface ClienteWaha {
  /** GET /api/sessions/{sessao} → WORKING, SCAN_QR_CODE, STARTING, FAILED, STOPPED… */
  sessao(): Promise<{ ok: true; status: string } | Falha>;
  /** GET /api/contacts/check-exists — resolve o chatId certo (9º dígito, §3). */
  verificarNumero(digitos: string): Promise<{ ok: true; existe: boolean; chatId: string | null } | Falha>;
  /** POST /api/sendText */
  enviarTexto(chatId: string, texto: string): Promise<{ ok: true; id: string | null } | Falha>;
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
      return { ok: false, erro: nome === 'TimeoutError' || nome === 'AbortError' ? 'WAHA não respondeu a tempo.' : `Sem conexão com o WAHA (${e instanceof Error ? e.message : String(e)}).` };
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
  };
}
