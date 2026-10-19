import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

vi.mock('../supabase.js', () => ({
  getSupabaseAdminClient: vi.fn(),
  getSupabaseUserClient: vi.fn(),
}));
vi.mock('../faturamento/bdLab.js', () => ({
  recebidosDosLotes: vi.fn(),
}));

import { getSupabaseAdminClient, getSupabaseUserClient } from '../supabase.js';
import { recebidosDosLotes } from '../faturamento/bdLab.js';
import type { RecebidoLoteAplis } from '../faturamento/bdLab.js';
import handler from './faturamento-titulos-conferencia-aplis.js';

const getSupabaseAdminClientMock = getSupabaseAdminClient as ReturnType<typeof vi.fn>;
const getSupabaseUserClientMock = getSupabaseUserClient as ReturnType<typeof vi.fn>;
const recebidosDosLotesMock = recebidosDosLotes as ReturnType<typeof vi.fn>;

type Linha = Record<string, unknown>;

interface CorpoResposta {
  success: boolean;
  error?: string;
  meta: { dadoAte: string | null };
  titulos: (Record<string, unknown> & { idNota: string; tipo: string })[];
  refechamentos: { idNota: string; lotes: number[]; emissaoAtual: string; emissaoNova: string }[];
}

// Query builder mínimo do supabase-js: select/eq/neq/order/range encadeáveis,
// single() e `await` direto.
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

