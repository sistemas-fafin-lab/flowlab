import { describe, expect, it } from 'vitest';
import { projetosEmAndamento, resumirProjeto, tempoDecorrido } from './projetos';
import { card, projeto, sprint } from './testes/fabricas';

const HOJE = '2026-10-13';

describe('resumirProjeto (RN05)', () => {
  it('projeto só com sprint ativa e sem cards está em andamento, com o prazo da sprint', () => {
    const p = projeto();
    const s = sprint({ project_id: p.id, start_date: '2026-10-06', end_date: '2026-10-30' });
    const r = resumirProjeto(p, [], [s], HOJE);
    expect(r.emAndamento).toBe(true);
    expect(r.prazo).toBe('2026-10-30');
    expect(r.situacao).toBe('on_track');
  });

  it('projeto sem sprint e sem prazo nos cards: em andamento e "sem prazo"', () => {
    const p = projeto();
    const r = resumirProjeto(p, [card({ project_id: p.id })], [], HOJE);
    expect(r.emAndamento).toBe(true);
    expect(r.prazo).toBeNull();
    expect(r.situacao).toBe('no_deadline');
  });

  it('projeto sem cards abertos nem sprint ativa não está em andamento', () => {
    const p = projeto();
    const r = resumirProjeto(p, [card({ project_id: p.id, kanban_status: 'done' })], [], HOJE);
    expect(r.emAndamento).toBe(false);
  });

  it('card aberto atrasado deixa o projeto Atrasado', () => {
    const p = projeto();
    const r = resumirProjeto(p, [card({ project_id: p.id, due_date: '2026-10-10' })], [], HOJE);
    expect(r.situacao).toBe('late');
  });

  it('sprint ativa vencida com cards abertos dela: Atrasado', () => {
    const p = projeto();
    const s = sprint({ project_id: p.id, start_date: '2026-09-29', end_date: '2026-10-10' });
    const r = resumirProjeto(p, [card({ project_id: p.id, sprint_id: s.id })], [s], HOJE);
    expect(r.situacao).toBe('late');
  });

  it('card vencendo em até 3 dias: Atenção', () => {
    const p = projeto();
    const r = resumirProjeto(p, [card({ project_id: p.id, due_date: '2026-10-15' })], [], HOJE);
    expect(r.situacao).toBe('at_risk');
  });

  it('prazo é o maior entre o fim da sprint e os prazos dos cards abertos', () => {
    const p = projeto();
    const s = sprint({ project_id: p.id, start_date: '2026-10-06', end_date: '2026-10-24' });
    const r = resumirProjeto(p, [card({ project_id: p.id, due_date: '2026-11-07' })], [s], HOJE);
    expect(r.prazo).toBe('2026-11-07');
  });

  it('progresso conta a sprint ativa quando existe, e o projeto inteiro quando não', () => {
    const p = projeto();
    const s = sprint({ project_id: p.id, start_date: '2026-10-06', end_date: '2026-10-30' });
    const naSprint = [card({ project_id: p.id, sprint_id: s.id, kanban_status: 'done' }), card({ project_id: p.id, sprint_id: s.id })];
    const foraDaSprint = [card({ project_id: p.id, kanban_status: 'done' }), card({ project_id: p.id, kanban_status: 'done' })];
    const comSprint = resumirProjeto(p, [...naSprint, ...foraDaSprint], [s], HOJE);
    expect([comSprint.feitos, comSprint.total]).toEqual([1, 2]);
    const semSprint = resumirProjeto(p, [...naSprint, ...foraDaSprint], [], HOJE);
    expect([semSprint.feitos, semSprint.total]).toEqual([3, 4]);
  });
});

describe('ritmo da sprint (D27)', () => {
  // Sprint de 07/10 a 17/10 (10 dias): em 13/10 já decorreram 60%.
  const p = projeto();
  const s = sprint({ project_id: p.id, start_date: '2026-10-07', end_date: '2026-10-17' });
  const cards = (feitos: number, total: number) =>
    Array.from({ length: total }, (_, i) =>
      card({ project_id: p.id, sprint_id: s.id, kanban_status: i < feitos ? 'done' : 'in_progress' }),
    );

  it('o tempo decorrido é a fração entre o início e o fim', () => {
    expect(tempoDecorrido(s, HOJE)).toBeCloseTo(0.6);
  });

  it('35% feito com 60% da sprint passado: Atenção', () => {
    // 7 de 20 = 35%
    expect(resumirProjeto(p, cards(7, 20), [s], HOJE).situacao).toBe('at_risk');
  });

  it('45% feito com 60% passado (dentro da folga de 20 pontos): No prazo', () => {
    // 9 de 20 = 45%; fim da sprint daqui a 4 dias, fora da janela de 3 dias
    expect(resumirProjeto(p, cards(9, 20), [s], HOJE).situacao).toBe('on_track');
  });
});

describe('projetosEmAndamento', () => {
  it('ordena Atrasado → Atenção → No prazo → Sem prazo e omite os parados', () => {
    const atrasado = projeto({ name: 'B' });
    const semPrazo = projeto({ name: 'A' });
    const encerrado = projeto({ name: 'C' });
    const lista = projetosEmAndamento(
      [semPrazo, atrasado, encerrado],
      [
        card({ project_id: atrasado.id, due_date: '2026-10-01' }),
        card({ project_id: semPrazo.id }),
        card({ project_id: encerrado.id, kanban_status: 'done' }),
      ],
      [],
      HOJE,
    );
    expect(lista.map((r) => r.nome)).toEqual(['B', 'A']);
  });
});
