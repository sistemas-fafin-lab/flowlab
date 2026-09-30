import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

vi.mock('../supabase.js', () => ({
  getSupabaseAdminClient: vi.fn(),
}));
vi.mock('../faturamento/bdLab.js', () => ({
  listarLotesFechadosDesde: vi.fn(),
  nfesDosLotes: vi.fn(),
}));

import { getSupabaseAdminClient } from '../supabase.js';
import { listarLotesFechadosDesde, nfesDosLotes } from '../faturamento/bdLab.js';
import type { LoteFaturamento } from '../faturamento/bdLab.js';
import handler from './faturamento-titulos-aplis-previa.js';

const getSupabaseAdminClientMock = getSupabaseAdminClient as ReturnType<typeof vi.fn>;
const listarLotesFechadosDesdeMock = listarLotesFechadosDesde as ReturnType<typeof vi.fn>;
const nfesDosLotesMock = nfesDosLotes as ReturnType<typeof vi.fn>;

type Linha = Record<string, unknown>;

interface CorpoResposta {
  success: boolean;
  error?: string;
  lotes: (Record<string, unknown> & { lote: Record<string, unknown> & { idLote: number } })[];
  nfsAPreencher: Record<string, unknown>[];
}

interface Cenario {
  usuario?: { id: string } | null;
  perfil?: { role: string; custom_roles: { permissions: string[] } | null } | null;
  tabelas?: Record<string, Linha[]>;
  erros?: Record<string, string>;
  /** NF-e por lote no apLIS (mock de nfesDosLotes). */
  nfes?: Record<number, string>;
}

// Query builder mínimo do supabase-js: select/in/eq/neq/or/order/range
// encadeáveis, single() e `await` direto. Filtra as linhas da tabela como o
// PostgREST faria. `or` entende só `coluna.is.null` e `coluna.eq.valor`.
function consulta(linhas: Linha[], erro: string | undefined) {
  let resultado = [...linhas];
  const builder = {
    select: () => builder,
    in: (coluna: string, valores: unknown[]) => {
      resultado = resultado.filter((l) => valores.includes(l[coluna]));
      return builder;
    },
    eq: (coluna: string, valor: unknown) => {
      resultado = resultado.filter((l) => l[coluna] === valor);
      return builder;
    },
    neq: (coluna: string, valor: unknown) => {
      resultado = resultado.filter((l) => l[coluna] !== valor);
      return builder;
    },
    or: (filtro: string) => {
      const condicoes = filtro.split(',').map((parte) => {
        const [coluna, op, ...resto] = parte.split('.');
        const valor = resto.join('.');
        return (l: Linha) => (op === 'is' && valor === 'null' ? l[coluna] === null : l[coluna] === valor);
      });
      resultado = resultado.filter((l) => condicoes.some((c) => c(l)));
      return builder;
    },
    range: (de: number, ate: number) => {
      resultado = resultado.slice(de, ate + 1);
      return builder;
    },
    order: (coluna: string, opcoes?: { ascending?: boolean }) => {
      const sentido = opcoes?.ascending === false ? -1 : 1;
      resultado.sort((a, b) => (String(a[coluna]) < String(b[coluna]) ? -sentido : sentido));
      return builder;
    },
    single: async () => (erro
      ? { data: null, error: { message: erro } }
      : { data: resultado[0] ?? null, error: null }),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(erro
        ? { data: null, error: { message: erro } }
        : { data: resultado, error: null }).then(resolve, reject),
  };
  return builder;
}

function criarSupabaseMock(cenario: Cenario = {}) {
  const usuario = cenario.usuario === undefined ? { id: 'user-1' } : cenario.usuario;
  const perfil = cenario.perfil === undefined
    ? { role: 'user', custom_roles: { permissions: ['canManageBilling'] } }
    : cenario.perfil;
  const tabelas: Record<string, Linha[]> = {
    user_profiles: perfil ? [{ id: 'user-1', ...perfil }] : [],
    lotes: [],
    nota_lote: [],
    notas_lote_audit_logs: [],
    notas: [],
    ...cenario.tabelas,
  };
  return {
    auth: {
      getUser: vi.fn(async () => (usuario
        ? { data: { user: usuario }, error: null }
        : { data: { user: null }, error: { message: 'invalid' } })),
    },
    from: vi.fn((tabela: string) => {
      if (!(tabela in tabelas)) throw new Error(`tabela inesperada no mock: ${tabela}`);
      return consulta(tabelas[tabela], cenario.erros?.[tabela]);
    }),
  };
}

