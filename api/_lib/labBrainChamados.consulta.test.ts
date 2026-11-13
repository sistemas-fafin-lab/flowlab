import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Supabase falso: chamados e perfis em memória. As linhas trazem colunas que não
// podem sair para o agente (descrição, solicitante, anexos), para provar que não saem.
// it_task_comments também é servido: se um dia a rota passar a ler a conversa, o
// teste de "sem comentários" pega o vazamento.
type Linha = Record<string, unknown>;
const estado = {
  perfis: [] as Linha[],
  chamados: [] as Linha[],
  comentarios: [] as Linha[],
  rpc: vi.fn(),
};

function tabela(nome: string): Linha[] {
  if (nome === 'user_profiles') return estado.perfis;
  if (nome === 'it_task_comments') return estado.comentarios;
  return estado.chamados;
}

function criarConsulta(nome: string) {
  const filtros: Array<(l: Linha) => boolean> = [];
  const resultado = () => tabela(nome).filter((l) => filtros.every((f) => f(l)));
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: (coluna: string, valor: unknown) => {
      filtros.push((l) => l[coluna] === valor);
      return builder;
    },
    in: (coluna: string, valores: unknown[]) => {
      filtros.push((l) => valores.includes(l[coluna]));
      return builder;
    },
    then: (ok: (v: unknown) => unknown, falha: (e: unknown) => unknown) =>
      Promise.resolve({ data: resultado(), error: null }).then(ok, falha),
    maybeSingle: () => Promise.resolve({ data: resultado()[0] ?? null, error: null }),
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
import consultarChamado from './handlers/integracoes-lab-brain-chamado-consultar.js';

const CHAVE = 'segredo-chamados';
const CHAVE_APOIO = 'segredo-apoio';

function criarReq(
  query: Record<string, unknown> = { id_externo: 'lb-001' },
  opcoes: { method?: string; auth?: string | null } = {},
) {
  const auth = opcoes.auth === undefined ? `Bearer ${CHAVE}` : opcoes.auth;
  return {
    method: opcoes.method ?? 'GET',
    headers: auth ? { authorization: auth } : {},
    query,
    body: undefined,
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
  await consultarChamado(req, res);
  return res;
}

beforeEach(() => {
  process.env.LAB_BRAIN_CHAMADOS_API_KEY = CHAVE;
  process.env.LAB_BRAIN_API_KEY = CHAVE_APOIO;
  estado.perfis = [];
  estado.chamados = [];
  estado.comentarios = [];
  estado.rpc.mockResolvedValue({ data: [{ permitido: true, retry_after: 0 }], error: null });
});

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.LAB_BRAIN_CHAMADOS_API_KEY;
  delete process.env.LAB_BRAIN_API_KEY;
});

describe('método, chave e permissão', () => {
  it('método != GET devolve 405 sem tocar o banco', async () => {
    const res = await chamar(criarReq({ id_externo: 'lb-001' }, { method: 'POST' }));
    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe('GET');
    expect(estado.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['sem chave', null],
    ['chave errada', 'Bearer outra'],
    ['chave de leitura do apoio', `Bearer ${CHAVE_APOIO}`],
  ])('%s devolve 401 sem consumir cota', async (_caso, auth) => {
    const res = await chamar(criarReq({ id_externo: 'lb-001' }, { auth }));
    expect(res.statusCode).toBe(401);
    expect(estado.rpc).not.toHaveBeenCalled();
  });

  it('LAB_BRAIN_CHAMADOS_API_KEY não configurada devolve 503 sem consumir cota', async () => {
    delete process.env.LAB_BRAIN_CHAMADOS_API_KEY;
    const res = await chamar(criarReq({ id_externo: 'lb-001' }, { auth: `Bearer ${CHAVE}` }));
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ success: false, error: 'Integração não configurada' });
    expect(estado.rpc).not.toHaveBeenCalled();
  });

  it('agente sem chamados.ler devolve 403 antes dos parâmetros e da cota', async () => {
    vi.mocked(agentePode).mockReturnValueOnce(false);
    const res = await chamar(criarReq({}));
    expect(res.statusCode).toBe(403);
    expect(agentePode).toHaveBeenCalledWith('lab-brain', 'chamados.ler');
    expect(estado.rpc).not.toHaveBeenCalled();
  });
});

describe('parâmetros', () => {
  it.each([
    ['sem id_externo', {}],
    ['id_externo vazio', { id_externo: '  ' }],
    ['id_externo com 256 caracteres', { id_externo: 'x'.repeat(256) }],
  ])('%s devolve 400 sem consumir cota', async (_caso, query) => {
    const res = await chamar(criarReq(query));
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: string }).error).toMatch(/id_externo/);
    expect(estado.rpc).not.toHaveBeenCalled();
  });
});

describe('cota e auditoria', () => {
  it('registra na cota lab-brain-chamados, 10 por minuto, a mesma da criação', async () => {
    await chamar();
    expect(estado.rpc).toHaveBeenCalledWith('integracao_registrar_chamada', {
      p_integracao: 'lab-brain-chamados',
      p_rota: 'lab-brain-chamado-consultar',
      p_parametros: { id_externo: 'lb-001' },
      p_limite: 10,
      p_janela_segundos: 60,
    });
  });

  it('sem cota devolve 429 com Retry-After', async () => {
    estado.rpc.mockResolvedValue({ data: [{ permitido: false, retry_after: 7 }], error: null });
    const res = await chamar();
    expect(res.statusCode).toBe(429);
    expect(res.headers['Retry-After']).toBe('7');
  });
});

