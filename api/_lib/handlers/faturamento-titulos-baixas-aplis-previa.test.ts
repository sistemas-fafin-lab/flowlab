import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

vi.mock('../supabase.js', () => ({
  getSupabaseAdminClient: vi.fn(),
  getSupabaseUserClient: vi.fn(),
}));
vi.mock('../faturamento/bdLab.js', () => ({
  recebidosDosLotes: vi.fn(),
  recebidosPorDataDosLotes: vi.fn(),
  diferencasDosLotes: vi.fn(),
}));

import { getSupabaseAdminClient, getSupabaseUserClient } from '../supabase.js';
import { diferencasDosLotes, recebidosDosLotes, recebidosPorDataDosLotes } from '../faturamento/bdLab.js';
import type { RecebidoLoteAplis, RecebidoLoteNaData } from '../faturamento/bdLab.js';
import type { DiferencaAplis } from '../faturamento/glosasAplis.js';
import handler from './faturamento-titulos-baixas-aplis-previa.js';

const getSupabaseAdminClientMock = getSupabaseAdminClient as ReturnType<typeof vi.fn>;
const getSupabaseUserClientMock = getSupabaseUserClient as ReturnType<typeof vi.fn>;
const recebidosDosLotesMock = recebidosDosLotes as ReturnType<typeof vi.fn>;
const recebidosPorDataDosLotesMock = recebidosPorDataDosLotes as ReturnType<typeof vi.fn>;
const diferencasDosLotesMock = diferencasDosLotes as ReturnType<typeof vi.fn>;

type Linha = Record<string, unknown>;

