import { describe, expect, it } from 'vitest';
import { bloqueiosEmAberto, momentoDaPauta, montarPautaReuniao, resumirReuniao, situacaoDoItem, type ItemReuniao } from './pauta';
import { montarPainelGestao, type EntradaGestao } from './gestao';
import { montarPlanejamento } from './planejamento';
import { card } from './testes/fabricas';
import type { CardTI } from './demandas';

// Dados fictícios. Segunda, 30/11/2026; a reunião da equipe é às 10h.
const HOJE = '2026-11-30';
const PESSOAS = { 'u-ana': 'Ana Souza', 'u-bruno': 'Bruno Mendes', 'u-gil': 'Gil Prado' };
const em = (iso: string) => new Date(iso);

describe('momentoDaPauta', () => {
  const agenda = { dia: 1, hora: '10:00' };
  it('manda de 1 h antes até a hora da reunião, no dia marcado', () => {
    expect(momentoDaPauta(em('2026-11-30T09:00:00-03:00'), agenda)).toEqual({ hoje: HOJE, enviar: true });
    expect(momentoDaPauta(em('2026-11-30T09:55:00-03:00'), agenda).enviar).toBe(true);
    expect(momentoDaPauta(em('2026-11-30T08:55:00-03:00'), agenda).enviar).toBe(false);
    expect(momentoDaPauta(em('2026-11-30T10:00:00-03:00'), agenda).enviar).toBe(false);
  });
  it('não manda em outro dia, sem dia ou com hora inválida', () => {
    expect(momentoDaPauta(em('2026-12-01T09:30:00-03:00'), agenda).enviar).toBe(false);
    expect(momentoDaPauta(em('2026-11-30T09:30:00-03:00'), { dia: null, hora: '10:00' }).enviar).toBe(false);
    expect(momentoDaPauta(em('2026-11-30T09:30:00-03:00'), { dia: 1, hora: '25:00' }).enviar).toBe(false);
  });
});

function itens() {
  const feito = card({ codigo: 'IT-301', kanban_status: 'done', status: 'resolved', assigned_to: ['u-ana'] });
  const atrasado = card({ codigo: 'IT-302', title: 'Robô de pré-faturamento', kanban_status: 'in_progress', assigned_to: ['u-ana'], due_date: '2026-11-25' });
  const aberto = card({ codigo: 'IT-303', title: 'Migração do servidor', kanban_status: 'in_progress', assigned_to: ['u-bruno'], due_date: '2026-12-05' });
  const lista: ItemReuniao[] = [
    { descricao: 'IT-301 Card', responsaveis: ['u-ana'], prazo: null, sugestao: 'aprovada', card: feito },
    { descricao: 'IT-302 Robô de pré-faturamento', responsaveis: ['u-ana'], prazo: '2026-11-25', sugestao: 'aprovada', card: atrasado },
    { descricao: 'Card novo "Abrir chamado para o fornecedor"', responsaveis: ['u-bruno'], prazo: null, sugestao: 'pendente', card: null },
    { descricao: 'Card novo "Recusado"', responsaveis: [], prazo: null, sugestao: 'rejeitada', card: null },
    { descricao: 'IT-303 Migração do servidor', responsaveis: ['u-bruno'], prazo: '2026-12-05', sugestao: 'aprovada', card: aberto },
  ];
  return { lista, feito, atrasado, aberto };
}

describe('o que a última reunião combinou', () => {
  it('feito, atrasado, na fila, em aberto; recusado fica de fora', () => {
    const { lista } = itens();
    expect(lista.map((i) => situacaoDoItem(i, HOJE))).toEqual(['feito', 'atrasado', 'na_fila', 'fora', 'aberto']);
    const r = resumirReuniao({ titulo: 'Planning', realizadaEm: '2026-11-24T13:00:00Z', itens: lista }, HOJE);
    expect(r).toMatchObject({ feitos: 1, total: 4 });
    expect(r.pendentes.map((x) => x.situacao)).toEqual(['atrasado', 'na_fila', 'aberto']);
  });

  it('vale o prazo combinado quando o card não tem prazo', () => {
    const semPrazo = card({ assigned_to: ['u-ana'] });
    expect(situacaoDoItem({ descricao: 'x', responsaveis: [], prazo: '2026-11-27', sugestao: 'aprovada', card: semPrazo }, HOJE)).toBe('atrasado');
  });
});

describe('bloqueiosEmAberto', () => {
  it('o mais recente de cada card, só dos que continuam abertos', () => {
    const aberto = card({ codigo: 'IT-060', title: 'Link da filial' });
    const fechado = card({ codigo: 'IT-061', kanban_status: 'done' });
    const r = bloqueiosEmAberto([
      { codigo: 'it-060', motivo: 'antigo', quem: 'u-ana', dia: '2026-11-26' },
      { codigo: 'IT-060', motivo: 'esperando a operadora', quem: 'u-ana', dia: '2026-11-27' },
      { codigo: 'IT-061', motivo: 'já resolvido', quem: 'u-bruno', dia: '2026-11-27' },
    ], [aberto, fechado]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ motivo: 'esperando a operadora', card: { codigo: 'IT-060' } });
  });
});

