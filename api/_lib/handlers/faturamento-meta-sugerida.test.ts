import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

vi.mock('../supabase.js', () => ({
  getSupabaseAdminClient: vi.fn(),
}));
vi.mock('../faturamento/bdLab.js', () => ({
  listarElegiveisPorMes: vi.fn(),
}));
vi.mock('../faturamento/fontesConsideradas.js', () => ({
  listarFontesConsideradasMeta: vi.fn(async () => [10, 20]),
}));

import { getSupabaseAdminClient } from '../supabase.js';
import { listarElegiveisPorMes } from '../faturamento/bdLab.js';
import handler from './faturamento-meta-sugerida.js';

const getSupabaseAdminClientMock = getSupabaseAdminClient as ReturnType<typeof vi.fn>;
const listarElegiveisMock = listarElegiveisPorMes as ReturnType<typeof vi.fn>;

type Linha = Record<string, unknown>;

interface CorpoResposta {
  success: boolean;
  error?: string;
  mes?: string;
  candidatas?: { origem: string; valor: number | null; meses: string[] }[];
  elegiveis?: { mes: string; valor: number }[];
  dadoAte?: string | null;
}

// Query builder mínimo do supabase-js: select/eq encadeáveis, single() e `await`.
function consulta(linhas: Linha[]) {
  let resultado = [...linhas];
  const builder = {
    select: () => builder,
    eq: (coluna: string, valor: unknown) => {
      resultado = resultado.filter((l) => l[coluna] === valor);
      return builder;
    },
    single: async () => ({ data: resultado[0] ?? null, error: null }),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve({ data: resultado, error: null }).then(resolve, reject),
  };
  return builder;
}

function prepararSupabase(permissoes: string[]) {
  getSupabaseAdminClientMock.mockReturnValue({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })) },
    from: vi.fn(() => consulta([{ id: 'user-1', custom_roles: { permissions: permissoes } }])),
  });
}

const ELEGIVEIS = [
  { mes: '2026-09', valor: 1_186_656.81 },
  { mes: '2026-08', valor: 1_090_681.63 },
];

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

async function executar(permissoes: string[], query: Record<string, string> = { mes: '2026-10' }, method = 'GET') {
  prepararSupabase(permissoes);
  listarElegiveisMock.mockResolvedValue({ elegiveis: ELEGIVEIS, dadoAte: '2026-10-05' });
  const res = criarRes();
  const req = { method, headers: { authorization: 'Bearer token-teste' }, query } as unknown as VercelRequest;
  await handler(req, res);
  return res;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/faturamento/meta-sugerida', () => {
  it('devolve as candidatas do mês, os Elegíveis usados e o dadoAte, sem cache', async () => {
    const res = await executar(['canViewContasReceber']);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(res.body).toEqual({
      success: true,
      mes: '2026-10',
      candidatas: [
        { origem: '90_10', valor: 1_177_059.29, meses: ['2026-09', '2026-08'] },
        { origem: 'media_2', valor: 1_138_669.22, meses: ['2026-09', '2026-08'] },
        // Julho não veio do apLIS: só a média de 3 fica indisponível.
        { origem: 'media_3', valor: null, meses: ['2026-09', '2026-08', '2026-07'] },
      ],
      elegiveis: ELEGIVEIS,
      dadoAte: '2026-10-05',
    });
  });

  it('consulta de M-3 a M-1 numa ida só, com a lista de fontes consideradas na meta', async () => {
    await executar(['canViewContasReceber'], { mes: '2027-01' });
    expect(listarElegiveisMock).toHaveBeenCalledTimes(1);
    expect(listarElegiveisMock).toHaveBeenCalledWith({
      periodoIni: '2026-10-01',
      periodoFim: '2026-12-31',
      fontesConsideradas: [10, 20],
    });
  });

  it.each([
    ['ausente', {}],
    ['fora do formato', { mes: '10/2026' }],
    ['mês 13', { mes: '2026-13' }],
  ])('mês %s devolve 400 sem consultar o apLIS', async (_caso, query) => {
    const res = await executar(['canViewContasReceber'], query);
    expect(res.statusCode).toBe(400);
    expect(listarElegiveisMock).not.toHaveBeenCalled();
  });

  it('método diferente de GET devolve 405', async () => {
    const res = await executar(['canViewContasReceber'], { mes: '2026-10' }, 'POST');
    expect(res.statusCode).toBe(405);
  });

  it('sem sessão devolve 401 sem consultar o apLIS', async () => {
    prepararSupabase(['canViewContasReceber']);
    const res = criarRes();
    await handler({ method: 'GET', headers: {}, query: { mes: '2026-10' } } as unknown as VercelRequest, res);
    expect(res.statusCode).toBe(401);
    expect(listarElegiveisMock).not.toHaveBeenCalled();
  });

  it('sem permissão do Contas a Receber devolve 403 sem consultar o apLIS', async () => {
    const res = await executar(['canViewGlosas']);
    expect(res.statusCode).toBe(403);
    expect(listarElegiveisMock).not.toHaveBeenCalled();
  });

  it('apLIS indisponível devolve o status e a mensagem da consulta, não 500', async () => {
    prepararSupabase(['canViewContasReceber']);
    listarElegiveisMock.mockResolvedValue({ erro: { status: 502, mensagem: 'apLIS indisponível' } });
    const res = criarRes();
    await handler(
      { method: 'GET', headers: { authorization: 'Bearer token-teste' }, query: { mes: '2026-10' } } as unknown as VercelRequest,
      res,
    );

    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({ success: false, error: 'apLIS indisponível' });
  });
});
