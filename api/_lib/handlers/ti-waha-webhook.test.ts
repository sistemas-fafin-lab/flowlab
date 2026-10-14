import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

vi.mock('../supabase.js', () => ({ getSupabaseAdminClient: vi.fn() }));
vi.mock('../ti-agente/respostas.js', () => ({ processarRecebida: vi.fn(async () => ({ ok: true })) }));
vi.mock('../ti-agente/servicos.js', () => ({ dependenciasIA: vi.fn(() => ({})) }));
vi.mock('@vercel/functions', () => ({ waitUntil: vi.fn() }));

import { getSupabaseAdminClient } from '../supabase.js';
import { processarRecebida } from '../ti-agente/respostas.js';
import handler from './ti-waha-webhook.js';

const dbMock = getSupabaseAdminClient as ReturnType<typeof vi.fn>;
const processarMock = processarRecebida as ReturnType<typeof vi.fn>;

function criarDb(opcoes: { insertErro?: { code: string; message: string }; saida?: { id: string; status: string } | null } = {}) {
  const inserts: Record<string, unknown>[] = [];
  const updates: { dados: Record<string, unknown>; filtros: unknown[][] }[] = [];
  const from = () => {
    const filtros: unknown[][] = [];
    const q: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'like', 'limit']) q[m] = (...a: unknown[]) => { filtros.push([m, ...a]); return q; };
    q.maybeSingle = async () => ({ data: opcoes.saida ?? null, error: null });
    q.single = async () => (opcoes.insertErro ? { data: null, error: opcoes.insertErro } : { data: { id: 'nova' }, error: null });
    q.then = (ok: (v: unknown) => unknown) =>
      Promise.resolve({ data: [{ id: 'm-bruno', user_id: 'u-bruno', whatsapp: '5561999924986', whatsapp_chat_id: null, ativo: true }], error: null }).then(ok);
    q.insert = (linha: Record<string, unknown>) => { inserts.push(linha); return q; };
    q.update = (dados: Record<string, unknown>) => { const u = { dados, filtros: [] as unknown[][] }; updates.push(u); const uq = { eq: (...a: unknown[]) => { u.filtros.push(a); return uq; } }; return uq; };
    return q;
  };
  return { db: { from }, inserts, updates };
}

/** `token: null` = sem token na URL. */
function req(body: unknown, token: string | null = 'segredo'): VercelRequest {
  return { method: 'POST', headers: {}, query: token ? { token } : {}, body } as unknown as VercelRequest;
}
function res() {
  const r = { statusCode: 0, body: undefined as Record<string, unknown> | undefined };
  const api = { setHeader: () => api, status: (c: number) => { r.statusCode = c; return api; }, json: (b: Record<string, unknown>) => { r.body = b; return api; } };
  return { r, api: api as unknown as VercelResponse };
}
const mensagem = (from: string, extra: Record<string, unknown> = {}) =>
  ({ event: 'message', session: 'ti_agente', payload: { id: 'false_x_AAA', from, fromMe: false, body: 'IT-045 concluída', ...extra } });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.WAHA_WEBHOOK_SECRET = 'segredo';
  delete process.env.WAHA_SESSION;
});
afterEach(() => { delete process.env.WAHA_WEBHOOK_SECRET; });

describe('POST /api/ti/waha-webhook', () => {
  it('token errado ou ausente: 401, sem tocar no banco', async () => {
    for (const t of ['errado', null]) {
      const { r, api } = res();
      await handler(req(mensagem('556199924986@c.us'), t), api);
      expect(r.statusCode).toBe(401);
    }
    expect(dbMock).not.toHaveBeenCalled();
  });

  it('grupo é ignorado sem gravar (RN13)', async () => {
    const { r, api } = res();
    await handler(req(mensagem('120363@g.us')), api);
    expect(r).toMatchObject({ statusCode: 200, body: { ignorado: 'grupo, lista ou canal' } });
    expect(dbMock).not.toHaveBeenCalled();
  });

  it('número desconhecido: registrada como ignorada, sem interpretação', async () => {
    const { db, inserts } = criarDb();
    dbMock.mockReturnValue(db);
    const { r, api } = res();
    await handler(req(mensagem('5511900000000@c.us')), api);
    expect(r.statusCode).toBe(200);
    expect(inserts[0]).toMatchObject({ membro_id: null, status: 'ignorada', direcao: 'entrada' });
    expect(processarMock).not.toHaveBeenCalled();
  });

  it('membro: grava a recebida e interpreta em segundo plano', async () => {
    const { db, inserts } = criarDb();
    dbMock.mockReturnValue(db);
    const { r, api } = res();
    await handler(req(mensagem('556199924986@c.us')), api);
    expect(r).toMatchObject({ statusCode: 200, body: { recebida: 'nova' } });
    expect(inserts[0]).toMatchObject({ membro_id: 'm-bruno', status: 'recebida', waha_message_id: 'false_x_AAA', texto: 'IT-045 concluída' });
    expect(processarMock).toHaveBeenCalledWith(db, {}, 'nova');
  });

  it('entrega repetida pelo WAHA não duplica nem reinterpreta', async () => {
    const { db } = criarDb({ insertErro: { code: '23505', message: 'duplicate key' } });
    dbMock.mockReturnValue(db);
    const { r, api } = res();
    await handler(req(mensagem('556199924986@c.us')), api);
    expect(r.body).toMatchObject({ repetida: true });
    expect(processarMock).not.toHaveBeenCalled();
  });

  it('ack: enviada vira lida; lida não volta para entregue', async () => {
    const { db, updates } = criarDb({ saida: { id: 's1', status: 'enviada' } });
    dbMock.mockReturnValue(db);
    const { r, api } = res();
    await handler(req({ event: 'message.ack', session: 'ti_agente', payload: { id: 'true_x@c.us_B', ack: 3 } }), api);
    expect(r.body).toMatchObject({ ack: 'lida' });
    expect(updates[0]).toEqual({ dados: { status: 'lida' }, filtros: [['id', 's1'], ['status', 'enviada']] });

    const outro = criarDb({ saida: { id: 's1', status: 'lida' } });
    dbMock.mockReturnValue(outro.db);
    const { r: r2, api: api2 } = res();
    await handler(req({ event: 'message.ack', session: 'ti_agente', payload: { id: 'true_x@c.us_B', ack: 2 } }), api2);
    expect(r2.body).toMatchObject({ ack: 'sem mudança' });
    expect(outro.updates).toEqual([]);
  });

  it('sem WAHA_WEBHOOK_SECRET configurado: 503', async () => {
    delete process.env.WAHA_WEBHOOK_SECRET;
    const { r, api } = res();
    await handler(req(mensagem('556199924986@c.us')), api);
    expect(r.statusCode).toBe(503);
  });
});
