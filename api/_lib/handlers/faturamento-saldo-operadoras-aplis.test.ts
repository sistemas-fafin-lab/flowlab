import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

vi.mock('../supabase.js', () => ({
  getSupabaseAdminClient: vi.fn(),
  getSupabaseUserClient: vi.fn(),
}));
vi.mock('../faturamento/bdLab.js', () => ({
  saldosAplisDosLotes: vi.fn(),
}));

import { getSupabaseAdminClient, getSupabaseUserClient } from '../supabase.js';
import { saldosAplisDosLotes } from '../faturamento/bdLab.js';
import handler from './faturamento-saldo-operadoras-aplis.js';

const getSupabaseAdminClientMock = getSupabaseAdminClient as ReturnType<typeof vi.fn>;
const getSupabaseUserClientMock = getSupabaseUserClient as ReturnType<typeof vi.fn>;
const saldosAplisMock = saldosAplisDosLotes as ReturnType<typeof vi.fn>;

type Linha = Record<string, unknown>;

interface Corpo {
  success: boolean;
  error?: string;
  meta?: { dadoAte: string | null };
  operadoras?: {
    operadoraId: string;
    nome: string;
    saldoSistema: number;
    saldoAplis: number | null;
    diferenca: number | null;
    situacao: string;
  }[];
}

