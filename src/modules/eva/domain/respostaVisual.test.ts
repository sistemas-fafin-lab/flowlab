import { describe, expect, it } from 'vitest';
import {
  blocosDoTexto, cardsCitados, codigosNosBlocos, cortarTexto, dadosAgenda, dadosDistribuicaoColunas, dadosDistribuicaoPessoas, dadosNumeros, dadosProjeto,
  dataDaReuniao, decisoesDaReuniao, prazoVisual, rotuloDoDia, tamanhoDoTexto, type ContextoVisual,
} from './respostaVisual';
import { card, projeto, sprint } from './testes/fabricas';

// Dados fictícios (nenhum dado real no repositório).
const HOJE = '2026-10-21'; // quarta-feira
const ANA = 'u-ana';
const BRUNO = 'u-bruno';

const ctx = (parcial: Partial<ContextoVisual> = {}): ContextoVisual => ({
  hoje: HOJE, visao: 'team', usuarioId: ANA, cards: [], projetos: [], sprints: [],
  membros: { [ANA]: { id: ANA, name: 'Ana Costa', initials: 'AC', gradient: 'g-ana' } },
  nomes: { [BRUNO]: 'Bruno Mendes' },
  stats: [], reuniao: null, pendentesDaReuniao: null,
  ...parcial,
});

describe('texto da EVA: formatação leve (D34)', () => {
  it('parágrafos, listas, negrito e códigos de card', () => {
    const b = blocosDoTexto('Duas coisas **pedem atenção** hoje:\n- IT-045 Robô atrasado\n- IT-052 vence amanhã\n\nO resto está em dia.');
    expect(b).toEqual([
      { tipo: 'paragrafo', linhas: [[{ tipo: 'texto', valor: 'Duas coisas ' }, { tipo: 'texto', valor: 'pedem atenção', negrito: true }, { tipo: 'texto', valor: ' hoje:' }]] },
      { tipo: 'lista', ordenada: false, itens: [
        [{ tipo: 'card', valor: 'IT-045' }, { tipo: 'texto', valor: ' Robô atrasado' }],
        [{ tipo: 'card', valor: 'IT-052' }, { tipo: 'texto', valor: ' vence amanhã' }],
      ] },
      { tipo: 'paragrafo', linhas: [[{ tipo: 'texto', valor: 'O resto está em dia.' }]] },
    ]);
  });

  it('aceita "•" e "1.", título vira negrito, "**" sem par fica como está, nada vira HTML', () => {
    expect(blocosDoTexto('• um\n• dois')[0]).toMatchObject({ tipo: 'lista', ordenada: false, itens: [[{ valor: 'um' }], [{ valor: 'dois' }]] });
    expect(blocosDoTexto('1. a\n2) b')[0]).toMatchObject({ tipo: 'lista', ordenada: true });
    expect(blocosDoTexto('## Resumo')[0]).toEqual({ tipo: 'paragrafo', linhas: [[{ tipo: 'texto', valor: 'Resumo', negrito: true }]] });
    expect(blocosDoTexto('5 ** 2 e **IT-010**')).toEqual([{ tipo: 'paragrafo', linhas: [[
      { tipo: 'texto', valor: '5 ** 2 e ' }, { tipo: 'card', valor: 'IT-010', negrito: true },
    ]] }]);
    expect(blocosDoTexto('<b>oi</b>')[0]).toEqual({ tipo: 'paragrafo', linhas: [[{ tipo: 'texto', valor: '<b>oi</b>' }]] });
  });

  it('a revelação corta por caracteres visíveis, sem partir código de card', () => {
    const b = blocosDoTexto('Olá **Ana**\n- IT-045 atrasado');
    expect(tamanhoDoTexto(b)).toBe('Olá '.length + 'Ana'.length + 'IT-045'.length + ' atrasado'.length);
    expect(cortarTexto(b, 5)).toEqual([{ tipo: 'paragrafo', linhas: [[{ tipo: 'texto', valor: 'Olá ' }, { tipo: 'texto', valor: 'A', negrito: true }]] }]);
    expect(cortarTexto(b, 9)).toEqual([
      { tipo: 'paragrafo', linhas: [[{ tipo: 'texto', valor: 'Olá ' }, { tipo: 'texto', valor: 'Ana', negrito: true }]] },
      { tipo: 'lista', ordenada: false, itens: [[]] },
    ]);
    expect(cortarTexto(b, 999)).toEqual(b);
  });
});

