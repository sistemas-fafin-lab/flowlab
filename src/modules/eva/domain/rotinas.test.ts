import { describe, expect, it } from 'vitest';
import { descricaoDoCard, descreverRotina, planoDaRotina, proximaOcorrencia, validarRotina, type Rotina } from './rotinas';

// Dados fictícios. Hoje: segunda, 30/11/2026.
const HOJE = '2026-11-30';
const rotina = (r: Partial<Rotina> = {}): Rotina => ({
  id: 'r1', titulo: 'Backup mensal do servidor', descricao: null, frequencia: 'mensal', dia_ancora: 5, proxima_em: '2026-12-05',
  antecedencia_dias: 3, responsaveis: ['u-ana'], prioridade: 'medium', projeto_id: null, ativa: true, ...r,
});

describe('proximaOcorrencia', () => {
  it('semanal e quinzenal somam dias', () => {
    expect(proximaOcorrencia('2026-11-30', 'semanal', 30)).toBe('2026-12-07');
    expect(proximaOcorrencia('2026-11-30', 'quinzenal', 30)).toBe('2026-12-14');
  });
  it('em meses, volta ao dia da âncora sem passar do fim do mês', () => {
    expect(proximaOcorrencia('2027-01-31', 'mensal', 31)).toBe('2027-02-28');
    expect(proximaOcorrencia('2027-02-28', 'mensal', 31)).toBe('2027-03-31');
    expect(proximaOcorrencia('2026-11-05', 'trimestral', 5)).toBe('2027-02-05');
    expect(proximaOcorrencia('2026-12-05', 'anual', 5)).toBe('2027-12-05');
    expect(proximaOcorrencia('2026-08-31', 'semestral', 31)).toBe('2027-02-28');
  });
});

describe('planoDaRotina', () => {
  it('antes do dia de criar, nada', () => {
    expect(planoDaRotina(rotina({ proxima_em: '2026-12-05' }), '2026-12-01')).toEqual({ criarPara: null, proxima: '2026-12-05' });
  });
  it('no dia de criar (3 dias antes), cria o card e anda para a próxima data', () => {
    expect(planoDaRotina(rotina({ proxima_em: '2026-12-05' }), '2026-12-02')).toEqual({ criarPara: '2026-12-05', proxima: '2027-01-05' });
  });
  it('com antecedência 0, cria no próprio dia', () => {
    expect(planoDaRotina(rotina({ proxima_em: HOJE, dia_ancora: 30, antecedencia_dias: 0 }), HOJE)).toEqual({ criarPara: HOJE, proxima: '2026-12-30' });
  });
  it('as datas que passaram ficam para trás, sem card atrasado', () => {
    // Pausada desde setembro e retomada: setembro, outubro e novembro passaram; o de 05/12 é o próximo.
    expect(planoDaRotina(rotina({ proxima_em: '2026-09-05' }), HOJE)).toEqual({ criarPara: null, proxima: '2026-12-05' });
    expect(planoDaRotina(rotina({ proxima_em: '2026-09-05' }), '2026-12-03')).toEqual({ criarPara: '2026-12-05', proxima: '2027-01-05' });
  });
});

describe('textos', () => {
  it('descreverRotina', () => {
    expect(descreverRotina(rotina())).toBe('Todo mês, dia 5');
    expect(descreverRotina(rotina({ frequencia: 'semanal', proxima_em: '2026-12-07' }))).toBe('Toda semana, às segundas');
    expect(descreverRotina(rotina({ frequencia: 'anual' }))).toBe('Todo ano, em 05/12');
  });
  it('a descrição do card diz de onde ele veio', () => {
    expect(descricaoDoCard(rotina({ descricao: 'Conferir o log do Veeam.' }))).toBe('Conferir o log do Veeam.\n\nCard de rotina criado pela EVA (todo mês, dia 5).');
    expect(descricaoDoCard(rotina())).toBe('Card de rotina criado pela EVA (todo mês, dia 5).');
  });
});

describe('validarRotina', () => {
  const base = { titulo: ' Revisão de acessos ', frequencia: 'trimestral', proxima_em: '2027-01-15', antecedencia_dias: 5, responsaveis: ['u-ana', 'u-ana'], prioridade: 'high' };
  it('a âncora sai da data, e o título e os responsáveis são limpos', () => {
    const r = validarRotina(base, HOJE);
    expect(r).toEqual({
      ok: true,
      rotina: {
        titulo: 'Revisão de acessos', descricao: null, frequencia: 'trimestral', dia_ancora: 15, proxima_em: '2027-01-15', antecedencia_dias: 5,
        responsaveis: ['u-ana'], prioridade: 'high', projeto_id: null, ativa: true,
      },
    });
  });
  it('recusa o que não dá para salvar', () => {
    expect(validarRotina({ ...base, titulo: '  ' }, HOJE)).toMatchObject({ ok: false, erro: expect.stringContaining('título') });
    expect(validarRotina({ ...base, frequencia: 'diaria' }, HOJE)).toMatchObject({ ok: false, erro: 'Escolha a frequência.' });
    expect(validarRotina({ ...base, proxima_em: '' }, HOJE)).toMatchObject({ ok: false, erro: 'Escolha a data do próximo card.' });
    expect(validarRotina({ ...base, proxima_em: '2026-11-29' }, HOJE)).toMatchObject({ ok: false, erro: 'A data do próximo card já passou.' });
    expect(validarRotina({ ...base, antecedencia_dias: 61 }, HOJE)).toMatchObject({ ok: false, erro: 'A antecedência vai de 0 a 60 dias.' });
  });
});
