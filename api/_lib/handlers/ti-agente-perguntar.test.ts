import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

vi.mock('../supabase.js', () => ({ getSupabaseAdminClient: vi.fn() }));
vi.mock('../ti-agente/autorizacao.js', async (original) => ({
  ...(await original<typeof import('../ti-agente/autorizacao.js')>()),
  autorizar: vi.fn(),
}));
vi.mock('../ti-agente/dados.js', () => ({ lerContexto: vi.fn() }));
vi.mock('../ti-agente/servicos.js', () => ({ dependenciasIA: vi.fn(() => ({})) }));
vi.mock('../ti-agente/ia/gerarEstruturado.js', () => ({ gerarEstruturado: vi.fn() }));

import { getSupabaseAdminClient } from '../supabase.js';
import { autorizar } from '../ti-agente/autorizacao.js';
import { lerContexto } from '../ti-agente/dados.js';
import { gerarEstruturado } from '../ti-agente/ia/gerarEstruturado.js';
import type { ContextoExtracao } from '../ti-agente/extracao.js';
import handler from './ti-agente-perguntar.js';

const autorizarMock = autorizar as ReturnType<typeof vi.fn>;
const lerContextoMock = lerContexto as ReturnType<typeof vi.fn>;
const gerarMock = gerarEstruturado as ReturnType<typeof vi.fn>;
const dbMock = getSupabaseAdminClient as ReturnType<typeof vi.fn>;

const CTX: ContextoExtracao = {
  membros: [{ id: 'u-ana', nome: 'Ana Costa', apelidos: [] }, { id: 'u-bruno', nome: 'Bruno Mendes', apelidos: [] }],
  cards: [
    { id: 'c1', codigo: 'IT-010', title: 'Portal', kanban_status: 'in_progress', priority: 'high', assigned_to: ['u-ana'], due_date: null, project_id: null },
    { id: 'c2', codigo: 'IT-011', title: 'Backup', kanban_status: 'todo', priority: 'medium', assigned_to: ['u-bruno'], due_date: null, project_id: null },
  ],
  projetos: [],
  sprints: [],
};

/** Consulta encadeável do supabase-js: qualquer filtro devolve a própria consulta. */
function consulta(resultado: unknown) {
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'neq', 'gte', 'order', 'limit']) q[m] = () => q;
  q.maybeSingle = async () => resultado;
  q.then = (ok: (v: unknown) => unknown, falha: (e: unknown) => unknown) => Promise.resolve(resultado).then(ok, falha);
  return q;
}

function criarDb(perguntasHoje: number) {
  const tabelas: string[] = [];
  const escritas: string[] = [];
  const db = {
    from: (tabela: string) => {
      tabelas.push(tabela);
      const q = tabela === 'ti_agente_chamadas_ia' ? consulta({ count: perguntasHoje, error: null }) : consulta({ data: tabela === 'ti_agente_mensagens' ? [] : null, error: null });
      for (const m of ['insert', 'update', 'upsert', 'delete']) q[m] = () => { escritas.push(`${tabela}.${m}`); return q; };
      return q;
    },
    rpc: (nome: string) => { escritas.push(`rpc:${nome}`); return consulta({ data: null, error: null }); },
  };
  return { db, tabelas, escritas };
}

function req(body: unknown): VercelRequest {
  return { method: 'POST', headers: { authorization: 'Bearer t' }, body } as unknown as VercelRequest;
}

function res() {
  const r = { statusCode: 0, body: undefined as unknown };
  const api = {
    setHeader: () => api,
    status: (c: number) => { r.statusCode = c; return api; },
    json: (b: unknown) => { r.body = b; return api; },
  };
  return { r, api: api as unknown as VercelResponse };
}

const usuario = (permissoes: string[]) => ({ userId: 'u-bruno', permissoes, ehAdmin: false });

beforeEach(() => {
  vi.clearAllMocks();
  lerContextoMock.mockResolvedValue(CTX);
});