describe('cards citados como cartão (D34)', () => {
  it('prazo legível e com tom', () => {
    expect(prazoVisual(card({ due_date: '2026-10-18T00:00:00.000Z' }), HOJE)).toEqual({ texto: 'atrasado há 3 dias', tom: 'perigo' });
    expect(prazoVisual(card({ due_date: '2026-10-20' }), HOJE)).toEqual({ texto: 'atrasado há 1 dia', tom: 'perigo' });
    expect(prazoVisual(card({ due_date: '2026-10-21' }), HOJE)).toEqual({ texto: 'vence hoje', tom: 'atencao' });
    expect(prazoVisual(card({ due_date: '2026-10-22' }), HOJE)).toEqual({ texto: 'vence amanhã', tom: 'atencao' });
    expect(prazoVisual(card({ due_date: '2026-10-30' }), HOJE)).toEqual({ texto: 'vence 30/10', tom: 'neutro' });
    expect(prazoVisual(card({}), HOJE)).toEqual({ texto: 'sem prazo', tom: 'neutro' });
    expect(prazoVisual(card({ kanban_status: 'done', due_date: '2026-10-01' }), HOJE)).toEqual({ texto: 'concluído', tom: 'ok' });
  });

  it('só os que existem, na ordem citada, com coluna e responsáveis (TI ou só nome)', () => {
    const c1 = card({ codigo: 'IT-045', title: 'Robô', kanban_status: 'in_progress', priority: 'high', assigned_to: [ANA, BRUNO] });
    const c2 = card({ codigo: 'IT-052' });
    const r = cardsCitados(['it-052', 'IT-999', 'IT-045'], ctx({ cards: [c1, c2] }));
    expect(r.map((c) => c.codigo)).toEqual(['IT-052', 'IT-045']);
    expect(r[1]).toMatchObject({ titulo: 'Robô', colunaRotulo: 'Em Progresso', prioridadeRotulo: 'Alta' });
    expect(r[1].responsaveis).toEqual([
      { id: ANA, nome: 'Ana Costa', iniciais: 'AC', gradiente: 'g-ana' },
      expect.objectContaining({ id: BRUNO, nome: 'Bruno Mendes', iniciais: 'BM' }),
    ]);
    expect(cardsCitados(['IT-045'], ctx({ cards: [c1], hoje: null }))).toEqual([]);
  });
});

