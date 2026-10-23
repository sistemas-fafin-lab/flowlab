import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

vi.mock('../supabase.js', () => ({
  getSupabaseAdminClient: vi.fn(),
}));
vi.mock('../faturamento/bdLab.js', () => ({
  glosasRecursosDoPeriodo: vi.fn(),
}));

import { getSupabaseAdminClient } from '../supabase.js';
import { glosasRecursosDoPeriodo } from '../faturamento/bdLab.js';
import type { LoteRecursoAplis, RequisicaoGlosaRecursoAplis } from '../faturamento/bdLab.js';
import handler from './faturamento-glosas-recursos-sincronizar.js';

const getSupabaseAdminClientMock = getSupabaseAdminClient as ReturnType<typeof vi.fn>;
const glosasRecursosDoPeriodoMock = glosasRecursosDoPeriodo as ReturnType<typeof vi.fn>;

type Linha = Record<string, unknown>;

interface CorpoResposta {
  success: boolean;
  error?: string;
  meta: { dadoAte: string | null; sincronizadoEm: string };
  requisicoes: number;
  lotes: number;
}

interface Cenario {
  usuario?: { id: string } | null;
  permissoes?: string[];
  fotos?: Linha[];
  lotes?: Linha[];
  sincronizacoes?: Linha[];
}

/** O que a rota gravou, por tabela. */
interface Gravado {
  upserts: Record<string, { linhas: Linha[]; opcoes: unknown }[]>;
  inserts: Record<string, Linha[]>;
}

// Query builder mínimo do supabase-js: select/eq/in encadeáveis, single(),
// `await` direto, e upsert/insert registrados em `gravado`.
function consulta(tabela: string, linhas: Linha[], gravado: Gravado) {
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
    upsert: (novas: Linha[], opcoes: unknown) => {
      (gravado.upserts[tabela] ??= []).push({ linhas: novas, opcoes });
      resultado = [];
      return builder;
    },
    insert: (nova: Linha | Linha[]) => {
      (gravado.inserts[tabela] ??= []).push(...(Array.isArray(nova) ? nova : [nova]));
      resultado = [];
      return builder;
    },
    single: async () => ({ data: resultado[0] ?? null, error: null }),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve({ data: resultado, error: null }).then(resolve, reject),
  };
  return builder;
}

function mockarSupabase(cenario: Cenario = {}): Gravado {
  const usuario = cenario.usuario === undefined ? { id: 'user-1' } : cenario.usuario;
  const perfil = { id: 'user-1', custom_roles: { permissions: cenario.permissoes ?? ['canViewBilling'] } };
  const gravado: Gravado = { upserts: {}, inserts: {} };
  const tabelas: Record<string, Linha[]> = {
    user_profiles: [perfil],
    glosa_recurso_requisicoes: cenario.fotos ?? [],
    glosa_recurso_sincronizacoes: cenario.sincronizacoes ?? [],
    glosa_recurso_lotes: cenario.lotes ?? [],
    glosa_recurso_historico: [],
  };
  getSupabaseAdminClientMock.mockReturnValue({
    auth: {
      getUser: vi.fn(async () => (usuario
        ? { data: { user: usuario }, error: null }
        : { data: { user: null }, error: { message: 'invalid' } })),
    },
    from: vi.fn((tabela: string) => {
      if (!(tabela in tabelas)) throw new Error(`tabela inesperada no mock: ${tabela}`);
      return consulta(tabela, tabelas[tabela], gravado);
    }),
  });
  return gravado;
}

function requisicao(overrides: Partial<RequisicaoGlosaRecursoAplis> = {}): RequisicaoGlosaRecursoAplis {
  return {
    idRequisicao: 501,
    codRequisicao: 'R501',
    numGuia: 'G-501',
    paciente: 'Paciente Teste',
    idLoteFaturamento: 6400,
    competencia: '2026-09',
    fontePagadora: { id: 1000, nome: 'BRADESCO' },
    status: 6,
    liquido: 1000,
    recebido: 700,
    idLoteRecurso: null,
    recursado: null,
    dataRecebimento: '2026-10-05',
    procedimentos: ['40304361 HEMOGRAMA COMPLETO'],
    motivos: ['1801 PROCEDIMENTO INVÁLIDO'],
    ...overrides,
  };
}

