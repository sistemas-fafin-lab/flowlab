import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

vi.mock('../supabase.js', () => ({
  getSupabaseAdminClient: vi.fn(),
}));
vi.mock('../faturamento/bdLab.js', () => ({
  glosasRecursosDoPeriodo: vi.fn(),
}));

import { getSupabaseAdminClient } from '../supabase.js';
import { glosasRecursosDoPeriodo } from '../faturamento/bdLab.js';
import handler from './faturamento-glosas-recursos-cron.js';

const getSupabaseAdminClientMock = getSupabaseAdminClient as ReturnType<typeof vi.fn>;
const glosasRecursosDoPeriodoMock = glosasRecursosDoPeriodo as ReturnType<typeof vi.fn>;

type Linha = Record<string, unknown>;

interface CorpoResposta {
  success: boolean;
  error?: string;
  meses: { competencia: string; ok: boolean; requisicoes?: number; lotes?: number; erro?: string }[];
  pulados: string[];
}

// Query builder mínimo do supabase-js: select/eq/in/is encadeáveis, `insert` registrado.
function mockarSupabase(sincronizacoes: Linha[] = []): Record<string, Linha[]> {
  const inserts: Record<string, Linha[]> = {};
  const tabelas: Record<string, Linha[]> = { glosa_recurso_sincronizacoes: sincronizacoes };
  const consulta = (tabela: string) => {
    let resultado = [...(tabelas[tabela] ?? [])];
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
      is: (coluna: string, valor: unknown) => {
        resultado = resultado.filter((l) => l[coluna] === valor);
        return builder;
      },
      upsert: () => builder,
      insert: (nova: Linha | Linha[]) => {
        (inserts[tabela] ??= []).push(...(Array.isArray(nova) ? nova : [nova]));
        resultado = [];
        return builder;
      },
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve({ data: resultado, error: null }).then(resolve, reject),
    };
    return builder;
  };
  getSupabaseAdminClientMock.mockReturnValue({ from: vi.fn(consulta) });
  return inserts;
}

function semGlosas(dadoAte = '2026-03-14') {
  return { requisicoes: [], lotesRecurso: [], dadoAte };
}

function criarReq(autorizacao?: string): VercelRequest {
  return {
    method: 'GET',
    headers: autorizacao ? { authorization: autorizacao } : {},
    query: {},
  } as unknown as VercelRequest;
}

function criarRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    setHeader(nome: string, valor: string) {
      this.headers[nome] = valor;
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  return res;
}

async function chamar(autorizacao: string | undefined = 'Bearer segredo-cron') {
  const res = criarRes();
  await handler(criarReq(autorizacao), res as unknown as VercelResponse);
  return { status: res.statusCode, corpo: res.body as CorpoResposta };
}

