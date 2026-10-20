import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

vi.mock('../supabase.js', () => ({
  getSupabaseAdminClient: vi.fn(),
}));
vi.mock('../orcamentoParticular.js', () => ({
  buildOrcamentoParticular: vi.fn(),
}));

import { getSupabaseAdminClient } from '../supabase.js';
import { buildOrcamentoParticular } from '../orcamentoParticular.js';
import handler from './atendimento-gerador-orcamento-precos.js';

const getSupabaseAdminClientMock = getSupabaseAdminClient as ReturnType<typeof vi.fn>;
const buildOrcamentoParticularMock = buildOrcamentoParticular as ReturnType<typeof vi.fn>;

interface CorpoResposta {
  success: boolean;
  error?: string;
  itens?: Record<string, unknown>[];
}

// Query builder mínimo do supabase-js para o user_profiles da autorização.
function consulta(linha: Record<string, unknown>) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    single: async () => ({ data: linha, error: null }),
  };
  return builder;
}

function prepararSupabase(permissoes: string[], opcoes: { sessaoValida?: boolean } = {}) {
  const sessaoValida = opcoes.sessaoValida ?? true;
  getSupabaseAdminClientMock.mockReturnValue({
    auth: {
      getUser: vi.fn(async () =>
        sessaoValida
          ? { data: { user: { id: 'user-1' } }, error: null }
          : { data: { user: null }, error: { message: 'invalid JWT' } },
      ),
    },
    from: vi.fn(() => consulta({ id: 'user-1', custom_roles: { permissions: permissoes } })),
  });
}

function criarReq(opcoes: { metodo?: string; token?: string | null } = {}): VercelRequest {
  const token = opcoes.token === undefined ? 'token-teste' : opcoes.token;
  return {
    method: opcoes.metodo ?? 'GET',
    headers: token ? { authorization: `Bearer ${token}` } : {},
    query: {},
  } as unknown as VercelRequest;
}

function criarRes() {
  const res = {
    statusCode: undefined as number | undefined,
    body: undefined as CorpoResposta | undefined,
    headers: {} as Record<string, string>,
    setHeader(chave: string, valor: string) {
      this.headers[chave] = valor;
    },
    status(codigo: number) {
      this.statusCode = codigo;
      return this;
    },
    json(payload: unknown) {
      this.body = payload as CorpoResposta;
      return this;
    },
  };
  return res as unknown as VercelResponse & typeof res;
}

async function executar(
  opcoes: { permissoes?: string[]; metodo?: string; token?: string | null; sessaoValida?: boolean } = {},
) {
  prepararSupabase(opcoes.permissoes ?? ['canUseGeradorOrcamento'], { sessaoValida: opcoes.sessaoValida });
  const res = criarRes();
  await handler(criarReq(opcoes), res);
  return res;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/atendimento/gerador-orcamento-precos', () => {
  it('sem token devolve 401 sem montar a lista', async () => {
    const res = await executar({ token: null });

    expect(res.statusCode).toBe(401);
    expect(res.body?.success).toBe(false);
    expect(buildOrcamentoParticularMock).not.toHaveBeenCalled();
  });

  it('sessão inválida devolve 401 sem montar a lista', async () => {
    const res = await executar({ sessaoValida: false });

    expect(res.statusCode).toBe(401);
    expect(res.body?.success).toBe(false);
    expect(buildOrcamentoParticularMock).not.toHaveBeenCalled();
  });

  it('sem canUseGeradorOrcamento devolve 403 sem montar a lista', async () => {
    const res = await executar({ permissoes: ['canViewBilling'] });

    expect(res.statusCode).toBe(403);
    expect(res.body?.success).toBe(false);
    expect(buildOrcamentoParticularMock).not.toHaveBeenCalled();
  });

  it('com canUseGeradorOrcamento devolve 200 com a lista montada sem custo', async () => {
    const itens = [
      { tuss: '40304361', nome: 'Hemograma', preco: 25, elegivelDescontoParticular: true, conveniosAceitos: ['Unimed'] },
      { tuss: '40304361', nome: 'Hemograma com plaquetas', preco: 30, elegivelDescontoParticular: true, conveniosAceitos: [] },
    ];
    buildOrcamentoParticularMock.mockResolvedValue(itens);

    const res = await executar();

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, itens });
    expect(buildOrcamentoParticularMock).toHaveBeenCalledWith(expect.anything(), { incluirCusto: false });
    expect(res.headers['Cache-Control']).toBe('no-store');
  });

  it('método diferente de GET devolve 405 sem montar a lista', async () => {
    const res = await executar({ metodo: 'POST' });

    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe('GET');
    expect(buildOrcamentoParticularMock).not.toHaveBeenCalled();
  });

  it('falha ao montar a lista devolve 500', async () => {
    buildOrcamentoParticularMock.mockRejectedValue(new Error('Falha ao ler custo_exames'));

    const res = await executar();

    expect(res.statusCode).toBe(500);
    expect(res.body?.success).toBe(false);
  });
});