interface CorpoResposta {
  success: boolean;
  error?: string;
  meta: { dadoAte: string | null };
  titulos: (Record<string, unknown> & {
    idNota: string;
    tipo: string | null;
    puladoGlosa: string | null;
    glosas: Record<string, unknown>[];
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
  glosas?: Linha[];
  erroGlosas?: string;
}

function mockarSupabase(cenario: Cenario = {}) {
  const usuario = cenario.usuario === undefined ? { id: 'user-1' } : cenario.usuario;
  const perfil = { id: 'user-1', custom_roles: { permissions: cenario.permissoes ?? ['canManageBilling'] } };
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
      if (tabela === 'glosas') return consulta(cenario.glosas ?? [], cenario.erroGlosas);
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
    nota_lote: aplisIds.map((aplis) => ({ lotes: { id_lote: `uuid-${aplis}`, aplis_id: aplis } })),
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
  diferencas: Record<number, DiferencaAplis[]> = {},
) {
  mockarSupabase(cenario);
  recebidosDosLotesMock.mockResolvedValue({ porLote, dadoAte: '2026-10-13' });
  recebidosPorDataDosLotesMock.mockResolvedValue({ porLote: porData });
  diferencasDosLotesMock.mockResolvedValue({ porLote: diferencas });
  const res = criarRes();
  await handler(criarReq(), res);
  return res;
}

// Procedimentos de um lote recebidos a menor no apLIS (NF 9124, lote 6228: 475 procedimentos, R$ 867,86).
function diferenca(idLote: number, overrides: Partial<DiferencaAplis> = {}): DiferencaAplis {
  return {
    idLote,
    motivoCodigo: 2902,
    motivoDescricao: 'GLOSA MANTIDA',
    desMotivoGlosa: '2902',
    codEventoFatur: 6,
    emRecurso: false,
    valor: 867.86,
    procedimentos: 475,
    demonstrativoValor: 867.86,
    ...overrides,
  };
}

// Glosa já lançada, no formato do select de glosas (lote embutido).
function glosaLancada(notaId: string, extra: Linha = {}): Linha {
  return {
    nota_id: notaId,
    origem: null,
    codigo_glosa: null,
    motivo: 'Glosa digitada',
    status: 'aberta',
    valor: 100,
    lotes: null,
    ...extra,
  };
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
      saldo: 0,
      glosas: [],
      puladoGlosa: null,
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

  it('título sem número da nota recebe as baixas como qualquer outro', async () => {
    const res = await executar(
      { notas: [nota('sem-nota', ['6329'], { numero_nota: null })] },
      { 6329: recebido(2034.81) },
      { 6329: [{ data: '2026-09-22', valor: 2034.81 }] },
    );
    expect(res.body.titulos).toEqual([expect.objectContaining({
      idNota: 'sem-nota',
      numeroNota: null,
      tipo: 'so-no-aplis',
      baixas: [expect.objectContaining({ data: '2026-09-22', valor: 2034.81 })],
    })]);
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

  describe('glosas', () => {
    it('título com a baixa batendo e glosa a lançar entra, sem baixa', async () => {
      // NF 9124: R$ 2.000 cobrados, R$ 1.132,14 recebidos nos dois lados, R$ 867,86 glosados no apLIS.
      const res = await executar(
        {
          notas: [nota('nf-9124', ['6228'], {
            numero_nota: '9124',
            status: 'parcialmente_recebida',
            valor_total: 2000,
            valor_recebido: 1132.14,
          })],
        },
        { 6228: recebido(1132.14) },
        {},
        { 6228: [diferenca(6228)] },
      );

      expect(res.statusCode).toBe(200);
      expect(res.body.titulos).toEqual([{
        idNota: 'nf-9124',
        numeroNota: '9124',
        operadora: 'AMHP-DF',
        tipo: null,
        recebidoSistema: 1132.14,
        recebidoAplis: 1132.14,
        baixas: [],
        saldo: 867.86,
        glosas: [{
          idLote: 6228,
          loteId: 'uuid-6228',
          codigo: '2902',
          motivo: 'GLOSA MANTIDA',
          status: 'aberta',
          valor: 867.86,
          procedimentos: 475,
          demonstrativo: 'confere',
        }],
        puladoGlosa: null,
      }]);
    });

    it('título com baixa leva as glosas no saldo que sobra depois das baixas', async () => {
      const res = await executar(
        { notas: [nota('so-no-aplis', ['6329'], { valor_total: 2100 })] },
        { 6329: recebido(2034.81) },
        { 6329: [{ data: '2026-09-22', valor: 2034.81 }] },
        { 6329: [diferenca(6329, { valor: 65.19, procedimentos: 2, codEventoFatur: 18 })] },
      );
      expect(res.body.titulos).toEqual([expect.objectContaining({
        tipo: 'so-no-aplis',
        baixas: [expect.objectContaining({ valor: 2034.81 })],
        saldo: 65.19,
        glosas: [expect.objectContaining({ valor: 65.19, status: 'definitiva', procedimentos: 2 })],
        puladoGlosa: null,
      })]);
    });

    it('sistema-maior e lote-ausente com diferença no apLIS entram pulados (tipo)', async () => {
      const res = await executar(
        {
          notas: [
            nota('sistema-maior', ['6401'], { status: 'parcialmente_recebida', valor_recebido: 1200 }),
            nota('lote-ausente', ['6402', '4905']),
          ],
        },
        { 6401: recebido(0), 6402: recebido(0) },
        {},
        { 6401: [diferenca(6401, { valor: 100 })], 6402: [diferenca(6402, { valor: 100 })] },
      );
      expect(res.body.titulos.map((t) => [t.idNota, t.tipo, t.baixas, t.glosas, t.puladoGlosa])).toEqual([
        ['sistema-maior', 'sistema-maior', [], [], 'tipo'],
        ['lote-ausente', 'lote-ausente', [], [], 'tipo'],
      ]);
      expect(res.body.titulos[1].recebidoAplis).toBeNull();
    });

    it('título sem número da nota recebe as glosas como qualquer outro', async () => {
      const res = await executar(
        { notas: [nota('sem-nota', ['6228'], { numero_nota: null, valor_recebido: 1132.14 })] },
        { 6228: recebido(1132.14) },
        {},
        { 6228: [diferenca(6228)] },
      );
      expect(res.body.titulos).toEqual([expect.objectContaining({
        tipo: null,
        glosas: [expect.objectContaining({ idLote: 6228, valor: 867.86 })],
        puladoGlosa: null,
      })]);
    });

    it('título com glosa digitada à mão sai com a glosa pulada (glosa-manual)', async () => {
      const res = await executar(
        {
          notas: [nota('nf-9124', ['6228'], { valor_total: 2000, valor_recebido: 1132.14, valor_glosado: 100 })],
          glosas: [glosaLancada('nf-9124'), glosaLancada('outro')],
        },
        { 6228: recebido(1132.14) },
        {},
        { 6228: [diferenca(6228)] },
      );
      expect(res.body.titulos).toEqual([expect.objectContaining({ glosas: [], puladoGlosa: 'glosa-manual' })]);
    });

    it('glosa do apLIS já lançada: sugere só o que o apLIS glosou a mais no lote + código', async () => {
      const res = await executar(
        {
          notas: [nota('nf-9124', ['6228'], { valor_total: 2000, valor_recebido: 1132.14, valor_glosado: 800 })],
          glosas: [glosaLancada('nf-9124', {
            origem: 'aplis', codigo_glosa: '2902', motivo: 'GLOSA MANTIDA', valor: '800.00', lotes: { aplis_id: '6228' },
          })],
        },
        { 6228: recebido(1132.14) },
        {},
        { 6228: [diferenca(6228)] },
      );
      expect(res.body.titulos).toEqual([expect.objectContaining({
        saldo: 67.86,
        glosas: [expect.objectContaining({ idLote: 6228, loteId: 'uuid-6228', codigo: '2902', valor: 67.86 })],
        puladoGlosa: null,
      })]);
    });

    it('glosa do apLIS lançada inteira e título fechado: fica fora da prévia', async () => {
      const res = await executar(
        {
          notas: [nota('nf-9124', ['6228'], { valor_total: 2000, valor_recebido: 1132.14, valor_glosado: 867.86 })],
          glosas: [glosaLancada('nf-9124', {
            origem: 'aplis', codigo_glosa: '2902', valor: 867.86, lotes: { aplis_id: '6228' },
          })],
        },
        { 6228: recebido(1132.14) },
        {},
        { 6228: [diferenca(6228)] },
      );
      expect(res.body.titulos).toEqual([]);
    });

    it('diferença só sem motivo: entra pulada (sem-motivo)', async () => {
      const res = await executar(
        { notas: [nota('a', ['6228'], { valor_total: 2000, valor_recebido: 1132.14 })] },
        { 6228: recebido(1132.14) },
        {},
        { 6228: [diferenca(6228, { motivoCodigo: null, motivoDescricao: null, desMotivoGlosa: null })] },
      );
      expect(res.body.titulos).toEqual([expect.objectContaining({ glosas: [], puladoGlosa: 'sem-motivo' })]);
    });

    it('título sem baixa e já fechado (saldo abaixo de R$ 1,00) fica fora, mesmo com diferença no apLIS', async () => {
      const res = await executar(
        {
          notas: [nota('fechado', ['6228'], {
            status: 'liquidada', valor_total: 2000, valor_recebido: 1132.14, valor_glosado: 867.86,
          })],
          glosas: [glosaLancada('fechado')],
        },
        { 6228: recebido(1132.14) },
        {},
        { 6228: [diferenca(6228)] },
      );
      expect(res.body.titulos).toEqual([]);
    });

    it('os títulos com baixa vêm antes dos só com glosa', async () => {
      const res = await executar(
        {
          notas: [
            nota('so-glosa', ['6228'], { valor_total: 2000, valor_recebido: 1132.14 }),
            nota('com-baixa', ['6329']),
          ],
        },
        { 6228: recebido(1132.14), 6329: recebido(2034.81) },
        { 6329: [{ data: '2026-09-22', valor: 2034.81 }] },
        { 6228: [diferenca(6228)] },
      );
      expect(res.body.titulos.map((t) => t.idNota)).toEqual(['com-baixa', 'so-glosa']);
    });

    it('pede as diferenças de todos os lotes conferidos e as glosas só dos títulos com diferença', async () => {
      const res = await executar(
        { notas: [nota('a', ['6228'], { valor_total: 2000, valor_recebido: 1132.14 }), nota('b', ['6402'])] },
        { 6228: recebido(1132.14), 6402: recebido(0) },
        {},
        { 6228: [diferenca(6228)] },
      );
      expect(res.statusCode).toBe(200);
      expect(diferencasDosLotesMock).toHaveBeenCalledWith([6228, 6402]);
    });

    it('falha ao ler as diferenças na réplica devolve 502', async () => {
      mockarSupabase({ notas: [nota('a', ['6329'])] });
      recebidosDosLotesMock.mockResolvedValue({ porLote: { 6329: recebido(2034.81) }, dadoAte: '2026-10-13' });
      recebidosPorDataDosLotesMock.mockResolvedValue({ porLote: {} });
      diferencasDosLotesMock.mockResolvedValue({
        erro: { status: 502, mensagem: 'Não foi possível consultar o banco do laboratório: connect ETIMEDOUT' },
      });
      const res = criarRes();
      await handler(criarReq(), res);

      expect(res.statusCode).toBe(502);
      expect(res.body.error).toMatch(/apLIS/);
      expect(res.body).not.toHaveProperty('titulos');
    });

    it('falha ao ler as glosas do sistema devolve 502', async () => {
      const res = await executar(
        { notas: [nota('a', ['6228'], { valor_total: 2000, valor_recebido: 1132.14 })], erroGlosas: 'boom' },
        { 6228: recebido(1132.14) },
        {},
        { 6228: [diferenca(6228)] },
      );
      expect(res.statusCode).toBe(502);
      expect(res.body).not.toHaveProperty('titulos');
    });
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
