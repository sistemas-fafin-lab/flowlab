import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Supabase falso: grava cada consulta encadeada e devolve o que o teste mandar.
interface Consulta {
  tabela: string;
  chamadas: Array<[string, unknown[]]>;
}
const estado = {
  consultas: [] as Consulta[],
  respostas: {} as Record<string, { data: unknown; error: unknown }>,
  rpc: vi.fn(),
};

function criarConsulta(tabela: string) {
  const consulta: Consulta = { tabela, chamadas: [] };
  estado.consultas.push(consulta);
  const resposta = () => estado.respostas[tabela] ?? { data: [], error: null };
  const builder: Record<string, unknown> = {};
  for (const metodo of ['select', 'eq', 'gte', 'lt', 'order', 'limit', 'range', 'returns']) {
    builder[metodo] = (...args: unknown[]) => {
      consulta.chamadas.push([metodo, args]);
      return builder;
    };
  }
  builder.maybeSingle = () => Promise.resolve(resposta());
  builder.then = (ok: (v: unknown) => unknown, falha: (e: unknown) => unknown) =>
    Promise.resolve(resposta()).then(ok, falha);
  return builder;
}

vi.mock('./supabase.js', () => ({
  getSupabaseAdminClient: () => ({ from: criarConsulta, rpc: estado.rpc }),
}));

import { criarHandlerLabBrainApoio, parseParametros } from './labBrainApoio.js';

const CHAVE = 'segredo-lab-brain';

function criarReq(query: Record<string, string> = {}, opcoes: { method?: string; auth?: string | null } = {}) {
  const auth = opcoes.auth === undefined ? `Bearer ${CHAVE}` : opcoes.auth;
  return {
    method: opcoes.method ?? 'GET',
    headers: auth ? { authorization: auth } : {},
    query,
  } as unknown as VercelRequest;
}

function criarRes() {
  const res = {
    statusCode: undefined as number | undefined,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    setHeader(chave: string, valor: string) {
      this.headers[chave] = valor;
      return this;
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

const requisicao = criarHandlerLabBrainApoio('requisicao');
const fila = criarHandlerLabBrainApoio('fila');
const exames = criarHandlerLabBrainApoio('exames');

beforeEach(() => {
  process.env.LAB_BRAIN_API_KEY = CHAVE;
  estado.consultas = [];
  estado.respostas = {};
  estado.rpc.mockResolvedValue({ data: [{ permitido: true, retry_after: 0 }], error: null });
});

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.LAB_BRAIN_API_KEY;
});

describe('autenticação, cota e auditoria', () => {
  it('método != GET devolve 405 sem tocar o banco', async () => {
    const res = criarRes();
    await exames(criarReq({}, { method: 'POST' }), res);
    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe('GET');
    expect(estado.rpc).not.toHaveBeenCalled();
  });

  it('chave errada ou ausente devolve 401 sem consumir cota', async () => {
    for (const auth of ['Bearer outra', null]) {
      const res = criarRes();
      await exames(criarReq({}, { auth }), res);
      expect(res.statusCode).toBe(401);
    }
    expect(estado.rpc).not.toHaveBeenCalled();
  });

  it('LAB_BRAIN_API_KEY não configurada devolve 500 genérico', async () => {
    delete process.env.LAB_BRAIN_API_KEY;
    const res = criarRes();
    await exames(criarReq(), res);
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ success: false, error: 'Erro interno' });
  });

  it('parâmetro inválido devolve 400 sem consumir cota', async () => {
    const res = criarRes();
    await requisicao(criarReq({ cod: "1'; drop" }), res);
    expect(res.statusCode).toBe(400);
    expect(estado.rpc).not.toHaveBeenCalled();
  });

  it('registra a chamada com rota, parâmetros e limite de 120 por minuto', async () => {
    estado.respostas.ac_apoio_requisicoes = { data: { codigo_lis: '123' }, error: null };
    await requisicao(criarReq({ cod: '123' }), criarRes());
    expect(estado.rpc).toHaveBeenCalledWith('integracao_registrar_chamada', {
      p_integracao: 'lab-brain',
      p_rota: 'lab-brain-apoio-requisicao',
      p_parametros: { cod: '123' },
      p_limite: 120,
      p_janela_segundos: 60,
    });
  });

  it('sem cota devolve 429 com Retry-After e não consulta as tabelas', async () => {
    estado.rpc.mockResolvedValue({ data: [{ permitido: false, retry_after: 17 }], error: null });
    const res = criarRes();
    await exames(criarReq(), res);
    expect(res.statusCode).toBe(429);
    expect(res.headers['Retry-After']).toBe('17');
    expect(estado.consultas).toHaveLength(0);
  });

  it('falha ao registrar a auditoria devolve 500 e não consulta as tabelas', async () => {
    estado.rpc.mockResolvedValue({ data: null, error: { message: 'function does not exist' } });
    const res = criarRes();
    await exames(criarReq(), res);
    expect(res.statusCode).toBe(500);
    expect(estado.consultas).toHaveLength(0);
  });
});