function mockarSupabase(cenario: Cenario = {}) {
  const usuario = cenario.usuario === undefined ? { id: 'user-1' } : cenario.usuario;
  const perfil = { id: 'user-1', custom_roles: { permissions: cenario.permissoes ?? ['canViewBilling'] } };
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
      return consulta(cenario.notas ?? [], cenario.erroNotas);
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
    fechamento: '2026-09-03',
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

async function executar(cenario: Cenario, porLote: Record<number, RecebidoLoteAplis> = {}) {
  mockarSupabase(cenario);
  recebidosDosLotesMock.mockResolvedValue({ porLote, dadoAte: '2026-10-13' });
  const res = criarRes();
  await handler(criarReq(), res);
  return res;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/faturamento/titulos-conferencia-aplis', () => {
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

    it('sem permissão de faturamento devolve 403', async () => {
      const res = await executar({ permissoes: ['canViewRequests'] });
      expect(res.statusCode).toBe(403);
      expect(recebidosDosLotesMock).not.toHaveBeenCalled();
    });

    it('canViewBilling basta e os títulos são lidos com o cliente do usuário (RLS)', async () => {
      const res = await executar({ permissoes: ['canViewBilling'] });
      expect(res.statusCode).toBe(200);
      expect(getSupabaseUserClientMock).toHaveBeenCalledWith('token-teste');
    });

    it('método diferente de GET devolve 405', async () => {
      const res = criarRes();
      await handler({ ...criarReq(), method: 'POST' } as VercelRequest, res);
      expect(res.statusCode).toBe(405);
    });
  });

  it('devolve só os divergentes, com meta.dadoAte e sem cache', async () => {
    const res = await executar(
      {
        notas: [
          nota('so-no-aplis', ['6329']),
          nota('aplis-maior', ['6400'], { status: 'parcialmente_recebida', valor_recebido: 500 }),
          nota('sistema-maior', ['6401'], { status: 'recebida', valor_recebido: 1200, valor_glosado: 50 }),
          nota('lote-ausente', ['4905']),
          nota('conferido', ['6402'], { status: 'recebida', valor_recebido: 300 }),
        ],
      },
      { 6329: recebido(2034.81), 6400: recebido(800), 6401: recebido(0), 6402: recebido(300) },
    );

    expect(res.statusCode).toBe(200);
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(res.body.meta).toEqual({ dadoAte: '2026-10-13' });
    expect(Object.fromEntries(res.body.titulos.map((t) => [t.idNota, t.tipo]))).toEqual({
      'so-no-aplis': 'so-no-aplis',
      'aplis-maior': 'aplis-maior',
      'sistema-maior': 'sistema-maior',
      'lote-ausente': 'lote-ausente',
    });
    expect(res.body.titulos.find((t) => t.idNota === 'so-no-aplis')).toEqual({
      idNota: 'so-no-aplis',
      numeroNota: '9127',
      operadora: 'AMHP-DF',
      status: 'aberta',
      dataEmissao: '2026-09-03',
      valorTotal: 2034.81,
      recebidoSistema: 0,
      glosadoSistema: 0,
      recebidoAplis: 2034.81,
      primeiroRecebimentoAplis: '2026-09-22',
      ultimoRecebimentoAplis: '2026-09-22',
      lotes: [{ aplisId: 6329, statusAplis: 'Recebido', recebidoAplis: 2034.81 }],
      tipo: 'so-no-aplis',
    });
    expect(res.body.titulos.find((t) => t.idNota === 'sistema-maior')).toMatchObject({ glosadoSistema: 50 });
  });

  it('consulta o apLIS uma vez com os lotes de todos os títulos', async () => {
    await executar({ notas: [nota('a', ['6329']), nota('b', ['6400', '6329'])] });
    expect(recebidosDosLotesMock).toHaveBeenCalledTimes(1);
    expect(new Set(recebidosDosLotesMock.mock.calls[0][0])).toEqual(new Set([6329, 6400]));
  });

  it('diferença abaixo de R$ 1,00 não aparece', async () => {
    const res = await executar(
      { notas: [nota('quase', ['6329'], { valor_recebido: 2034.00 })] },
      { 6329: recebido(2034.81) },
    );
    expect(res.body.titulos).toEqual([]);
  });

  it('título cancelado fica de fora', async () => {
    const res = await executar(
      { notas: [nota('cancelado', ['6329'], { status: 'cancelada' })] },
      { 6329: recebido(2034.81) },
    );
    expect(res.body.titulos).toEqual([]);
  });

  it('título com 2 lotes soma os recebidos do apLIS', async () => {
    const res = await executar(
      { notas: [nota('dois-lotes', ['5001', '5002'], { status: 'parcialmente_recebida', valor_recebido: 300 })] },
      { 5001: recebido(300), 5002: recebido(200.5) },
    );
    expect(res.body.titulos).toHaveLength(1);
    expect(res.body.titulos[0]).toMatchObject({ tipo: 'aplis-maior', recebidoSistema: 300, recebidoAplis: 500.5 });
  });

  it('valores numeric vindos como string do PostgREST viram número', async () => {
    const res = await executar(
      { notas: [nota('texto', ['6329'], { valor_total: '2034.81', valor_recebido: '0.00', valor_glosado: null })] },
      { 6329: recebido(2034.81) },
    );
    expect(res.body.titulos[0]).toMatchObject({ valorTotal: 2034.81, recebidoSistema: 0, glosadoSistema: 0 });
  });

  it('título com lote sem aplis_id (criado fora do apLIS) fica de fora: a soma seria parcial', async () => {
    const res = await executar(
      { notas: [nota('misto', ['6329', null], { valor_recebido: 5000 })] },
      { 6329: recebido(2034.81) },
    );
    expect(res.body.titulos).toEqual([]);
  });

  it('título sem lote não leva id à réplica nem aparece', async () => {
    const res = await executar({ notas: [nota('sem-lote', [])] });
    expect(res.statusCode).toBe(200);
    expect(res.body.titulos).toEqual([]);
    expect(recebidosDosLotesMock).toHaveBeenCalledWith([]);
  });

  it('falha na réplica devolve 502 com mensagem clara, nunca lista vazia', async () => {
    mockarSupabase({ notas: [nota('a', ['6329'])] });
    recebidosDosLotesMock.mockResolvedValue({
      erro: { status: 502, mensagem: 'Não foi possível consultar o banco do laboratório: connect ETIMEDOUT' },
    });
    const res = criarRes();
    await handler(criarReq(), res);

    expect(res.statusCode).toBe(502);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/apLIS/);
    expect(res.body.error).toMatch(/tente novamente/i);
    expect(res.body).not.toHaveProperty('titulos');
  });

  it('falha ao ler os títulos no Supabase devolve 502', async () => {
    const res = await executar({ erroNotas: 'boom' });
    expect(res.statusCode).toBe(502);
    expect(res.body.success).toBe(false);
    expect(recebidosDosLotesMock).not.toHaveBeenCalled();
  });

  describe('refechamentos', () => {
    it('título cujo lote foi refechado depois da emissão sai com emissão atual e nova', async () => {
      const res = await executar(
        { notas: [nota('refechado', ['6553'], { data_emissao: '2026-09-24' })] },
        { 6553: recebido(0, { fechamento: '2026-10-14' }) },
      );
      expect(res.statusCode).toBe(200);
      expect(res.body.refechamentos).toEqual([
        { idNota: 'refechado', operadora: 'AMHP-DF', lotes: [6553], emissaoAtual: '2026-09-24', emissaoNova: '2026-10-14' },
      ]);
    });

    it('fechamento no mesmo mês da emissão, ou anterior, não aparece', async () => {
      const res = await executar(
        {
          notas: [
            // 6111: emissão 08/07, fechamento 09/07 — só o dia difere, fica.
            nota('mesmo-mes', ['6111'], { data_emissao: '2026-07-08' }),
            nota('anterior', ['6200'], { data_emissao: '2026-08-10' }),
          ],
        },
        { 6111: recebido(0, { fechamento: '2026-07-09' }), 6200: recebido(0, { fechamento: '2026-07-30' }) },
      );
      expect(res.body.refechamentos).toEqual([]);
    });

    it('título com vários lotes usa o fechamento mais recente entre eles', async () => {
      const res = await executar(
        { notas: [nota('dois-lotes', ['6283', '6243'], { data_emissao: '2026-08-05' })] },
        {
          6243: recebido(0, { fechamento: '2026-10-02' }),
          6283: recebido(0, { fechamento: '2026-10-09' }),
        },
      );
      expect(res.body.refechamentos).toEqual([
        { idNota: 'dois-lotes', operadora: 'AMHP-DF', lotes: [6243, 6283], emissaoAtual: '2026-08-05', emissaoNova: '2026-10-09' },
      ]);
    });

    it('título com algum lote sem fechamento ou ausente no apLIS não aparece', async () => {
      const res = await executar(
        {
          notas: [
            nota('um-aberto', ['6395', '7017'], { data_emissao: '2026-09-01' }),
            nota('ausente', ['6774', '4905'], { data_emissao: '2026-09-01' }),
          ],
        },
        {
          6395: recebido(0, { fechamento: '2026-10-10' }),
          7017: recebido(0, { fechamento: null }),
          6774: recebido(0, { fechamento: '2026-10-10' }),
        },
      );
      expect(res.body.refechamentos).toEqual([]);
    });

    it('título cancelado e título com lote sem aplis_id não aparecem', async () => {
      const res = await executar(
        {
          notas: [
            nota('cancelado', ['6553'], { status: 'cancelada', data_emissao: '2026-09-24' }),
            nota('misto', ['6553', null], { data_emissao: '2026-09-24' }),
          ],
        },
        { 6553: recebido(0, { fechamento: '2026-10-14' }) },
      );
      expect(res.body.refechamentos).toEqual([]);
    });

    it('refechamento sai separado das divergências de recebido', async () => {
      const res = await executar(
        { notas: [nota('ambos', ['6553'], { data_emissao: '2026-09-24' })] },
        { 6553: recebido(500, { fechamento: '2026-10-14' }) },
      );
      expect(res.body.titulos.map((t) => t.idNota)).toEqual(['ambos']);
      expect(res.body.refechamentos.map((r) => r.idNota)).toEqual(['ambos']);
      expect(res.body.titulos[0]).not.toHaveProperty('emissaoNova');
    });
  });
});
