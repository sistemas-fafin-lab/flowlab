import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

vi.mock('../supabase.js', () => ({
  getSupabaseAdminClient: vi.fn(),
}));
vi.mock('../faturamento/bdLab.js', () => ({
  listarRequisicoesConversao: vi.fn(),
}));
vi.mock('../faturamento/fontesConsideradas.js', () => ({
  listarFontesConsideradasMeta: vi.fn(async () => [10, 20]),
}));

import { getSupabaseAdminClient } from '../supabase.js';
import { listarRequisicoesConversao } from '../faturamento/bdLab.js';
import handler from './faturamento-comparativos-conversao.js';

const getSupabaseAdminClientMock = getSupabaseAdminClient as ReturnType<typeof vi.fn>;
const listarConversaoMock = listarRequisicoesConversao as ReturnType<typeof vi.fn>;

type Linha = Record<string, unknown>;

interface MesConversao {
  mes: string;
  aptas: number;
  faturadas: number;
  semLote: number;
  percentual: number | null;
}

interface CorpoResposta {
  success: boolean;
  error?: string;
  mes?: string;
  periodos?: unknown[];
  totais?: MesConversao[];
  convenios?: { fontePagadoraId: number | null; nome: string | null; meses: MesConversao[] }[];
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

const base = {
  fontePagadoraId: 10,
  nome: 'BRADESCO',
  codEvento: null,
  temProcedimento: true,
  temRpsAtivo: false,
};
const LINHAS = [
  { ...base, idRequisicao: 1, mes: '2026-10', temLote: true, statusLote: 2 },
  { ...base, idRequisicao: 2, mes: '2026-10', temLote: false, statusLote: null },
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
  listarConversaoMock.mockResolvedValue({ linhas: LINHAS });
  const res = criarRes();
  const req = { method, headers: { authorization: 'Bearer token-teste' }, query } as unknown as VercelRequest;
  await handler(req, res);
  return res;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/faturamento/comparativos-conversao', () => {
  it('devolve o mês, os 3 períodos, os totais e a conversão por convênio, sem cache', async () => {
    const res = await executar(['canViewBilling']);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(res.body).toMatchObject({
      success: true,
      mes: '2026-10',
      periodos: [
        { mes: '2026-10', desde: '2026-10-01', ate: '2026-10-31' },
        { mes: '2026-09', desde: '2026-09-01', ate: '2026-09-30' },
        { mes: '2026-08', desde: '2026-08-01', ate: '2026-08-31' },
      ],
    });
    expect(res.body!.totais).toEqual([
      { mes: '2026-10', aptas: 2, faturadas: 1, semLote: 1, percentual: 50 },
      { mes: '2026-09', aptas: 0, faturadas: 0, semLote: 0, percentual: null },
      { mes: '2026-08', aptas: 0, faturadas: 0, semLote: 0, percentual: null },
    ]);
    expect(res.body!.convenios).toMatchObject([
      { fontePagadoraId: 10, nome: 'BRADESCO', meses: [{ aptas: 2, faturadas: 1, percentual: 50 }, {}, {}] },
    ]);
  });

  it('consulta uma única janela de M-2 à referência, com a whitelist da sub-aba "Sem lote"', async () => {
    await executar(['canViewBilling']);
    expect(listarConversaoMock).toHaveBeenCalledWith({
      periodoIni: '2026-08-01',
      periodoFim: '2026-10-31',
      fontesConsideradas: [10, 20],
    });
  });

  it.each([
    ['ausente', {}],
    ['fora do formato', { mes: '10/2026' }],
    ['mês 13', { mes: '2026-13' }],
  ])('mês %s devolve 400 sem consultar o apLIS', async (_caso, query) => {
    const res = await executar(['canViewBilling'], query);
    expect(res.statusCode).toBe(400);
    expect(listarConversaoMock).not.toHaveBeenCalled();
  });

  it('método diferente de GET devolve 405', async () => {
    const res = await executar(['canViewBilling'], { mes: '2026-10' }, 'POST');
    expect(res.statusCode).toBe(405);
    expect(listarConversaoMock).not.toHaveBeenCalled();
  });

  it('sem permissão de faturamento devolve 403 sem consultar o apLIS', async () => {
    const res = await executar([]);
    expect(res.statusCode).toBe(403);
    expect(listarConversaoMock).not.toHaveBeenCalled();
  });

  describe('permissão por tela (ADR 0001): a rota serve Contas a Receber', () => {
    it.each([['canViewBilling'], ['canManageBilling'], ['canViewContasReceber']])('%s basta', async (chave) => {
      const res = await executar([chave]);
      expect(res.statusCode).toBe(200);
    });

    it.each([['canViewFaturas'], ['canViewGlosas'], ['canViewIndicadores']])('só %s devolve 403', async (chave) => {
      const res = await executar([chave]);
      expect(res.statusCode).toBe(403);
      expect(listarConversaoMock).not.toHaveBeenCalled();
    });
  });

  it('apLIS indisponível devolve o status e a mensagem da consulta, não 500', async () => {
    prepararSupabase(['canViewBilling']);
    listarConversaoMock.mockResolvedValue({ erro: { status: 503, mensagem: 'apLIS indisponível' } });
    const res = criarRes();
    await handler(
      { method: 'GET', headers: { authorization: 'Bearer token-teste' }, query: { mes: '2026-10' } } as unknown as VercelRequest,
      res,
    );

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ success: false, error: 'apLIS indisponível' });
  });
});
