import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

vi.mock('../supabase.js', () => ({
  getSupabaseAdminClient: vi.fn(),
  getSupabaseUserClient: vi.fn(),
}));
vi.mock('../faturamento/bdLab.js', () => ({
  glosasDasRequisicoes: vi.fn(),
}));

import { getSupabaseAdminClient, getSupabaseUserClient } from '../supabase.js';
import { glosasDasRequisicoes } from '../faturamento/bdLab.js';
import handler from './faturamento-comparativos-ranking-glosa.js';

const getSupabaseAdminClientMock = getSupabaseAdminClient as ReturnType<typeof vi.fn>;
const getSupabaseUserClientMock = getSupabaseUserClient as ReturnType<typeof vi.fn>;
const glosasDasRequisicoesMock = glosasDasRequisicoes as ReturnType<typeof vi.fn>;

type Linha = Record<string, unknown>;

interface LinhaRanking { codigo: string | null; descricao: string | null; valor: number; quantidade: number; percentual: number }
interface Corpo {
  success: boolean;
  error?: string;
  mes?: string;
  meses?: {
    mes: string;
    ranking: { total: { total: number; linhas: LinhaRanking[] }; acatada: { total: number; linhas: LinhaRanking[] } };
    requisicoes: Record<string, unknown>[];
  }[];
}

// Query builder mínimo do supabase-js: encadeável e aguardável. Só o `.in()` filtra (é ele que
// separa as leituras por lote e por competência); os outros filtros são ignorados, e a página
// única (< 1000) encerra a paginação.
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
      id_requisicao: 1, cod_requisicao: 'R-001', num_guia: 'G-1', fonte_pagadora_nome: 'CASSI', paciente: 'MARIA DA SILVA', id_lote_faturamento: 555, competencia: '2026-10', status_aplis: 17, liquido: '300', recebido: '300',
      glosa_fixada: '300', recebido_fixacao: '0', valor_recursado: '300', valor_recursado_editado: null,
      valor_recebido_glosa_editado: null, id_lote_recurso: 9,
      glosa_recurso_lotes: { data_envio_aplis: '2026-10-10', data_envio_editada: null },
    },
    // Recebido a menor – acatado (18): acatada de 150 no mesmo lote.
    {
      id_requisicao: 2, cod_requisicao: 'R-002', num_guia: 'G-2', fonte_pagadora_nome: 'CASSI', paciente: 'JOÃO SOUZA', id_lote_faturamento: 555, competencia: '2026-10', status_aplis: 18, liquido: '500', recebido: '350',
      glosa_fixada: '150', recebido_fixacao: '350', valor_recursado: null, valor_recursado_editado: null,
      valor_recebido_glosa_editado: null, id_lote_recurso: null, glosa_recurso_lotes: null,
    },
    // Glosado sem recurso (6) em lote que não tem título aqui: em disputa, "Fora de lote".
    {
      id_requisicao: 3, cod_requisicao: 'R-003', num_guia: null, fonte_pagadora_nome: 'GEAP', paciente: 'ANA LIMA', id_lote_faturamento: 777, competencia: '2026-10', status_aplis: 6, liquido: '90', recebido: '40',
      glosa_fixada: '50', recebido_fixacao: '40', valor_recursado: null, valor_recursado_editado: null,
      valor_recebido_glosa_editado: null, id_lote_recurso: null, glosa_recurso_lotes: null, id_fonte_pagadora: 7,
    },
    // Operadora fora da meta: não entra, nem como "Fora de lote".
    {
      id_requisicao: 4, id_lote_faturamento: 778, competencia: '2026-10', status_aplis: 6, liquido: '900', recebido: '0',
      glosa_fixada: '900', recebido_fixacao: '0', valor_recursado: null, valor_recursado_editado: null,
      valor_recebido_glosa_editado: null, id_lote_recurso: null, glosa_recurso_lotes: null, id_fonte_pagadora: 99,
    },
    // Lote 888 tem título, emitido em junho (fora dos 3 meses): não é "Fora de lote" e não entra.
    {
      id_requisicao: 5, id_lote_faturamento: 888, competencia: '2026-10', status_aplis: 6, liquido: '70', recebido: '0',
      glosa_fixada: '70', recebido_fixacao: '0', valor_recursado: null, valor_recursado_editado: null,
      valor_recebido_glosa_editado: null, id_lote_recurso: null, glosa_recurso_lotes: null, id_fonte_pagadora: 7,
    },
  ],
  lotes: [
    { ...LOTE, nota_lote: [{ notas: { data_emissao: '2026-10-05', status: 'emitida' } }] },
    {
      id_lote: 'lote-2', codigo_lote: '1002', aplis_id: '888',
      nota_lote: [
        { notas: { data_emissao: '2026-06-01', status: 'emitida' } },
        { notas: { data_emissao: '2026-01-01', status: 'cancelada' } },
      ],
    },
  ],
  operadoras: [{ aplis_id: '7' }],
};

