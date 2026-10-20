import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

vi.mock('../_lib/supabase.js', () => ({
  getSupabaseAdminClient: vi.fn(() => ({})),
}));
vi.mock('../_lib/tussExames.js', () => ({
  isAdmissaoApiKeyValid: vi.fn(),
  buildTussExames: vi.fn(),
}));

import { isAdmissaoApiKeyValid, buildTussExames } from '../_lib/tussExames.js';
import handler from './tuss-exames.js';

const isAdmissaoApiKeyValidMock = isAdmissaoApiKeyValid as ReturnType<typeof vi.fn>;
const buildTussExamesMock = buildTussExames as ReturnType<typeof vi.fn>;

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

describe('GET /api/integracoes/tuss-exames', () => {
  it('método != GET devolve 405 sem chamar o Supabase', async () => {
    const res = criarRes();
    await handler(criarReq('POST'), res);

    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe('GET');
    expect(buildTussExamesMock).not.toHaveBeenCalled();
  });

  it('sem chave válida devolve 401 sem consultar o banco', async () => {
    isAdmissaoApiKeyValidMock.mockReturnValue(false);
    const res = criarRes();

    await handler(criarReq('GET', 'Bearer chave-errada'), res);

    expect(res.statusCode).toBe(401);
    expect(buildTussExamesMock).not.toHaveBeenCalled();
  });

  it('ADMISSAO_API_KEY não configurada (validador lança) devolve 500 genérico', async () => {
    isAdmissaoApiKeyValidMock.mockImplementation(() => {
      throw new Error('Variável de ambiente obrigatória ausente: ADMISSAO_API_KEY');
    });
    const res = criarRes();

    await handler(criarReq('GET', 'Bearer qualquer'), res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ success: false, error: 'Erro interno' });
    expect(buildTussExamesMock).not.toHaveBeenCalled();
  });

  it('chave válida devolve 200 com o payload, sem cache', async () => {
    isAdmissaoApiKeyValidMock.mockReturnValue(true);
    const payload = {
      exames: [{ id: 'e1', tuss: '40601285', aplis_id_exame_tipo: 30, aplis_id_teste: 101 }],
      fontes_pagadoras: [],
      exclusoes: [],
      gerado_em: '2026-10-20T12:00:00.000Z',
    };
    buildTussExamesMock.mockResolvedValue(payload);
    const res = criarRes();

    await handler(criarReq('GET', 'Bearer segredo-teste'), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(payload);
    expect(res.headers['Cache-Control']).toBe('no-store');
  });

  it('erro ao montar a resposta devolve 500 genérico', async () => {
    isAdmissaoApiKeyValidMock.mockReturnValue(true);
    buildTussExamesMock.mockRejectedValue(new Error('Falha ao ler custo_exames: permission denied'));
    const res = criarRes();

    await handler(criarReq('GET', 'Bearer segredo-teste'), res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ success: false, error: 'Erro interno' });
  });
});
