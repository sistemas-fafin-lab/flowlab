import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

vi.mock('../supabase.js', () => ({
  getSupabaseAdminClient: vi.fn(),
  getSupabaseUserClient: vi.fn(),
}));
vi.mock('../faturamento/bdLab.js', () => ({
  lotesNoStatus: vi.fn(),
  STLOT_LABELS: { 3: 'Faturado', 4: 'Recebido', 14: 'Aguardando Data para Envio' },
}));

import { getSupabaseAdminClient, getSupabaseUserClient } from '../supabase.js';
import { lotesNoStatus } from '../faturamento/bdLab.js';
import handler from './faturamento-titulos-lotes-status-aplis.js';

const getSupabaseAdminClientMock = getSupabaseAdminClient as ReturnType<typeof vi.fn>;
const getSupabaseUserClientMock = getSupabaseUserClient as ReturnType<typeof vi.fn>;
const lotesNoStatusMock = lotesNoStatus as ReturnType<typeof vi.fn>;

type Linha = Record<string, unknown>;

interface CorpoResposta {
  success: boolean;
  error?: string;
  meta: { dadoAte: string | null };
  idsLote: number[];
}

// Query builder mínimo do supabase-js: select/gte/lte/order/range encadeáveis e
// `await` direto. gte/lte guardam o recorte para o teste conferir.
function consulta(linhas: Linha[], erro: string | undefined, filtros: Record<string, unknown>) {
  let resultado = [...linhas];
  const builder = {
    select: () => builder,
    eq: () => builder,
    gte: (coluna: string, valor: unknown) => {
      filtros[`${coluna}>=`] = valor;
      return builder;
    },
    lte: (coluna: string, valor: unknown) => {
      filtros[`${coluna}<=`] = valor;
      return builder;
    },
    order: () => builder,
    range: (de: number, ate: number) => {
      resultado = resultado.slice(de, ate + 1);
      return builder;
    },
    single: async () => ({ data: resultado[0] ?? null, error: null }),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(erro
        ? { data: null, error: { message: erro } }
        : { data: resultado, error: null }).then(resolve, reject),
  };
  return builder;
}

interface Cenario {
  permissoes?: string[];
  notas?: Linha[];
  erroNotas?: string;
}

function mockarSupabase(cenario: Cenario = {}) {
  const perfil = { id: 'user-1', custom_roles: { permissions: cenario.permissoes ?? ['canViewBilling'] } };
  const filtros: Record<string, unknown> = {};
  getSupabaseAdminClientMock.mockReturnValue({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })) },
    from: vi.fn(() => consulta([perfil], undefined, {})),
  });
  getSupabaseUserClientMock.mockReturnValue({
    from: vi.fn((tabela: string) => {
      if (tabela !== 'notas') throw new Error(`tabela inesperada no mock: ${tabela}`);
      return consulta(cenario.notas ?? [], cenario.erroNotas, filtros);
    }),
  });
  return filtros;
}

function nota(aplisIds: (string | null)[]): Linha {
  return { id_nota: 'n', nota_lote: aplisIds.map((aplis) => ({ lotes: aplis === null ? null : { aplis_id: aplis } })) };
}

function criarReq(query: Record<string, string>): VercelRequest {
  return { method: 'GET', headers: { authorization: 'Bearer token-teste' }, query } as unknown as VercelRequest;
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

const QUERY_VALIDA = { status: '14', desde: '2026-10-01', ate: '2026-10-31' };

afterEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/faturamento/titulos-lotes-status-aplis', () => {
  it('pergunta ao apLIS só pelos lotes dos títulos do período e devolve os que estão no status', async () => {
    const filtros = mockarSupabase({ notas: [nota(['7047', '7049']), nota(['7047', null]), nota(['abc'])] });
    lotesNoStatusMock.mockResolvedValue({ idsLote: [7047], dadoAte: '2026-10-29' });
    const res = criarRes();
    await handler(criarReq(QUERY_VALIDA), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, meta: { dadoAte: '2026-10-29' }, idsLote: [7047] });
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(filtros).toEqual({ 'data_emissao>=': '2026-10-01', 'data_emissao<=': '2026-10-31' });
    expect(lotesNoStatusMock).toHaveBeenCalledWith([7047, 7049], 14);
    expect(getSupabaseUserClientMock).toHaveBeenCalledWith('token-teste');
  });

  it.each([
    ['status fora do catálogo', { ...QUERY_VALIDA, status: '99' }],
    ['status ausente', { desde: '2026-10-01', ate: '2026-10-31' }],
    ['data mal formatada', { ...QUERY_VALIDA, desde: '01/10/2026' }],
  ])('%s devolve 400 sem consultar nada', async (_caso, query) => {
    mockarSupabase();
    const res = criarRes();
    await handler(criarReq(query), res);
    expect(res.statusCode).toBe(400);
    expect(getSupabaseUserClientMock).not.toHaveBeenCalled();
    expect(lotesNoStatusMock).not.toHaveBeenCalled();
  });

  it('sem permissão de faturamento devolve 403', async () => {
    mockarSupabase({ permissoes: ['canViewRequests'] });
    const res = criarRes();
    await handler(criarReq(QUERY_VALIDA), res);
    expect(res.statusCode).toBe(403);
    expect(lotesNoStatusMock).not.toHaveBeenCalled();
  });

  it('falha ao ler os títulos devolve 502', async () => {
    mockarSupabase({ erroNotas: 'timeout' });
    const res = criarRes();
    await handler(criarReq(QUERY_VALIDA), res);
    expect(res.statusCode).toBe(502);
    expect(lotesNoStatusMock).not.toHaveBeenCalled();
  });

  it('falha no apLIS vira erro, nunca lista vazia', async () => {
    mockarSupabase({ notas: [nota(['7047'])] });
    lotesNoStatusMock.mockResolvedValue({ erro: { status: 503, mensagem: 'túnel fora do ar' } });
    const res = criarRes();
    await handler(criarReq(QUERY_VALIDA), res);
    expect(res.statusCode).toBe(503);
    expect(res.body?.success).toBe(false);
    expect(res.body?.error).toContain('túnel fora do ar');
  });
});
