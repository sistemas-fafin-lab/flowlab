import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

vi.mock('../supabase.js', () => ({
  getSupabaseAdminClient: vi.fn(),
}));
vi.mock('../orcamentoParticular.js', () => ({
  buildOrcamentoParticular: vi.fn(),
}));
vi.mock('../atendimento/geminiPedidoMedico.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../atendimento/geminiPedidoMedico.js')>();
  return { ...original, lerPedidoMedicoComGemini: vi.fn() };
});

import { getSupabaseAdminClient } from '../supabase.js';
import { buildOrcamentoParticular } from '../orcamentoParticular.js';
import { lerPedidoMedicoComGemini, TempoEsgotadoIaError } from '../atendimento/geminiPedidoMedico.js';
import handler from './atendimento-gerador-orcamento-pedido-medico.js';

const getSupabaseAdminClientMock = getSupabaseAdminClient as ReturnType<typeof vi.fn>;
const buildOrcamentoParticularMock = buildOrcamentoParticular as ReturnType<typeof vi.fn>;
const geminiMock = lerPedidoMedicoComGemini as ReturnType<typeof vi.fn>;

const BUCKET = 'atendimento-pedidos-medicos';

interface CorpoResposta {
  success: boolean;
  error?: string;
  exames?: { nomeNoPedido: string; item: { tuss: string; nome: string } | null }[];
}

const LISTA = [
  { tuss: '40304361', nome: 'Hemograma Completo', preco: 25, elegivelDescontoParticular: true, conveniosAceitos: [] },
  { tuss: '40302040', nome: 'Glicemia de Jejum', preco: 12, elegivelDescontoParticular: true, conveniosAceitos: ['Unimed'] },
  { tuss: '99999999', nome: null, preco: 10, elegivelDescontoParticular: false, conveniosAceitos: [] },
];

// Query builder mínimo do supabase-js para o user_profiles da autorização.
function consulta(linha: Record<string, unknown>) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    single: async () => ({ data: linha, error: null }),
  };
  return builder;
}

/** Storage falso: guarda os arquivos por bucket/path e registra o que foi apagado. */
function criarStorage(arquivos: Record<string, Blob>) {
  const apagados: string[] = [];
  const storage = {
    from: vi.fn((bucket: string) => ({
      download: async (path: string) => {
        const blob = bucket === BUCKET ? arquivos[path] : undefined;
        return blob ? { data: blob, error: null } : { data: null, error: { message: 'Object not found' } };
      },
      remove: async (paths: string[]) => {
        if (bucket === BUCKET) apagados.push(...paths);
        return { data: [], error: null };
      },
    })),
  };
  return { storage, apagados };
}

function prepararSupabase(
  opcoes: { permissoes?: string[]; sessaoValida?: boolean; arquivos?: Record<string, Blob> } = {},
) {
  const sessaoValida = opcoes.sessaoValida ?? true;
  const { storage, apagados } = criarStorage(
    opcoes.arquivos ?? {
      'user-1/abc/pedido-1.jpg': new Blob(['foto'], { type: 'image/jpeg' }),
      'user-1/abc/pedido-2.pdf': new Blob(['pdf'], { type: 'application/pdf' }),
    },
  );
  getSupabaseAdminClientMock.mockReturnValue({
    auth: {
      getUser: vi.fn(async () =>
        sessaoValida
          ? { data: { user: { id: 'user-1' } }, error: null }
          : { data: { user: null }, error: { message: 'invalid JWT' } },
      ),
    },
    from: vi.fn(() =>
      consulta({ id: 'user-1', custom_roles: { permissions: opcoes.permissoes ?? ['canUseGeradorOrcamento'] } }),
    ),
    storage,
  });
  return { apagados };
}

