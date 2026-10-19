import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

vi.mock('../supabase.js', () => ({
  getSupabaseAdminClient: vi.fn(),
}));
vi.mock('../faturamento/bdLab.js', () => ({
  buscarLocaisOrigem: vi.fn(),
  MAX_BUSCA: 100,
}));

import { getSupabaseAdminClient } from '../supabase.js';
import { buscarLocaisOrigem } from '../faturamento/bdLab.js';
import handler from './faturamento-locais-origem.js';

const getSupabaseAdminClientMock = getSupabaseAdminClient as ReturnType<typeof vi.fn>;
const buscarLocaisOrigemMock = buscarLocaisOrigem as ReturnType<typeof vi.fn>;

interface CorpoResposta {
  success: boolean;
  error?: string;
  locais?: Record<string, unknown>[];
}

// Query builder mínimo do supabase-js para o user_profiles de autorizarFaturamento.
function consulta(linha: Record<string, unknown>) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    single: async () => ({ data: linha, error: null }),
  };
  return builder;
}

function prepararSupabase(permissoes: string[]) {
  getSupabaseAdminClientMock.mockReturnValue({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })) },
    from: vi.fn(() => consulta({ id: 'user-1', custom_roles: { permissions: permissoes } })),
  });
}

function criarReq(query: Record<string, string> = {}, opcoes: { metodo?: string; token?: string | null } = {}): VercelRequest {
  const token = opcoes.token === undefined ? 'token-teste' : opcoes.token;
  return {
    method: opcoes.metodo ?? 'GET',
    headers: token ? { authorization: `Bearer ${token}` } : {},
    query,
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
  query: Record<string, string>,
  opcoes: { permissoes?: string[]; metodo?: string; token?: string | null } = {},
) {
  prepararSupabase(opcoes.permissoes ?? ['canViewBilling']);
  const res = criarRes();
  await handler(criarReq(query, opcoes), res);
  return res;
}

const NEXUS = { id: 1290, nome: 'NEXUS', razaoSocial: 'NUCLEO DE EXCELENCIA EM ULTRASSONOGRAFIA ENSINO MEDICO LTDA', inativo: false };

afterEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/faturamento/locais-origem', () => {
  it('devolve os locais de origem que casam o termo', async () => {
    buscarLocaisOrigemMock.mockResolvedValue({ locais: [NEXUS] });

    const res = await executar({ busca: 'nexus' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, locais: [NEXUS] });
    expect(buscarLocaisOrigemMock).toHaveBeenCalledWith('nexus');
  });

  it('tira os espaços das pontas do termo antes de buscar', async () => {
    buscarLocaisOrigemMock.mockResolvedValue({ locais: [] });

    await executar({ busca: '  mater  ' });

    expect(buscarLocaisOrigemMock).toHaveBeenCalledWith('mater');
  });

  it('quem só tem canManageBilling também busca', async () => {
    buscarLocaisOrigemMock.mockResolvedValue({ locais: [NEXUS] });

    const res = await executar({ busca: 'nexus' }, { permissoes: ['canManageBilling'] });

    expect(res.statusCode).toBe(200);
  });

  it('sem permissão de faturamento devolve 403 sem consultar o apLIS', async () => {
    const res = await executar({ busca: 'nexus' }, { permissoes: [] });

    expect(res.statusCode).toBe(403);
    expect(buscarLocaisOrigemMock).not.toHaveBeenCalled();
  });

  it('sem sessão devolve 401 sem consultar o apLIS', async () => {
    const res = await executar({ busca: 'nexus' }, { token: null });

    expect(res.statusCode).toBe(401);
    expect(buscarLocaisOrigemMock).not.toHaveBeenCalled();
  });

  it.each([
    ['sem termo', {}],
    ['termo vazio', { busca: '   ' }],
    ['termo de um caractere', { busca: 'n' }],
    ['termo longo demais', { busca: 'x'.repeat(101) }],
  ])('%s devolve 400 sem consultar o apLIS', async (_caso, query) => {
    const res = await executar(query);

    expect(res.statusCode).toBe(400);
    expect(res.body?.success).toBe(false);
    expect(buscarLocaisOrigemMock).not.toHaveBeenCalled();
  });

  it('falha do banco do laboratório vira o erro devolvido pela consulta', async () => {
    buscarLocaisOrigemMock.mockResolvedValue({ erro: { status: 502, mensagem: 'Banco fora do ar' } });

    const res = await executar({ busca: 'nexus' });

    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({ success: false, error: 'Banco fora do ar' });
  });

  it('método diferente de GET devolve 405', async () => {
    const res = await executar({ busca: 'nexus' }, { metodo: 'POST' });

    expect(res.statusCode).toBe(405);
    expect(buscarLocaisOrigemMock).not.toHaveBeenCalled();
  });
});
