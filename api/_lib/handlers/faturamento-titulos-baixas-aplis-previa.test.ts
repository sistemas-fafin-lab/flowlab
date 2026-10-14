import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

vi.mock('../supabase.js', () => ({
  getSupabaseAdminClient: vi.fn(),
  getSupabaseUserClient: vi.fn(),
}));
vi.mock('../faturamento/bdLab.js', () => ({
  recebidosDosLotes: vi.fn(),
  recebidosPorDataDosLotes: vi.fn(),
}));

import { getSupabaseAdminClient, getSupabaseUserClient } from '../supabase.js';
import { recebidosDosLotes, recebidosPorDataDosLotes } from '../faturamento/bdLab.js';
import type { RecebidoLoteAplis, RecebidoLoteNaData } from '../faturamento/bdLab.js';
import handler from './faturamento-titulos-baixas-aplis-previa.js';

const getSupabaseAdminClientMock = getSupabaseAdminClient as ReturnType<typeof vi.fn>;
const getSupabaseUserClientMock = getSupabaseUserClient as ReturnType<typeof vi.fn>;
const recebidosDosLotesMock = recebidosDosLotes as ReturnType<typeof vi.fn>;
const recebidosPorDataDosLotesMock = recebidosPorDataDosLotes as ReturnType<typeof vi.fn>;

type Linha = Record<string, unknown>;

interface CorpoResposta {
  success: boolean;
  error?: string;
  meta: { dadoAte: string | null };
  titulos: (Record<string, unknown> & {
    idNota: string;
    tipo: string;
    pulado: string | null;
    baixas: { data: string; valor: number; observacoes: string }[];
  })[];
}

// Query builder mínimo do supabase-js: select/eq/in/neq/order/range encadeáveis,
// single() e `await` direto.
function consulta(linhas: Linha[], erro: string | undefined) {
  let resultado = [...linhas];
  const builder = {
    select: () => builder,
    eq: (coluna: string, valor: unknown) => {
      resultado = resultado.filter((l) => l[coluna] === valor);
      return builder;
    },
    in: (coluna: string, valores: unknown[]) => {
      resultado = resultado.filter((l) => valores.includes(l[coluna]));
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
  recebimentos?: Linha[];
  erroRecebimentos?: string;
}

function mockarSupabase(cenario: Cenario = {}) {
  const usuario = cenario.usuario === undefined ? { id: 'user-1' } : cenario.usuario;
  const perfil = { id: 'user-1', role: 'user', custom_roles: { permissions: cenario.permissoes ?? ['canManageBilling'] } };
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
      if (tabela === 'notas') return consulta(cenario.notas ?? [], cenario.erroNotas);
      if (tabela === 'recebimentos') return consulta(cenario.recebimentos ?? [], cenario.erroRecebimentos);
      throw new Error(`tabela inesperada no mock: ${tabela}`);
    }),
  });
}

// Título no formato do select aninhado: notas → operadoras, nota_lote → lotes.
function nota(idNota: string, aplisIds: (string | null)[], extra: Linha = {}): Linha {
  return {
    id_nota: idNota,
    numero_nota: '9127',
    status: 'aberta',
    data_emissao: '2026-09-03',
    valor_total: 2034.81,
    valor_recebido: 0,
    valor_glosado: 0,
    operadoras: { nome: 'AMHP-DF' },
    nota_lote: aplisIds.map((aplis) => ({ lotes: { aplis_id: aplis } })),
    ...extra,
  };
}

function recebido(valor: number, overrides: Partial<RecebidoLoteAplis> = {}): RecebidoLoteAplis {
  return {
    status: valor > 0 ? 4 : 3,
    statusLabel: valor > 0 ? 'Recebido' : 'Faturado',
    recebido: valor,
    primeiroRecebimento: valor > 0 ? '2026-09-22' : null,
    ultimoRecebimento: valor > 0 ? '2026-09-22' : null,
    ...overrides,
  };
}

