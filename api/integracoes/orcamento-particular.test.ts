import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

vi.mock('../_lib/supabase.js', () => ({
  getSupabaseAdminClient: vi.fn(() => ({})),
}));
vi.mock('../_lib/orcamentoParticular.js', () => ({
  isTabelaParticularApiKeyValid: vi.fn(),
  buildOrcamentoParticular: vi.fn(),
}));

import { isTabelaParticularApiKeyValid, buildOrcamentoParticular } from '../_lib/orcamentoParticular.js';
import handler from './orcamento-particular.js';

const isTabelaParticularApiKeyValidMock = isTabelaParticularApiKeyValid as ReturnType<typeof vi.fn>;
const buildOrcamentoParticularMock = buildOrcamentoParticular as ReturnType<typeof vi.fn>;

function criarReq(method: string, authorization?: string): VercelRequest {
  return {
    method,
    headers: authorization ? { authorization } : {},
  } as unknown as VercelRequest;
}

function criarRes() {
  const res = {
    statusCode: undefined as number | undefined,
    body: undefined as unknown,
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

afterEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/integracoes/orcamento-particular', () => {
  it('método != GET devolve 405 sem chamar o Supabase', async () => {
    const res = criarRes();
    await handler(criarReq('POST'), res);

    expect(res.statusCode).toBe(405);
    expect(buildOrcamentoParticularMock).not.toHaveBeenCalled();
  });

  it('sem chave válida devolve 401 sem consultar o banco', async () => {
    isTabelaParticularApiKeyValidMock.mockReturnValue(false);
    const res = criarRes();

    await handler(criarReq('GET', 'Bearer chave-errada'), res);

    expect(res.statusCode).toBe(401);
    expect(buildOrcamentoParticularMock).not.toHaveBeenCalled();
  });

  it('TABELA_PARTICULAR_API_KEY não configurada (validador lança) devolve 500', async () => {
    isTabelaParticularApiKeyValidMock.mockImplementation(() => {
      throw new Error('Variável de ambiente obrigatória ausente: TABELA_PARTICULAR_API_KEY');
    });
    const res = criarRes();

    await handler(criarReq('GET', 'Bearer qualquer'), res);

    expect(res.statusCode).toBe(500);
    expect(buildOrcamentoParticularMock).not.toHaveBeenCalled();
  });

  it('chave válida devolve 200 com o array de itens', async () => {
    isTabelaParticularApiKeyValidMock.mockReturnValue(true);
    const itens = [
      {
        tuss: '40301060',
        nome: 'Hemograma',
        preco: 100,
        custo: 15,
        elegivelDescontoParticular: true,
        conveniosAceitos: ['Convênio A'],
      },
    ];
    buildOrcamentoParticularMock.mockResolvedValue(itens);
    const res = criarRes();

    await handler(criarReq('GET', 'Bearer segredo-teste'), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(itens);
  });

  it('erro ao montar a resposta devolve 500', async () => {
    isTabelaParticularApiKeyValidMock.mockReturnValue(true);
    buildOrcamentoParticularMock.mockRejectedValue(new Error('Falha ao ler custo_exames'));
    const res = criarRes();

    await handler(criarReq('GET', 'Bearer segredo-teste'), res);

    expect(res.statusCode).toBe(500);
  });
});
