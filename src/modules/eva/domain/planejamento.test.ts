import { describe, expect, it } from 'vitest';
import {
  acimaDaCapacidade, contarDiasUteis, janelaDoPlanejamento, montarPlanejamento, montarTextoPlanejamento, rotuloDaJanela, type EntradaPlanejamento,
} from './planejamento';
import { card, sprint } from './testes/fabricas';
import type { CardTI } from './demandas';

// Dados fictícios. Sexta, 27/11/2026. Sem sprint planejada, a janela vai até 10/12 (10 dias úteis).
const HOJE = '2026-11-27';
const PESSOAS = { 'u-ana': 'Ana Souza', 'u-bruno': 'Bruno Mendes', 'u-carla': 'Carla Dias', 'u-davi': 'Davi Lima', 'u-eva': 'Eva Rocha' };
const EQUIPE = Object.keys(PESSOAS);

const feitos = (quem: string, n: number, dia = '2026-11-20'): CardTI[] =>
  Array.from({ length: n }, () => card({ kanban_status: 'done', status: 'resolved', assigned_to: [quem], resolved_at: `${dia}T15:00:00Z`, updated_at: `${dia}T15:00:00Z` }));

function cenario() {
  const t1 = card({ codigo: 'IT-101', title: 'Trocar teclados', priority: 'low', assigned_to: ['u-ana'] });
  const t2 = card({ codigo: 'IT-102', title: 'Inventário de toners', priority: 'medium', assigned_to: ['u-ana'], due_date: '2026-12-20' });
  const t3 = card({ codigo: 'IT-103', priority: 'high', assigned_to: ['u-ana'] });
  const t4 = card({ codigo: 'IT-104', priority: 'critical', assigned_to: ['u-ana'] });
  const t5 = card({ codigo: 'IT-105', priority: 'low', assigned_to: ['u-ana', 'u-bruno'] });
  const emAndamento = [1, 2, 3].map((i) => card({ codigo: `IT-11${i}`, kanban_status: 'in_progress', priority: 'low', assigned_to: ['u-ana'] }));
  const revisao = card({ codigo: 'IT-120', kanban_status: 'review', assigned_to: ['u-ana'] });
  const backlogDaAna = card({ codigo: 'IT-130', kanban_status: 'backlog', assigned_to: ['u-ana'] });
  const doDavi = [1, 2].map((i) => card({ codigo: `IT-14${i}`, kanban_status: 'in_progress', assigned_to: ['u-davi'] }));
  const b1 = card({ codigo: 'IT-201', kanban_status: 'backlog', priority: 'low' });
  const b2 = card({ codigo: 'IT-202', kanban_status: 'backlog', priority: 'high' });
  const b3 = card({ codigo: 'IT-203', kanban_status: 'backlog', priority: 'high', due_date: '2026-12-01' });
  const antigo = card({ kanban_status: 'done', status: 'resolved', assigned_to: ['u-bruno'], resolved_at: '2026-10-20T12:00:00Z' });
  const cards = [
    ...feitos('u-ana', 12), ...feitos('u-bruno', 8), ...feitos('u-carla', 4), antigo,
    t1, t2, t3, t4, t5, ...emAndamento, revisao, backlogDaAna, ...doDavi, b1, b2, b3,
  ];
  const entrada: EntradaPlanejamento = {
    hoje: HOJE, cards, sprints: [], equipe: EQUIPE, pessoas: PESSOAS,
    ausencias: { 'u-carla': { ausente_de: '2026-11-30', ausente_ate: '2026-12-04', ausencia_motivo: null } },
  };
  return { entrada, t1, t2, t5, b2, b3 };
}

describe('janelaDoPlanejamento', () => {
  it('sem sprint planejada, vai até o 10º dia útil, hoje incluso', () => {
    const j = janelaDoPlanejamento([], HOJE);
    expect(j).toMatchObject({ de: HOJE, ate: '2026-12-10', sprint: null, diasUteis: 10 });
    expect(rotuloDaJanela(j)).toBe('até 10/12 (próximos 10 dias úteis)');
  });

  it('com sprint planejada perto, vai até o fim dela', () => {
    const s = sprint({ name: 'Sprint 7', status: 'planned', start_date: '2026-12-01', end_date: '2026-12-12' });
    const j = janelaDoPlanejamento([sprint({ status: 'active', start_date: '2026-11-16', end_date: '2026-11-30' }), s], HOJE);
    expect(j).toMatchObject({ ate: '2026-12-12', sprint: { id: s.id }, diasUteis: 11 });
    expect(rotuloDaJanela(j)).toBe('até o fim da Sprint 7 (12/12)');
  });

  it('sprint planejada para daqui a mais de 4 semanas não é a próxima', () => {
    const j = janelaDoPlanejamento([sprint({ status: 'planned', start_date: '2027-01-10', end_date: '2027-01-24' })], HOJE);
    expect(j.sprint).toBeNull();
  });

  it('conta dias úteis e tira os de ausência', () => {
    expect(contarDiasUteis('2026-11-27', '2026-12-04')).toBe(6);
    expect(contarDiasUteis('2026-11-27', '2026-12-04', (d) => d >= '2026-11-30')).toBe(1);
  });
});