function criarReq(semToken = false): VercelRequest {
  return {
    method: 'GET',
    headers: semToken ? {} : { authorization: 'Bearer token-teste' },
    query: {},
  } as unknown as VercelRequest;
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
      this.body = payload;
      return this;
    },
  };
  return res as unknown as VercelResponse & typeof res;
}

async function executar(
  cenario: Cenario,
  porLote: Record<number, RecebidoLoteAplis> = {},
  porData: Record<number, RecebidoLoteNaData[]> = {},
) {
  mockarSupabase(cenario);
  recebidosDosLotesMock.mockResolvedValue({ porLote, dadoAte: '2026-10-13' });
  recebidosPorDataDosLotesMock.mockResolvedValue({ porLote: porData });
  const res = criarRes();
  await handler(criarReq(), res);
  return res;
}

function recebimento(notaId: string, valor: number, data: string, status = 'recebido'): Linha {
  return { nota_id: notaId, valor_recebido: valor, data_receb: data, status };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/faturamento/titulos-baixas-aplis-previa', () => {
  describe('autorização', () => {
    it('sem token devolve 401 sem consultar o apLIS', async () => {
      mockarSupabase();
      const res = criarRes();
      await handler(criarReq(true), res);
      expect(res.statusCode).toBe(401);
      expect(recebidosDosLotesMock).not.toHaveBeenCalled();
    });

    it('sessão inválida devolve 401', async () => {
      const res = await executar({ usuario: null });
      expect(res.statusCode).toBe(401);
      expect(recebidosDosLotesMock).not.toHaveBeenCalled();
    });

    it('só canViewBilling devolve 403: a prévia é para quem lança baixa', async () => {
      const res = await executar({ permissoes: ['canViewBilling'] });
      expect(res.statusCode).toBe(403);
      expect(recebidosDosLotesMock).not.toHaveBeenCalled();
    });

    it('canManageBilling basta e os títulos são lidos com o cliente do usuário (RLS)', async () => {
      const res = await executar({ permissoes: ['canManageBilling'] });
      expect(res.statusCode).toBe(200);
      expect(getSupabaseUserClientMock).toHaveBeenCalledWith('token-teste');
    });

    it('método diferente de GET devolve 405', async () => {
      const res = criarRes();
      await handler({ ...criarReq(), method: 'POST' } as VercelRequest, res);
      expect(res.statusCode).toBe(405);
    });
  });

  it('devolve as baixas por data, com meta.dadoAte e sem cache', async () => {
    const res = await executar(
      { notas: [nota('so-no-aplis', ['6329'])] },
      { 6329: recebido(2034.81) },
      { 6329: [{ data: '2026-09-22', valor: 2034.81 }] },
    );

    expect(res.statusCode).toBe(200);
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(res.body.meta).toEqual({ dadoAte: '2026-10-13' });
    expect(res.body.titulos).toEqual([{
      idNota: 'so-no-aplis',
      numeroNota: '9127',
      operadora: 'AMHP-DF',
      tipo: 'so-no-aplis',
      recebidoSistema: 0,
      recebidoAplis: 2034.81,
      baixas: [{
        data: '2026-09-22',
        valor: 2034.81,
        observacoes: 'Baixa do apLIS — lote(s) 6329 (recebido em 22/09/2026)',
      }],
      pulado: null,
    }]);
  });

  it('sistema-maior, lote-ausente e conferidos ficam fora', async () => {
    const res = await executar(
      {
        notas: [
          nota('sistema-maior', ['6401'], { status: 'recebida', valor_recebido: 1200 }),
          nota('lote-ausente', ['4905']),
          nota('conferido', ['6402'], { status: 'recebida', valor_recebido: 300 }),
        ],
      },
      { 6401: recebido(0), 6402: recebido(300) },
    );
    expect(res.statusCode).toBe(200);
    expect(res.body.titulos).toEqual([]);
  });

  it('título sem número da nota sai pulado, sem baixas e sem ir à réplica por data', async () => {
    const res = await executar(
      { notas: [nota('sem-nota', ['6329'], { numero_nota: null })] },
      { 6329: recebido(2034.81) },
      { 6329: [{ data: '2026-09-22', valor: 2034.81 }] },
    );
    expect(res.body.titulos).toEqual([expect.objectContaining({
      idNota: 'sem-nota',
      numeroNota: null,
      tipo: 'so-no-aplis',
      baixas: [],
      pulado: 'sem-nota',
    })]);
    expect(recebidosPorDataDosLotesMock).toHaveBeenCalledWith([]);
  });

  it('aplis-maior junta as datas dos lotes do título e descarta as datas já lançadas no sistema', async () => {
    const res = await executar(
      {
        notas: [nota('dois-lotes', ['5001', '5002'], { status: 'parcialmente_recebida', valor_recebido: 800 })],
        recebimentos: [
          recebimento('dois-lotes', 800, '2026-08-15'),
          recebimento('outro', 999, '2026-10-01'),
          recebimento('dois-lotes', 500, '2026-10-01', 'estornado'),
        ],
      },
      { 5001: recebido(950), 5002: recebido(50) },
      {
        5001: [{ data: '2026-08-15', valor: 800 }, { data: '2026-10-01', valor: 150 }],
        5002: [{ data: '2026-10-01', valor: 50 }],
      },
    );
    expect(res.body.titulos[0]).toMatchObject({ tipo: 'aplis-maior', recebidoSistema: 800, recebidoAplis: 1000 });
    expect(res.body.titulos[0].baixas).toEqual([{
      data: '2026-10-01',
      valor: 200,
      observacoes: 'Baixa do apLIS — lote(s) 5001, 5002 (recebido em 01/10/2026)',
    }]);
  });

  it('pede à réplica as datas só dos lotes dos títulos que geram baixa', async () => {
    await executar(
      {
        notas: [
          nota('a', ['6329']),
          nota('sistema-maior', ['6401'], { valor_recebido: 1200 }),
        ],
      },
      { 6329: recebido(2034.81), 6401: recebido(0) },
    );
    expect(recebidosPorDataDosLotesMock).toHaveBeenCalledWith([6329]);
  });

  it('falha na réplica devolve 502 com mensagem clara, nunca lista vazia', async () => {
    mockarSupabase({ notas: [nota('a', ['6329'])] });
    recebidosDosLotesMock.mockResolvedValue({
      erro: { status: 502, mensagem: 'Não foi possível consultar o banco do laboratório: connect ETIMEDOUT' },
    });
    const res = criarRes();
    await handler(criarReq(), res);

    expect(res.statusCode).toBe(502);
    expect(res.body.error).toMatch(/apLIS/);
    expect(res.body).not.toHaveProperty('titulos');
  });

  it('falha na consulta por data devolve 502', async () => {
    mockarSupabase({ notas: [nota('a', ['6329'])] });
    recebidosDosLotesMock.mockResolvedValue({ porLote: { 6329: recebido(2034.81) }, dadoAte: '2026-10-13' });
    recebidosPorDataDosLotesMock.mockResolvedValue({
      erro: { status: 502, mensagem: 'Não foi possível consultar o banco do laboratório: connect ETIMEDOUT' },
    });
    const res = criarRes();
    await handler(criarReq(), res);

    expect(res.statusCode).toBe(502);
    expect(res.body).not.toHaveProperty('titulos');
  });

  it('falha ao ler os títulos no Supabase devolve 502', async () => {
    const res = await executar({ erroNotas: 'boom' });
    expect(res.statusCode).toBe(502);
    expect(recebidosDosLotesMock).not.toHaveBeenCalled();
  });

  it('falha ao ler as baixas do sistema devolve 502', async () => {
    const res = await executar(
      { notas: [nota('a', ['6329'], { valor_recebido: 500 })], erroRecebimentos: 'boom' },
      { 6329: recebido(2034.81) },
      { 6329: [{ data: '2026-09-22', valor: 2034.81 }] },
    );
    expect(res.statusCode).toBe(502);
    expect(res.body).not.toHaveProperty('titulos');
  });
});