function criarReq(opcoes: { metodo?: string; token?: string | null; body?: unknown } = {}): VercelRequest {
  const token = opcoes.token === undefined ? 'token-teste' : opcoes.token;
  return {
    method: opcoes.metodo ?? 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
    query: {},
    body: opcoes.body === undefined ? { paths: ['user-1/abc/pedido-1.jpg', 'user-1/abc/pedido-2.pdf'] } : opcoes.body,
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

async function executar(
  opcoes: {
    permissoes?: string[];
    sessaoValida?: boolean;
    arquivos?: Record<string, Blob>;
    metodo?: string;
    token?: string | null;
    body?: unknown;
  } = {},
) {
  const { apagados } = prepararSupabase(opcoes);
  const res = criarRes();
  await handler(criarReq(opcoes), res);
  return { res, apagados };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/atendimento/gerador-orcamento-pedido-medico', () => {
  it('devolve os exames lidos casados com a lista de preços e apaga os arquivos', async () => {
    buildOrcamentoParticularMock.mockResolvedValue(LISTA);
    geminiMock.mockResolvedValue(
      '```json\n{"exams":[{"name":"Hemograma","matched":"Hemograma Completo"},{"name":"glicemia jejum","matched":null},{"name":"Vitamina D","matched":null}]}\n```',
    );

    const { res, apagados } = await executar();

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      exames: [
        { nomeNoPedido: 'Hemograma', item: { tuss: '40304361', nome: 'Hemograma Completo' } },
        { nomeNoPedido: 'glicemia jejum', item: { tuss: '40302040', nome: 'Glicemia de Jejum' } },
        { nomeNoPedido: 'Vitamina D', item: null },
      ],
    });
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(apagados.sort()).toEqual(['user-1/abc/pedido-1.jpg', 'user-1/abc/pedido-2.pdf']);
  });

  it('manda à IA os arquivos baixados e os nomes da lista sem custo', async () => {
    buildOrcamentoParticularMock.mockResolvedValue(LISTA);
    geminiMock.mockResolvedValue('{"exams":[]}');

    await executar();

    expect(buildOrcamentoParticularMock).toHaveBeenCalledWith(expect.anything(), { incluirCusto: false });
    const [arquivos, prompt] = geminiMock.mock.calls[0] as [{ mimeType: string; data: Buffer }[], string];
    expect(arquivos.map((a) => a.mimeType)).toEqual(['image/jpeg', 'application/pdf']);
    expect(arquivos[0].data.toString()).toBe('foto');
    expect(prompt).toContain('Hemograma Completo\nGlicemia de Jejum');
  });

  it('falha da IA devolve 502 e apaga os arquivos', async () => {
    buildOrcamentoParticularMock.mockResolvedValue(LISTA);
    geminiMock.mockRejectedValue(new Error('503 UNAVAILABLE'));

    const { res, apagados } = await executar();

    expect(res.statusCode).toBe(502);
    expect(res.body?.success).toBe(false);
    expect(apagados.sort()).toEqual(['user-1/abc/pedido-1.jpg', 'user-1/abc/pedido-2.pdf']);
  });

  it('IA que estoura o tempo devolve 504 e apaga os arquivos', async () => {
    buildOrcamentoParticularMock.mockResolvedValue(LISTA);
    geminiMock.mockRejectedValue(new TempoEsgotadoIaError());

    const { res, apagados } = await executar();

    expect(res.statusCode).toBe(504);
    expect(res.body?.error).toMatch(/demorou/i);
    expect(apagados.sort()).toEqual(['user-1/abc/pedido-1.jpg', 'user-1/abc/pedido-2.pdf']);
  });

  it('resposta da IA sem lista de exames devolve 502 e apaga os arquivos', async () => {
    buildOrcamentoParticularMock.mockResolvedValue(LISTA);
    geminiMock.mockResolvedValue('Desculpe, não entendi o pedido.');

    const { res, apagados } = await executar();

    expect(res.statusCode).toBe(502);
    expect(apagados).toHaveLength(2);
  });

  it('arquivo que não está no bucket devolve 400, sem chamar a IA, e apaga os que estavam', async () => {
    const { res, apagados } = await executar({
      arquivos: { 'user-1/abc/pedido-1.jpg': new Blob(['foto'], { type: 'image/jpeg' }) },
    });

    expect(res.statusCode).toBe(400);
    expect(geminiMock).not.toHaveBeenCalled();
    expect(apagados.sort()).toEqual(['user-1/abc/pedido-1.jpg', 'user-1/abc/pedido-2.pdf']);
  });

  it('falha ao montar a lista de preços devolve 500 e apaga os arquivos', async () => {
    buildOrcamentoParticularMock.mockRejectedValue(new Error('Falha ao ler custo_exames'));

    const { res, apagados } = await executar();

    expect(res.statusCode).toBe(500);
    expect(geminiMock).not.toHaveBeenCalled();
    expect(apagados).toHaveLength(2);
  });

  it.each([
    ['sem paths', {}],
    ['paths vazio', { paths: [] }],
    ['mais de 5 arquivos', { paths: ['user-1/a/1.jpg', 'user-1/a/2.jpg', 'user-1/a/3.jpg', 'user-1/a/4.jpg', 'user-1/a/5.jpg', 'user-1/a/6.jpg'] }],
    ['path vazio', { paths: ['user-1/a/1.jpg', '  '] }],
    ['path com ..', { paths: ['../outro-bucket/x.pdf'] }],
    ['path que não é texto', { paths: [42] }],
  ])('%s devolve 400 sem chamar a IA nem apagar nada', async (_caso, body) => {
    const { res, apagados } = await executar({ body });

    expect(res.statusCode).toBe(400);
    expect(res.body?.success).toBe(false);
    expect(geminiMock).not.toHaveBeenCalled();
    expect(apagados).toEqual([]);
  });

  it('path de outro usuário devolve 400 sem chamar a IA nem apagar nada', async () => {
    const { res, apagados } = await executar({
      body: { paths: ['user-1/abc/pedido-1.jpg', 'user-2/xyz/pedido.jpg'] },
    });

    expect(res.statusCode).toBe(400);
    expect(geminiMock).not.toHaveBeenCalled();
    expect(apagados).toEqual([]);
  });

  it('aceita 5 arquivos', async () => {
    const paths = ['user-1/a/1.jpg', 'user-1/a/2.jpg', 'user-1/a/3.jpg', 'user-1/a/4.jpg', 'user-1/a/5.jpg'];
    buildOrcamentoParticularMock.mockResolvedValue(LISTA);
    geminiMock.mockResolvedValue('{"exams":[]}');

    const { res } = await executar({
      body: { paths },
      arquivos: Object.fromEntries(paths.map((p) => [p, new Blob(['x'], { type: 'image/jpeg' })])),
    });

    expect(res.statusCode).toBe(200);
    expect(res.body?.exames).toEqual([]);
  });

  it('sem token devolve 401 sem chamar a IA nem apagar nada', async () => {
    const { res, apagados } = await executar({ token: null });

    expect(res.statusCode).toBe(401);
    expect(geminiMock).not.toHaveBeenCalled();
    expect(apagados).toEqual([]);
  });

  it('sessão inválida devolve 401 sem chamar a IA', async () => {
    const { res } = await executar({ sessaoValida: false });

    expect(res.statusCode).toBe(401);
    expect(geminiMock).not.toHaveBeenCalled();
  });

  it('sem canUseGeradorOrcamento devolve 403 sem chamar a IA nem apagar nada', async () => {
    const { res, apagados } = await executar({ permissoes: ['canViewBilling'] });

    expect(res.statusCode).toBe(403);
    expect(geminiMock).not.toHaveBeenCalled();
    expect(apagados).toEqual([]);
  });

  it('método diferente de POST devolve 405', async () => {
    const { res } = await executar({ metodo: 'GET' });

    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe('POST');
    expect(geminiMock).not.toHaveBeenCalled();
  });
});