describe('GET /api/faturamento/glosas-recursos-cron', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', 'segredo-cron');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-15T09:00:00Z'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
    vi.restoreAllMocks();
    getSupabaseAdminClientMock.mockReset();
    glosasRecursosDoPeriodoMock.mockReset();
  });

  it('sem o segredo do cron devolve 401 sem consultar o apLIS', async () => {
    mockarSupabase();
    const { status } = await chamar('Bearer outro');
    expect(status).toBe(401);
    expect(glosasRecursosDoPeriodoMock).not.toHaveBeenCalled();
  });

  it('sincroniza cada mês de 2026 até o atual, do mais recente para o mais antigo, com todos os convênios', async () => {
    const inserts = mockarSupabase();
    glosasRecursosDoPeriodoMock.mockResolvedValue(semGlosas());

    const { status, corpo } = await chamar();

    expect(status).toBe(200);
    expect(glosasRecursosDoPeriodoMock.mock.calls.map(([recorte]) => recorte)).toEqual([
      { competencia: '2026-03', fontePagadoraId: undefined },
      { competencia: '2026-02', fontePagadoraId: undefined },
      { competencia: '2026-01', fontePagadoraId: undefined },
    ]);
    expect(inserts.glosa_recurso_sincronizacoes).toEqual([
      expect.objectContaining({ competencia: '2026-03', id_fonte_pagadora: null, sincronizado_por: null, dado_ate: '2026-03-14' }),
      expect.objectContaining({ competencia: '2026-02', id_fonte_pagadora: null, sincronizado_por: null }),
      expect.objectContaining({ competencia: '2026-01', id_fonte_pagadora: null, sincronizado_por: null }),
    ]);
    expect(corpo.success).toBe(true);
    expect(corpo.meses.map((m) => [m.competencia, m.ok])).toEqual([
      ['2026-03', true],
      ['2026-02', true],
      ['2026-01', true],
    ]);
    expect(corpo.pulados).toEqual([]);
  });

  it('falha num mês não impede os outros e fica no log', async () => {
    const inserts = mockarSupabase();
    glosasRecursosDoPeriodoMock.mockImplementation(async ({ competencia }: { competencia: string }) => {
      if (competencia === '2026-03') return { erro: { status: 502, mensagem: 'túnel fora do ar' } };
      if (competencia === '2026-02') throw new Error('conexão caiu');
      return semGlosas();
    });

    const { status, corpo } = await chamar();

    expect(status).toBe(502);
    expect(corpo.success).toBe(false);
    expect(corpo.meses).toEqual([
      { competencia: '2026-03', ok: false, erro: 'túnel fora do ar' },
      { competencia: '2026-02', ok: false, erro: 'conexão caiu' },
      { competencia: '2026-01', ok: true, requisicoes: 0, lotes: 0 },
    ]);
    expect(inserts.glosa_recurso_sincronizacoes).toEqual([
      expect.objectContaining({ competencia: '2026-01' }),
    ]);
    const logado = (console.error as ReturnType<typeof vi.fn>).mock.calls.map((args) => args.join(' '));
    expect(logado.some((l) => l.includes('2026-03') && l.includes('túnel fora do ar'))).toBe(true);
    expect(logado.some((l) => l.includes('2026-02') && l.includes('conexão caiu'))).toBe(true);
  });

  it('não começa um mês que não caberia no tempo máximo da função: pula e registra', async () => {
    mockarSupabase();
    // Cada mês leva 100 s: depois de dois, o terceiro passaria dos 300 s da função.
    glosasRecursosDoPeriodoMock.mockImplementation(async () => {
      vi.setSystemTime(Date.now() + 100_000);
      return semGlosas();
    });

    const { status, corpo } = await chamar();

    expect(glosasRecursosDoPeriodoMock).toHaveBeenCalledTimes(2);
    expect(status).toBe(502);
    expect(corpo.success).toBe(false);
    expect(corpo.meses.map((m) => m.competencia)).toEqual(['2026-03', '2026-02']);
    expect(corpo.pulados).toEqual(['2026-01']);
    const logado = (console.error as ReturnType<typeof vi.fn>).mock.calls.map((args) => args.join(' '));
    expect(logado.some((l) => l.includes('2026-01'))).toBe(true);
  });

  it('começa pelos meses sincronizados há mais tempo, para nenhum ficar sempre de fora', async () => {
    mockarSupabase([
      { competencia: '2026-03', id_fonte_pagadora: null, sincronizado_em: '2026-03-14T09:00:00Z' },
      { competencia: '2026-01', id_fonte_pagadora: null, sincronizado_em: '2026-03-13T09:00:00Z' },
      // Só de um convênio: não cobre o mês.
      { competencia: '2026-02', id_fonte_pagadora: 1000, sincronizado_em: '2026-03-14T10:00:00Z' },
    ]);
    glosasRecursosDoPeriodoMock.mockResolvedValue(semGlosas());

    await chamar();

    expect(glosasRecursosDoPeriodoMock.mock.calls.map(([recorte]) => recorte.competencia)).toEqual([
      '2026-02',
      '2026-01',
      '2026-03',
    ]);
  });

  it('o mês atual é o de Brasília', async () => {
    mockarSupabase();
    glosasRecursosDoPeriodoMock.mockResolvedValue(semGlosas());
    // 01/04 01h UTC ainda é 31/03 em Brasília.
    vi.setSystemTime(new Date('2026-04-01T01:00:00Z'));

    await chamar();

    expect(glosasRecursosDoPeriodoMock.mock.calls[0][0].competencia).toBe('2026-03');
  });
});
