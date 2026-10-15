import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

vi.mock('../supabase.js', () => ({ getSupabaseAdminClient: vi.fn() }));
vi.mock('../ti-agente/autorizacao.js', async (original) => ({
  ...(await original<typeof import('../ti-agente/autorizacao.js')>()),
  autorizar: vi.fn(),
}));

import { getSupabaseAdminClient } from '../supabase.js';
import { autorizar } from '../ti-agente/autorizacao.js';
import handler from './ti-agente-cobrar.js';
import { cobrarCard } from '../ti-agente/cobranca.js';

const dbMock = getSupabaseAdminClient as ReturnType<typeof vi.fn>;
const autorizarMock = autorizar as ReturnType<typeof vi.fn>;

const CARD = {
  id: 'c1', codigo: 'IT-031', title: 'Firewall', priority: 'high', status: 'in_progress', kanban_status: 'in_progress',
  assigned_to: ['u-bruno'], due_date: '2026-01-10T00:00:00.000Z', kanban_hidden: false, project_id: null, sprint_id: null,
  updated_at: '2026-01-10T12:00:00Z', created_at: '2026-01-01T12:00:00Z',
};

/** Banco falso por tabela: o que cada consulta devolve e o que foi inserido. */
function criarDb(o: { whatsappAtivo?: boolean; ultimaManual?: string | null; membros?: Record<string, unknown>[] } = {}) {
  const inserts: unknown[] = [];
  const from = (tabela: string) => {
    const q: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'neq', 'contains', 'order', 'limit']) q[m] = () => q;
    q.maybeSingle = async () => {
      if (tabela === 'it_requests') return { data: CARD, error: null };
      if (tabela === 'ti_agente_config') return { data: { whatsapp_ativo: o.whatsappAtivo ?? true, cobranca_ativa: false, dias_parado: 5 }, error: null };
      return { data: o.ultimaManual ? { created_at: o.ultimaManual } : null, error: null };
    };
    q.then = (ok: (v: unknown) => unknown) => Promise.resolve({
      data: o.membros ?? [{ id: 'm-bruno', user_id: 'u-bruno', whatsapp: '5561999924986', recebe_cobranca: true, ativo: true, perfil: { name: 'Bruno Mendes', deleted_at: null } }],
      error: null,
    }).then(ok);
    q.insert = async (linhas: unknown) => { inserts.push(linhas); return { error: null }; };
    return q;
  };
  return { db: { from }, inserts };
}

const req = (body: unknown) => ({ method: 'POST', headers: { authorization: 'Bearer t' }, body }) as unknown as VercelRequest;
function res() {
  const r = { statusCode: 0, body: undefined as Record<string, unknown> | undefined };
  const api = { setHeader: () => api, status: (c: number) => { r.statusCode = c; return api; }, json: (b: Record<string, unknown>) => { r.body = b; return api; } };
  return { r, api: api as unknown as VercelResponse };
}
const usuario = (permissoes: string[], userId = 'u-gestor') => ({ userId, permissoes, ehAdmin: false });

beforeEach(() => vi.clearAllMocks());

describe('POST /api/ti/agente-cobrar (D22, RN16)', () => {
  it('gestor cobra o card de outra pessoa: uma mensagem por responsável, com quem clicou', async () => {
    const { db, inserts } = criarDb();
    dbMock.mockReturnValue(db);
    autorizarMock.mockResolvedValue(usuario(['canManageAgenteTI']));
    const { r, api } = res();
    await handler(req({ card_id: 'c1' }), api);
    expect(r).toMatchObject({ statusCode: 200, body: { modo: 'cobrar', destinatarios: ['Bruno Mendes'] } });
    expect(inserts[0]).toEqual([expect.objectContaining({ membro_id: 'm-bruno', tipo: 'cobranca_manual', status: 'pendente', card_ids: ['c1'], enviada_por: 'u-gestor' })]);
  });

  it('quem não é gestor não cobra card dos outros: 403', async () => {
    const { db, inserts } = criarDb();
    dbMock.mockReturnValue(db);
    autorizarMock.mockResolvedValue(usuario(['canManageIT']));
    const { r, api } = res();
    await handler(req({ card_id: 'c1' }), api);
    expect(r.statusCode).toBe(403);
    expect(inserts).toEqual([]);
  });

  it('cobrança manual há menos de 4 h: 409', async () => {
    const { db, inserts } = criarDb({ ultimaManual: new Date(Date.now() - 60 * 60 * 1000).toISOString() });
    dbMock.mockReturnValue(db);
    autorizarMock.mockResolvedValue(usuario(['canManageAgenteTI']));
    const { r, api } = res();
    await handler(req({ card_id: 'c1' }), api);
    expect(r.statusCode).toBe(409);
    expect(inserts).toEqual([]);
  });

  it('responsável sem adesão ou WhatsApp desligado: 422', async () => {
    const semAdesao = criarDb({ membros: [{ id: 'm-bruno', user_id: 'u-bruno', whatsapp: '5561999924986', recebe_cobranca: false, ativo: true, perfil: { name: 'Bruno', deleted_at: null } }] });
    dbMock.mockReturnValue(semAdesao.db);
    autorizarMock.mockResolvedValue(usuario(['canManageAgenteTI']));
    const a = res();
    await handler(req({ card_id: 'c1' }), a.api);
    expect(a.r.statusCode).toBe(422);

    dbMock.mockReturnValue(criarDb({ whatsappAtivo: false }).db);
    const b = res();
    await handler(req({ card_id: 'c1' }), b.api);
    expect(b.r).toMatchObject({ statusCode: 422, body: { error: 'O WhatsApp da EVA está desligado (EVA → Configurações).' } });
  });

  it('no fim de semana, a cobrança vai agendada para segunda às 7h', async () => {
    const { db, inserts } = criarDb();
    const sabado = new Date('2026-10-17T10:00:00-03:00');
    const r = await cobrarCard(db as never, usuario(['canManageAgenteTI']), 'c1', sabado);
    expect(r).toMatchObject({ ok: true, agendadaPara: '2026-10-19T10:00:00.000Z' });
    expect(inserts[0]).toEqual([expect.objectContaining({ proxima_tentativa_em: '2026-10-19T10:00:00.000Z' })]);
  });

  it('Lembrar o próprio card com canManageIT', async () => {
    const { db } = criarDb();
    dbMock.mockReturnValue(db);
    autorizarMock.mockResolvedValue(usuario(['canManageIT'], 'u-bruno'));
    const { r, api } = res();
    await handler(req({ card_id: 'c1' }), api);
    expect(r).toMatchObject({ statusCode: 200, body: { modo: 'lembrar' } });
  });
});
