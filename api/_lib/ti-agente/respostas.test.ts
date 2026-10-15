import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./dados.js', () => ({ avisarQuemTem: vi.fn(async () => undefined) }));

import { avisarQuemTem } from './dados.js';
import {
  NAO_ACHEI_CARD, linhaDoCard, montarConfirmacao, propostaDoItem, registrarAtualizacoes, respostaFiel, validarResposta, type SaidaResposta,
} from './respostas.js';
import type { CardTI } from '../../../src/modules/eva/domain/demandas.js';

const HOJE = '2026-10-13';
const card = (c: Partial<CardTI>): CardTI => ({
  id: 'c1', codigo: 'IT-045', title: 'Robô de pré-faturamento', priority: 'high', status: 'in_progress', kanban_status: 'in_progress',
  assigned_to: ['u-bruno'], due_date: '2026-10-10T00:00:00.000Z', kanban_hidden: false, project_id: null, sprint_id: null,
  updated_at: '2026-10-10T12:00:00Z', created_at: '2026-10-01T12:00:00Z', ...c,
});
const C1 = card({});
const C2 = card({ id: 'c2', codigo: 'IT-052', title: 'Hub de Laudos', due_date: '2026-10-14T00:00:00.000Z' });
const saida = (itens: SaidaResposta['itens']): SaidaResposta => ({ itens, confianca: 'alta' });
const item = (i: Partial<SaidaResposta['itens'][number]>) => ({ card_codigo: 'IT-045', intencao: 'atualizar' as const, nova_data: null, prazo_texto: null, ...i });

describe('interpretação da resposta', () => {
  it('linha do card para o contexto da IA (prazo no dia do Board)', () => {
    expect(linhaDoCard(C1)).toBe('- IT-045 | Robô de pré-faturamento | coluna: in_progress | prazo: 2026-10-10');
  });

  it('só cards da lista; data inválida ou passada some; um item por card', () => {
    const v = validarResposta(saida([
      item({ intencao: 'concluir' }),
      item({ card_codigo: 'it-045', intencao: 'adiar' }),
      item({ card_codigo: 'IT-052', intencao: 'adiar', nova_data: '2026-10-01' }),
      item({ card_codigo: 'IT-999', intencao: 'concluir' }),
    ]), [C1, C2], HOJE);
    expect(v.map((i) => [i.card.codigo, i.intencao, i.novaData])).toEqual([['IT-045', 'concluir', null], ['IT-052', 'adiar', null]]);
  });

  it('o que vira sugestão: concluir e adiar com data nova (D12)', () => {
    expect(propostaDoItem({ card: C1, intencao: 'concluir', novaData: null, prazoTexto: null })).toEqual({ kanban_status: 'done' });
    expect(propostaDoItem({ card: C2, intencao: 'adiar', novaData: '2026-10-16', prazoTexto: 'sexta' })).toEqual({ prazo: '2026-10-16', prazo_texto: 'sexta' });
    expect(propostaDoItem({ card: C2, intencao: 'adiar', novaData: '2026-10-14', prazoTexto: null })).toBeNull();
    expect(propostaDoItem({ card: C1, intencao: 'bloquear', novaData: null, prazoTexto: null })).toBeNull();
  });

  it('confirmação diz o que vai para aprovação, e pede o código quando não acha', () => {
    expect(montarConfirmacao('Bruno Mendes', [
      { card: C1, intencao: 'concluir', novaData: null, prazoTexto: null },
      { card: C2, intencao: 'adiar', novaData: '2026-10-16', prazoTexto: 'sexta' },
    ])).toBe('Anotado, Bruno!\nIT-045: concluída. Mandei para aprovação do gestor.\nIT-052: novo prazo 16/10. Mandei para aprovação.');
    expect(montarConfirmacao('Bruno', [])).toBe(NAO_ACHEI_CARD);
  });

  it('a confirmação da IA só vale quando bate com o que foi registrado (D30)', () => {
    const concluir = { card: C1, intencao: 'concluir' as const, novaData: null, prazoTexto: null };
    expect(respostaFiel(saida([item({ intencao: 'concluir' })]), [concluir])).toBe(true);
    // A IA citou dois cards, mas só um existe: vale a montada pelo sistema.
    expect(respostaFiel(saida([item({ intencao: 'concluir' }), item({ card_codigo: 'IT-999', intencao: 'concluir' })]), [concluir])).toBe(false);
    // "Vai para sexta" sem data clara não vira sugestão: a IA não pode dizer que mandou para aprovação.
    expect(respostaFiel(saida([item({ intencao: 'adiar' })]), [{ card: C1, intencao: 'adiar', novaData: null, prazoTexto: 'sexta' }])).toBe(false);
  });
});

/** Banco falso: registra inserts e updates por tabela. */
function criarDb() {
  const inserts: { tabela: string; linhas: unknown }[] = [];
  const updates: { tabela: string; dados: Record<string, unknown> }[] = [];
  const consulta = (tabela: string) => {
    const q: Record<string, unknown> = {};
    q.eq = () => q;
    q.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok);
    q.insert = async (linhas: unknown) => { inserts.push({ tabela, linhas }); return { error: null }; };
    q.update = (dados: Record<string, unknown>) => { updates.push({ tabela, dados }); return q; };
    return q;
  };
  return { db: { from: consulta }, inserts, updates };
}

beforeEach(() => vi.clearAllMocks());

describe('registrarAtualizacoes', () => {
  const membro = { id: 'm-bruno', user_id: 'u-bruno', nome: 'Bruno Mendes' };

  it('comentário no card e sugestão na fila; nada escrito em it_requests (D6, D28)', async () => {
    const { db, inserts, updates } = criarDb();
    const r = await registrarAtualizacoes(db as never, {
      mensagemId: 'msg1', membro, texto: 'IT-045 concluída', confianca: 'alta',
      itens: [{ card: C1, intencao: 'concluir', novaData: null, prazoTexto: null }],
    });
    expect(r).toMatchObject({ sugestoes: 1, cardIds: ['c1'] });
    expect(r.confirmacao).toContain('IT-045: concluída. Mandei para aprovação do gestor.');
    expect(inserts.map((i) => i.tabela)).toEqual(['it_task_comments', 'ti_agente_sugestoes']);
    expect(inserts[0].linhas).toEqual([{ task_id: 'c1', user_id: 'u-bruno', content: 'via WhatsApp: IT-045 concluída' }]);
    expect(inserts[1].linhas).toMatchObject([{ origem: 'whatsapp', mensagem_id: 'msg1', proposta_por: 'u-bruno', tipo: 'atualizar_card', card_id: 'c1', proposta: { kanban_status: 'done' } }]);
    expect([...inserts.map((i) => i.tabela), ...updates.map((u) => u.tabela)]).not.toContain('it_requests');
    expect(avisarQuemTem).toHaveBeenCalledTimes(1);
  });

  it('bloqueio vira aviso aos gestores, sem sugestão', async () => {
    const { db, inserts } = criarDb();
    const r = await registrarAtualizacoes(db as never, {
      mensagemId: 'msg1', membro, texto: 'IT-045 travado esperando o fornecedor', confianca: 'alta',
      itens: [{ card: C1, intencao: 'bloquear', novaData: null, prazoTexto: null }],
    });
    expect(r.sugestoes).toBe(0);
    expect(inserts.map((i) => i.tabela)).toEqual(['it_task_comments']);
    expect(avisarQuemTem).toHaveBeenCalledWith(expect.anything(), 'canManageAgenteTI', expect.objectContaining({ titulo: 'IT-045 bloqueado', tipo: 'warning' }));
  });
});
