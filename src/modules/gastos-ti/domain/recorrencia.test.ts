import { describe, expect, it } from 'vitest';
import {
  equivalenteMensal,
  ocorrenciasNoIntervalo,
  proximaOcorrencia,
  situacaoDespesa,
  temOcorrenciaEm,
  valorVigente,
  type DespesaRecorrente,
} from './recorrencia';

const despesa = (campos: Partial<DespesaRecorrente> = {}): DespesaRecorrente => ({
  id: 'd1',
  valorBase: 1200,
  recorrencia: 'mensal',
  competenciaInicio: '2026-10-01',
  competenciaFim: null,
  diaVencimento: 10,
  reajustes: [],
  ...campos,
});

const competencias = (d: DespesaRecorrente, desde: string, ate: string) =>
  ocorrenciasNoIntervalo(d, desde, ate).map((o) => o.competencia);

describe('ocorrenciasNoIntervalo (RN01)', () => {
  it('mensal: uma por mês, atravessando a virada do ano', () => {
    expect(competencias(despesa(), '2026-11-01', '2027-02-01')).toEqual([
      '2026-11-01',
      '2026-12-01',
      '2027-01-01',
      '2027-02-01',
    ]);
  });

  it('não gera nada antes do início', () => {
    expect(competencias(despesa(), '2026-01-01', '2026-10-01')).toEqual(['2026-10-01']);
    expect(competencias(despesa(), '2026-01-01', '2026-09-01')).toEqual([]);
  });

  it('trimestral fica alinhada à competência inicial, mesmo com janela desalinhada', () => {
    const d = despesa({ recorrencia: 'trimestral', competenciaInicio: '2026-02-01' });
    expect(competencias(d, '2026-06-01', '2027-03-01')).toEqual(['2026-08-01', '2026-11-01', '2027-02-01']);
  });

  it('anual iniciando no meio do ano repete no mesmo mês', () => {
    const d = despesa({ recorrencia: 'anual', competenciaInicio: '2026-07-01' });
    expect(competencias(d, '2026-01-01', '2029-12-01')).toEqual(['2026-07-01', '2027-07-01', '2028-07-01', '2029-07-01']);
  });

  it('semestral e bimestral', () => {
    expect(competencias(despesa({ recorrencia: 'semestral' }), '2026-10-01', '2027-12-01')).toEqual(['2026-10-01', '2027-04-01', '2027-10-01']);
    expect(competencias(despesa({ recorrencia: 'bimestral' }), '2026-10-01', '2027-03-01')).toEqual(['2026-10-01', '2026-12-01', '2027-02-01']);
  });

  it('para na competência final (encerrada)', () => {
    const d = despesa({ competenciaFim: '2026-12-01' });
    expect(competencias(d, '2026-10-01', '2027-06-01')).toEqual(['2026-10-01', '2026-11-01', '2026-12-01']);
  });

  it('única: uma ocorrência só, na competência inicial', () => {
    const d = despesa({ recorrencia: 'unica', competenciaInicio: '2026-11-01' });
    expect(competencias(d, '2026-01-01', '2027-12-01')).toEqual(['2026-11-01']);
    expect(competencias(d, '2026-12-01', '2027-12-01')).toEqual([]);
  });

  it('parcelamento em 10× = mensal com 10 competências (RN02)', () => {
    const d = despesa({ competenciaInicio: '2026-10-01', competenciaFim: '2027-07-01' });
    const todas = competencias(d, '2026-01-01', '2028-12-01');
    expect(todas).toHaveLength(10);
    expect(todas[0]).toBe('2026-10-01');
    expect(todas[9]).toBe('2027-07-01');
  });

  it('vencimento respeita o fim do mês (dia 31 em fevereiro)', () => {
    const d = despesa({ diaVencimento: 31, competenciaInicio: '2027-01-01' });
    expect(ocorrenciasNoIntervalo(d, '2027-01-01', '2027-04-01').map((o) => o.vencimento)).toEqual([
      '2027-01-31',
      '2027-02-28',
      '2027-03-31',
      '2027-04-30',
    ]);
  });

  it('cada ocorrência leva o id da despesa e o valor previsto', () => {
    const [o] = ocorrenciasNoIntervalo(despesa(), '2026-10-01', '2026-10-01');
    expect(o).toEqual({ despesaId: 'd1', competencia: '2026-10-01', vencimento: '2026-10-10', valorPrevisto: 1200 });
  });
});

describe('temOcorrenciaEm', () => {
  it('confere a competência contra o ciclo, o início e o fim', () => {
    const d = despesa({ recorrencia: 'trimestral', competenciaFim: '2027-04-01' });
    expect(temOcorrenciaEm(d, '2026-10-01')).toBe(true);
    expect(temOcorrenciaEm(d, '2027-01-01')).toBe(true);
    expect(temOcorrenciaEm(d, '2026-11-01')).toBe(false);
    expect(temOcorrenciaEm(d, '2026-07-01')).toBe(false);
    expect(temOcorrenciaEm(d, '2027-07-01')).toBe(false);
  });
});

