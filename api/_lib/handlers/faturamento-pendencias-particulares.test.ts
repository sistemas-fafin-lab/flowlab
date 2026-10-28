import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

vi.mock('../supabase.js', () => ({
  getSupabaseAdminClient: vi.fn(),
  getSupabaseUserClient: vi.fn(),
}));
vi.mock('../faturamento/bdLab.js', () => ({
  listarParticularesPendentes: vi.fn(),
  MAX_TAMANHO: 200,
  TAMANHO_PADRAO: 50,
}));

import { getSupabaseAdminClient, getSupabaseUserClient } from '../supabase.js';
import { listarParticularesPendentes } from '../faturamento/bdLab.js';
import { limparCacheClinicasSemNf } from '../faturamento/clinicasSemNf.js';
import handler from './faturamento-pendencias-particulares.js';

const getSupabaseAdminClientMock = getSupabaseAdminClient as ReturnType<typeof vi.fn>;
const getSupabaseUserClientMock = getSupabaseUserClient as ReturnType<typeof vi.fn>;
const listarParticularesPendentesMock = listarParticularesPendentes as ReturnType<typeof vi.fn>;

type Linha = Record<string, unknown>;

interface CorpoResposta {
  success: boolean;
  error?: string;
  meta?: Record<string, unknown>;
  requisicoes?: Record<string, unknown>[];
}

interface Cenario {
  permissoes?: string[];
  /** Linhas de `clinicas_sem_nf` lidas com o cliente do usuário. */
  clinicasSemNf?: Linha[];
  erroClinicasSemNf?: string;
}

// Query builder mínimo do supabase-js: select/eq encadeáveis, single() e `await`.
function consulta(linhas: Linha[], erro?: string) {
  let resultado = [...linhas];
  const builder = {
    select: () => builder,
    eq: (coluna: string, valor: unknown) => {
      resultado = resultado.filter((l) => l[coluna] === valor);
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

function prepararSupabase(cenario: Cenario) {
  const permissoes = cenario.permissoes ?? ['canViewBilling'];
  getSupabaseAdminClientMock.mockReturnValue({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })) },
    from: vi.fn((tabela: string) => {
      if (tabela !== 'user_profiles') throw new Error(`tabela inesperada no cliente admin: ${tabela}`);
      return consulta([{ id: 'user-1', custom_roles: { permissions: permissoes } }]);
    }),
  });
  getSupabaseUserClientMock.mockReturnValue({
    from: vi.fn((tabela: string) => {
      if (tabela !== 'clinicas_sem_nf') throw new Error(`tabela inesperada no cliente do usuário: ${tabela}`);
      return consulta(cenario.clinicasSemNf ?? [], cenario.erroClinicasSemNf);
    }),
  });
}

const RESULTADO_VAZIO = {
  requisicoes: [],
  meta: { pagina: 1, tamanho: 50, qtdPaginas: 0, registros: 0, valorTotal: 0, limite: '2026-10-19' },
};

function criarReq(query: Record<string, string> = {}): VercelRequest {
  return {
    method: 'GET',
    headers: { authorization: 'Bearer token-teste' },
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
      this.body = payload as CorpoResposta;
      return this;
    },
  };
  return res as unknown as VercelResponse & typeof res;
}

async function executar(cenario: Cenario, query?: Record<string, string>) {
  prepararSupabase(cenario);
  listarParticularesPendentesMock.mockResolvedValue(RESULTADO_VAZIO);
  const res = criarRes();
  await handler(criarReq(query), res);
  return res;
}

const QUATRO_CLINICAS = [
  { aplis_id: 1155, nome: 'ABAC' },
  { aplis_id: 1290, nome: 'NEXUS' },
  { aplis_id: 1014, nome: 'MATER CLINICA' },
  { aplis_id: 1222, nome: 'ECOMED' },
];

afterEach(() => {
  vi.clearAllMocks();
  limparCacheClinicasSemNf();
});

