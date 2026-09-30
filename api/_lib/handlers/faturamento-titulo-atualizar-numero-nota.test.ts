import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

vi.mock('../supabase.js', () => ({
  getSupabaseUserClient: vi.fn(),
}));
vi.mock('../faturamento/autorizacao.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../faturamento/autorizacao.js')>()),
  autorizarFaturamento: vi.fn(),
}));

import { getSupabaseUserClient } from '../supabase.js';
import { autorizarFaturamento } from '../faturamento/autorizacao.js';
import handler from './faturamento-titulo-atualizar-numero-nota.js';

const getSupabaseUserClientMock = getSupabaseUserClient as ReturnType<typeof vi.fn>;
const autorizarFaturamentoMock = autorizarFaturamento as ReturnType<typeof vi.fn>;

interface Resposta {
  status: number;
  corpo: Record<string, unknown>;
}

function criarRes() {
  const resposta: Resposta = { status: 0, corpo: {} };
  const res = {
    setHeader: vi.fn(),
    status: vi.fn((codigo: number) => {
      resposta.status = codigo;
      return res;
    }),
    json: vi.fn((corpo: Record<string, unknown>) => {
      resposta.corpo = corpo;
      return res;
    }),
  };
  return { res: res as unknown as VercelResponse, resposta };
}

/** Prepara a RPC para devolver `data`/`erro` e expõe o mock para inspecionar a chamada. */
function prepararRpc(data: unknown, erro?: string) {
  const rpc = vi.fn(async () => (erro
    ? { data: null, error: { message: erro } }
    : { data, error: null }));
  getSupabaseUserClientMock.mockReturnValue({ rpc });
  autorizarFaturamentoMock.mockResolvedValue(null);
  return rpc;
}

async function chamar(body: Record<string, unknown>): Promise<Resposta> {
  const req = {
    method: 'POST',
    headers: { authorization: 'Bearer token-1' },
    body,
  } as unknown as VercelRequest;
  const { res, resposta } = criarRes();
  await handler(req, res);
  return resposta;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('titulo-atualizar-numero-nota', () => {
  it('sem somenteSeVazio, grava como a edição manual sempre fez', async () => {
    const rpc = prepararRpc('atualizado');

    const r = await chamar({ idNota: 'nota-1', numeroNota: ' 123 ' });

    expect(rpc).toHaveBeenCalledWith('fat_atualizar_numero_nota', {
      p_id_nota: 'nota-1',
      p_numero_nota: '123',
      p_somente_se_vazio: false,
    });
    expect(r.status).toBe(200);
    expect(r.corpo).toEqual({ success: true, resultado: 'atualizado' });
  });

  it('repassa somenteSeVazio à RPC', async () => {
    const rpc = prepararRpc('atualizado');

    const r = await chamar({ idNota: 'nota-1', numeroNota: '123', somenteSeVazio: true });

    expect(rpc).toHaveBeenCalledWith('fat_atualizar_numero_nota', {
      p_id_nota: 'nota-1',
      p_numero_nota: '123',
      p_somente_se_vazio: true,
    });
    expect(r.status).toBe(200);
    expect(r.corpo).toEqual({ success: true, resultado: 'atualizado' });
  });

  it('título já preenchido volta como sucesso com resultado "ja-preenchido", não como erro', async () => {
    prepararRpc('ja-preenchido');

    const r = await chamar({ idNota: 'nota-1', numeroNota: '123', somenteSeVazio: true });

    expect(r.status).toBe(200);
    expect(r.corpo).toEqual({ success: true, resultado: 'ja-preenchido' });
  });

  it('erro da RPC continua virando 400 com a mensagem do banco', async () => {
    prepararRpc(null, 'Título cancelado não aceita edição do número da nota.');

    const r = await chamar({ idNota: 'nota-1', numeroNota: '123', somenteSeVazio: true });

    expect(r.status).toBe(400);
    expect(r.corpo).toEqual({
      success: false,
      error: 'Título cancelado não aceita edição do número da nota.',
    });
  });

  it('retorno inesperado da RPC não vira sucesso', async () => {
    prepararRpc(null);

    const r = await chamar({ idNota: 'nota-1', numeroNota: '123' });

    expect(r.status).toBe(500);
    expect(r.corpo.success).toBe(false);
  });

  it('recusa somenteSeVazio que não seja booleano', async () => {
    const rpc = prepararRpc('atualizado');

    const r = await chamar({ idNota: 'nota-1', numeroNota: '123', somenteSeVazio: 'sim' });

    expect(r.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('sem permissão, devolve a falha da autorização sem chamar a RPC', async () => {
    const rpc = prepararRpc('atualizado');
    autorizarFaturamentoMock.mockResolvedValue({
      status: 403,
      payload: { success: false, error: 'Sem permissão para gerenciar contas a receber.' },
    });

    const r = await chamar({ idNota: 'nota-1', numeroNota: '123' });

    expect(r.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });
});
