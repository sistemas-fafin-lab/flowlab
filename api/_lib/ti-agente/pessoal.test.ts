import { describe, expect, it } from 'vitest';
import { lerQuando, montarBlocoDia, montarConteudoConversa, planejarLembrete, type DiaDaPessoa } from './pessoal.js';
import type { CardTI } from '../../../src/modules/eva/domain/demandas.js';

const card = (c: Partial<CardTI>): CardTI => ({
  id: 'c1', codigo: 'IT-045', title: 'Robô de pré-faturamento', priority: 'high', status: 'in_progress', kanban_status: 'in_progress',
  assigned_to: ['u-bruno'], due_date: '2026-10-10T00:00:00.000Z', kanban_hidden: false, project_id: null, sprint_id: null,
  updated_at: '2026-10-10T12:00:00Z', created_at: '2026-10-01T12:00:00Z', ...c,
});
// Quarta, 14/10, 11h em Brasília.
const AGORA = new Date('2026-10-14T14:00:00Z');

describe('lembretes', () => {
  it('a hora vem no horário de Brasília', () => {
    expect(lerQuando('2026-10-15T09:00')?.toISOString()).toBe('2026-10-15T12:00:00.000Z');
    expect(lerQuando('2026-10-15 09:30')?.toISOString()).toBe('2026-10-15T12:30:00.000Z');
    expect(lerQuando('amanhã')).toBeNull();
    expect(lerQuando(null)).toBeNull();
  });

  it('futuro, até 60 dias, e dentro do expediente (senão, a próxima janela)', () => {
    expect(planejarLembrete(lerQuando('2026-10-15T09:00'), AGORA)).toEqual({ ok: true, envio: new Date('2026-10-15T12:00:00.000Z'), ajustado: false });
    // Quarta às 21h: fora do horário, vai para quinta às 7h.
    expect(planejarLembrete(lerQuando('2026-10-14T21:00'), AGORA)).toEqual({ ok: true, envio: new Date('2026-10-15T10:00:00.000Z'), ajustado: true });
    expect(planejarLembrete(lerQuando('2026-10-14T10:00'), AGORA)).toMatchObject({ ok: false, motivo: expect.stringContaining('já passou') });
    expect(planejarLembrete(lerQuando('2027-01-30T09:00'), AGORA)).toMatchObject({ ok: false, motivo: expect.stringContaining('60 dias') });
    expect(planejarLembrete(null, AGORA)).toMatchObject({ ok: false, motivo: expect.stringContaining('Para quando?') });
  });
});

describe('conversa e dia da pessoa', () => {
  it('a conversa vai delimitada, com a hora de cada fala, antes da mensagem', () => {
    const t = montarConteudoConversa('e o do Bruno?', [
      { de: 'pessoa', em: '2026-10-14T13:00:00Z', texto: 'o que tem atrasado?' },
      { de: 'eva', em: '2026-10-14T13:00:05Z', texto: 'Só o IT-045.\nO resto está em dia.' },
    ], null, 2000);
    expect(t).toBe('<conversa_recente>\nPessoa (14/10, 10:00): o que tem atrasado?\nEVA (14/10, 10:00): Só o IT-045. O resto está em dia.\n</conversa_recente>\n\n<mensagem>\ne o do Bruno?\n</mensagem>');
    expect(montarConteudoConversa('oi', [], 'Bom dia!', 2000)).toBe('<ultima_cobranca_da_eva>\nBom dia!\n</ultima_cobranca_da_eva>\n\n<mensagem>\noi\n</mensagem>');
  });

  it('o dia: atrasadas, o que vence, paradas, a última reunião e os lembretes com o id', () => {
    const dia: DiaDaPessoa = {
      pendencias: {
        atrasadas: [card({})],
        vencendo: [card({ id: 'c2', codigo: 'IT-052', title: 'Hub de Laudos', due_date: '2026-10-15T00:00:00.000Z', priority: 'medium' })],
        paradas: [],
      },
      diasParado: 5,
      ultimoComentario: {},
      reuniao: { titulo: 'Weekly TI', realizadaEm: '2026-10-13T13:00:00Z', itens: [{ descricao: 'card novo "Trocar o nobreak"', status: 'aguardando aprovação' }] },
      lembretes: [{ id: 'l1', texto: 'ligar para o fornecedor', quando: '2026-10-15T12:00:00Z' }],
    };
    expect(montarBlocoDia('Bruno Mendes', '2026-10-14', dia)).toBe([
      'O DIA DE BRUNO (hoje, 14/10)',
      'Atrasadas:',
      '- IT-045 | Robô de pré-faturamento | venceu 10/10 | prioridade alta',
      'Vencem hoje ou amanhã:',
      '- IT-052 | Hub de Laudos | vence 15/10 | prioridade média',
      'Da última reunião ("Weekly TI", 13/10), para a pessoa:',
      '- card novo "Trocar o nobreak" | aguardando aprovação',
      '',
      'LEMBRETES MARCADOS',
      '- id=l1 | 15/10, 09:00 | ligar para o fornecedor',
    ].join('\n'));
    const vazio: DiaDaPessoa = { pendencias: { atrasadas: [], vencendo: [], paradas: [] }, diasParado: 5, ultimoComentario: {}, reuniao: null, lembretes: [] };
    expect(montarBlocoDia('Ana', '2026-10-14', vazio)).toBe('O DIA DE ANA (hoje, 14/10)\nNada atrasado, vencendo ou parado.\n\nLEMBRETES MARCADOS\n(nenhum)');
  });
});
