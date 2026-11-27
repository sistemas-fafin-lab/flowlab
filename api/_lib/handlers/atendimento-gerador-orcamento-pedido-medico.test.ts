import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  exames?: { nomeNoPedido: string; item: Record<string, unknown> | null }[];
  paciente?: string | null;
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
      '```json\n{"exams":[{"name":"Hemograma","matched":"Hemograma Completo"},{"name":"glicemia jejum","matched":"Glicemia de Jejum"},{"name":"Vitamina D","matched":null,"relacionados":["Hemograma Completo","Vitamina D3"],"tipo":"variante"}]}\n```',
    );

    const { res, apagados } = await executar();

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      exames: [
        { nomeNoPedido: 'Hemograma', item: { tuss: '40304361', nome: 'Hemograma Completo' }, relacionados: [], tipo: null },
        {
          nomeNoPedido: 'glicemia jejum',
          item: { tuss: '40302040', nome: 'Glicemia de Jejum' },
          relacionados: [],
          tipo: null,
        },
        // Relacionado fora da lista de preços é descartado.
        { nomeNoPedido: 'Vitamina D', item: null, relacionados: ['Hemograma Completo'], tipo: 'variante' },
      ],
      // A IA não mandou o nome do paciente: a tela pede para o atendente digitar.
      paciente: null,
    });
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(apagados.sort()).toEqual(['user-1/abc/pedido-1.jpg', 'user-1/abc/pedido-2.pdf']);
  });

  it('devolve o nome do paciente lido no pedido, sem espaços sobrando', async () => {
    buildOrcamentoParticularMock.mockResolvedValue(LISTA);
    geminiMock.mockResolvedValue('{"paciente":"  Maria   da Silva ","exams":[{"name":"Hemograma","matched":"Hemograma Completo"}]}');

    const { res } = await executar();

    expect(res.statusCode).toBe(200);
    expect(res.body?.paciente).toBe('Maria da Silva');
    expect(res.body?.exames).toHaveLength(1);
  });

  it('nome do paciente que a IA devolve como null ou fora do formato vira null', async () => {
    buildOrcamentoParticularMock.mockResolvedValue(LISTA);

    for (const resposta of ['{"paciente":null,"exams":[]}', '{"paciente":42,"exams":[]}']) {
      geminiMock.mockResolvedValue(resposta);
      const { res } = await executar();
      expect(res.statusCode).toBe(200);
      expect(res.body?.paciente).toBeNull();
    }
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

describe('POST /api/atendimento/gerador-orcamento-pedido-medico no modo colaborador', () => {
  // Lista do modo colaborador: inclui o exame de uso interno, que a particular não tem.
  const LISTA_COLABORADOR = [
    {
      tuss: '40304361',
      nome: 'Hemograma Completo',
      precoParticular: 25,
      precoColaborador: { disponivel: true, valor: 19.66 },
    },
    {
      tuss: '40316521',
      nome: 'TSH',
      precoParticular: 40,
      precoColaborador: { disponivel: false, motivo: 'pouca_vantagem' },
    },
    {
      tuss: '',
      nome: 'Painel Interno Colaborador',
      precoParticular: null,
      precoColaborador: { disponivel: true, valor: 30 },
    },
  ];
  const RESPOSTA_IA =
    '{"exams":[{"name":"Hemograma","matched":"Hemograma Completo"},{"name":"TSH","matched":"TSH"},{"name":"Painel interno","matched":"Painel Interno Colaborador"}]}';

  beforeEach(() => {
    buildOrcamentoParticularMock.mockImplementation(async (_supabase, opcoes: { modo?: string }) =>
      opcoes.modo === 'colaborador' ? LISTA_COLABORADOR : LISTA,
    );
    geminiMock.mockResolvedValue(RESPOSTA_IA);
  });

  const corpo = (modo?: string) => ({
    paths: ['user-1/abc/pedido-1.jpg', 'user-1/abc/pedido-2.pdf'],
    ...(modo === undefined ? {} : { modo }),
  });

  it('com canUseTabelaColaborador casa contra a lista colaborador, sem custo, e apaga os arquivos', async () => {
    const { res, apagados } = await executar({ permissoes: ['canUseTabelaColaborador'], body: corpo('colaborador') });

    expect(res.statusCode).toBe(200);
    expect(buildOrcamentoParticularMock).toHaveBeenCalledWith(expect.anything(), {
      incluirCusto: false,
      modo: 'colaborador',
    });
    const [, prompt] = geminiMock.mock.calls[0] as [unknown, string];
    expect(prompt).toContain('Painel Interno Colaborador');
    expect(apagados).toHaveLength(2);
  });

  it('cada exame casado traz o resultado da regra: o valor ou o motivo de "consultar a gestão"', async () => {
    const { res } = await executar({ permissoes: ['canUseTabelaColaborador'], body: corpo('colaborador') });

    expect(res.body?.exames).toEqual([
      {
        nomeNoPedido: 'Hemograma',
        item: { tuss: '40304361', nome: 'Hemograma Completo', precoColaborador: { disponivel: true, valor: 19.66 } },
        relacionados: [],
        tipo: null,
      },
      {
        nomeNoPedido: 'TSH',
        item: { tuss: '40316521', nome: 'TSH', precoColaborador: { disponivel: false, motivo: 'pouca_vantagem' } },
        relacionados: [],
        tipo: null,
      },
      {
        nomeNoPedido: 'Painel interno',
        item: { tuss: '', nome: 'Painel Interno Colaborador', precoColaborador: { disponivel: true, valor: 30 } },
        relacionados: [],
        tipo: null,
      },
    ]);
  });

  it('o exame de uso interno não casa no modo particular', async () => {
    const { res } = await executar({ body: corpo('particular') });

    expect(res.statusCode).toBe(200);
    expect(buildOrcamentoParticularMock).toHaveBeenCalledWith(expect.anything(), { incluirCusto: false });
    expect(res.body?.exames?.find((e) => e.nomeNoPedido === 'Painel interno')?.item).toBeNull();
    // No particular, o item casado não traz o resultado da regra colaborador.
    expect(res.body?.exames?.[0].item).toEqual({ tuss: '40304361', nome: 'Hemograma Completo' });
  });

  it('sem modo, a rota segue no particular', async () => {
    const { res } = await executar({ body: corpo() });

    expect(res.statusCode).toBe(200);
    expect(buildOrcamentoParticularMock).toHaveBeenCalledWith(expect.anything(), { incluirCusto: false });
  });

  it('modo colaborador só com canUseGeradorOrcamento devolve 403 sem chamar a IA nem apagar nada', async () => {
    const { res, apagados } = await executar({
      permissoes: ['canUseGeradorOrcamento', 'canViewGeradorOrcamentoCustos'],
      body: corpo('colaborador'),
    });

    expect(res.statusCode).toBe(403);
    expect(geminiMock).not.toHaveBeenCalled();
    expect(apagados).toEqual([]);
  });

  it('modo particular só com canUseTabelaColaborador devolve 403 sem chamar a IA nem apagar nada', async () => {
    const { res, apagados } = await executar({ permissoes: ['canUseTabelaColaborador'], body: corpo('particular') });

    expect(res.statusCode).toBe(403);
    expect(geminiMock).not.toHaveBeenCalled();
    expect(apagados).toEqual([]);
  });

  it('modo desconhecido devolve 400 sem chamar a IA nem apagar nada', async () => {
    const { res, apagados } = await executar({
      permissoes: ['canUseGeradorOrcamento', 'canUseTabelaColaborador'],
      body: corpo('convenio'),
    });

    expect(res.statusCode).toBe(400);
    expect(geminiMock).not.toHaveBeenCalled();
    expect(apagados).toEqual([]);
  });
});
