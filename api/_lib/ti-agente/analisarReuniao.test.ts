import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./dados.js', async (original) => ({
  ...(await original<typeof import('./dados.js')>()),
  lerContexto: vi.fn(),
  avisarQuemTem: vi.fn(),
}));
vi.mock('./ia/gerarEstruturado.js', () => ({ gerarEstruturado: vi.fn() }));
vi.mock('./grupo.js', () => ({ enviarResumoDaReuniao: vi.fn(async () => null) }));

import { avisarQuemTem, lerContexto, lerQuemTem } from './dados.js';
import { gerarEstruturado, type Dependencias } from './ia/gerarEstruturado.js';
import { analisarReuniao } from './analisarReuniao.js';

const avisarMock = avisarQuemTem as ReturnType<typeof vi.fn>;
const gerarMock = gerarEstruturado as ReturnType<typeof vi.fn>;
(lerContexto as ReturnType<typeof vi.fn>).mockResolvedValue({ membros: [], cards: [], projetos: [], sprints: [] });

/** Consulta encadeável do supabase-js que registra filtros e escritas. */
function criarDb() {
  const updates: { tabela: string; dados: Record<string, unknown> }[] = [];
  const filtros: { tabela: string; metodo: string; args: unknown[] }[] = [];
  const consulta = (tabela: string, resultado: unknown) => {
    const q: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'is', 'or', 'order', 'limit', 'contains']) {
      q[m] = (...args: unknown[]) => { filtros.push({ tabela, metodo: m, args }); return q; };
    }
    q.single = async () => resultado;
    q.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok);
    q.update = (dados: Record<string, unknown>) => { updates.push({ tabela, dados }); return q; };
    q.insert = async () => ({ error: null });
    return q;
  };
  const db = {
    from: (tabela: string) =>
      consulta(tabela, { data: { id: 'r1', titulo: 'Review', realizada_em: '2026-10-10T17:00:00Z', resumo_markdown: 'x' }, error: null }),
  };
  return { db, updates, filtros };
}

const saidaComUmaSugestao = {
  ok: true, provedor: 'claude', motivoReserva: null, tentativas: [],
  dados: {
    observacoes: 'Decisão',
    sugestoes: [{
      tipo: 'criar_card', card_codigo: null, titulo: 'Card novo', descricao: null, responsaveis: [], prazo: null, prazo_texto: null,
      prioridade: null, kanban_status: null, projeto_id: null, sprint: null, comentario: null, trecho: 't', confianca: 'alta',
    }],
  },
};

beforeEach(() => vi.clearAllMocks());

describe('analisarReuniao', () => {
  it('falha no aviso do sino não marca como erro uma análise já gravada', async () => {
    const { db, updates } = criarDb();
    gerarMock.mockResolvedValue(saidaComUmaSugestao);
    avisarMock.mockRejectedValue(new Error('invalid input syntax for type json'));
    const r = await analisarReuniao(db as never, {} as Dependencias, 'r1');
    expect(r).toMatchObject({ ok: true, erro: null });
    const status = updates.filter((u) => u.tabela === 'ti_agente_reunioes').map((u) => u.dados.status);
    expect(status).toEqual(['analisando', 'analisada']);
  });
});

describe('lerQuemTem', () => {
  it('filtra custom_roles.permissions (jsonb) com JSON, não com literal de array', async () => {
    const { db, filtros } = criarDb();
    await lerQuemTem(db as never, 'canApproveAgenteTI');
    const contains = filtros.find((f) => f.metodo === 'contains');
    expect(contains?.args).toEqual(['permissions', '["canApproveAgenteTI"]']);
  });

  it('aplica a aba Permissões (D33): a linha dá ou tira a chave; admin sempre', async () => {
    const tabelas: Record<string, unknown[]> = {
      custom_roles: [{ id: 'cargo-aprova' }],
      ti_agente_papeis: [
        { user_id: 'tirou', configura: false, gestor: true, aprova: false },
        { user_id: 'ganhou', configura: false, gestor: false, aprova: true },
        { user_id: 'admin-com-linha', configura: false, gestor: false, aprova: false },
      ],
      // O que o banco devolveria para o filtro: admins, gente do cargo e quem ganhou pela linha.
      user_profiles: [
        { id: 'admin-com-linha', role: 'admin' },
        { id: 'pelo-cargo', role: 'user' },
        { id: 'tirou', role: 'user' },
        { id: 'ganhou', role: 'user' },
      ],
    };
    const ors: string[] = [];
    const db = {
      from: (tabela: string) => {
        const q: Record<string, unknown> = {};
        for (const m of ['select', 'eq', 'is', 'contains', 'limit']) q[m] = () => q;
        q.or = (f: string) => { ors.push(f); return q; };
        q.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: tabelas[tabela] ?? [], error: null }).then(ok);
        return q;
      },
    };
    const ids = await lerQuemTem(db as never, 'canApproveAgenteTI');
    expect(ids.sort()).toEqual(['admin-com-linha', 'ganhou', 'pelo-cargo']);
    expect(ors[0]).toBe('role.eq.admin,custom_role_id.in.(cargo-aprova),id.in.(ganhou)');

    // Fora das chaves da EVA, a aba Permissões não entra.
    ors.length = 0;
    expect((await lerQuemTem(db as never, 'canManageIT')).sort()).toEqual(['admin-com-linha', 'ganhou', 'pelo-cargo', 'tirou']);
    expect(ors[0]).toBe('role.eq.admin,custom_role_id.in.(cargo-aprova)');
  });
});