describe('montarPlanejamento', () => {
  it('ritmo das 4 semanas, capacidade na janela, comprometido e saldo', () => {
    const p = montarPlanejamento(cenario().entrada);
    const ana = p.pessoas.find((x) => x.id === 'u-ana')!;
    // 12 entregas em 4 semanas = 3 por semana; 10 dias úteis = 6 cards.
    expect(ana).toMatchObject({ entregas: 12, ritmo: 3, capacidade: 6, saldo: -3, semHistorico: false });
    // A Fazer, Em Progresso e Revisão contam; o Backlog dela sem sprint nem prazo, não.
    expect(ana.comprometidos).toHaveLength(9);
    // O card antigo (20/10) fica fora do ritmo do Bruno.
    expect(p.pessoas.find((x) => x.id === 'u-bruno')).toMatchObject({ entregas: 8, ritmo: 2, capacidade: 4, saldo: 3 });
  });

  it('a ausência na janela tira dias da capacidade', () => {
    const carla = montarPlanejamento(cenario().entrada).pessoas.find((x) => x.id === 'u-carla')!;
    expect(carla).toMatchObject({ diasPresentes: 5, capacidade: 1, saldo: 1 });
    expect(carla.ausencia).toBe('ausente de 30/11 a 04/12');
  });

  it('sem entrega nas 4 semanas, usa a média da equipe e não recebe cards', () => {
    const p = montarPlanejamento(cenario().entrada);
    expect(p.ritmoMedio).toBe(2);
    expect(p.pessoas.find((x) => x.id === 'u-davi')).toMatchObject({ semHistorico: true, capacidade: 4, saldo: 2 });
    expect(p.movimentos.every((m) => m.para !== 'u-davi')).toBe(true);
  });

  it('quem não tem card nem entrega fica de fora', () => {
    expect(montarPlanejamento(cenario().entrada).pessoas.map((x) => x.id)).not.toContain('u-eva');
  });

  it('propõe passar o que é mais fácil: não começado, não crítico e só da pessoa', () => {
    const { entrada, t1, t2 } = cenario();
    const p = montarPlanejamento(entrada);
    expect(p.movimentos.map((m) => [m.card.codigo, m.de, m.para])).toEqual([
      [t1.codigo, 'u-ana', 'u-bruno'],
      [t2.codigo, 'u-ana', 'u-bruno'],
    ]);
    expect(acimaDaCapacidade(p).map((x) => x.id)).toEqual(['u-ana']);
  });

  it('do Backlog, entra o que ninguém assumiu, por prioridade e prazo, até a folga que sobra', () => {
    const { entrada, b3 } = cenario();
    const p = montarPlanejamento(entrada);
    // Folga do Bruno (3) menos os 2 cards que ele recebe = 1.
    expect(p.folgaEquipe).toBe(3);
    expect(p.doBacklog.map((c) => c.codigo)).toEqual([b3.codigo]);
  });

  it('sem ninguém com folga, não propõe nada', () => {
    const { entrada } = cenario();
    const semBruno = { ...entrada, cards: entrada.cards.filter((c) => !(c.assigned_to.length === 1 && c.assigned_to[0] === 'u-bruno')) };
    expect(montarPlanejamento(semBruno).movimentos).toEqual([]);
  });
});

describe('montarTextoPlanejamento', () => {
  it('WhatsApp: cada pessoa, a equipe, o Backlog e a redistribuição', () => {
    const texto = montarTextoPlanejamento(montarPlanejamento(cenario().entrada), 'whatsapp');
    expect(texto).toContain('📐 Planejamento até 10/12 (próximos 10 dias úteis)');
    expect(texto).toContain('• Ana: ritmo 3/semana · cabem ~6 · tem 9 → 3 acima');
    expect(texto).toContain('• Carla: ritmo 1/semana · cabem ~1 · tem 0 → folga de 1 (ausente de 30/11 a 04/12)');
    expect(texto).toContain('• Davi: sem entrega em 4 semanas (usei a média da equipe) · cabem ~4 · tem 2 → folga de 2');
    expect(texto).toContain('Equipe: cabem ~15, já tem 12.');
    expect(texto).toContain('Do Backlog, entrariam: IT-203');
    expect(texto).toContain('💡 Para equilibrar');
    expect(texto).toContain('• IT-101 Trocar teclados: Ana → Bruno');
  });

  it('chat: negrito e listas com "- "', () => {
    const texto = montarTextoPlanejamento(montarPlanejamento(cenario().entrada), 'chat');
    expect(texto.split('\n')[0]).toBe('**Planejamento até 10/12 (próximos 10 dias úteis)**');
    expect(texto).toContain('**Para equilibrar**');
    expect(texto).toContain('- IT-102 Inventário de toners: Ana → Bruno');
  });

  it('sem entrega de ninguém nas 4 semanas, explica em vez de inventar ritmo', () => {
    const p = montarPlanejamento({ hoje: HOJE, cards: [card({ assigned_to: ['u-ana'] })], sprints: [], equipe: EQUIPE, pessoas: PESSOAS });
    expect(montarTextoPlanejamento(p, 'whatsapp')).toContain('Ainda não dá para medir o ritmo');
    expect(p.movimentos).toEqual([]);
  });
});
