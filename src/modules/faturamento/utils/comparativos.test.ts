import { describe, expect, it } from 'vitest';
import { mesDeReferenciaPadrao, mesesFechados, montarVolumeEnvio, periodosComparativos } from './comparativos';

describe('periodosComparativos', () => {
  it('devolve referência, M-1 e M-2 com o primeiro e o último dia de cada mês', () => {
    expect(periodosComparativos('2026-10')).toEqual([
      { mes: '2026-10', desde: '2026-10-01', ate: '2026-10-31' },
      { mes: '2026-09', desde: '2026-09-01', ate: '2026-09-30' },
      { mes: '2026-08', desde: '2026-08-01', ate: '2026-08-31' },
    ]);
  });

  it('vira o ano para trás: janeiro tem dezembro e novembro do ano anterior', () => {
    expect(periodosComparativos('2026-01').map((p) => p.mes)).toEqual(['2026-01', '2025-12', '2025-11']);
    expect(periodosComparativos('2026-02').map((p) => p.mes)).toEqual(['2026-02', '2026-01', '2025-12']);
  });

  it('respeita fevereiro, inclusive em ano bissexto', () => {
    expect(periodosComparativos('2028-03')[1]).toEqual({ mes: '2028-02', desde: '2028-02-01', ate: '2028-02-29' });
    expect(periodosComparativos('2027-03')[1].ate).toBe('2027-02-28');
  });

  it.each(['2026-13', '2026-00', '2026-1', '26-10', '', '2026-10-01', 'abc'])('mês inválido (%s) devolve null', (mes) => {
    expect(periodosComparativos(mes)).toBeNull();
  });
});

describe('mesDeReferenciaPadrao', () => {
  it('é o último mês fechado, não o corrente', () => {
    expect(mesDeReferenciaPadrao(new Date(2026, 10, 6))).toBe('2026-10');
  });

  it('em janeiro, é dezembro do ano anterior', () => {
    expect(mesDeReferenciaPadrao(new Date(2026, 0, 15))).toBe('2025-12');
  });
});

describe('montarVolumeEnvio', () => {
  const periodos = periodosComparativos('2026-10')!;

  it('uma linha por convênio com lotes e guias nos 3 meses, na ordem referência, M-1, M-2', () => {
    const volume = montarVolumeEnvio(periodos, [
      { mes: '2026-10', fontePagadoraId: 1, nome: 'BRADESCO', qtdLotes: 4, qtdGuias: 120 },
      { mes: '2026-09', fontePagadoraId: 1, nome: 'BRADESCO', qtdLotes: 3, qtdGuias: 90 },
      { mes: '2026-08', fontePagadoraId: 1, nome: 'BRADESCO', qtdLotes: 5, qtdGuias: 150 },
    ]);

    expect(volume).toEqual([
      {
        fontePagadoraId: 1,
        nome: 'BRADESCO',
        meses: [
          { mes: '2026-10', qtdLotes: 4, qtdGuias: 120 },
          { mes: '2026-09', qtdLotes: 3, qtdGuias: 90 },
          { mes: '2026-08', qtdLotes: 5, qtdGuias: 150 },
        ],
      },
    ]);
  });

  it('convênio sem envio em um mês fica com zero nele, não some', () => {
    const [linha] = montarVolumeEnvio(periodos, [
      { mes: '2026-10', fontePagadoraId: 2, nome: 'PMDF', qtdLotes: 2, qtdGuias: 40 },
    ]);

    expect(linha.meses).toEqual([
      { mes: '2026-10', qtdLotes: 2, qtdGuias: 40 },
      { mes: '2026-09', qtdLotes: 0, qtdGuias: 0 },
      { mes: '2026-08', qtdLotes: 0, qtdGuias: 0 },
    ]);
  });

  it('ordena pelo maior volume de guias somado nos 3 meses e desempata pelo nome', () => {
    const volume = montarVolumeEnvio(periodos, [
      { mes: '2026-10', fontePagadoraId: 1, nome: 'ZETA', qtdLotes: 1, qtdGuias: 10 },
      { mes: '2026-10', fontePagadoraId: 2, nome: 'ALFA', qtdLotes: 1, qtdGuias: 10 },
      { mes: '2026-09', fontePagadoraId: 3, nome: 'MEIO', qtdLotes: 9, qtdGuias: 500 },
    ]);

    expect(volume.map((v) => v.nome)).toEqual(['MEIO', 'ALFA', 'ZETA']);
  });

  it('ignora linhas de meses fora dos 3 períodos', () => {
    const volume = montarVolumeEnvio(periodos, [
      { mes: '2026-07', fontePagadoraId: 1, nome: 'BRADESCO', qtdLotes: 9, qtdGuias: 9 },
    ]);
    expect(volume).toEqual([]);
  });

  it('soma linhas repetidas do mesmo convênio e mês e mantém convênio sem identificação', () => {
    const volume = montarVolumeEnvio(periodos, [
      { mes: '2026-10', fontePagadoraId: null, nome: null, qtdLotes: 1, qtdGuias: 3 },
      { mes: '2026-10', fontePagadoraId: null, nome: null, qtdLotes: 2, qtdGuias: 4 },
    ]);

    expect(volume).toHaveLength(1);
    expect(volume[0].nome).toBeNull();
    expect(volume[0].meses[0]).toEqual({ mes: '2026-10', qtdLotes: 3, qtdGuias: 7 });
  });
});

describe('mesesFechados', () => {
  it('lista do último mês fechado para trás, atravessando o ano', () => {
    expect(mesesFechados(4, new Date(2026, 1, 10))).toEqual(['2026-01', '2025-12', '2025-11', '2025-10']);
  });
});
