import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Supabase falso: guarda os chamados e os perfis em memória e grava cada insert.
interface Perfil {
  id: string;
  email: string;
  deleted_at: string | null;
  disabled_at: string | null;
}
interface Chamado {
  id: string;
  codigo: string;
  origem: string | null;
  id_externo: string | null;
  [coluna: string]: unknown;
}
const estado = {
  perfis: [] as Perfil[],
  chamados: [] as Chamado[],
  inserts: [] as Array<Record<string, unknown>>,
  /** Simula outra chamada que gravou o mesmo id_externo entre a busca e o insert. */
  corridaNoInsert: null as Chamado | null,
  rpc: vi.fn(),
};

type Filtro = (linha: Record<string, unknown>) => boolean;

function criarConsulta(tabela: string) {
  const filtros: Filtro[] = [];
  const linhas = () =>
    (tabela === 'user_profiles' ? estado.perfis : estado.chamados) as unknown as Array<Record<string, unknown>>;
  const resultado = () => linhas().filter((l) => filtros.every((f) => f(l)));
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: (coluna: string, valor: unknown) => {
      filtros.push((l) => l[coluna] === valor);
      return builder;
    },
    ilike: (coluna: string, padrao: string) => {
      // Só o necessário para o teste: sem curinga, ILIKE é igualdade sem maiúsculas.
      const literal = padrao.replace(/\\([\\%_])/g, '$1').toLowerCase();
      filtros.push((l) => String(l[coluna]).toLowerCase() === literal);
      return builder;
    },
    limit: () => builder,
    then: (ok: (v: unknown) => unknown, falha: (e: unknown) => unknown) =>
      Promise.resolve({ data: resultado(), error: null }).then(ok, falha),
    maybeSingle: () => Promise.resolve({ data: resultado()[0] ?? null, error: null }),
    insert: (linha: Record<string, unknown>) => {
      estado.inserts.push(linha);
      return {
        select: () => ({
          single: () => {
            if (estado.corridaNoInsert) {
              estado.chamados.push(estado.corridaNoInsert);
              estado.corridaNoInsert = null;
              return Promise.resolve({ data: null, error: { code: '23505', message: 'duplicate key' } });
            }
            const novo: Chamado = {
              id: `uuid-${estado.chamados.length + 1}`,
              codigo: `IT-${100 + estado.chamados.length + 1}`,
              origem: null,
              id_externo: null,
              ...linha,
            };
            estado.chamados.push(novo);
            return Promise.resolve({ data: { id: novo.id, codigo: novo.codigo }, error: null });
          },
        }),
      };
    },
  };
  return builder;
}

vi.mock('./supabase.js', () => ({
  getSupabaseAdminClient: () => ({ from: criarConsulta, rpc: estado.rpc }),
}));

vi.mock('./agentes/permissoes.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('./agentes/permissoes.js')>();
  return { ...real, agentePode: vi.fn(real.agentePode) };
});

import { agentePode } from './agentes/permissoes.js';
import criarChamado from './handlers/integracoes-lab-brain-chamado-criar.js';

const CHAVE = 'segredo-chamados';
const CHAVE_APOIO = 'segredo-apoio';

const CORPO_VALIDO = {
  titulo: 'Escrita na API do TiqueTaque',
  descricao: 'O RH precisa lançar afastamento de férias pela API.',
  solicitante_email: 'suane@lab.com',
  id_externo: 'lb-001',
};

function criarReq(body: unknown = CORPO_VALIDO, opcoes: { method?: string; auth?: string | null } = {}) {
  const auth = opcoes.auth === undefined ? `Bearer ${CHAVE}` : opcoes.auth;
  return {
    method: opcoes.method ?? 'POST',
    headers: auth ? { authorization: auth } : {},
    query: {},
    body,
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

async function chamar(req = criarReq()) {
  const res = criarRes();
  await criarChamado(req, res);
  return res;
}

beforeEach(() => {
  process.env.LAB_BRAIN_CHAMADOS_API_KEY = CHAVE;
  process.env.LAB_BRAIN_API_KEY = CHAVE_APOIO;
  estado.perfis = [{ id: 'user-suane', email: 'Suane@Lab.com', deleted_at: null, disabled_at: null }];
  estado.chamados = [];
  estado.inserts = [];
  estado.corridaNoInsert = null;
  estado.rpc.mockResolvedValue({ data: [{ permitido: true, retry_after: 0 }], error: null });
});

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.LAB_BRAIN_CHAMADOS_API_KEY;
  delete process.env.LAB_BRAIN_API_KEY;
});