describe('GET /api/faturamento/pendencias-particulares', () => {
  describe('clínicas sem NF', () => {
    it('repassa à consulta os locais de origem marcados no Supabase, excluindo-os por padrão', async () => {
      const res = await executar({ clinicasSemNf: QUATRO_CLINICAS });

      expect(res.statusCode).toBe(200);
      expect(listarParticularesPendentesMock).toHaveBeenCalledWith(expect.objectContaining({
        idsClinicasSemNf: [1014, 1155, 1222, 1290],
        incluirSemNf: false,
      }));
    });

    it('com incluirSemNf=1 pede à consulta que traga também as clínicas sem NF', async () => {
      await executar({ clinicasSemNf: QUATRO_CLINICAS }, { incluirSemNf: '1' });

      expect(listarParticularesPendentesMock).toHaveBeenCalledWith(expect.objectContaining({
        idsClinicasSemNf: [1014, 1155, 1222, 1290],
        incluirSemNf: true,
      }));
    });

    it('devolve as requisições como a consulta as montou, com clínica e marca de sem NF', async () => {
      prepararSupabase({ clinicasSemNf: QUATRO_CLINICAS });
      const requisicao = {
        idRequisicao: 1, codRequisicao: '0042', dtaSolicitacao: '2026-10-05', dtaFinalizacao: null,
        paciente: 'FULANO', valor: 120, codEvento: 1, eventoLabel: 'Cadastrada', idLote: null,
        localOrigem: { id: 1155, nome: 'ABAC' }, clinicaSemNf: true,
      };
      listarParticularesPendentesMock.mockResolvedValue({ ...RESULTADO_VAZIO, requisicoes: [requisicao] });
      const res = criarRes();
      await handler(criarReq({ incluirSemNf: '1' }), res);

      expect(res.statusCode).toBe(200);
      expect(res.headers['Cache-Control']).toBe('no-store');
      expect(res.body?.requisicoes).toEqual([requisicao]);
    });

    it('lista vazia no Supabase não exclui ninguém', async () => {
      await executar({ clinicasSemNf: [] });

      expect(listarParticularesPendentesMock).toHaveBeenCalledWith(expect.objectContaining({
        idsClinicasSemNf: [],
      }));
    });

    it('falha ao ler a lista no Supabase devolve erro claro e não consulta o apLIS sem o filtro', async () => {
      const res = await executar({ erroClinicasSemNf: 'permission denied for table clinicas_sem_nf' });

      expect(res.statusCode).toBe(502);
      expect(res.body?.success).toBe(false);
      expect(res.body?.error).toMatch(/clínicas sem NF/);
      expect(listarParticularesPendentesMock).not.toHaveBeenCalled();
    });

    it('lê a lista com o cliente do usuário, não com o admin', async () => {
      await executar({ clinicasSemNf: QUATRO_CLINICAS });
      expect(getSupabaseUserClientMock).toHaveBeenCalledWith('token-teste');
    });
  });

  it('sem permissão de faturamento devolve 403 sem ler a lista nem o apLIS', async () => {
    const res = await executar({ permissoes: [] });

    expect(res.statusCode).toBe(403);
    expect(getSupabaseUserClientMock).not.toHaveBeenCalled();
    expect(listarParticularesPendentesMock).not.toHaveBeenCalled();
  });

  describe('permissão por tela (ADR 0001): a rota serve Contas a Receber', () => {
    it.each([['canViewBilling'], ['canManageBilling'], ['canViewContasReceber']])('%s basta', async (chave) => {
      const res = await executar({ permissoes: [chave] });
      expect(res.statusCode).toBe(200);
    });

    it.each([['canViewFaturas'], ['canViewGlosas'], ['canViewIndicadores'], ['canViewCalendarioEnvios']])(
      'só %s devolve 403',
      async (chave) => {
        const res = await executar({ permissoes: [chave] });
        expect(res.statusCode).toBe(403);
        expect(listarParticularesPendentesMock).not.toHaveBeenCalled();
      },
    );
  });

  it.each([
    ['desde fora do formato', { desde: '01/10/2026' }],
    ['tamanho acima do máximo', { tamanho: '500' }],
  ])('%s devolve 400 sem consultar o apLIS', async (_caso, query) => {
    const res = await executar({}, query);

    expect(res.statusCode).toBe(400);
    expect(listarParticularesPendentesMock).not.toHaveBeenCalled();
  });
});
