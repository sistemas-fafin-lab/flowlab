import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

vi.mock('../supabase.js', () => ({
  getSupabaseAdminClient: vi.fn(),
  getSupabaseUserClient: vi.fn(),
}));

import { getSupabaseAdminClient, getSupabaseUserClient } from '../supabase.js';
import handler from './faturamento-dashboard-glosa-saldo.js';

const getSupabaseAdminClientMock = getSupabaseAdminClient as ReturnType<typeof vi.fn>;
const getSupabaseUserClientMock = getSupabaseUserClient as ReturnType<typeof vi.fn>;

type Linha = Record<string, unknown>;

interface Corpo {
  success: boolean;
  error?: string;
  cards?: {
    faturado: number;
    recebido: number;
    acatado: number;
    saldoPendente: number;
    recuperada: number;
    glosaTotal: number;
  };
}

// Query builder mínimo do supabase-js (o mesmo do teste do funil): só o `.in()` filtra.
function consulta(linhasDaTabela: Linha[], erro: string | null = null) {
  let linhas = linhasDaTabela;
  const builder: Record<string, unknown> = {};
  for (const metodo of ['select', 'eq', 'neq', 'gte', 'lte', 'order', 'range']) builder[metodo] = () => builder;
  builder.in = (coluna: string, valores: unknown[]) => {
    const aceitos = new Set(valores.map(String));
    linhas = linhas.filter((l) => aceitos.has(String(l[coluna])));
    return builder;
  };
  builder.single = async () => ({ data: linhas[0] ?? null, error: null });
  builder.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(erro ? { data: null, error: { message: erro } } : { data: linhas, error: null }).then(resolve, reject);
  return builder;
}

function prepararSupabase(permissoes: string[], tabelas: Record<string, Linha[]>, falhaEm?: string) {
  getSupabaseAdminClientMock.mockReturnValue({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })) },
    from: vi.fn(() => consulta([{ id: 'user-1', custom_roles: { permissions: permissoes } }])),
  });
  getSupabaseUserClientMock.mockReturnValue({
    from: vi.fn((tabela: string) => consulta(tabelas[tabela] ?? [], tabela === falhaEm ? 'boom' : null)),
  });
}

const LOTE_A = { id_lote: 'lote-a', codigo_lote: '1001', aplis_id: '555' };
const LOTE_B = { id_lote: 'lote-b', codigo_lote: '2001', aplis_id: '666' };

const requisicao = (parcial: Linha): Linha => ({
  competencia: '2026-10', recebido_fixacao: '0', valor_recursado: null, valor_recursado_editado: null,
  valor_recebido_glosa_editado: null, id_lote_recurso: null, glosa_recurso_lotes: null, ...parcial,
});

const CENARIO: Record<string, Linha[]> = {
  notas: [
    {
      id_nota: 'n-a', operadora_id: 'op-a', data_emissao: '2026-10-05', valor_total: '1000.00', valor_recebido: '400.00',
      valor_glosa_acatada: '150.00', operadoras: { is_considerada_meta: true }, nota_lote: [{ lotes: LOTE_A }],
    },
    {
      id_nota: 'n-b', operadora_id: 'op-b', data_emissao: '2026-10-08', valor_total: '500.00', valor_recebido: '100.00',
      valor_glosa_acatada: '0', operadoras: { is_considerada_meta: true }, nota_lote: [{ lotes: LOTE_B }],
    },
  ],
  glosa_recurso_requisicoes: [
    // Recurso pago (17) no lote da operadora A: recuperada de 300.
    requisicao({
      id_requisicao: 1, id_lote_faturamento: 555, status_aplis: 17, liquido: '300', recebido: '300', glosa_fixada: '300',
      valor_recursado: '300', id_lote_recurso: 9, glosa_recurso_lotes: { data_envio_aplis: '2026-10-10', data_envio_editada: null },
      id_fonte_pagadora: 7,
    }),
    // Acatada (18) no mesmo lote: entra só na glosa total.
    requisicao({
      id_requisicao: 2, id_lote_faturamento: 555, status_aplis: 18, liquido: '500', recebido: '350', glosa_fixada: '150',
      recebido_fixacao: '350', id_fonte_pagadora: 7,
    }),
    // Glosa recebida (34) no lote da operadora B: recuperada de 80.
    requisicao({
      id_requisicao: 3, id_lote_faturamento: 666, status_aplis: 34, liquido: '80', recebido: '80', glosa_fixada: '80',
      id_fonte_pagadora: 8,
    }),
  ],
  lotes: [
    { ...LOTE_A, nota_lote: [{ notas: { data_emissao: '2026-10-05', status: 'emitida' } }] },
    { ...LOTE_B, nota_lote: [{ notas: { data_emissao: '2026-10-08', status: 'emitida' } }] },
  ],
  operadoras: [
    { id_operadora: 'op-a', aplis_id: '7' },
    { id_operadora: 'op-b', aplis_id: '8' },
  ],
};