describe('valorVigente (RN04)', () => {
  it('sem reajuste, vale o valor base', () => {
    expect(valorVigente(despesa(), '2027-05-01')).toBe(1200);
  });

  it('reajuste vale da sua competência em diante e não reescreve o passado', () => {
    const d = despesa({ reajustes: [{ vigenteDesde: '2027-01-01', valor: 1300 }] });
    expect(valorVigente(d, '2026-12-01')).toBe(1200);
    expect(valorVigente(d, '2027-01-01')).toBe(1300);
    expect(valorVigente(d, '2027-06-01')).toBe(1300);
  });

  it('com vários reajustes, vale o mais recente já vigente, em qualquer ordem', () => {
    const d = despesa({
      reajustes: [
        { vigenteDesde: '2027-06-01', valor: 1500 },
        { vigenteDesde: '2027-01-01', valor: 1300 },
      ],
    });
    expect(valorVigente(d, '2027-03-01')).toBe(1300);
    expect(valorVigente(d, '2027-06-01')).toBe(1500);
  });

  it('as ocorrências já saem com o valor reajustado', () => {
    const d = despesa({ reajustes: [{ vigenteDesde: '2026-12-01', valor: 1300 }] });
    expect(ocorrenciasNoIntervalo(d, '2026-11-01', '2026-12-01').map((o) => o.valorPrevisto)).toEqual([1200, 1300]);
  });
});

describe('equivalenteMensal (RN05)', () => {
  it('divide o valor pelos meses do ciclo', () => {
    expect(equivalenteMensal(despesa({ recorrencia: 'anual', valorBase: 12000 }), '2026-10-01')).toBe(1000);
    expect(equivalenteMensal(despesa({ recorrencia: 'trimestral', valorBase: 900 }), '2026-10-01')).toBe(300);
    expect(equivalenteMensal(despesa(), '2026-10-01')).toBe(1200);
  });

  it('despesa única não tem equivalente mensal', () => {
    expect(equivalenteMensal(despesa({ recorrencia: 'unica' }), '2026-10-01')).toBeNull();
  });
});

describe('situacaoDespesa (RN08)', () => {
  it('futura, ativa ou encerrada pelas datas', () => {
    expect(situacaoDespesa(despesa({ competenciaInicio: '2026-11-01' }), '2026-10-01')).toBe('futura');
    expect(situacaoDespesa(despesa(), '2026-10-01')).toBe('ativa');
    expect(situacaoDespesa(despesa({ competenciaFim: '2026-12-01' }), '2026-12-01')).toBe('ativa');
    expect(situacaoDespesa(despesa({ competenciaFim: '2026-12-01' }), '2027-01-01')).toBe('encerrada');
  });

  it('única fica ativa só no próprio mês', () => {
    const d = despesa({ recorrencia: 'unica' });
    expect(situacaoDespesa(d, '2026-10-01')).toBe('ativa');
    expect(situacaoDespesa(d, '2026-11-01')).toBe('encerrada');
  });
});

describe('proximaOcorrencia', () => {
  it('é a primeira com vencimento a partir de hoje', () => {
    expect(proximaOcorrencia(despesa(), '2026-10-05')?.vencimento).toBe('2026-10-10');
    expect(proximaOcorrencia(despesa(), '2026-10-10')?.vencimento).toBe('2026-10-10');
    expect(proximaOcorrencia(despesa(), '2026-10-11')?.vencimento).toBe('2026-11-10');
  });

  it('anual: encontra a do ano seguinte quando a deste ano já venceu', () => {
    const d = despesa({ recorrencia: 'anual', competenciaInicio: '2026-03-01' });
    expect(proximaOcorrencia(d, '2026-10-01')?.competencia).toBe('2027-03-01');
  });

  it('despesa futura distante mostra a primeira ocorrência', () => {
    const d = despesa({ competenciaInicio: '2028-05-01' });
    expect(proximaOcorrencia(d, '2026-10-01')?.competencia).toBe('2028-05-01');
  });

  it('encerrada não tem próxima', () => {
    expect(proximaOcorrencia(despesa({ competenciaFim: '2026-10-01' }), '2026-10-20')).toBeNull();
  });

  it('mesma despesa com outro "hoje" muda só a situação/próxima, não as ocorrências', () => {
    const d = despesa();
    const antes = ocorrenciasNoIntervalo(d, '2026-10-01', '2027-03-01');
    proximaOcorrencia(d, '2027-02-15');
    situacaoDespesa(d, '2027-02-01');
    expect(ocorrenciasNoIntervalo(d, '2026-10-01', '2027-03-01')).toEqual(antes);
  });
});
