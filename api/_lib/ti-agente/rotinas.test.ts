import { describe, expect, it } from 'vitest';
import { criarCardsDeRotina } from './rotinas.js';

// Dados fictícios. Quarta, 02/12/2026.
const AGORA = new Date('2026-12-02T09:00:00-03:00');
type Linha = Record<string, unknown>;

/** Banco falso: rotinas (update com a trava pela data lida) e it_requests (insert). */
function criarDb(e: { rotinas: Linha[]; semTabela?: boolean; cardFalha?: string; outroPegou?: boolean }) {
  const cards: Linha[] = [];
  const from = (tabela: string) => {
    const filtros: [string, unknown][] = [];
    let op: 'select' | 'update' | 'insert' = 'select';
    let valores: Linha = {};
    const q: Record<string, unknown> = {};
    q.select = () => q;
    q.limit = () => q;
    q.eq = (k: string, v: unknown) => { filtros.push([k, v]); return q; };
    q.update = (v: Linha) => { op = 'update'; valores = v; return q; };
    q.insert = (v: Linha) => { op = 'insert'; valores = v; return q; };
    const rodar = () => {
      if (tabela === 'ti_agente_rotinas') {
        if (e.semTabela) return { data: null, error: { message: 'relation "ti_agente_rotinas" does not exist' } };
        const achadas = e.rotinas.filter((r) => filtros.every(([k, v]) => r[k] === v));
        if (op === 'update') {
          // Outra volta do relógio trocou a data antes.
          if (e.outroPegou && 'proxima_em' in valores) return { data: [], error: null };
          achadas.forEach((r) => Object.assign(r, valores));
          return { data: achadas.map((r) => ({ id: r.id })), error: null };
        }
        return { data: achadas, error: null };
      }
      return { data: null, error: null };
    };
    q.single = async () => {
      if (e.cardFalha) return { data: null, error: { message: e.cardFalha } };
      const card = { id: `card-${cards.length + 1}`, codigo: `IT-${500 + cards.length}`, ...valores };
      cards.push(card);
      return { data: { id: card.id, codigo: card.codigo }, error: null };
    };
    q.then = (ok: (v: unknown) => unknown) => Promise.resolve(rodar()).then(ok);
    return q;
  };
  return { db: { from } as never, cards };
}

const backup = (r: Linha = {}) => ({
  id: 'r1', titulo: 'Backup mensal do servidor', descricao: 'Conferir o log.', frequencia: 'mensal', dia_ancora: 5, proxima_em: '2026-12-05',
  antecedencia_dias: 3, responsaveis: ['u-ana'], prioridade: 'high', projeto_id: null, ativa: true, created_by: 'u-gil', ...r,
});

describe('criarCardsDeRotina', () => {
  it('no dia de criar, o card sai com o prazo, os responsáveis e a prioridade, e a data anda', async () => {
    const rotina = backup();
    const { db, cards } = criarDb({ rotinas: [rotina] });
    expect(await criarCardsDeRotina(db, { agora: AGORA })).toEqual({ pulado: null, criados: ['IT-500'], erros: [] });
    expect(cards[0]).toMatchObject({
      title: 'Backup mensal do servidor', request_type: 'suporte', priority: 'high', status: 'pending', kanban_status: 'todo',
      requested_by: 'u-gil', assigned_to: ['u-ana'], due_date: '2026-12-05T00:00:00.000Z', is_internal: true, tags: ['agente-ti', 'rotina'],
      description: 'Conferir o log.\n\nCard de rotina criado pela EVA (todo mês, dia 5).',
    });
    expect(rotina).toMatchObject({ proxima_em: '2027-01-05', ultimo_card_id: 'card-1', ultimo_erro: null });
    // A volta seguinte do relógio não cria de novo.
    expect((await criarCardsDeRotina(db, { agora: new Date('2026-12-02T09:10:00-03:00') })).criados).toEqual([]);
  });

  it('antes do dia de criar, nada muda', async () => {
    const rotina = backup({ proxima_em: '2026-12-20' });
    const { db, cards } = criarDb({ rotinas: [rotina] });
    expect((await criarCardsDeRotina(db, { agora: AGORA })).criados).toEqual([]);
    expect(cards).toEqual([]);
    expect(rotina.proxima_em).toBe('2026-12-20');
  });

  it('se outra volta trocou a data antes, não cria o card de novo', async () => {
    const { db, cards } = criarDb({ rotinas: [backup()], outroPegou: true });
    expect((await criarCardsDeRotina(db, { agora: AGORA })).criados).toEqual([]);
    expect(cards).toEqual([]);
  });

  it('se o card falha, o erro fica na rotina e a data não volta', async () => {
    const rotina = backup();
    const { db } = criarDb({ rotinas: [rotina], cardFalha: 'invalid input syntax for type uuid' });
    const r = await criarCardsDeRotina(db, { agora: AGORA });
    expect(r.erros).toEqual(['Backup mensal do servidor: Não consegui criar o card de 2026-12-05: invalid input syntax for type uuid']);
    expect(rotina).toMatchObject({ proxima_em: '2027-01-05', ultimo_erro: 'Não consegui criar o card de 2026-12-05: invalid input syntax for type uuid' });
  });

  it('sem a tabela (migration não aplicada), não faz nada', async () => {
    expect(await criarCardsDeRotina(criarDb({ rotinas: [], semTabela: true }).db, { agora: AGORA })).toMatchObject({ pulado: 'Sem a tabela de rotinas.' });
  });
});
