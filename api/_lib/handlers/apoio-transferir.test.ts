import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

vi.mock('../supabase.js', () => ({
  getSupabaseAdminClient: vi.fn(),
}));
vi.mock('../recepcaoAgendamento.js', () => ({
  autorizarOperador: vi.fn(async () => null),
}));
vi.mock('../apoio/aol.js', () => ({
  enviarSolicitacaoAol: vi.fn(),
}));

import { getSupabaseAdminClient } from '../supabase.js';
import { autorizarOperador } from '../recepcaoAgendamento.js';
import { enviarSolicitacaoAol } from '../apoio/aol.js';
import handler from './apoio-transferir.js';

const autorizarOperadorMock = autorizarOperador as ReturnType<typeof vi.fn>;
const enviarSolicitacaoAolMock = enviarSolicitacaoAol as ReturnType<typeof vi.fn>;
const getSupabaseAdminClientMock = getSupabaseAdminClient as ReturnType<typeof vi.fn>;

interface FilaRow {
  id: string;
  status: string;
  numero_requisicao: string | null;
  paciente: Record<string, unknown> | null;
  xml_envio: string | null;
  created_at: string;
  updated_at: string;
}

function linhaFila(overrides: Partial<FilaRow> = {}): FilaRow {
  return {
    id: 'item-1',
    status: 'aguardando',
    numero_requisicao: 'REQ-1',
    paciente: { nome: 'JOAO', datanasc: '1990-01-01' },
    xml_envio: '<solicitacoes senha="__ENV__"/>',
    created_at: '2026-08-27T10:00:00+00:00',
    updated_at: '2026-08-27T10:00:00+00:00',
    ...overrides,
  };
}

function criarSupabaseMock(linhasPorId: Record<string, FilaRow | undefined>) {
  const filaUpdates: { id: string; payload: Record<string, unknown> }[] = [];
  const upsertMock = vi.fn(async () => ({ error: null }));

  const from = vi.fn((tabela: string) => {
    if (tabela === 'ac_apoio_fila') {
      return {
        select: () => ({
          eq: (_col: string, id: string) => ({
            limit: async () => {
              const linha = linhasPorId[id];
              return { data: linha ? [linha] : [], error: null };
            },
          }),
        }),
        update: (payload: Record<string, unknown>) => ({
          eq: async (_col: string, id: string) => {
            filaUpdates.push({ id, payload });
            return { error: null };
          },
        }),
      };
    }
    if (tabela === 'ac_apoio_requisicoes') {
      return { upsert: upsertMock };
    }
    throw new Error(`tabela inesperada no mock: ${tabela}`);
  });

  return { from, filaUpdates, upsertMock };
}

