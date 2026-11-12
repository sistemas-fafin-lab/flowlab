import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

vi.mock('../supabase.js', () => ({
  getSupabaseAdminClient: vi.fn(),
}));
vi.mock('../faturamento/bdLab.js', () => ({
  listarVolumeEnvioMensal: vi.fn(),
  STATUS_ENVIADOS_PADRAO: [2, 3],
}));

import { getSupabaseAdminClient } from '../supabase.js';
import { listarVolumeEnvioMensal } from '../faturamento/bdLab.js';
import handler from './faturamento-comparativos-volume-envio.js';

const getSupabaseAdminClientMock = getSupabaseAdminClient as ReturnType<typeof vi.fn>;
const listarVolumeMock = listarVolumeEnvioMensal as ReturnType<typeof vi.fn>;

type Linha = Record<string, unknown>;

interface CorpoResposta {
  success: boolean;
  error?: string;
  meta?: Record<string, unknown>;
  mes?: string;
  periodos?: unknown[];
  volume?: unknown[];
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

const LINHAS = [
  { mes: '2026-10', fontePagadoraId: 1, nome: 'BRADESCO', qtdLotes: 4, qtdGuias: 120, valor: 18450.9 },
  { mes: '2026-09', fontePagadoraId: 1, nome: 'BRADESCO', qtdLotes: 3, qtdGuias: 90, valor: 12000 },
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
  listarVolumeMock.mockResolvedValue({ linhas: LINHAS });
  const res = criarRes();
  const req = { method, headers: { authorization: 'Bearer token-teste' }, query } as unknown as VercelRequest;
  await handler(req, res);
  return res;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/faturamento/comparativos-volume-envio', () => {
  it('devolve o mês, os 3 períodos e o volume (lotes, guias e valor) por convênio, sem cache', async () => {
    const res = await executar(['canViewBilling']);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(res.body).toEqual({
      success: true,
      mes: '2026-10',
      periodos: [
        { mes: '2026-10', desde: '2026-10-01', ate: '2026-10-31' },
        { mes: '2026-09', desde: '2026-09-01', ate: '2026-09-30' },
        { mes: '2026-08', desde: '2026-08-01', ate: '2026-08-31' },
      ],
      volume: [
        {
          fontePagadoraId: 1,
          nome: 'BRADESCO',
          meses: [
            { mes: '2026-10', qtdLotes: 4, qtdGuias: 120, valor: 18450.9 },
            { mes: '2026-09', qtdLotes: 3, qtdGuias: 90, valor: 12000 },
            { mes: '2026-08', qtdLotes: 0, qtdGuias: 0, valor: 0 },
          ],
        },
      ],
    });
  });

  it('consulta uma única janela do primeiro dia de M-2 ao último da referência', async () => {
    await executar(['canViewBilling']);
    expect(listarVolumeMock).toHaveBeenCalledWith(
      expect.objectContaining({ periodoIni: '2026-08-01', periodoFim: '2026-10-31' }),
    );
  });

  it('virada de ano: janeiro de 2026 consulta desde novembro de 2025', async () => {
    await executar(['canViewBilling'], { mes: '2026-01' });
    expect(listarVolumeMock).toHaveBeenCalledWith(
      expect.objectContaining({ periodoIni: '2025-11-01', periodoFim: '2026-01-31' }),
    );
  });

  it.each([
    ['ausente', {}],
    ['fora do formato', { mes: '10/2026' }],
    ['mês 13', { mes: '2026-13' }],
  ])('mês %s devolve 400 sem consultar o apLIS', async (_caso, query) => {
    const res = await executar(['canViewBilling'], query);
    expect(res.statusCode).toBe(400);
    expect(listarVolumeMock).not.toHaveBeenCalled();
  });

  it('método diferente de GET devolve 405', async () => {
    const res = await executar(['canViewBilling'], { mes: '2026-10' }, 'POST');
    expect(res.statusCode).toBe(405);
    expect(listarVolumeMock).not.toHaveBeenCalled();
  });

  it('sem permissão de faturamento devolve 403 sem consultar o apLIS', async () => {
    const res = await executar([]);
    expect(res.statusCode).toBe(403);
    expect(listarVolumeMock).not.toHaveBeenCalled();
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
        expect(listarVolumeMock).not.toHaveBeenCalled();
      },
    );
  });

  it('apLIS indisponível devolve o status e a mensagem da consulta, não 500', async () => {
    prepararSupabase(['canViewBilling']);
    listarVolumeMock.mockResolvedValue({ erro: { status: 503, mensagem: 'apLIS indisponível' } });
    const res = criarRes();
    await handler(
      { method: 'GET', headers: { authorization: 'Bearer token-teste' }, query: { mes: '2026-10' } } as unknown as VercelRequest,
      res,
    );

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ success: false, error: 'apLIS indisponível' });
  });
});
