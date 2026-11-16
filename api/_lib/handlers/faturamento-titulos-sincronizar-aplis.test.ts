import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

vi.mock('../supabase.js', () => ({
  getSupabaseAdminClient: vi.fn(() => ({})),
}));
vi.mock('../faturamento/autorizacao.js', () => ({
  tokenDoHeader: vi.fn((h?: string) => (h?.startsWith('Bearer ') ? h.slice(7) : null)),
  autorizarFaturamento: vi.fn(),
}));
vi.mock('../faturamento/sincronizarTitulosAplis.js', () => ({
  sincronizarTitulosAplis: vi.fn(),
}));

import { autorizarFaturamento } from '../faturamento/autorizacao.js';
import { sincronizarTitulosAplis } from '../faturamento/sincronizarTitulosAplis.js';
import handler from './faturamento-titulos-sincronizar-aplis.js';

const autorizarMock = autorizarFaturamento as ReturnType<typeof vi.fn>;
const sincronizarMock = sincronizarTitulosAplis as ReturnType<typeof vi.fn>;

function criarRes() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    setHeader(nome: string, valor: string) { this.headers[nome] = valor; return this; },
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
  };
}

async function chamar(method = 'POST') {
  const res = criarRes();
  await handler(
    { method, headers: { authorization: 'Bearer token' }, query: {}, body: {} } as unknown as VercelRequest,
    res as unknown as VercelResponse,
  );
  return { status: res.statusCode, corpo: res.body as Record<string, unknown> };
}

describe('POST /api/faturamento/titulos-sincronizar-aplis', () => {
  afterEach(() => {
    autorizarMock.mockReset();
    sincronizarMock.mockReset();
  });

  it('método diferente de POST devolve 405', async () => {
    expect((await chamar('GET')).status).toBe(405);
    expect(sincronizarMock).not.toHaveBeenCalled();
  });

  it('sem permissão da tela não sincroniza', async () => {
    autorizarMock.mockResolvedValue({ status: 403, payload: { success: false, error: 'Sem permissão' } });
    const { status } = await chamar();
    expect(status).toBe(403);
    expect(autorizarMock).toHaveBeenCalledWith('token', ['contasReceber']);
    expect(sincronizarMock).not.toHaveBeenCalled();
  });

  it('devolve o resumo da sincronização', async () => {
    autorizarMock.mockResolvedValue(null);
    sincronizarMock.mockResolvedValue({
      lotes: 1948, lotesAtualizados: 3, statusMudaram: 2, numerosPreenchidos: 1, refechamentos: [], dadoAte: '2026-11-15',
    });
    const { status, corpo } = await chamar();
    expect(status).toBe(200);
    expect(corpo).toEqual({
      success: true,
      meta: { dadoAte: '2026-11-15' },
      lotes: 1948,
      lotesAtualizados: 3,
      statusMudaram: 2,
      numerosPreenchidos: 1,
      refechamentos: [],
    });
  });

  it('falha no apLIS devolve o erro', async () => {
    autorizarMock.mockResolvedValue(null);
    sincronizarMock.mockResolvedValue({ erro: { status: 502, mensagem: 'túnel fora' } });
    const { status, corpo } = await chamar();
    expect(status).toBe(502);
    expect(String(corpo.error)).toContain('túnel fora');
  });
});