describe('GET lab-brain-apoio-requisicao', () => {
  it('junta o vínculo com o Álvaro e os itens da fila', async () => {
    estado.respostas.ac_apoio_requisicoes = { data: { codigo_lis: '0085', codigo_os: 'OS9' }, error: null };
    estado.respostas.ac_apoio_fila = { data: [{ id: 'f1', status: 'enviado' }], error: null };
    const res = criarRes();

    await requisicao(criarReq({ cod: '0085' }), res);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(res.body).toEqual({
      cod_requisicao: '0085',
      enviada_alvaro: true,
      requisicao: { codigo_lis: '0085', codigo_os: 'OS9' },
      fila: [{ id: 'f1', status: 'enviado' }],
    });
  });

  it('nunca pede xml_envio, alvaro_response nem filename', async () => {
    estado.respostas.ac_apoio_requisicoes = { data: { codigo_lis: '1' }, error: null };
    await requisicao(criarReq({ cod: '1' }), criarRes());
    const selects = estado.consultas.flatMap((c) =>
      c.chamadas.filter(([m]) => m === 'select').map(([, a]) => String(a[0])),
    );
    for (const s of selects) expect(s).not.toMatch(/xml_envio|alvaro_response|filename/);
  });

  it('só na fila (ainda não enviada) devolve enviada_alvaro false', async () => {
    estado.respostas.ac_apoio_requisicoes = { data: null, error: null };
    estado.respostas.ac_apoio_fila = { data: [{ id: 'f1', status: 'aguardando' }], error: null };
    const res = criarRes();
    await requisicao(criarReq({ cod: '77' }), res);
    expect(res.statusCode).toBe(200);
    expect((res.body as { enviada_alvaro: boolean }).enviada_alvaro).toBe(false);
  });

  it('ausente nas duas tabelas devolve 404', async () => {
    estado.respostas.ac_apoio_requisicoes = { data: null, error: null };
    const res = criarRes();
    await requisicao(criarReq({ cod: '999' }), res);
    expect(res.statusCode).toBe(404);
  });

  it('erro do banco devolve 500 genérico', async () => {
    estado.respostas.ac_apoio_requisicoes = { data: null, error: { message: 'permission denied' } };
    const res = criarRes();
    await requisicao(criarReq({ cod: '1' }), res);
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ success: false, error: 'Erro interno' });
  });
});

describe('GET lab-brain-apoio-fila', () => {
  it('aplica status e o período no fuso do laboratório (-03:00)', async () => {
    await fila(criarReq({ status: 'erro', desde: '2026-11-01', ate: '2026-11-05' }), criarRes());
    const chamadas = estado.consultas[0].chamadas;
    expect(chamadas).toContainEqual(['eq', ['status', 'erro']]);
    expect(chamadas).toContainEqual(['gte', ['updated_at', '2026-11-01T03:00:00.000Z']]);
    expect(chamadas).toContainEqual(['lt', ['updated_at', '2026-11-06T03:00:00.000Z']]);
  });

  it('pagina pedindo um item a mais para calcular tem_mais', async () => {
    estado.respostas.ac_apoio_fila = { data: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], error: null };
    const res = criarRes();
    await fila(criarReq({ limite: '2', pagina: '3' }), res);
    expect(estado.consultas[0].chamadas).toContainEqual(['range', [4, 6]]);
    expect(res.body).toEqual({ itens: [{ id: 'a' }, { id: 'b' }], pagina: 3, limite: 2, tem_mais: true });
  });
});

describe('GET lab-brain-apoio-exames', () => {
  it('devolve o catálogo sem preço', async () => {
    estado.respostas.ac_apoio_exames = { data: [{ cod_exame: 'TSH' }], error: null };
    const res = criarRes();
    await exames(criarReq(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ exames: [{ cod_exame: 'TSH' }] });
    const select = estado.consultas[0].chamadas.find(([m]) => m === 'select');
    expect(String(select?.[1][0])).not.toMatch(/preco/);
  });
});

describe('parseParametros da fila', () => {
  it.each([
    [{ status: 'cancelado' }],
    [{ desde: '06/11/2026' }],
    [{ desde: '2026-02-30' }],
    [{ desde: '2026-11-05', ate: '2026-11-01' }],
    [{ limite: '0' }],
    [{ limite: '201' }],
    [{ pagina: 'x' }],
  ])('rejeita %o', (query) => {
    expect(parseParametros('fila', query).ok).toBe(false);
  });

  it('usa limite 50 e página 1 por padrão', () => {
    expect(parseParametros('fila', {})).toEqual({
      ok: true,
      valor: { recurso: 'fila', filtros: { status: null, desde: null, ate: null, limite: 50, pagina: 1 } },
    });
  });
});