describe('método e chave', () => {
  it('método != POST devolve 405 sem tocar o banco', async () => {
    const res = await chamar(criarReq(CORPO_VALIDO, { method: 'GET' }));
    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe('POST');
    expect(estado.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['sem chave', null],
    ['chave errada', 'Bearer outra'],
    ['chave de leitura do apoio', `Bearer ${CHAVE_APOIO}`],
  ])('%s devolve 401 sem consumir cota', async (_caso, auth) => {
    const res = await chamar(criarReq(CORPO_VALIDO, { auth }));
    expect(res.statusCode).toBe(401);
    expect(estado.rpc).not.toHaveBeenCalled();
    expect(estado.inserts).toHaveLength(0);
  });
});

describe('permissão e corpo', () => {
  it('agente sem chamados.criar devolve 403 antes do corpo e da cota', async () => {
    vi.mocked(agentePode).mockReturnValueOnce(false);
    const res = await chamar(criarReq({}));
    expect(res.statusCode).toBe(403);
    expect(agentePode).toHaveBeenCalledWith('lab-brain', 'chamados.criar');
    expect(estado.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['corpo ausente', null],
    ['corpo que não é objeto', 'texto'],
    ['sem titulo', { ...CORPO_VALIDO, titulo: undefined }],
    ['titulo só com espaços', { ...CORPO_VALIDO, titulo: '   ' }],
    ['titulo com 256 caracteres', { ...CORPO_VALIDO, titulo: 'a'.repeat(256) }],
    ['titulo que não é texto', { ...CORPO_VALIDO, titulo: 123 }],
    ['sem descricao', { ...CORPO_VALIDO, descricao: undefined }],
    ['descricao vazia', { ...CORPO_VALIDO, descricao: '  ' }],
    ['descricao com 5.001 caracteres', { ...CORPO_VALIDO, descricao: 'a'.repeat(5001) }],
    ['sem solicitante_email', { ...CORPO_VALIDO, solicitante_email: undefined }],
    ['solicitante_email sem @', { ...CORPO_VALIDO, solicitante_email: 'suane' }],
    ['sem id_externo', { ...CORPO_VALIDO, id_externo: undefined }],
    ['id_externo vazio', { ...CORPO_VALIDO, id_externo: ' ' }],
    ['id_externo com 256 caracteres', { ...CORPO_VALIDO, id_externo: 'x'.repeat(256) }],
    ['prioridade desconhecida', { ...CORPO_VALIDO, prioridade: 'urgente' }],
    ['tipo desconhecido', { ...CORPO_VALIDO, tipo: 'consultoria' }],
  ])('%s devolve 400 sem consumir cota', async (_caso, body) => {
    const res = await chamar(criarReq(body));
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: string }).error).toEqual(expect.any(String));
    expect(estado.rpc).not.toHaveBeenCalled();
    expect(estado.inserts).toHaveLength(0);
  });

  it('aceita titulo de 255 e descricao de 5.000 caracteres', async () => {
    const res = await chamar(criarReq({ ...CORPO_VALIDO, titulo: 'a'.repeat(255), descricao: 'b'.repeat(5000) }));
    expect(res.statusCode).toBe(201);
  });
});

describe('cota e auditoria', () => {
  it('registra na cota lab-brain-chamados, 10 por minuto, sem título nem descrição', async () => {
    await chamar();
    expect(estado.rpc).toHaveBeenCalledWith('integracao_registrar_chamada', {
      p_integracao: 'lab-brain-chamados',
      p_rota: 'lab-brain-chamado-criar',
      p_parametros: { id_externo: 'lb-001', solicitante_email: 'suane@lab.com', prioridade: 'medium', tipo: 'suporte' },
      p_limite: 10,
      p_janela_segundos: 60,
    });
  });

  it('sem cota devolve 429 com Retry-After e não cria o chamado', async () => {
    estado.rpc.mockResolvedValue({ data: [{ permitido: false, retry_after: 42 }], error: null });
    const res = await chamar();
    expect(res.statusCode).toBe(429);
    expect(res.headers['Retry-After']).toBe('42');
    expect(estado.inserts).toHaveLength(0);
  });

  it('falha ao gravar a auditoria devolve 500 e não cria o chamado', async () => {
    estado.rpc.mockResolvedValue({ data: null, error: { message: 'function does not exist' } });
    const res = await chamar();
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ success: false, error: 'Erro interno' });
    expect(estado.inserts).toHaveLength(0);
  });
});