function consulta(linhas: Linha[], erro: string | undefined) {
  let resultado = [...linhas];
  const builder = {
    select: () => builder,
    eq: (coluna: string, valor: unknown) => {
      resultado = resultado.filter((l) => l[coluna] === valor);
      return builder;
    },
    neq: (coluna: string, valor: unknown) => {
      resultado = resultado.filter((l) => l[coluna] !== valor);
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
  usuario?: { id: string } | null;
  permissoes?: string[];
  notas?: Linha[];
  erroNotas?: string;
}

function mockarSupabase(c: Cenario = {}) {
  const usuario = c.usuario === undefined ? { id: 'user-1' } : c.usuario;
  const perfil = { id: 'user-1', custom_roles: { permissions: c.permissoes ?? ['canViewBilling'] } };
  getSupabaseAdminClientMock.mockReturnValue({
    auth: {
      getUser: vi.fn(async () => (usuario
        ? { data: { user: usuario }, error: null }
        : { data: { user: null }, error: { message: 'invalid' } })),
    },
    from: vi.fn((tabela: string) => {
      if (tabela !== 'user_profiles') throw new Error(`admin não deve ler ${tabela}`);
      return consulta([perfil], undefined);
    }),
  });
  getSupabaseUserClientMock.mockReturnValue({
    from: vi.fn((tabela: string) => {
      if (tabela !== 'notas') throw new Error(`tabela inesperada no mock: ${tabela}`);
      return consulta(c.notas ?? [], c.erroNotas);
    }),
  });
}

function nota(idNota: string, aplisId: string | null, extra: Linha = {}): Linha {
  return {
    id_nota: idNota,
    numero_nota: '9127',
    status: 'aberta',
    operadora_id: 'op-bradesco',
    data_emissao: '2026-10-05',
    valor_saldo: 900,
    operadoras: { nome: 'BRADESCO', is_considerada_meta: true },
    nota_lote: [{ lotes: { aplis_id: aplisId, codigo_lote: 'L-1' } }],
    ...extra,
  };
}

function criarReq(query: Record<string, string | string[]> = {}, semToken = false): VercelRequest {
  return {
    method: 'GET',
    headers: semToken ? {} : { authorization: 'Bearer token-teste' },
    query: { desde: '2026-10-01', ate: '2026-10-31', ...query },
  } as unknown as VercelRequest;
}

function criarRes() {
  const res = {
    statusCode: undefined as number | undefined,
    body: undefined as Corpo | undefined,
    headers: {} as Record<string, string>,
    setHeader(chave: string, valor: string) {
      this.headers[chave] = valor;
    },
    status(codigo: number) {
      this.statusCode = codigo;
      return this;
    },
    json(payload: unknown) {
      this.body = payload as Corpo;
      return this;
    },
  };
  return res as unknown as VercelResponse & typeof res;
}

async function executar(cenario: Cenario, query: Record<string, string | string[]> = {}) {
  mockarSupabase(cenario);
  saldosAplisMock.mockResolvedValue({ porLote: { 6329: { liquido: 1500, recebido: 400 } }, dadoAte: '2026-11-05' });
  const res = criarRes();
  await handler(criarReq(query), res);
  return res;
}

afterEach(() => vi.clearAllMocks());

describe('GET /api/faturamento/saldo-operadoras-aplis', () => {
  it('sem token devolve 401 sem consultar o apLIS', async () => {
    mockarSupabase();
    const res = criarRes();
    await handler(criarReq({}, true), res);
    expect(res.statusCode).toBe(401);
    expect(saldosAplisMock).not.toHaveBeenCalled();
  });

  it('sem permissão de faturamento devolve 403', async () => {
    const res = await executar({ permissoes: ['canViewRequests'] });
    expect(res.statusCode).toBe(403);
    expect(saldosAplisMock).not.toHaveBeenCalled();
  });

  it('método diferente de GET devolve 405', async () => {
    mockarSupabase();
    const res = criarRes();
    await handler({ ...criarReq(), method: 'POST' } as VercelRequest, res);
    expect(res.statusCode).toBe(405);
  });

  it.each([
    ['desde ausente', { desde: '' }],
    ['ate malformada', { ate: '31/10/2026' }],
    ['somentePeriodo inválido', { somentePeriodo: 'talvez' }],
  ])('parâmetro inválido (%s) devolve 400', async (_nome, query) => {
    const res = await executar({}, query);
    expect(res.statusCode).toBe(400);
    expect(res.body?.success).toBe(false);
    expect(saldosAplisMock).not.toHaveBeenCalled();
  });

  it('devolve saldo do sistema × apLIS por operadora, com meta.dadoAte e sem cache', async () => {
    const res = await executar({ notas: [nota('n1', '6329')] });
    expect(res.statusCode).toBe(200);
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(res.body?.meta?.dadoAte).toBe('2026-11-05');
    expect(res.body?.operadoras).toEqual([
      expect.objectContaining({
        operadoraId: 'op-bradesco',
        nome: 'BRADESCO',
        saldoSistema: 900,
        saldoAplis: 1100,
        diferenca: -200,
        situacao: 'sistema-menor',
      }),
    ]);
  });

  it('os filtros da tela recortam o universo: operadora e período', async () => {
    const notas = [
      nota('n1', '6329'),
      nota('n2', '6329', { operadora_id: 'op-pmdf', operadoras: { nome: 'PMDF', is_considerada_meta: true } }),
      nota('n3', '6329', { data_emissao: '2026-08-01' }),
    ];
    const total = await executar({ notas }, {});
    expect(total.body?.operadoras?.map((o) => o.nome).sort()).toEqual(['BRADESCO', 'PMDF']);
    expect(total.body?.operadoras?.find((o) => o.nome === 'BRADESCO')?.saldoSistema).toBe(1800);

    const periodo = await executar({ notas }, { somentePeriodo: 'true', operadoraId: ['op-bradesco'] });
    expect(periodo.body?.operadoras).toHaveLength(1);
    expect(periodo.body?.operadoras?.[0].saldoSistema).toBe(900);
  });

  it('só consulta o apLIS pelos lotes do universo filtrado', async () => {
    await executar({ notas: [nota('n1', '6329'), nota('n2', '7000', { operadora_id: 'op-pmdf' })] }, { operadoraId: 'op-bradesco' });
    expect(saldosAplisMock).toHaveBeenCalledWith([6329]);
  });

  it('apLIS fora do ar devolve a falha do apLIS (não 500) com a mensagem', async () => {
    mockarSupabase({ notas: [nota('n1', '6329')] });
    saldosAplisMock.mockResolvedValue({ erro: { status: 502, mensagem: 'réplica indisponível' } });
    const res = criarRes();
    await handler(criarReq(), res);
    expect(res.statusCode).toBe(502);
    expect(res.body?.success).toBe(false);
    expect(res.body?.error).toContain('apLIS');
  });

  it('falha de leitura no Supabase devolve 502', async () => {
    const res = await executar({ erroNotas: 'timeout' });
    expect(res.statusCode).toBe(502);
    expect(res.body?.success).toBe(false);
  });
});
