import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

vi.mock('../supabase.js', () => ({
  getSupabaseAdminClient: vi.fn(),
}));
vi.mock('../faturamento/bdLab.js', () => ({
  listarGlosaPorMesSolicitacao: vi.fn(),
}));

import { getSupabaseAdminClient } from '../supabase.js';
import { listarGlosaPorMesSolicitacao } from '../faturamento/bdLab.js';
import handler from './faturamento-comparativos-glosa-por-mes.js';

const getSupabaseAdminClientMock = getSupabaseAdminClient as ReturnType<typeof vi.fn>;
const listarGlosaMock = listarGlosaPorMesSolicitacao as ReturnType<typeof vi.fn>;

type Linha = Record<string, unknown>;

interface CorpoResposta {
  success: boolean;
  error?: string;
  mes?: string;
  meses?: unknown[];
  total?: unknown;
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

// Valores da planilha da DRE (jan–mar/2026).
const LINHAS = [
  { mes: '2026-01', valor: 25281.54, qtdCobrancas: 1733 },
  { mes: '2026-03', valor: 44088.59, qtdCobrancas: 980 },
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

async function executar(permissoes: string[], query: Record<string, string> = { mes: '2026-03' }, method = 'GET') {
  prepararSupabase(permissoes);
  listarGlosaMock.mockResolvedValue({ linhas: LINHAS });
  const res = criarRes();
  const req = { method, headers: { authorization: 'Bearer token-teste' }, query } as unknown as VercelRequest;
  await handler(req, res);
  return res;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/faturamento/comparativos-glosa-por-mes', () => {
  it('devolve a glosa de janeiro até o mês de referência e o total, sem cache', async () => {
    const res = await executar(['canViewBilling']);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(res.body).toEqual({
      success: true,
      mes: '2026-03',
      meses: [
        { mes: '2026-01', valor: 25281.54, qtdCobrancas: 1733 },
        { mes: '2026-02', valor: 0, qtdCobrancas: 0 },
        { mes: '2026-03', valor: 44088.59, qtdCobrancas: 980 },
      ],
      total: { valor: 69370.13, qtdCobrancas: 2713 },
    });
  });

  it('consulta do primeiro dia do ano ao último dia do mês de referência', async () => {
    await executar(['canViewBilling'], { mes: '2026-09' });
    expect(listarGlosaMock).toHaveBeenCalledWith('2026-01-01', '2026-09-30');
  });

  it.each([
    ['ausente', {}],
    ['fora do formato', { mes: '09/2026' }],
    ['mês 13', { mes: '2026-13' }],
  ])('mês %s devolve 400 sem consultar o apLIS', async (_caso, query) => {
    const res = await executar(['canViewBilling'], query);
    expect(res.statusCode).toBe(400);
    expect(listarGlosaMock).not.toHaveBeenCalled();
  });

  it('método diferente de GET devolve 405', async () => {
    const res = await executar(['canViewBilling'], { mes: '2026-03' }, 'POST');
    expect(res.statusCode).toBe(405);
    expect(listarGlosaMock).not.toHaveBeenCalled();
  });

  describe('permissão por tela (ADR 0001): a rota serve Contas a Receber', () => {
    it.each([['canViewBilling'], ['canManageBilling'], ['canViewContasReceber']])('%s basta', async (chave) => {
      const res = await executar([chave]);
      expect(res.statusCode).toBe(200);
    });

    it.each([[[] as string[]], [['canViewGlosas']], [['canViewIndicadores']]])(
      'permissões %j devolvem 403 sem consultar o apLIS',
      async (permissoes) => {
        const res = await executar(permissoes);
        expect(res.statusCode).toBe(403);
        expect(listarGlosaMock).not.toHaveBeenCalled();
      },
    );
  });

  it('banco do laboratório indisponível devolve o status e a mensagem da consulta, não 500', async () => {
    prepararSupabase(['canViewBilling']);
    listarGlosaMock.mockResolvedValue({ erro: { status: 502, mensagem: 'banco indisponível' } });
    const res = criarRes();
    await handler(
      { method: 'GET', headers: { authorization: 'Bearer token-teste' }, query: { mes: '2026-03' } } as unknown as VercelRequest,
      res,
    );

    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({ success: false, error: 'banco indisponível' });
  });
});
