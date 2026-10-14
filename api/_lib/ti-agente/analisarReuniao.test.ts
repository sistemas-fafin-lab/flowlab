import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./dados.js', async (original) => ({
  ...(await original<typeof import('./dados.js')>()),
  lerContexto: vi.fn(),
  avisarGestores: vi.fn(),
}));
vi.mock('./ia/gerarEstruturado.js', () => ({ gerarEstruturado: vi.fn() }));

import { avisarGestores, lerContexto, lerGestores } from './dados.js';
import { gerarEstruturado, type Dependencias } from './ia/gerarEstruturado.js';
import { analisarReuniao } from './analisarReuniao.js';

const avisarMock = avisarGestores as ReturnType<typeof vi.fn>;
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

describe('lerGestores', () => {
  it('filtra custom_roles.permissions (jsonb) com JSON, não com literal de array', async () => {
    const { db, filtros } = criarDb();
    await lerGestores(db as never);
    const contains = filtros.find((f) => f.metodo === 'contains');
    expect(contains?.args).toEqual(['permissions', '["canApproveAgenteTI"]']);
  });
});