/** Linha de it_requests como o banco devolve, com colunas que não podem sair para o agente. */
function chamado(campos: Linha = {}): Linha {
  return {
    id: 'uuid-1',
    codigo: 'IT-101',
    title: 'Escrita na API do TiqueTaque',
    description: 'O RH precisa lançar afastamento de férias pela API.',
    requested_by: 'user-suane',
    attachments: [{ url: 'https://storage/x.pdf', name: 'x.pdf' }],
    status: 'in_progress',
    kanban_status: 'todo',
    kanban_hidden: false,
    priority: 'high',
    assigned_to: ['user-gabriel'],
    resolution: null,
    resolved_at: null,
    updated_at: '2026-11-13T13:00:00.000Z',
    origem: 'lab-brain',
    id_externo: 'lb-001',
    ...campos,
  };
}

describe('consulta', () => {
  beforeEach(() => {
    estado.perfis = [
      { id: 'user-gabriel', name: 'Gabriel', email: 'gabriel@lab.com' },
      { id: 'user-mario', name: 'Mário', email: 'mario@lab.com' },
      { id: 'user-suane', name: 'Suane', email: 'suane@lab.com' },
    ];
  });

  it('chamado em aberto devolve 200 com a situação e sem resolução', async () => {
    estado.chamados = [chamado()];
    const res = await chamar();
    expect(res.statusCode).toBe(200);
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(res.body).toEqual({
      codigo: 'IT-101',
      situacao: 'in_progress',
      coluna_kanban: 'todo',
      prioridade: 'high',
      responsavel: 'Gabriel',
      resolucao: null,
      atualizado_em: '2026-11-13T13:00:00.000Z',
    });
  });

  it('id_externo de um chamado de outra origem devolve 404', async () => {
    // id_externo exige origem no banco (it_requests_id_externo_exige_origem): outra origem é outro texto.
    estado.chamados = [chamado({ origem: 'outra-integracao' })];
    const res = await chamar();
    expect(res.statusCode).toBe(404);
  });

  it('id_externo desconhecido devolve 404', async () => {
    estado.chamados = [chamado({ id_externo: 'lb-999' })];
    const res = await chamar();
    expect(res.statusCode).toBe(404);
  });
  it('chamado resolvido devolve 200 com a resolução', async () => {
    estado.chamados = [
      chamado({
        status: 'resolved',
        kanban_status: 'done',
        resolution: 'Chave de escrita liberada no TiqueTaque.',
        resolved_at: '2026-11-13T14:00:00.000Z',
        updated_at: '2026-11-13T14:00:01.000Z',
      }),
    ];
    const res = await chamar();
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      situacao: 'resolved',
      coluna_kanban: 'done',
      resolucao: 'Chave de escrita liberada no TiqueTaque.',
      atualizado_em: '2026-11-13T14:00:01.000Z',
    });
  });

  it('chamado cancelado devolve 200 com o motivo em resolucao', async () => {
    // Rejeitar a sugestão da EVA cancela o chamado fora do Kanban e grava o motivo como resolução.
    estado.chamados = [
      chamado({
        status: 'cancelled',
        kanban_status: 'backlog',
        kanban_hidden: true,
        assigned_to: [],
        resolution: 'Esse acesso é liberado pelo RH, não pelo TI.',
      }),
    ];
    const res = await chamar();
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      situacao: 'cancelled',
      coluna_kanban: null,
      resolucao: 'Esse acesso é liberado pelo RH, não pelo TI.',
    });
  });

  it('chamado pendente não devolve resolução, mesmo com uma antiga gravada', async () => {
    estado.chamados = [chamado({ status: 'pending', kanban_hidden: true, resolution: 'Texto antigo.' })];
    const res = await chamar();
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ situacao: 'pending', resolucao: null });
  });

  it('chamado pendente, fora do Kanban e sem responsável: coluna e responsável nulos', async () => {
    estado.chamados = [chamado({ status: 'pending', kanban_status: 'backlog', kanban_hidden: true, assigned_to: [] })];
    const res = await chamar();
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ situacao: 'pending', coluna_kanban: null, responsavel: null, resolucao: null });
  });

  it('vários responsáveis saem juntos, na ordem do chamado', async () => {
    estado.chamados = [chamado({ assigned_to: ['user-mario', 'user-gabriel'] })];
    const res = await chamar();
    expect((res.body as { responsavel: string }).responsavel).toBe('Mário, Gabriel');
  });

  it('não devolve comentários, anexos, descrição nem dados do solicitante', async () => {
    estado.chamados = [chamado()];
    estado.comentarios = [{ task_id: 'uuid-1', content: 'conversa interna do TI', kind: 'comment' }];
    const res = await chamar();
    const corpo = JSON.stringify(res.body);
    expect(corpo).not.toMatch(/conversa interna|x\.pdf|afastamento|user-suane|Suane|@lab\.com/);
    expect(Object.keys(res.body as object).sort()).toEqual(
      ['atualizado_em', 'codigo', 'coluna_kanban', 'prioridade', 'resolucao', 'responsavel', 'situacao'],
    );
  });

  it('falha ao gravar a auditoria devolve 500 sem expor o chamado', async () => {
    estado.chamados = [chamado()];
    estado.rpc.mockResolvedValue({ data: null, error: { message: 'function does not exist' } });
    const res = await chamar();
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ success: false, error: 'Erro interno' });
  });
});
