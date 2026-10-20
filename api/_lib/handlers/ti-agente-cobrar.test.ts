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
function criarDb(o: { whatsappAtivo?: boolean; grupo?: string | null; ultimaManual?: string | null; membros?: Record<string, unknown>[]; card?: Record<string, unknown> } = {}) {
  const inserts: unknown[] = [];
  const from = (tabela: string) => {
    const q: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'neq', 'contains', 'order', 'limit']) q[m] = () => q;
    q.maybeSingle = async () => {
      if (tabela === 'it_requests') return { data: { ...CARD, ...o.card }, error: null };
      if (tabela === 'ti_agente_config') {
        return {
          data: { whatsapp_ativo: o.whatsappAtivo ?? true, cobranca_ativa: false, dias_parado: 5, whatsapp_grupo_id: o.grupo ?? null, whatsapp_grupo_nome: o.grupo ? 'TI FAFIN' : null },
          error: null,
        };
      }
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
const usuario = (permissoes: string[], userId = 'u-gestor') => ({ userId, permissoes });

beforeEach(() => vi.clearAllMocks());

describe('POST /api/ti/agente-cobrar (D22, RN16)', () => {
  it('gestor cobra o card de outra pessoa: uma mensagem por responsável, com quem clicou', async () => {
    const { db, inserts } = criarDb();
    dbMock.mockReturnValue(db);
    autorizarMock.mockResolvedValue(usuario(['canManageAgenteTI']));
    const { r, api } = res();
    await handler(req({ card_id: 'c1' }), api);
    expect(r).toMatchObject({ statusCode: 200, body: { modo: 'cobrar', destinatarios: ['Bruno Mendes'], citadosNoGrupo: [], grupoNome: null } });
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

  it('responsável sem adesão e sem grupo escolhido, ou WhatsApp desligado: 422', async () => {
    const semAdesao = criarDb({ membros: [{ id: 'm-bruno', user_id: 'u-bruno', whatsapp: '5561999924986', recebe_cobranca: false, ativo: true, perfil: { name: 'Bruno', deleted_at: null } }] });
    dbMock.mockReturnValue(semAdesao.db);
    autorizarMock.mockResolvedValue(usuario(['canManageAgenteTI']));
    const a = res();
    await handler(req({ card_id: 'c1' }), a.api);
    expect(a.r).toMatchObject({ statusCode: 422, body: { error: expect.stringContaining('não há grupo da equipe escolhido') } });
    expect(semAdesao.inserts).toEqual([]);

    dbMock.mockReturnValue(criarDb({ whatsappAtivo: false }).db);
    const b = res();
    await handler(req({ card_id: 'c1' }), b.api);
    expect(b.r).toMatchObject({ statusCode: 422, body: { error: 'O WhatsApp da EVA está desligado (EVA → Configurações).' } });
  });

  it('quem não recebe pelo WhatsApp é cobrado no grupo, citado pelo nome (D35)', async () => {
    const GRUPO = '120363000000000001@g.us';
    const membros = [
      { id: 'm-bruno', user_id: 'u-bruno', whatsapp: null, recebe_cobranca: false, ativo: true, perfil: { name: 'Bruno Mendes', deleted_at: null } },
      { id: 'm-carla', user_id: 'u-carla', whatsapp: '5561988887777', recebe_cobranca: true, ativo: true, perfil: { name: 'Carla Dias', deleted_at: null } },
      // Inativo na aba Membros: nem no privado, nem citado.
      { id: 'm-davi', user_id: 'u-davi', whatsapp: null, recebe_cobranca: false, ativo: false, perfil: { name: 'Davi Rocha', deleted_at: null } },
    ];
    const { db, inserts } = criarDb({ grupo: GRUPO, membros, card: { assigned_to: ['u-bruno', 'u-carla', 'u-davi'] } });
    dbMock.mockReturnValue(db);
    autorizarMock.mockResolvedValue(usuario(['canManageAgenteTI']));
    const { r, api } = res();
    await handler(req({ card_id: 'c1' }), api);
    expect(r).toMatchObject({ statusCode: 200, body: { modo: 'cobrar', destinatarios: ['Carla Dias'], citadosNoGrupo: ['Bruno'], grupoNome: 'TI FAFIN' } });
    const linhas = inserts[0] as Record<string, unknown>[];
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toMatchObject({ membro_id: 'm-carla', chat_id_destino: null, tipo: 'cobranca_manual' });
    // O mesmo tipo da cobrança pessoal: a janela de 4 h vale para o grupo também.
    expect(linhas[1]).toMatchObject({
      membro_id: null, chat_id_destino: GRUPO, tipo: 'cobranca_manual', card_ids: ['c1'], enviada_por: 'u-gestor',
      texto: expect.stringMatching(/^⏰ Bruno, a task "Firewall" \(IT-031\) está atrasada há \d+ dias\. Consegue atualizar o status no Kanban\?$/),
    });
  });

  it('no Lembrar, sem adesão continua recusado: o lembrete é pessoal, não vai para o grupo', async () => {
    const { db, inserts } = criarDb({
      grupo: '120363000000000001@g.us',
      membros: [{ id: 'm-bruno', user_id: 'u-bruno', whatsapp: null, recebe_cobranca: false, ativo: true, perfil: { name: 'Bruno', deleted_at: null } }],
    });
    dbMock.mockReturnValue(db);
    autorizarMock.mockResolvedValue(usuario(['canManageIT'], 'u-bruno'));
    const { r, api } = res();
    await handler(req({ card_id: 'c1' }), api);
    expect(r).toMatchObject({ statusCode: 422, body: { error: 'Você não tem WhatsApp cadastrado com adesão à cobrança (EVA → Membros).' } });
    expect(inserts).toEqual([]);
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