function entradaGestao(cards: CardTI[]): EntradaGestao {
  return {
    hoje: HOJE, agora: em('2026-11-30T09:05:00-03:00').getTime(), periodo: { de: '2026-11-03', ate: HOJE },
    cards, projetos: [], sprints: [], chamados: [], pessoas: PESSOAS, equipe: Object.keys(PESSOAS), diasParado: 5,
    sugestoesPendentes: 3, sugestaoMaisAntiga: '2026-11-24T12:00:00Z', cardsSemResposta: [], ausencias: {},
  };
}

describe('montarPautaReuniao', () => {
  function pauta(formato: 'whatsapp' | 'chat', comReuniao = true) {
    const { lista, feito, atrasado, aberto } = itens();
    const velho = card({ codigo: 'IT-310', title: 'Backup do servidor', assigned_to: ['u-bruno'], due_date: '2026-11-18' });
    const bloqueado = card({ codigo: 'IT-060', title: 'Link da filial', assigned_to: ['u-ana'] });
    const cards = [feito, atrasado, aberto, velho, bloqueado];
    const entrada = entradaGestao(cards);
    return montarPautaReuniao({
      entrada,
      painel: montarPainelGestao(entrada),
      plano: montarPlanejamento({ hoje: HOJE, cards, sprints: [], equipe: entrada.equipe, pessoas: PESSOAS }),
      reuniao: comReuniao ? { titulo: 'Planning', realizadaEm: '2026-11-24T13:00:00Z', itens: lista } : null,
      bloqueios: [{ codigo: 'IT-060', motivo: 'esperando a operadora', quem: 'u-ana', dia: '2026-11-27' }],
      marcada: formato === 'whatsapp' ? { dia: HOJE, hora: '10:00' } : null,
      linkInicio: 'https://app/it/inicio',
      formato,
    });
  }

  it('WhatsApp: o que não andou, atrasados, bloqueios, pendências e o que decidir', () => {
    const t = pauta('whatsapp');
    expect(t.split('\n')[0]).toBe('🗓️ Pauta da reunião · segunda, 30/11 às 10:00');
    expect(t).toContain('📝 Da última reunião ("Planning", 24/11): 1 de 4 feitos');
    expect(t).toContain('• IT-302 Robô de pré-faturamento · Ana · até 25/11 · atrasado há 5 dias');
    expect(t).toContain('• Card novo "Abrir chamado para o fornecedor" · Bruno: a sugestão ainda espera aprovação');
    expect(t).toContain('• IT-303 Migração do servidor · Bruno · até 05/12 · Em Progresso');
    expect(t).toContain('⚠️ Atrasados (2)');
    expect(t).toContain('• IT-310 Backup do servidor · Bruno · há 12 dias');
    expect(t).toContain('⛔ Bloqueios do check-in');
    expect(t).toContain('• IT-060 Link da filial: esperando a operadora (Ana, 27/11)');
    expect(t).toContain('• 3 sugestões aguardam aprovação, a mais antiga há 6 dias');
    expect(t).toContain('💬 Para decidir');
    expect(t).toContain('• Repactuar o prazo do IT-310 (atrasado há 12 dias)');
    expect(t).toContain('• Destravar o IT-060: esperando a operadora');
    expect(t).toContain('• Decidir a sugestão da última reunião que ainda espera aprovação');
    expect(t).toContain('Detalhes no Início: https://app/it/inicio');
  });

  it('chat: negrito, listas com "- " e sem o link', () => {
    const t = pauta('chat');
    expect(t.split('\n')[0]).toBe('**Pauta da reunião · 30/11**');
    expect(t).toContain('**Para decidir**');
    expect(t).toContain('- Destravar o IT-060: esperando a operadora');
    expect(t).not.toContain('Detalhes no Início');
  });

  it('sem reunião analisada, a seção dela não aparece', () => {
    expect(pauta('whatsapp', false)).not.toContain('Da última reunião');
  });

  it('sem ritmo medido (ninguém entregou), ninguém aparece acima da capacidade', () => {
    expect(pauta('whatsapp')).not.toContain('⚖️ Acima da capacidade');
  });

  it('com alguém acima da capacidade e um colega com folga, propõe equilibrar', () => {
    const feitos = (quem: string, n: number) =>
      Array.from({ length: n }, () => card({ kanban_status: 'done', status: 'resolved', assigned_to: [quem], resolved_at: '2026-11-20T15:00:00Z' }));
    const daAna = Array.from({ length: 8 }, (_, i) => card({ codigo: `IT-4${i}0`, title: `Tarefa ${i}`, priority: 'low', assigned_to: ['u-ana'] }));
    const cards = [...feitos('u-ana', 4), ...feitos('u-bruno', 8), ...daAna];
    const entrada = entradaGestao(cards);
    const t = montarPautaReuniao({
      entrada, painel: montarPainelGestao(entrada), plano: montarPlanejamento({ hoje: HOJE, cards, sprints: [], equipe: entrada.equipe, pessoas: PESSOAS }),
      reuniao: null, bloqueios: [], marcada: null, linkInicio: '', formato: 'whatsapp',
    });
    expect(t).toContain('⚖️ Acima da capacidade até 11/12 (próximos 10 dias úteis)');
    expect(t).toContain('• Ana: tem 8, cabem ~2');
    expect(t).toMatch(/• Equilibrar a carga: IT-4\d0 e IT-4\d0 de Ana para Bruno \(para aplicar, me peça o planejamento\)/);
  });
});