type LoteFixture = LoteFaturamento & { particular?: boolean };

function lote(overrides: Partial<LoteFixture> = {}): LoteFixture {
  return {
    idLote: 6600,
    status: 3,
    statusLabel: 'Faturado',
    dtaCriacao: '2026-09-02',
    dtaFechamento: '2026-09-03',
    dtaEnvio: null,
    dtaCancelamento: null,
    protocolo: null,
    protocoloDuplicado: false,
    protocoloDuplicadoContagem: null,
    protocoloDuplicadoLotes: null,
    nfeNumero: '12345',
    nfeCodigoVerificacao: null,
    numeroRPS: 900,
    dtaVencimento: null,
    prestador: null,
    valor: 1500,
    qtdRequisicoes: 3,
    fontePagadora: { id: 1025, nome: 'AMHP-DF', razaoSocial: null, cpfCnpj: null },
    statusFaturamento: [],
    ...overrides,
  };
}

function criarReq(query: Record<string, string> = { desde: '2026-09-01' }, semToken = false): VercelRequest {
  return {
    method: 'GET',
    headers: semToken ? {} : { authorization: 'Bearer token-teste' },
    query,
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

async function executar(cenario: Cenario, lotes: LoteFixture[], query?: Record<string, string>) {
  const nfes = cenario.nfes ?? {};
  getSupabaseAdminClientMock.mockReturnValue(criarSupabaseMock(cenario));
  listarLotesFechadosDesdeMock.mockResolvedValue({
    lotes: lotes.map(({ particular = false, ...l }) => ({ lote: l, particular })),
  });
  nfesDosLotesMock.mockImplementation(async (ids: number[]) => ({
    porLote: Object.fromEntries(ids.filter((id) => id in nfes).map((id) => [id, nfes[id]])),
  }));
  const res = criarRes();
  await handler(criarReq(query), res);
  return res;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/faturamento/titulos-aplis-previa', () => {
  describe('autorização', () => {
    it('sem token devolve 401 sem consultar o apLIS', async () => {
      getSupabaseAdminClientMock.mockReturnValue(criarSupabaseMock());
      const res = criarRes();
      await handler(criarReq(undefined, true), res);

      expect(res.statusCode).toBe(401);
      expect(listarLotesFechadosDesdeMock).not.toHaveBeenCalled();
    });

    it('sessão inválida devolve 401', async () => {
      const res = await executar({ usuario: null }, [lote()]);
      expect(res.statusCode).toBe(401);
      expect(listarLotesFechadosDesdeMock).not.toHaveBeenCalled();
    });

    it('só canViewBilling devolve 403: a prévia só existe para quem vai criar', async () => {
      const res = await executar(
        { perfil: { role: 'user', custom_roles: { permissions: ['canViewBilling'] } } },
        [lote()],
      );
      expect(res.statusCode).toBe(403);
      expect(listarLotesFechadosDesdeMock).not.toHaveBeenCalled();
    });

    it('método diferente de GET devolve 405', async () => {
      const res = criarRes();
      await handler({ ...criarReq(), method: 'POST' } as VercelRequest, res);
      expect(res.statusCode).toBe(405);
    });
  });

  describe('parâmetro desde', () => {
    it.each([
      ['ausente', {}],
      ['fora do formato', { desde: '01/09/2026' }],
      ['data inexistente', { desde: '2026-09-31' }],
      ['antes do piso de 01/09/2026', { desde: '2026-08-31' }],
    ])('%s devolve 400 sem consultar o apLIS', async (_caso, query) => {
      const res = await executar({}, [lote()], query as Record<string, string>);
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(listarLotesFechadosDesdeMock).not.toHaveBeenCalled();
    });

    it('repassa a data à consulta e a devolve na resposta', async () => {
      const res = await executar({}, [], { desde: '2026-10-01' });
      expect(res.statusCode).toBe(200);
      expect(listarLotesFechadosDesdeMock).toHaveBeenCalledWith('2026-10-01');
      expect(res.body).toEqual({ success: true, desde: '2026-10-01', lotes: [], nfsAPreencher: [] });
    });
  });

  it('lote sem nada de especial vem sem marcas', async () => {
    const res = await executar({}, [lote()]);

    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(res.body.lotes).toHaveLength(1);
    const [item] = res.body.lotes;
    expect(item.lote.idLote).toBe(6600);
    expect(item.lote.dtaFechamento).toBe('2026-09-03');
    expect(item.lote).not.toHaveProperty('particular');
    expect(item).toMatchObject({
      bloqueio: null,
      jaRecebidoAplis: false,
      semNf: false,
      emissaoMesAnterior: false,
      desvinculado: null,
    });
  });

  it('exclui lote com título ativo e lote de título cancelado; mantém o sem vínculo', async () => {
    const res = await executar(
      {
        tabelas: {
          lotes: [
            { id_lote: 'uuid-ativo', aplis_id: '6601' },
            { id_lote: 'uuid-cancelado', aplis_id: '6602' },
          ],
          nota_lote: [
            { id_lote: 'uuid-ativo', id_nota: 'nota-ativa' },
            { id_lote: 'uuid-cancelado', id_nota: 'nota-cancelada' },
          ],
        },
      },
      [lote({ idLote: 6601 }), lote({ idLote: 6602 }), lote({ idLote: 6603 })],
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.lotes.map((l) => l.lote.idLote)).toEqual([6603]);
  });

  it('lote da fonte Particular não aparece', async () => {
    const res = await executar({}, [lote({ idLote: 6604, particular: true }), lote({ idLote: 6605 })]);
    expect(res.body.lotes.map((l) => l.lote.idLote)).toEqual([6605]);
  });

  it('lote de R$ 0 vem bloqueado como sem-valor', async () => {
    const res = await executar({}, [lote({ valor: 0 })]);
    expect(res.body.lotes[0].bloqueio).toBe('sem-valor');
  });

  it.each([
    [4, true],
    [7, true],
    [3, false],
  ])('STLOT %i → jaRecebidoAplis %s', async (status, esperado) => {
    const res = await executar({}, [lote({ status })]);
    expect(res.body.lotes[0].jaRecebidoAplis).toBe(esperado);
  });

  it('lote sem NFeNumero vem com semNf', async () => {
    const res = await executar({}, [lote({ nfeNumero: null })]);
    expect(res.body.lotes[0].semNf).toBe(true);
  });

  it('criado em agosto e fechado em setembro vem com emissaoMesAnterior', async () => {
    const res = await executar({}, [lote({ dtaCriacao: '2026-08-28', dtaFechamento: '2026-09-02' })]);
    expect(res.body.lotes[0].emissaoMesAnterior).toBe(true);
  });

  it('lote desvinculado aparece com o título, a data e o motivo do último desvínculo', async () => {
    const res = await executar(
      {
        tabelas: {
          lotes: [{ id_lote: 'uuid-desv', aplis_id: '6606' }],
          notas_lote_audit_logs: [
            {
              lote_id: 'uuid-desv', nota_id: 'nota-antiga', motivo: 'primeiro engano',
              performed_at: '2026-09-10T12:00:00+00:00', notas: { numero_nota: '111' },
            },
            {
              lote_id: 'uuid-desv', nota_id: 'nota-recente', motivo: 'lote de outra operadora',
              performed_at: '2026-09-20T15:30:00+00:00', notas: { numero_nota: null },
            },
          ],
        },
      },
      [lote({ idLote: 6606 })],
    );

    expect(res.body.lotes[0].desvinculado).toEqual({
      idNota: 'nota-recente',
      numeroNota: null,
      em: '2026-09-20T15:30:00+00:00',
      motivo: 'lote de outra operadora',
    });
  });

  it('erro do apLIS vira mensagem clara com o status da consulta', async () => {
    getSupabaseAdminClientMock.mockReturnValue(criarSupabaseMock());
    listarLotesFechadosDesdeMock.mockResolvedValue({
      erro: { status: 502, mensagem: 'Não foi possível consultar o banco do laboratório: connect ETIMEDOUT' },
    });
    const res = criarRes();
    await handler(criarReq(), res);

    expect(res.statusCode).toBe(502);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/apLIS/);
    expect(res.body.error).toMatch(/tente novamente/i);
  });

  it('falha ao consultar os vínculos no Supabase não lista lotes (evita faturar em dobro)', async () => {
    const res = await executar(
      { tabelas: { lotes: [{ id_lote: 'uuid-6600', aplis_id: '6600' }] }, erros: { nota_lote: 'boom' } },
      [lote()],
    );

    expect(res.statusCode).toBe(502);
    expect(res.body.success).toBe(false);
  });
  describe('nfsAPreencher', () => {
    // Título no formato do select aninhado: notas → operadoras, nota_lote → lotes.
    function titulo(idNota: string, aplisIds: string[], extra: Linha = {}): Linha {
      return {
        id_nota: idNota,
        numero_nota: null,
        status: 'aberta',
        operadoras: { nome: 'AMHP-DF' },
        nota_lote: aplisIds.map((aplis) => ({ lotes: { aplis_id: aplis } })),
        ...extra,
      };
    }

    async function nfs(titulos: Linha[], nfes: Record<number, string>) {
      const res = await executar({ tabelas: { notas: titulos }, nfes }, []);
      expect(res.statusCode).toBe(200);
      return res.body.nfsAPreencher;
    }

    it('título sem número cujo lote tem NF-e vem preenchível', async () => {
      expect(await nfs([titulo('nota-1', ['5001'])], { 5001: '9182' })).toEqual([
        { idNota: 'nota-1', idsLote: [5001], operadora: 'AMHP-DF', situacao: 'preenchivel', nfeNumeros: ['9182'] },
      ]);
    });

    it('independe da data de corte e dos lotes da prévia', async () => {
      await nfs([titulo('nota-1', ['4826'])], { 4826: '9126' });
      expect(nfesDosLotesMock).toHaveBeenCalledWith([4826]);
    });

    it('número vazio ("") conta como sem número', async () => {
      const lista = await nfs([titulo('nota-1', ['5001'], { numero_nota: '' })], { 5001: '9182' });
      expect(lista.map((n) => n.idNota)).toEqual(['nota-1']);
    });

    it('título com número não entra', async () => {
      expect(await nfs([titulo('nota-1', ['5001'], { numero_nota: '9000' })], { 5001: '9182' })).toEqual([]);
    });

    it('título cancelado não entra', async () => {
      expect(await nfs([titulo('nota-1', ['5001'], { status: 'cancelada' })], { 5001: '9182' })).toEqual([]);
    });

    it('lote sem NF-e no apLIS não entra', async () => {
      expect(await nfs([titulo('nota-1', ['5001'])], {})).toEqual([]);
    });

    it('título sem lote não entra (nada a conferir no apLIS)', async () => {
      expect(await nfs([titulo('nota-1', [])], {})).toEqual([]);
    });

    it('multi-lote com a mesma NF-e em todos entra preenchível', async () => {
      // Caso real: lotes 4828 e 4898 saíram no mesmo RPS 9108 (NF-e 9124).
      expect(await nfs([titulo('nota-1', ['4828', '4898'])], { 4828: '9124', 4898: '9124' })).toEqual([
        {
          idNota: 'nota-1', idsLote: [4828, 4898], operadora: 'AMHP-DF',
          situacao: 'preenchivel', nfeNumeros: ['9124'],
        },
      ]);
    });

    it('multi-lote com NF-e diferentes vem divergente, listando as NF-e', async () => {
      expect(await nfs([titulo('nota-1', ['5001', '5002'])], { 5001: '9182', 5002: '9190' })).toEqual([
        {
          idNota: 'nota-1', idsLote: [5001, 5002], operadora: 'AMHP-DF',
          situacao: 'divergente', nfeNumeros: ['9182', '9190'],
        },
      ]);
    });

    it('multi-lote com um lote ainda sem NF-e não entra', async () => {
      expect(await nfs([titulo('nota-1', ['5001', '5002'])], { 5001: '9182' })).toEqual([]);
    });

    it('lote sem aplis_id (criado fora do apLIS) deixa o título de fora', async () => {
      const semAplis = { ...titulo('nota-1', ['5001']), nota_lote: [{ lotes: { aplis_id: '5001' } }, { lotes: { aplis_id: null } }] };
      expect(await nfs([semAplis], { 5001: '9182' })).toEqual([]);
    });

    it('sem títulos sem número não consulta o apLIS', async () => {
      expect(await nfs([], {})).toEqual([]);
      expect(nfesDosLotesMock).not.toHaveBeenCalled();
    });

    it('erro do apLIS na consulta das NF-e vira mensagem clara', async () => {
      getSupabaseAdminClientMock.mockReturnValue(criarSupabaseMock({ tabelas: { notas: [titulo('nota-1', ['5001'])] } }));
      listarLotesFechadosDesdeMock.mockResolvedValue({ lotes: [] });
      nfesDosLotesMock.mockResolvedValue({ erro: { status: 504, mensagem: 'timeout' } });
      const res = criarRes();
      await handler(criarReq(), res);

      expect(res.statusCode).toBe(504);
      expect(res.body.error).toMatch(/apLIS/);
      expect(res.body.error).toMatch(/tente novamente/i);
    });

    it('falha ao ler os títulos no Supabase devolve 502', async () => {
      const res = await executar({ erros: { notas: 'boom' } }, [lote()]);
      expect(res.statusCode).toBe(502);
      expect(res.body.success).toBe(false);
    });
  });
});
