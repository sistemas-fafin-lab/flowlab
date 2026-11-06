import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

vi.mock('../supabase.js', () => ({
  getSupabaseAdminClient: vi.fn(),
  getSupabaseUserClient: vi.fn(),
}));
vi.mock('../faturamento/bdLab.js', () => ({
  listarRecebidosMes: vi.fn(),
}));

import { getSupabaseAdminClient, getSupabaseUserClient } from '../supabase.js';
import { listarRecebidosMes } from '../faturamento/bdLab.js';
import handler from './faturamento-comparativos-funil-glosa.js';

const getSupabaseAdminClientMock = getSupabaseAdminClient as ReturnType<typeof vi.fn>;
const getSupabaseUserClientMock = getSupabaseUserClient as ReturnType<typeof vi.fn>;
const recebidosMesMock = listarRecebidosMes as ReturnType<typeof vi.fn>;

type Linha = Record<string, unknown>;

interface Corpo {
  success: boolean;
  error?: string;
  mes?: string;
  periodos?: unknown[];
  funil?: {
    mes: string;
    faturado: number;
    recebido: number;
    recuperada: number;
    acatada: number;
    emDisputa: number;
    glosaTotal: number;
    saldo: number;
    lotes: { codigo: string; glosaTotal: number; saldo: number }[];
  }[];
  recebidoNoMes?: { mes: string; valor: number }[];
}

