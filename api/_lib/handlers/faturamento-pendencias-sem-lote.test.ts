import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

vi.mock('../supabase.js', () => ({
  getSupabaseAdminClient: vi.fn(),
}));
vi.mock('../faturamento/bdLab.js', () => ({
  listarRequisicoesSemLote: vi.fn(),
  MAX_TAMANHO: 200,
  TAMANHO_PADRAO: 50,
}));
vi.mock('../faturamento/fontesConsideradas.js', () => ({
  listarFontesConsideradasMeta: vi.fn(async () => []),
}));

import { getSupabaseAdminClient } from '../supabase.js';
import { listarRequisicoesSemLote } from '../faturamento/bdLab.js';
import handler from './faturamento-pendencias-sem-lote.js';

const getSupabaseAdminClientMock = getSupabaseAdminClient as ReturnType<typeof vi.fn>;
const listarSemLoteMock = listarRequisicoesSemLote as ReturnType<typeof vi.fn>;

type Linha = Record<string, unknown>;

interface CorpoResposta {
  success: boolean;
  error?: string;
  meta?: Record<string, unknown>;
  requisicoes?: Record<string, unknown>[];
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

const RESULTADO = {
  requisicoes: [{ idRequisicao: 7, valor: 150 }],
  meta: { pagina: 1, tamanho: 1, qtdPaginas: 1, registros: 1, valorTotal: 150, limite: '2026-11-06', clinicas: [] },
};

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

async function executar(permissoes: string[], query: Record<string, string> = {}, method = 'GET') {
  prepararSupabase(permissoes);
  listarSemLoteMock.mockResolvedValue(RESULTADO);
  const res = criarRes();
  const req = { method, headers: { authorization: 'Bearer token-teste' }, query } as unknown as VercelRequest;
  await handler(req, res);
  return res;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/faturamento/pendencias-sem-lote', () => {
  it('devolve meta e requisições como a consulta as montou, sem cache', async () => {
    const res = await executar(['canViewBilling']);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(res.body).toEqual({ success: true, ...RESULTADO });
  });

  it('repassa o recorte do mês e a paginação à consulta', async () => {
    await executar(['canViewBilling'], { desde: '2026-06-01', ate: '2026-06-30', pagina: '1', tamanho: '1' });

    expect(listarSemLoteMock).toHaveBeenCalledWith(
      expect.objectContaining({ desde: '2026-06-01', ate: '2026-06-30', pagina: 1, tamanho: 1 }),
    );
  });

  it('método diferente de GET devolve 405', async () => {
    const res = await executar(['canViewBilling'], {}, 'POST');
    expect(res.statusCode).toBe(405);
    expect(listarSemLoteMock).not.toHaveBeenCalled();
  });

  it('sem permissão de faturamento devolve 403 sem consultar o apLIS', async () => {
    const res = await executar([]);
    expect(res.statusCode).toBe(403);
    expect(listarSemLoteMock).not.toHaveBeenCalled();
  });

  describe('permissão por tela (ADR 0001): a rota serve Contas a Receber', () => {
    it.each([['canViewBilling'], ['canManageBilling'], ['canViewContasReceber']])('%s basta', async (chave) => {
      const res = await executar([chave]);
      expect(res.statusCode).toBe(200);
    });

    it.each([['canViewFaturas'], ['canViewGlosas'], ['canViewIndicadores'], ['canViewCalendarioEnvios']])(
      'só %s devolve 403',
      async (chave) => {
        const res = await executar([chave]);
        expect(res.statusCode).toBe(403);
        expect(listarSemLoteMock).not.toHaveBeenCalled();
      },
    );
  });

  it.each([
    ['desde fora do formato', { desde: '01/06/2026' }],
    ['tamanho acima do máximo', { tamanho: '500' }],
    ['operadoraId não numérico', { operadoraId: 'abc' }],
  ])('%s devolve 400 sem consultar o apLIS', async (_caso, query) => {
    const res = await executar(['canViewBilling'], query);
    expect(res.statusCode).toBe(400);
    expect(listarSemLoteMock).not.toHaveBeenCalled();
  });

  it('apLIS indisponível devolve o status e a mensagem da consulta, não 500', async () => {
    prepararSupabase(['canViewBilling']);
    listarSemLoteMock.mockResolvedValue({ erro: { status: 503, mensagem: 'apLIS indisponível' } });
    const res = criarRes();
    await handler(
      { method: 'GET', headers: { authorization: 'Bearer token-teste' }, query: {} } as unknown as VercelRequest,
      res,
    );

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ success: false, error: 'apLIS indisponível' });
  });
});