async function executar(
  permissoes: string[],
  query: Record<string, string | string[]> = { desde: '2026-10-01', ate: '2026-10-31' },
  method = 'GET',
  falhaEm?: string,
) {
  prepararSupabase(permissoes, CENARIO, falhaEm);
  const res = {
    statusCode: undefined as number | undefined,
    body: undefined as Corpo | undefined,
    headers: {} as Record<string, string>,
    setHeader(chave: string, valor: string) { this.headers[chave] = valor; },
    status(codigo: number) { this.statusCode = codigo; return this; },
    json(payload: unknown) { this.body = payload as Corpo; return this; },
  };
  const req = { method, headers: { authorization: 'Bearer token-teste' }, query } as unknown as VercelRequest;
  await handler(req, res as unknown as VercelResponse);
  return res;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/faturamento/dashboard-glosa-saldo', () => {
  it('devolve Recuperada e Saldo pendente do período, de todas as operadoras da meta', async () => {
    const res = await executar(['canViewBilling']);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(res.body?.cards).toEqual({
      faturado: 1500,
      recebido: 500,
      acatado: 150,
      saldoPendente: 850,
      recuperada: 380,
      glosaTotal: 530,
    });
  });

  it('filtra pela operadora', async () => {
    const res = await executar(['canViewBilling'], { desde: '2026-10-01', ate: '2026-10-31', operadoraId: 'op-a' });

    expect(res.statusCode).toBe(200);
    expect(res.body?.cards).toMatchObject({ faturado: 1000, saldoPendente: 450, recuperada: 300, glosaTotal: 450 });
  });

  it('sem permissão devolve 403 e não lê dados', async () => {
    const res = await executar(['canViewEstoque']);
    expect(res.statusCode).toBe(403);
    expect(getSupabaseUserClientMock).not.toHaveBeenCalled();
  });

  it.each([
    ['sem desde', { ate: '2026-10-31' }],
    ['ate fora do formato', { desde: '2026-10-01', ate: '31/10/2026' }],
    ['período invertido', { desde: '2026-11-01', ate: '2026-10-01' }],
  ])('%s devolve 400 sem ler dados', async (_caso, query) => {
    const res = await executar(['canViewBilling'], query);
    expect(res.statusCode).toBe(400);
    expect(getSupabaseUserClientMock).not.toHaveBeenCalled();
  });

  it('método diferente de GET devolve 405', async () => {
    const res = await executar(['canViewBilling'], { desde: '2026-10-01', ate: '2026-10-31' }, 'POST');
    expect(res.statusCode).toBe(405);
  });

  it('falha de leitura no Supabase devolve 502', async () => {
    const res = await executar(['canViewBilling'], { desde: '2026-10-01', ate: '2026-10-31' }, 'GET', 'glosa_recurso_requisicoes');
    expect(res.statusCode).toBe(502);
    expect(res.body?.success).toBe(false);
  });
});