describe('blocos (D34): os dados saem do board', () => {
  it('números: os mesmos do topo do Início, com tom', () => {
    const stats = [
      { key: 'open' as const, label: 'Em aberto', value: 12, hint: 'Backlog a Revisão' },
      { key: 'overdue' as const, label: 'Atrasadas', value: 2, hint: 'IT-045' },
      { key: 'charges' as const, label: 'Cobranças', value: 1, hint: '' },
      { key: 'done' as const, label: 'Concluídas', value: 5, hint: 'Nesta semana' },
    ];
    expect(dadosNumeros(ctx({ stats })).map((n) => [n.chave, n.valor, n.tom])).toEqual([
      ['open', '12', 'neutro'], ['overdue', '2', 'perigo'], ['done', '5', 'ok'],
    ]);
  });

  it('distribuição por pessoa: abertos e atrasados, mais carregado primeiro, sem responsável à parte', () => {
    const cards = [
      card({ assigned_to: [ANA], due_date: '2026-10-10' }), card({ assigned_to: [ANA] }), card({ assigned_to: [ANA, BRUNO] }),
      card({ assigned_to: [BRUNO] }), card({}), card({ assigned_to: [BRUNO], kanban_status: 'done' }),
    ];
    const d = dadosDistribuicaoPessoas(ctx({ cards }));
    expect(d.itens.map((i) => [i.pessoa?.nome ?? 'Sem responsável', i.total, i.atrasados])).toEqual([
      ['Ana Costa', 3, 1], ['Bruno Mendes', 2, 0], ['Sem responsável', 1, 0],
    ]);
    expect(d.maximo).toBe(3);
    expect(d.outras).toEqual({ pessoas: 0, cards: 0 });
  });

  it('distribuição por coluna: respeita a visão; Concluído só a semana', () => {
    const cards = [
      card({ kanban_status: 'todo', assigned_to: [ANA] }), card({ kanban_status: 'review' }),
      card({ kanban_status: 'done', updated_at: '2026-10-20T12:00:00Z' }), card({ kanban_status: 'done', updated_at: '2026-09-01T12:00:00Z' }),
    ];
    expect(dadosDistribuicaoColunas(ctx({ cards })).fatias.map((f) => f.total)).toEqual([0, 1, 0, 1, 1]);
    expect(dadosDistribuicaoColunas(ctx({ cards, visao: 'me' })).total).toBe(1);
  });

  it('projeto: progresso da sprint contra o tempo, situação e os cards que pedem atenção', () => {
    const p = projeto({ name: 'Portal' });
    const s = sprint({ project_id: p.id, name: 'Sprint 6', start_date: '2026-10-11', end_date: '2026-10-31' });
    const cards = [
      card({ project_id: p.id, sprint_id: s.id, kanban_status: 'done', status: 'resolved' }),
      card({ project_id: p.id, sprint_id: s.id, codigo: 'IT-100', due_date: '2026-10-15' }),
      card({ project_id: p.id, sprint_id: s.id, codigo: 'IT-101', due_date: '2026-10-28' }),
      card({ project_id: p.id, sprint_id: s.id }),
    ];
    const d = dadosProjeto(ctx({ cards, projetos: [p], sprints: [s] }), p.id)!;
    expect(d).toMatchObject({ nome: 'Portal', sprint: 'Sprint 6', feitos: 1, total: 4, pctFeito: 25, pctTempo: 50, abertos: 3 });
    expect(d.situacao.rotulo).toBe('Atrasado');
    expect(d.destaques[0].codigo).toBe('IT-100');
    expect(dadosProjeto(ctx({ projetos: [p] }), 'p-inexistente')).toBeNull();
  });

  it('agenda: atrasadas antes, depois dia a dia até o fim do período', () => {
    const cards = [
      card({ codigo: 'IT-1', due_date: '2026-10-19', assigned_to: [ANA] }),
      card({ codigo: 'IT-2', due_date: '2026-10-21' }),
      card({ codigo: 'IT-3', due_date: '2026-10-22', assigned_to: [ANA] }),
      card({ codigo: 'IT-4', due_date: '2026-10-24' }),
      card({ codigo: 'IT-5', due_date: '2026-11-15' }),
    ];
    const d = dadosAgenda(ctx({ cards }), 7);
    expect(d.atrasados.cards.map((c) => c.codigo)).toEqual(['IT-1']);
    expect(d.dias.map((x) => [x.rotulo, x.cards.map((c) => c.codigo)])).toEqual([['Hoje', ['IT-2']], ['Amanhã', ['IT-3']], ['sáb 24/10', ['IT-4']]]);
    expect(d.total).toBe(3);
    const minha = dadosAgenda(ctx({ cards, visao: 'me' }), 7);
    expect([minha.atrasados.total, minha.total]).toEqual([1, 1]);
    expect(rotuloDoDia('2026-10-26', HOJE)).toBe('seg 26/10');
  });

  it('cards que a agenda e o projeto já mostram não se repetem como cartão', () => {
    const p = projeto({ name: 'Portal' });
    const cards = [
      card({ codigo: 'IT-1', due_date: '2026-10-22' }),
      card({ codigo: 'IT-2', project_id: p.id, due_date: '2026-11-30' }),
      card({ codigo: 'IT-3', due_date: '2026-12-20' }),
    ];
    const c = ctx({ cards, projetos: [p] });
    expect([...codigosNosBlocos([{ tipo: 'agenda', dias: 7 }], c)]).toEqual(['IT-1']);
    expect([...codigosNosBlocos([{ tipo: 'projeto', projetoId: p.id }, { tipo: 'numeros' }], c)]).toEqual(['IT-2']);
    expect(codigosNosBlocos([], c).size).toBe(0);
  });

  it('reunião: decisões por linha ou por frase; data no dia de Brasília', () => {
    expect(decisoesDaReuniao('- Migrar o backup\n- Portal antes do LIS')).toEqual(['Migrar o backup', 'Portal antes do LIS']);
    expect(decisoesDaReuniao('Migrar o backup até sexta. Portal antes do LIS. Ana cuida do robô.')).toEqual([
      'Migrar o backup até sexta.', 'Portal antes do LIS.', 'Ana cuida do robô.',
    ]);
    expect(decisoesDaReuniao(null)).toEqual([]);
    expect(dataDaReuniao('2026-10-14T01:30:00Z')).toBe('13/10');
  });
});
