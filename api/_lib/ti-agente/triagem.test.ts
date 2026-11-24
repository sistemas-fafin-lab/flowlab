import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../labBrainSugestao.js', async (original) => ({
  ...(await original<typeof import('../labBrainSugestao.js')>()),
  // A análise em si é a mesma do LAB-BRAIN (labBrainChamados.test); aqui, quem entra na triagem.
  criarSugestaoDePromocao: vi.fn(async () => true),
}));

import { criarSugestaoDePromocao } from '../labBrainSugestao.js';
import { TRIAGEM_POR_VOLTA, triarChamadosNovos } from './triagem.js';

// Dados fictícios.
const chamado = (id: string, extra: Record<string, unknown> = {}) => ({
  id, codigo: `IT-${id.slice(1).padStart(3, '0')}`, title: `Pedido ${id}`, description: 'Detalhe', priority: 'medium', request_type: 'suporte', origem: null, ...extra,
});

function criarDb(e: { desde: string | null; chamados: Record<string, unknown>[]; jaTem: string[] }) {
  const from = (tabela: string) => {
    const q: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in', 'gte', 'order', 'limit']) q[m] = () => q;
    q.maybeSingle = async () => ({ data: tabela === 'ti_agente_config' ? { triagem_desde: e.desde } : null, error: null });
    q.then = (ok: (v: unknown) => unknown) => Promise.resolve(
      tabela === 'it_requests' ? { data: e.chamados, error: null } : { data: e.jaTem.map((card_id) => ({ card_id })), error: null },
    ).then(ok);
    return q;
  };
  return { from } as never;
}

beforeEach(() => vi.mocked(criarSugestaoDePromocao).mockClear());

describe('triagem de todo chamado (D45)', () => {
  it('só os da tela, sem sugestão ainda, no máximo 5 por volta, com a origem "triagem"', async () => {
    const chamados = [
      chamado('c1'),
      chamado('c2'), // já tem sugestão
      chamado('c3', { origem: 'lab-brain' }), // o LAB-BRAIN já sugere na criação
      ...['c4', 'c5', 'c6', 'c7', 'c8'].map((id) => chamado(id)),
    ];
    const r = await triarChamadosNovos(criarDb({ desde: '2026-11-24T10:00:00Z', chamados, jaTem: ['c2'] }), {} as never);
    expect(r).toEqual({ analisados: TRIAGEM_POR_VOLTA, sugeridos: TRIAGEM_POR_VOLTA, pulado: null });
    const chamadas = vi.mocked(criarSugestaoDePromocao).mock.calls;
    expect(chamadas.map((c) => c[2].id)).toEqual(['c1', 'c4', 'c5', 'c6', 'c7']);
    expect(chamadas[0][2]).toEqual({ id: 'c1', codigo: 'IT-001', titulo: 'Pedido c1', descricao: 'Detalhe', prioridade: 'medium', tipo: 'suporte', origem: 'tela' });
    expect(chamadas[0][3]).toEqual({ origem: 'triagem' });
  });

  it('sem a data de início (ou sem a migration), a triagem fica desligada', async () => {
    const r = await triarChamadosNovos(criarDb({ desde: null, chamados: [chamado('c1')], jaTem: [] }), {} as never);
    expect(r.pulado).toMatch(/desligada/);
    expect(criarSugestaoDePromocao).not.toHaveBeenCalled();
  });
});