const proc = (idProcedimento: string, codigo: string | null, valor: number) => ({
  procedimento: idProcedimento, procedimentoDescricao: 'HEMOGRAMA', codigo, descricao: codigo ? `Motivo ${codigo}` : null,
  valor, data: '2026-10-20',
});

async function executar(
  permissoes: string[],
  query: Record<string, string> = { mes: '2026-10' },
  method = 'GET',
  falhaEm?: string,
) {
  prepararSupabase(permissoes, CENARIO, falhaEm);
  glosasDasRequisicoesMock.mockResolvedValue({
    porRequisicao: new Map([
      [1, [proc('40301630', '3096', 300)]],
      [2, [proc('40301630', '1705', 150)]],
      // A requisição 3 não tem código no apLIS: "Sem código".
    ]),
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

describe('GET /api/faturamento/comparativos-ranking-glosa', () => {
  it('ranking Acatada e Total batem com o funil do mês (acatada 150; total 300 + 150 + 50)', async () => {
    const res = await executar(['canViewBilling']);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(res.body?.meses?.map((m) => m.mes)).toEqual(['2026-10', '2026-09', '2026-08']);

    const outubro = res.body!.meses![0];
    expect(outubro.ranking.acatada).toEqual({
      total: 150,
      linhas: [{ codigo: '1705', descricao: 'Motivo 1705', valor: 150, quantidade: 1, percentual: 100 }],
    });
    expect(outubro.ranking.total.total).toBe(500);
    expect(outubro.ranking.total.linhas.map((l) => [l.codigo, l.valor])).toEqual([['3096', 300], ['1705', 150], [null, 50]]);
    // Só as requisições dos 3 meses vão ao apLIS.
    expect(glosasDasRequisicoesMock).toHaveBeenCalledWith([1, 2, 3]);
  });

  it('a tabela de requisições traz as colunas pedidas e nenhum nome de paciente', async () => {
    const res = await executar(['canViewBilling']);
    const linhas = res.body!.meses![0].requisicoes;

    expect(linhas.find((l) => l.idRequisicao === 2)).toMatchObject({
      codigo: '1705', codRequisicao: 'R-002', numGuia: 'G-2', lote: '1001', convenio: 'CASSI',
      procedimento: '40301630 – HEMOGRAMA', valor: 150, status: 'Recebido a menor – acatado', classe: 'acatada',
      data: '2026-10-20',
    });
    expect(linhas.find((l) => l.idRequisicao === 3)).toMatchObject({ codigo: null, lote: '777 · Fora de lote' });
    const json = JSON.stringify(res.body);
    expect(json).not.toMatch(/paciente/i);
    expect(json).not.toContain('MARIA DA SILVA');
  });

  it('sem permissão devolve 403 e não lê dados', async () => {
    const res = await executar(['canViewEstoque']);
    expect(res.statusCode).toBe(403);
    expect(getSupabaseUserClientMock).not.toHaveBeenCalled();
    expect(glosasDasRequisicoesMock).not.toHaveBeenCalled();
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
    glosasDasRequisicoesMock.mockResolvedValue({ erro: { status: 503, mensagem: 'apLIS indisponível' } });
    const res = { statusCode: 0, body: undefined as Corpo | undefined, setHeader() {}, status(c: number) { this.statusCode = c; return this; }, json(p: unknown) { this.body = p as Corpo; return this; } };
    await handler({ method: 'GET', headers: { authorization: 'Bearer t' }, query: { mes: '2026-10' } } as unknown as VercelRequest, res as unknown as VercelResponse);
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ success: false, error: 'apLIS indisponível' });
  });

  it('falha de leitura no Supabase devolve 502', async () => {
    const res = await executar(['canViewBilling'], { mes: '2026-10' }, 'GET', 'glosa_recurso_requisicoes');
    expect(res.statusCode).toBe(502);
    expect(res.body?.success).toBe(false);
  });
});