function criarReq(ids: unknown): VercelRequest {
  return {
    method: 'POST',
    headers: { authorization: 'Bearer token-teste' },
    body: { ids },
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

const respostaSucesso = '<solicitacoes><solicitacao idLis="REQ-1" incluido="true" idAlvaro="OS-999"/></solicitacoes>';
const respostaReprovada = '<solicitacoes><solicitacao idLis="REQ-1" incluido="false" informacao="dado invalido"/></solicitacoes>';

afterEach(() => {
  vi.clearAllMocks();
  autorizarOperadorMock.mockResolvedValue(null);
});

describe('POST /api/analises-clinicas/apoio-transferir', () => {
  it('sem ids no body devolve 400 sem tocar o Supabase', async () => {
    const res = criarRes();
    await handler(criarReq(undefined), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ success: false, error: "Informe 'ids' com os itens da fila a enviar." });
    expect(getSupabaseAdminClientMock).not.toHaveBeenCalled();
  });

  it('ids array vazio devolve 400 sem tocar o Supabase', async () => {
    const res = criarRes();
    await handler(criarReq([]), res);

    expect(res.statusCode).toBe(400);
    expect(getSupabaseAdminClientMock).not.toHaveBeenCalled();
  });

  it('ids com item não-string devolve 400 sem tocar o Supabase', async () => {
    const res = criarRes();
    await handler(criarReq(['item-1', 42]), res);

    expect(res.statusCode).toBe(400);
    expect(getSupabaseAdminClientMock).not.toHaveBeenCalled();
  });

  it('item não encontrado na fila devolve ok:false com "Registro não encontrado"', async () => {
    const supabase = criarSupabaseMock({});
    getSupabaseAdminClientMock.mockReturnValue(supabase);
    const res = criarRes();

    await handler(criarReq(['item-inexistente']), res);

    expect(res.statusCode).toBe(200);
    expect((res.body as any).resultados).toEqual([
      { id: 'item-inexistente', ok: false, erro: 'Registro não encontrado' },
    ]);
    expect(enviarSolicitacaoAolMock).not.toHaveBeenCalled();
  });

  it('status atual não permite envio: retorna erro sem chamar enviarSolicitacaoAol', async () => {
    const linha = linhaFila({ status: 'enviado' });
    const supabase = criarSupabaseMock({ [linha.id]: linha });
    getSupabaseAdminClientMock.mockReturnValue(supabase);
    const res = criarRes();

    await handler(criarReq([linha.id]), res);

    expect((res.body as any).resultados).toEqual([
      { id: linha.id, ok: false, erro: 'Status atual não permite envio: enviado' },
    ]);
    expect(enviarSolicitacaoAolMock).not.toHaveBeenCalled();
  });

  it('item sem xml_envio: retorna erro sem chamar enviarSolicitacaoAol', async () => {
    const linha = linhaFila({ xml_envio: null });
    const supabase = criarSupabaseMock({ [linha.id]: linha });
    getSupabaseAdminClientMock.mockReturnValue(supabase);
    const res = criarRes();

    await handler(criarReq([linha.id]), res);

    expect((res.body as any).resultados).toEqual([
      { id: linha.id, ok: false, erro: 'Item sem XML de envio' },
    ]);
    expect(enviarSolicitacaoAolMock).not.toHaveBeenCalled();
  });

  it('envio com sucesso: fila vira enviado e persistirRequisicaoEnviada é chamado (requisicoes_salvo: true)', async () => {
    const linha = linhaFila();
    const supabase = criarSupabaseMock({ [linha.id]: linha });
    getSupabaseAdminClientMock.mockReturnValue(supabase);
    enviarSolicitacaoAolMock.mockResolvedValue({ httpStatus: 200, texto: respostaSucesso });
    const res = criarRes();

    await handler(criarReq([linha.id]), res);

    expect((res.body as any).resultados).toEqual([
      {
        id: linha.id,
        ok: true,
        http_status: 200,
        alvaro_response: respostaSucesso,
        requisicoes_salvo: true,
      },
    ]);
    const updateFinal = supabase.filaUpdates.at(-1);
    expect(updateFinal?.payload).toMatchObject({ status: 'enviado', erro_mensagem: null });
    expect(supabase.upsertMock).toHaveBeenCalledTimes(1);
    const [upsertPayload] = supabase.upsertMock.mock.calls[0];
    expect(upsertPayload).toMatchObject({ codigo_lis: 'REQ-1', codigo_os: 'OS-999' });
  });

  it('envio com sucesso HTTP mas avaliarRespostaAol reprova: fila vira erro e não chama persistirRequisicaoEnviada', async () => {
    const linha = linhaFila();
    const supabase = criarSupabaseMock({ [linha.id]: linha });
    getSupabaseAdminClientMock.mockReturnValue(supabase);
    enviarSolicitacaoAolMock.mockResolvedValue({ httpStatus: 200, texto: respostaReprovada });
    const res = criarRes();

    await handler(criarReq([linha.id]), res);

    const resultado = (res.body as any).resultados[0];
    expect(resultado.ok).toBe(false);
    expect(resultado.erro).toBe('Solicitacao REQ-1: dado invalido');
    const updateFinal = supabase.filaUpdates.at(-1);
    expect(updateFinal?.payload.status).toBe('erro');
    expect(supabase.upsertMock).not.toHaveBeenCalled();
  });

  it('enviarSolicitacaoAol falha (rede/timeout): fila vira erro com a mensagem', async () => {
    const linha = linhaFila();
    const supabase = criarSupabaseMock({ [linha.id]: linha });
    getSupabaseAdminClientMock.mockReturnValue(supabase);
    enviarSolicitacaoAolMock.mockRejectedValue(new Error('timeout de rede'));
    const res = criarRes();

    await handler(criarReq([linha.id]), res);

    expect((res.body as any).resultados).toEqual([
      { id: linha.id, ok: false, erro: 'timeout de rede' },
    ]);
    const updateFinal = supabase.filaUpdates.at(-1);
    expect(updateFinal?.payload).toEqual({ status: 'erro', erro_mensagem: 'timeout de rede' });
    expect(supabase.upsertMock).not.toHaveBeenCalled();
  });

  it('sucesso no envio mas persistirRequisicaoEnviada falha: fila continua enviado, requisicoes_salvo:false + requisicoes_erro', async () => {
    const linha = linhaFila();
    const supabase = criarSupabaseMock({ [linha.id]: linha });
    getSupabaseAdminClientMock.mockReturnValue(supabase);
    // sucesso HTTP e regra de negócio, mas sem idAlvaro na resposta -> extrairIdAlvaro devolve '' -> persistirRequisicaoEnviada lança
    const respostaSemIdAlvaro = '<solicitacoes><solicitacao idLis="REQ-1" incluido="true"/></solicitacoes>';
    enviarSolicitacaoAolMock.mockResolvedValue({ httpStatus: 200, texto: respostaSemIdAlvaro });
    const res = criarRes();

    await handler(criarReq([linha.id]), res);

    const resultado = (res.body as any).resultados[0];
    expect(resultado.ok).toBe(true);
    expect(resultado.requisicoes_salvo).toBe(false);
    expect(resultado.requisicoes_erro).toContain('idAlvaro');
    const updateFinal = supabase.filaUpdates.at(-1);
    expect(updateFinal?.payload.status).toBe('enviado');
  });

  it('múltiplos ids: um item falhando não interrompe os outros', async () => {
    const linhaFalha = linhaFila({ id: 'item-falha' });
    const linhaOk = linhaFila({ id: 'item-ok' });
    const supabase = criarSupabaseMock({ [linhaFalha.id]: linhaFalha, [linhaOk.id]: linhaOk });
    getSupabaseAdminClientMock.mockReturnValue(supabase);
    enviarSolicitacaoAolMock.mockImplementation(async () => {
      if (enviarSolicitacaoAolMock.mock.calls.length === 1) {
        throw new Error('falha na primeira chamada');
      }
      return { httpStatus: 200, texto: respostaSucesso };
    });
    const res = criarRes();

    await handler(criarReq([linhaFalha.id, linhaOk.id]), res);

    const resultados = (res.body as any).resultados;
    expect(resultados).toHaveLength(2);
    expect(resultados[0]).toEqual({ id: 'item-falha', ok: false, erro: 'falha na primeira chamada' });
    expect(resultados[1].id).toBe('item-ok');
    expect(resultados[1].ok).toBe(true);
    expect(enviarSolicitacaoAolMock).toHaveBeenCalledTimes(2);
  });
});