// Query builder mínimo do supabase-js: encadeável e aguardável. Os filtros são ignorados:
// cada tabela devolve as linhas do cenário, e a página única (< 1000) encerra a paginação.
function consulta(linhas: Linha[], erro: string | null = null) {
  const builder: Record<string, unknown> = {};
  for (const metodo of ['select', 'eq', 'neq', 'gte', 'lte', 'in', 'order', 'range']) builder[metodo] = () => builder;
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

const LOTE = { id_lote: 'lote-1', codigo_lote: '1001', aplis_id: '555' };

const CENARIO: Record<string, Linha[]> = {
  notas: [
    {
      id_nota: 'n1', data_emissao: '2026-10-05', valor_total: '1000.00', valor_recebido: '400.00',
      operadoras: { is_considerada_meta: true }, nota_lote: [{ lotes: LOTE }],
    },
    {
      id_nota: 'n-fora-da-meta', data_emissao: '2026-10-06', valor_total: '9999.00', valor_recebido: '0',
      operadoras: { is_considerada_meta: false }, nota_lote: [],
    },
  ],
  glosa_recurso_requisicoes: [
    // Recurso pago (17): recuperada de 300, no lote 555 (título n1).
    {
      id_requisicao: 1, id_lote_faturamento: 555, competencia: '2026-10', status_aplis: 17, liquido: '300', recebido: '300',
      glosa_fixada: '300', recebido_fixacao: '0', valor_recursado: '300', valor_recursado_editado: null,
      valor_recebido_glosa_editado: null, id_lote_recurso: 9,
      glosa_recurso_lotes: { data_envio_aplis: '2026-10-10', data_envio_editada: null },
    },
    // Recebido a menor – acatado (18): acatada de 150 no mesmo lote.
    {
      id_requisicao: 2, id_lote_faturamento: 555, competencia: '2026-10', status_aplis: 18, liquido: '500', recebido: '350',
      glosa_fixada: '150', recebido_fixacao: '350', valor_recursado: null, valor_recursado_editado: null,
      valor_recebido_glosa_editado: null, id_lote_recurso: null, glosa_recurso_lotes: null,
    },
    // Glosado sem recurso (6) em lote que não tem título aqui: em disputa, "Fora de lote".
    {
      id_requisicao: 3, id_lote_faturamento: 777, competencia: '2026-10', status_aplis: 6, liquido: '90', recebido: '40',
      glosa_fixada: '50', recebido_fixacao: '40', valor_recursado: null, valor_recursado_editado: null,
      valor_recebido_glosa_editado: null, id_lote_recurso: null, glosa_recurso_lotes: null,
    },
  ],
  operadoras: [{ aplis_id: '7' }],
};

async function executar(
  permissoes: string[],
  query: Record<string, string> = { mes: '2026-10' },
  method = 'GET',
  tabelas: Record<string, Linha[]> = CENARIO,
  falhaEm?: string,
) {
  prepararSupabase(permissoes, tabelas, falhaEm);
  recebidosMesMock.mockResolvedValue({
    lotes: [
      { fontePagadoraId: 7, idLote: 555, valorRecebido: 123.45 },
      { fontePagadoraId: 99, idLote: 1, valorRecebido: 1000 }, // fora da meta
    ],
  });
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

describe('GET /api/faturamento/comparativos-funil-glosa', () => {
  it('devolve o funil dos 3 períodos, com acatada, disputa, recuperada, fora de lote e o caixa do mês', async () => {
    const res = await executar(['canViewBilling']);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(res.body?.mes).toBe('2026-10');
    expect(res.body?.funil?.map((f) => f.mes)).toEqual(['2026-10', '2026-09', '2026-08']);

    const outubro = res.body!.funil![0];
    expect(outubro).toMatchObject({
      faturado: 1000,
      recebido: 400,
      recuperada: 300,
      acatada: 150,
      emDisputa: 50,
      glosaTotal: 500,
      saldo: 400,
    });
    expect(outubro.recebido + outubro.acatada + outubro.emDisputa + outubro.saldo).toBe(outubro.faturado);
    expect(outubro.lotes.map((l) => l.codigo)).toEqual(['1001', 'Fora de lote']);

    expect(res.body?.recebidoNoMes?.[0]).toEqual({ mes: '2026-10', valor: 123.45 });
  });

  it('sem permissão devolve 403 e não lê dados', async () => {
    const res = await executar(['canViewEstoque']);
    expect(res.statusCode).toBe(403);
    expect(getSupabaseUserClientMock).not.toHaveBeenCalled();
    expect(recebidosMesMock).not.toHaveBeenCalled();
  });

  it('aceita a chave da tela Contas a Receber', async () => {
    const res = await executar(['canViewContasReceber']);
    expect(res.statusCode).toBe(200);
  });

  it.each([
    ['ausente', {}],
    ['fora do formato', { mes: '10/2026' }],
    ['mês 13', { mes: '2026-13' }],
  ])('mês %s devolve 400 sem ler dados', async (_caso, query) => {
    const res = await executar(['canViewBilling'], query);
    expect(res.statusCode).toBe(400);
    expect(getSupabaseUserClientMock).not.toHaveBeenCalled();
  });

  it('método diferente de GET devolve 405', async () => {
    const res = await executar(['canViewBilling'], { mes: '2026-10' }, 'POST');
    expect(res.statusCode).toBe(405);
  });

  it('apLIS fora do ar devolve o status do erro com mensagem, não 500', async () => {
    prepararSupabase(['canViewBilling'], CENARIO);
    recebidosMesMock.mockResolvedValue({ erro: { status: 503, mensagem: 'apLIS indisponível' } });
    const res = { statusCode: 0, body: undefined as Corpo | undefined, setHeader() {}, status(c: number) { this.statusCode = c; return this; }, json(p: unknown) { this.body = p as Corpo; return this; } };
    await handler({ method: 'GET', headers: { authorization: 'Bearer t' }, query: { mes: '2026-10' } } as unknown as VercelRequest, res as unknown as VercelResponse);
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ success: false, error: 'apLIS indisponível' });
  });

  it('falha de leitura no Supabase devolve 502', async () => {
    const res = await executar(['canViewBilling'], { mes: '2026-10' }, 'GET', CENARIO, 'glosa_recurso_requisicoes');
    expect(res.statusCode).toBe(502);
    expect(res.body?.success).toBe(false);
  });
});
