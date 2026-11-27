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
import handler from './atendimento-tabela-colaborador-precos.js';

const getSupabaseAdminClientMock = getSupabaseAdminClient as ReturnType<typeof vi.fn>;
const buildOrcamentoParticularMock = buildOrcamentoParticular as ReturnType<typeof vi.fn>;

interface CorpoResposta {
  success: boolean;
  error?: string;
  itens?: Record<string, unknown>[];
  podeVerCustos?: boolean;
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
  prepararSupabase(opcoes.permissoes ?? ['canUseTabelaColaborador'], { sessaoValida: opcoes.sessaoValida });
  const res = criarRes();
  await handler(criarReq(opcoes), res);
  return res;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/atendimento/tabela-colaborador-precos', () => {
  const itens = [
    { tuss: '40304361', nome: 'Hemograma', precoParticular: 25, precoColaborador: { disponivel: true, valor: 19.66 } },
  ];

  it('sem token devolve 401 sem montar a lista', async () => {
    const res = await executar({ token: null });

    expect(res.statusCode).toBe(401);
    expect(res.body?.success).toBe(false);
    expect(buildOrcamentoParticularMock).not.toHaveBeenCalled();
  });

  it('sessão inválida devolve 401 sem montar a lista', async () => {
    const res = await executar({ sessaoValida: false });

    expect(res.statusCode).toBe(401);
    expect(buildOrcamentoParticularMock).not.toHaveBeenCalled();
  });

  it('só com canUseGeradorOrcamento (e custos) devolve 403 sem montar a lista', async () => {
    const res = await executar({ permissoes: ['canUseGeradorOrcamento', 'canViewGeradorOrcamentoCustos'] });

    expect(res.statusCode).toBe(403);
    expect(res.body?.success).toBe(false);
    expect(buildOrcamentoParticularMock).not.toHaveBeenCalled();
  });

  it('com a permissão e sem custos monta no modo colaborador sem custo', async () => {
    buildOrcamentoParticularMock.mockResolvedValue(itens);

    const res = await executar();

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, itens, podeVerCustos: false });
    expect(buildOrcamentoParticularMock).toHaveBeenCalledWith(expect.anything(), {
      incluirCusto: false,
      modo: 'colaborador',
    });
    expect(res.headers['Cache-Control']).toBe('no-store');
  });

  it('com a permissão e a de custos monta com custo', async () => {
    buildOrcamentoParticularMock.mockResolvedValue(itens);

    const res = await executar({ permissoes: ['canUseTabelaColaborador', 'canViewGeradorOrcamentoCustos'] });

    expect(res.statusCode).toBe(200);
    expect(res.body?.podeVerCustos).toBe(true);
    expect(buildOrcamentoParticularMock).toHaveBeenCalledWith(expect.anything(), {
      incluirCusto: true,
      modo: 'colaborador',
    });
  });

  it('método diferente de GET devolve 405 sem montar a lista', async () => {
    const res = await executar({ metodo: 'POST' });

    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe('GET');
    expect(buildOrcamentoParticularMock).not.toHaveBeenCalled();
  });

  it('falha ao montar a lista devolve 500', async () => {
    buildOrcamentoParticularMock.mockRejectedValue(new Error('Parâmetros da Tabela Colaborador não cadastrados.'));

    const res = await executar();

    expect(res.statusCode).toBe(500);
    expect(res.body?.success).toBe(false);
  });
});