describe('POST /api/ti/agente-perguntar', () => {
  it('a 31ª pergunta do dia é recusada sem chamar a IA (RN17)', async () => {
    const { db } = criarDb(30);
    dbMock.mockReturnValue(db);
    autorizarMock.mockResolvedValue(usuario(['canManageIT']));
    const { r, api } = res();
    await handler(req({ pergunta: 'O que está atrasado?' }), api);
    expect(r.statusCode).toBe(429);
    expect((r.body as { error: string }).error).toContain('Você chegou ao limite de perguntas de hoje');
    expect(gerarMock).not.toHaveBeenCalled();
  });

  it('pedido de mudança volta como proposta e nada é escrito até a confirmação (D28)', async () => {
    const { db, escritas } = criarDb(3);
    dbMock.mockReturnValue(db);
    autorizarMock.mockResolvedValue(usuario(['canManageIT']));
    gerarMock.mockResolvedValue({
      ok: true, provedor: 'claude', motivoReserva: null, tentativas: [],
      dados: {
        resposta: 'Preparei a proposta para aprovação.',
        cards_citados: ['IT-011'],
        propostas: [{
          tipo: 'atualizar_card', card_codigo: 'IT-011', titulo: null, descricao: null, responsaveis: [], prazo: null, prazo_texto: null,
          prioridade: null, kanban_status: 'review', projeto_id: null, sprint: null, comentario: null, trecho: 'move o IT-011 para revisão', confianca: 'alta',
        }],
      },
    });
    const { r, api } = res();
    await handler(req({ pergunta: 'move o IT-011 para revisão', visao: 'team' }), api);
    expect(r.statusCode).toBe(200);
    expect(r.body).toMatchObject({ success: true, propostas: [{ tipo: 'atualizar_card', card_id: 'c2', proposta: { kanban_status: 'review' } }] });
    expect(escritas).toEqual([]);
  });

  it('Minha visão manda só os cards da pessoa; quem não é gestor não leva a fila', async () => {
    const { db, tabelas } = criarDb(0);
    dbMock.mockReturnValue(db);
    autorizarMock.mockResolvedValue(usuario(['canManageIT']));
    gerarMock.mockResolvedValue({ ok: true, provedor: 'claude', motivoReserva: null, tentativas: [], dados: { resposta: 'ok', cards_citados: ['IT-010'], propostas: [] } });
    const { r, api } = res();
    await handler(req({ pergunta: 'minhas tasks?', visao: 'me' }), api);
    const pedido = gerarMock.mock.calls[0][0] as { contexto: string; finalidade: string; esforco: string; userId: string };
    expect(pedido).toMatchObject({ finalidade: 'chat', esforco: 'low', userId: 'u-bruno' });
    expect(pedido.contexto).toContain('IT-011');
    expect(pedido.contexto).not.toContain('IT-010');
    expect(pedido.contexto).not.toContain('FILA DO WHATSAPP');
    expect(tabelas).not.toContain('ti_agente_mensagens');
    // O código citado que não está no contexto recortado sai da resposta.
    expect(r.body).toMatchObject({ cardsCitados: [] });
  });

  it('gestor leva a fila do WhatsApp no contexto', async () => {
    const { db, tabelas } = criarDb(0);
    dbMock.mockReturnValue(db);
    autorizarMock.mockResolvedValue(usuario(['canApproveAgenteTI']));
    gerarMock.mockResolvedValue({ ok: true, provedor: 'claude', motivoReserva: null, tentativas: [], dados: { resposta: 'ok', cards_citados: [], propostas: [] } });
    const { api } = res();
    await handler(req({ pergunta: 'quem foi cobrado?' }), api);
    expect(tabelas).toContain('ti_agente_mensagens');
    expect((gerarMock.mock.calls[0][0] as { contexto: string }).contexto).toContain('FILA DO WHATSAPP');
  });

  it('os dois provedores falhando dá a mensagem do handoff', async () => {
    const { db } = criarDb(0);
    dbMock.mockReturnValue(db);
    autorizarMock.mockResolvedValue(usuario(['canManageIT']));
    gerarMock.mockResolvedValue({ ok: false, erros: ['Claude: erro', 'Gemini: erro'], tentativas: [] });
    const { r, api } = res();
    await handler(req({ pergunta: 'oi' }), api);
    expect(r.statusCode).toBe(502);
    expect((r.body as { error: string }).error).toBe('Não consegui consultar o board agora. Tente novamente em alguns segundos.');
  });

  it('pergunta vazia é recusada', async () => {
    autorizarMock.mockResolvedValue(usuario(['canManageIT']));
    const { r, api } = res();
    await handler(req({ pergunta: '  ' }), api);
    expect(r.statusCode).toBe(400);
  });
});