function loteRecurso(overrides: Partial<LoteRecursoAplis> = {}): LoteRecursoAplis {
  return {
    idLoteRecurso: 441,
    status: 2,
    statusLabel: 'Enviado',
    protocolo: '18235554',
    protocoloFaturamento: '340228570924',
    fontePagadora: { id: 1000, nome: 'BRADESCO' },
    dtaCriacao: '2026-10-20',
    dtaEnvio: '2026-10-22',
    dtaFinalizacao: null,
    dtaCancelamento: null,
    ...overrides,
  };
}

function criarReq(body: unknown, semToken = false): VercelRequest {
  return {
    method: 'POST',
    headers: semToken ? {} : { authorization: 'Bearer token-teste' },
    query: {},
    body,
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

interface Aplis {
  requisicoes?: RequisicaoGlosaRecursoAplis[];
  lotesRecurso?: LoteRecursoAplis[];
}

async function executar(cenario: Cenario, body: unknown, aplis: Aplis = {}) {
  const gravado = mockarSupabase(cenario);
  glosasRecursosDoPeriodoMock.mockResolvedValue({
    requisicoes: aplis.requisicoes ?? [],
    lotesRecurso: aplis.lotesRecurso ?? [],
    dadoAte: '2026-10-22',
  });
  const res = criarRes();
  await handler(criarReq(body), res);
  return { res, gravado };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/faturamento/glosas-recursos-sincronizar', () => {
  describe('autorização e parâmetros', () => {
    it('sem token devolve 401 sem consultar o apLIS', async () => {
      mockarSupabase();
      const res = criarRes();
      await handler(criarReq({ competencia: '2026-09' }, true), res);
      expect(res.statusCode).toBe(401);
      expect(glosasRecursosDoPeriodoMock).not.toHaveBeenCalled();
    });

    it('sem permissão de faturamento devolve 403 e não grava nada', async () => {
      const { res, gravado } = await executar({ permissoes: ['canViewRequests'] }, { competencia: '2026-09' });
      expect(res.statusCode).toBe(403);
      expect(glosasRecursosDoPeriodoMock).not.toHaveBeenCalled();
      expect(gravado).toEqual({ upserts: {}, inserts: {} });
    });

    it('método diferente de POST devolve 405', async () => {
      const res = criarRes();
      await handler({ ...criarReq({}), method: 'GET' } as VercelRequest, res);
      expect(res.statusCode).toBe(405);
    });

    it.each([undefined, '2026-9', '2026-13', 'setembro'])('competência %s inválida devolve 400', async (competencia) => {
      const { res } = await executar({}, { competencia });
      expect(res.statusCode).toBe(400);
      expect(glosasRecursosDoPeriodoMock).not.toHaveBeenCalled();
    });

    it('convênio inválido devolve 400', async () => {
      const { res } = await executar({}, { competencia: '2026-09', fontePagadoraId: 'bradesco' });
      expect(res.statusCode).toBe(400);
    });

    it('lê do apLIS só o período e o convênio pedidos', async () => {
      await executar({}, { competencia: '2026-09', fontePagadoraId: 1000 });
      expect(glosasRecursosDoPeriodoMock).toHaveBeenCalledWith({ competencia: '2026-09', fontePagadoraId: 1000 });
    });

    it('sem convênio lê todos', async () => {
      await executar({}, { competencia: '2026-09' });
      expect(glosasRecursosDoPeriodoMock).toHaveBeenCalledWith({ competencia: '2026-09', fontePagadoraId: undefined });
    });
  });

  describe('gravação da foto', () => {
    const jaSincronizado = [{ competencia: '2026-09', id_fonte_pagadora: null }];

    function fotoGravada(gravado: Gravado): Linha[] {
      return (gravado.upserts.glosa_recurso_requisicoes ?? []).flatMap((u) => u.linhas);
    }

    it('grava o lote de recurso, a requisição e a sincronização, e devolve a data do dado', async () => {
      const { res, gravado } = await executar(
        { sincronizacoes: jaSincronizado },
        { competencia: '2026-09' },
        {
          requisicoes: [requisicao({ status: 7, idLoteRecurso: 441, recursado: 300 })],
          lotesRecurso: [loteRecurso()],
        },
      );

      expect(res.statusCode).toBe(200);
      expect(res.body).toMatchObject({ success: true, meta: { dadoAte: '2026-10-22' }, requisicoes: 1, lotes: 1 });
      expect(res.headers['Cache-Control']).toBe('no-store');

      expect(gravado.upserts.glosa_recurso_lotes).toEqual([{
        linhas: [expect.objectContaining({
          id_lote_recurso: 441,
          status_aplis: 2,
          status_label: 'Enviado',
          protocolo: '18235554',
          protocolo_faturamento: '340228570924',
          id_fonte_pagadora: 1000,
          fonte_pagadora_nome: 'BRADESCO',
          data_envio_aplis: '2026-10-22',
        })],
        opcoes: { onConflict: 'id_lote_recurso' },
      }]);

      expect(fotoGravada(gravado)).toEqual([expect.objectContaining({
        id_requisicao: 501,
        cod_requisicao: 'R501',
        num_guia: 'G-501',
        paciente: 'Paciente Teste',
        id_lote_faturamento: 6400,
        competencia: '2026-09',
        id_fonte_pagadora: 1000,
        fonte_pagadora_nome: 'BRADESCO',
        id_lote_recurso: 441,
        status_aplis: 7,
        liquido: 1000,
        recebido: 700,
        valor_recursado: 300,
        glosa_fixada: 300,
        recebido_fixacao: 700,
        // O lote 441 já foi enviado: a foto pode ser posterior ao envio.
        valor_inicial_estimado: true,
      })]);
      expect(gravado.upserts.glosa_recurso_requisicoes?.[0].opcoes).toEqual({ onConflict: 'id_requisicao' });

      expect(gravado.inserts.glosa_recurso_sincronizacoes).toEqual([expect.objectContaining({
        competencia: '2026-09',
        id_fonte_pagadora: null,
        dado_ate: '2026-10-22',
        requisicoes: 1,
        lotes: 1,
        sincronizado_por: 'user-1',
      })]);
    });

    it('grava a data de recebimento, os procedimentos glosados e os motivos da requisição', async () => {
      const { gravado } = await executar({ sincronizacoes: jaSincronizado }, { competencia: '2026-09' }, {
        requisicoes: [requisicao({
          procedimentos: ['40304361 HEMOGRAMA COMPLETO', '40302040 GLICOSE'],
          motivos: ['1801 PROCEDIMENTO INVÁLIDO', '1702 COBRANÇA EM DUPLICIDADE'],
        })],
      });
      expect(fotoGravada(gravado)[0]).toMatchObject({
        data_recebimento: '2026-10-05',
        procedimentos: ['40304361 HEMOGRAMA COMPLETO', '40302040 GLICOSE'],
        motivos: ['1801 PROCEDIMENTO INVÁLIDO', '1702 COBRANÇA EM DUPLICIDADE'],
      });
    });

    it('a primeira sincronização do mês marca o valor inicial estimado', async () => {
      const { gravado } = await executar({}, { competencia: '2026-09' }, { requisicoes: [requisicao({ status: 7 })] });
      expect(fotoGravada(gravado)[0]).toMatchObject({ glosa_fixada: 300, valor_inicial_estimado: true });
    });

    it('sincronização anterior de outro convênio não cobre a requisição: é carga inicial', async () => {
      const { gravado } = await executar(
        { sincronizacoes: [{ competencia: '2026-09', id_fonte_pagadora: 2000 }] },
        { competencia: '2026-09' },
        { requisicoes: [requisicao({ status: 7 })] },
      );
      expect(fotoGravada(gravado)[0]).toMatchObject({ valor_inicial_estimado: true });
    });

    it('sincronização anterior do mesmo convênio cobre a requisição', async () => {
      const { gravado } = await executar(
        { sincronizacoes: [{ competencia: '2026-09', id_fonte_pagadora: 1000 }] },
        { competencia: '2026-09' },
        { requisicoes: [requisicao({ status: 7 })] },
      );
      expect(fotoGravada(gravado)[0]).toMatchObject({ valor_inicial_estimado: false });
    });

    it('requisição nova num lote de recurso já enviado leva a marca de estimado', async () => {
      const { gravado } = await executar(
        { sincronizacoes: jaSincronizado },
        { competencia: '2026-09' },
        {
          requisicoes: [
            requisicao({ idRequisicao: 501, status: 7, idLoteRecurso: 441, recursado: 300 }),
            requisicao({ idRequisicao: 502, status: 7, idLoteRecurso: 442, recursado: 300 }),
          ],
          lotesRecurso: [loteRecurso(), loteRecurso({ idLoteRecurso: 442, statusLabel: 'Criado', dtaEnvio: null })],
        },
      );
      const [enviada, naoEnviada] = fotoGravada(gravado);
      expect(enviada).toMatchObject({ id_requisicao: 501, valor_inicial_estimado: true });
      expect(naoEnviada).toMatchObject({ id_requisicao: 502, valor_inicial_estimado: false });
    });

    it('registra a sincronização com o convênio pedido', async () => {
      const { gravado } = await executar({}, { competencia: '2026-09', fontePagadoraId: 1000 });
      expect(gravado.inserts.glosa_recurso_sincronizacoes).toEqual([
        expect.objectContaining({ competencia: '2026-09', id_fonte_pagadora: 1000 }),
      ]);
    });

    it('requisição já na foto mantém a glosa fixada e atualiza o que vem do apLIS', async () => {
      const { gravado } = await executar(
        {
          sincronizacoes: jaSincronizado,
          fotos: [{ id_requisicao: 501, status_aplis: 6, recebido: '700.00', id_lote_recurso: null, glosa_fixada: 300, recebido_fixacao: 700, valor_inicial_estimado: false }],
        },
        { competencia: '2026-09' },
        { requisicoes: [requisicao({ status: 34, recebido: 1000, idLoteRecurso: 441, recursado: 280 })] },
      );
      expect(fotoGravada(gravado)[0]).toMatchObject({
        status_aplis: 34,
        recebido: 1000,
        valor_recursado: 280,
        glosa_fixada: 300,
        recebido_fixacao: 700,
        valor_inicial_estimado: false,
      });
    });

    // Upsert em lote: uma coluna presente só em parte das linhas iria como NULL
    // nas outras. A data da primeira sincronização fica com o default do banco.
    it('atualiza a última sincronização e deixa a primeira para o banco', async () => {
      const { gravado } = await executar(
        { fotos: [{ id_requisicao: 501, status_aplis: 6, recebido: '700.00', id_lote_recurso: null, glosa_fixada: 300, recebido_fixacao: 700, valor_inicial_estimado: false }] },
        { competencia: '2026-09' },
        {
          requisicoes: [requisicao({ idRequisicao: 501 }), requisicao({ idRequisicao: 502, idLoteRecurso: 441 })],
          lotesRecurso: [loteRecurso()],
        },
      );
      const linhas = [...fotoGravada(gravado), ...gravado.upserts.glosa_recurso_lotes[0].linhas];
      for (const linha of linhas) {
        expect(linha).not.toHaveProperty('primeira_sincronizacao');
        expect(linha.ultima_sincronizacao).toEqual(expect.any(String));
      }
    });

    it('falha no apLIS devolve o erro sem gravar nada', async () => {
      const gravado = mockarSupabase();
      glosasRecursosDoPeriodoMock.mockResolvedValue({ erro: { status: 502, mensagem: 'túnel fora do ar' } });
      const res = criarRes();
      await handler(criarReq({ competencia: '2026-09' }), res);
      expect(res.statusCode).toBe(502);
      expect(gravado).toEqual({ upserts: {}, inserts: {} });
    });
  });

  describe('histórico', () => {
    const jaSincronizado = [{ competencia: '2026-09', id_fonte_pagadora: null }];
    const fotoAnterior = {
      id_requisicao: 501,
      status_aplis: 7,
      recebido: '700.00',
      id_lote_recurso: 441,
      glosa_fixada: '300.00',
      recebido_fixacao: '700.00',
      valor_inicial_estimado: false,
    };

    function eventosGravados(gravado: Gravado): Linha[] {
      return gravado.inserts.glosa_recurso_historico ?? [];
    }

    it('a primeira sincronização da requisição grava só o início do acompanhamento', async () => {
      const { res, gravado } = await executar(
        { sincronizacoes: jaSincronizado },
        { competencia: '2026-09' },
        { requisicoes: [requisicao({ status: 7, idLoteRecurso: 441, recursado: 300 })], lotesRecurso: [loteRecurso()] },
      );
      expect(res.statusCode).toBe(200);
      expect(eventosGravados(gravado)).toEqual([{
        id_requisicao: 501,
        id_lote_recurso: 441,
        tipo: 'inicio_acompanhamento',
        valor_anterior: null,
        valor_novo: '7',
        descricao: 'Início do acompanhamento (1º recurso)',
        ocorrido_em: res.body?.meta.sincronizadoEm,
        usuario_id: null,
      }]);
    });

    it('requisição já acompanhada: grava a mudança de status e de recebido', async () => {
      const { res, gravado } = await executar(
        { sincronizacoes: jaSincronizado, fotos: [fotoAnterior], lotes: [{ id_lote_recurso: 441, data_envio_aplis: '2026-10-22' }] },
        { competencia: '2026-09' },
        {
          requisicoes: [requisicao({ status: 16, recebido: 850, idLoteRecurso: 441, recursado: 300 })],
          lotesRecurso: [loteRecurso()],
        },
      );
      expect(eventosGravados(gravado)).toEqual([
        expect.objectContaining({
          id_requisicao: 501,
          tipo: 'mudanca_status',
          valor_anterior: '7',
          valor_novo: '16',
          descricao: 'Foi para 2º recurso',
          ocorrido_em: res.body?.meta.sincronizadoEm,
        }),
        expect.objectContaining({ id_requisicao: 501, tipo: 'mudanca_recebido', valor_anterior: '700.00', valor_novo: '850.00' }),
      ]);
    });

    it('lote enviado desde a última sincronização: evento do lote, sem requisição', async () => {
      const { gravado } = await executar(
        { sincronizacoes: jaSincronizado, fotos: [fotoAnterior], lotes: [{ id_lote_recurso: 441, data_envio_aplis: null }] },
        { competencia: '2026-09' },
        {
          requisicoes: [requisicao({ status: 7, recebido: 700, idLoteRecurso: 441, recursado: 300 })],
          lotesRecurso: [loteRecurso()],
        },
      );
      expect(eventosGravados(gravado)).toEqual([expect.objectContaining({
        id_requisicao: null,
        id_lote_recurso: 441,
        tipo: 'envio_lote',
        valor_anterior: null,
        valor_novo: '2026-10-22',
      })]);
    });

    it('requisição acompanhada entra num lote novo já enviado: entrada e envio', async () => {
      const { gravado } = await executar(
        { sincronizacoes: jaSincronizado, fotos: [{ ...fotoAnterior, id_lote_recurso: null }] },
        { competencia: '2026-09' },
        {
          requisicoes: [requisicao({ status: 7, recebido: 700, idLoteRecurso: 441, recursado: 300 })],
          lotesRecurso: [loteRecurso()],
        },
      );
      expect(eventosGravados(gravado).map((e) => [e.tipo, e.id_requisicao, e.id_lote_recurso])).toEqual([
        ['envio_lote', null, 441],
        ['entrada_lote_recurso', 501, 441],
      ]);
    });

    it('lote novo só com requisições novas é carga inicial: só o início do acompanhamento', async () => {
      const { gravado } = await executar(
        { sincronizacoes: jaSincronizado },
        { competencia: '2026-09' },
        { requisicoes: [requisicao({ status: 7, idLoteRecurso: 441, recursado: 300 })], lotesRecurso: [loteRecurso()] },
      );
      expect(eventosGravados(gravado).map((e) => e.tipo)).toEqual(['inicio_acompanhamento']);
    });

    it('data de envio editada à mão: não é sobrescrita e o envio no apLIS não gera evento', async () => {
      const { res, gravado } = await executar(
        {
          sincronizacoes: jaSincronizado,
          fotos: [fotoAnterior],
          lotes: [{
            id_lote_recurso: 441,
            data_envio_aplis: null,
            data_envio_editada: '2026-10-15',
            data_envio_editada_por: 'user-9',
            data_envio_editada_em: '2026-10-16T12:00:00Z',
          }],
        },
        { competencia: '2026-09' },
        {
          requisicoes: [requisicao({ status: 7, recebido: 700, idLoteRecurso: 441, recursado: 300 })],
          lotesRecurso: [loteRecurso()],
        },
      );
      expect(res.statusCode).toBe(200);
      const [linhaLote] = gravado.upserts.glosa_recurso_lotes[0].linhas;
      expect(linhaLote.data_envio_aplis).toBe('2026-10-22');
      for (const coluna of ['data_envio_editada', 'data_envio_editada_por', 'data_envio_editada_em']) {
        expect(linhaLote).not.toHaveProperty(coluna);
      }
      expect(gravado.inserts.glosa_recurso_historico).toBeUndefined();
    });

    it('valores da requisição editados à mão: não são sobrescritos e o recebido não gera evento', async () => {
      const { gravado } = await executar(
        {
          sincronizacoes: jaSincronizado,
          fotos: [{
            ...fotoAnterior,
            valor_recursado_editado: '250.00',
            valor_recebido_glosa_editado: '120.00',
          }],
          lotes: [{ id_lote_recurso: 441, data_envio_aplis: '2026-10-22' }],
        },
        { competencia: '2026-09' },
        {
          requisicoes: [requisicao({ status: 16, recebido: 850, idLoteRecurso: 441, recursado: 300 })],
          lotesRecurso: [loteRecurso()],
        },
      );
      const [linha] = gravado.upserts.glosa_recurso_requisicoes[0].linhas;
      expect(linha).toMatchObject({ recebido: 850, valor_recursado: 300 });
      for (const coluna of [
        'valor_recursado_editado', 'valor_recursado_editado_por', 'valor_recursado_editado_em',
        'valor_recebido_glosa_editado', 'valor_recebido_glosa_editado_por', 'valor_recebido_glosa_editado_em',
      ]) {
        expect(linha).not.toHaveProperty(coluna);
      }
      expect(eventosGravados(gravado).map((e) => e.tipo)).toEqual(['mudanca_status']);
    });

    it('nada mudou: não grava evento', async () => {
      const { res, gravado } = await executar(
        { sincronizacoes: jaSincronizado, fotos: [fotoAnterior], lotes: [{ id_lote_recurso: 441, data_envio_aplis: '2026-10-22' }] },
        { competencia: '2026-09' },
        {
          requisicoes: [requisicao({ status: 7, recebido: 700, idLoteRecurso: 441, recursado: 300 })],
          lotesRecurso: [loteRecurso()],
        },
      );
      expect(res.statusCode).toBe(200);
      expect(gravado.inserts.glosa_recurso_historico).toBeUndefined();
    });
  });
});