describe('solicitante', () => {
  it.each([
    ['inexistente', { id: 'user-x', email: 'outra@lab.com', deleted_at: null, disabled_at: null }, /Nenhum usuário/],
    ['removido', { id: 'user-suane', email: 'suane@lab.com', deleted_at: '2026-10-01', disabled_at: null }, /removido ou desativado/],
    ['desativado', { id: 'user-suane', email: 'suane@lab.com', deleted_at: null, disabled_at: '2026-10-01' }, /removido ou desativado/],
  ])('%s devolve 422 com mensagem clara e não cria o chamado', async (_caso, perfil, mensagem) => {
    estado.perfis = [perfil];
    const res = await chamar();
    expect(res.statusCode).toBe(422);
    expect((res.body as { error: string }).error).toMatch(mensagem);
    expect(estado.inserts).toHaveLength(0);
  });

  it('e-mail com _ não casa outro e-mail por curinga', async () => {
    estado.perfis = [{ id: 'user-x', email: 'suaneXlab@lab.com', deleted_at: null, disabled_at: null }];
    const res = await chamar(criarReq({ ...CORPO_VALIDO, solicitante_email: 'suane_lab@lab.com' }));
    expect(res.statusCode).toBe(422);
  });

  it('com um perfil removido e outro ativo no mesmo e-mail, vale o ativo', async () => {
    estado.perfis = [
      { id: 'user-antigo', email: 'suane@lab.com', deleted_at: '2026-01-01', disabled_at: null },
      { id: 'user-suane', email: 'SUANE@lab.com', deleted_at: null, disabled_at: null },
    ];
    const res = await chamar();
    expect(res.statusCode).toBe(201);
    expect(estado.inserts[0].requested_by).toBe('user-suane');
  });
});

describe('criação', () => {
  it('devolve 201 { id, codigo } com o chamado pendente, fora do Kanban e os padrões aplicados', async () => {
    const res = await chamar(
      criarReq({ ...CORPO_VALIDO, titulo: '  Escrita na API do TiqueTaque  ', solicitante_email: 'SUANE@lab.com' }),
    );
    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({ id: 'uuid-1', codigo: 'IT-101' });
    expect(estado.inserts).toEqual([
      {
        title: 'Escrita na API do TiqueTaque',
        description: 'O RH precisa lançar afastamento de férias pela API.',
        request_type: 'suporte',
        priority: 'medium',
        requested_by: 'user-suane',
        kanban_hidden: true,
        origem: 'lab-brain',
        id_externo: 'lb-001',
      },
    ]);
    // Pendente é o padrão da coluna status: a rota não força outra situação.
    expect(estado.inserts[0]).not.toHaveProperty('status');
  });

  it('grava prioridade e tipo informados', async () => {
    await chamar(criarReq({ ...CORPO_VALIDO, prioridade: 'critical', tipo: 'desenvolvimento' }));
    expect(estado.inserts[0]).toMatchObject({ priority: 'critical', request_type: 'desenvolvimento' });
  });
});

describe('reenvio do mesmo id_externo', () => {
  it('devolve 200 com o chamado que já existe, sem criar outro', async () => {
    const primeira = await chamar();
    const segunda = await chamar();
    expect(primeira.statusCode).toBe(201);
    expect(segunda.statusCode).toBe(200);
    expect(segunda.body).toEqual(primeira.body);
    expect(estado.inserts).toHaveLength(1);
  });

  it('devolve 200 mesmo que o solicitante tenha sido desativado depois da criação', async () => {
    await chamar();
    estado.perfis[0].disabled_at = '2026-11-13';
    const res = await chamar();
    expect(res.statusCode).toBe(200);
    expect(estado.inserts).toHaveLength(1);
  });

  it('o mesmo id_externo de um chamado de outra origem não conta como reenvio', async () => {
    estado.chamados = [{ id: 'uuid-tela', codigo: 'IT-050', origem: null, id_externo: 'lb-001' }];
    const res = await chamar();
    expect(res.statusCode).toBe(201);
  });

  it('duas chamadas simultâneas: a que perde a corrida devolve 200 com o chamado da outra', async () => {
    estado.corridaNoInsert = { id: 'uuid-outra', codigo: 'IT-777', origem: 'lab-brain', id_externo: 'lb-001' };
    const res = await chamar();
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ id: 'uuid-outra', codigo: 'IT-777' });
  });
});
