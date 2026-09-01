import { describe, expect, it } from 'vitest';
import { filtrarCardsCorrelacao, mesclarVinculosComOrigem } from './riscosCorrelacao.js';

describe('mesclarVinculosComOrigem', () => {
  it('sem origem, retorna os vínculos N:N com ehOrigem false', () => {
    const resultado = mesclarVinculosComOrigem([{ id: 'a' }, { id: 'b' }], []);
    expect(resultado).toEqual([
      { id: 'a', ehOrigem: false },
      { id: 'b', ehOrigem: false },
    ]);
  });

  it('só origem, sem vínculo N:N — entra como uma linha adicional com ehOrigem true', () => {
    const resultado = mesclarVinculosComOrigem([], [{ id: 'a' }]);
    expect(resultado).toEqual([{ id: 'a', ehOrigem: true }]);
  });

  it('mesmo id em origem e em vínculo N:N — mescla numa única linha, sem duplicar', () => {
    const resultado = mesclarVinculosComOrigem([{ id: 'a' }], [{ id: 'a' }]);
    expect(resultado).toEqual([{ id: 'a', ehOrigem: true }]);
  });

  it('origem e vínculos N:N distintos — origem entra à parte, os demais ficam ehOrigem false', () => {
    const resultado = mesclarVinculosComOrigem([{ id: 'a' }, { id: 'b' }], [{ id: 'origem' }]);
    expect(resultado).toEqual([
      { id: 'origem', ehOrigem: true },
      { id: 'a', ehOrigem: false },
      { id: 'b', ehOrigem: false },
    ]);
  });

  it('mais de uma origem (2 riscos nascidos da mesma ocorrência) — todas entram', () => {
    const resultado = mesclarVinculosComOrigem([], [{ id: 'risco-1' }, { id: 'risco-2' }]);
    expect(resultado).toHaveLength(2);
    expect(resultado.every((r) => r.ehOrigem)).toBe(true);
  });

  it('não muta os arrays originais', () => {
    const vinculos = [{ id: 'a' }];
    const origens = [{ id: 'a' }];
    mesclarVinculosComOrigem(vinculos, origens);
    expect(vinculos).toEqual([{ id: 'a' }]);
    expect(origens).toEqual([{ id: 'a' }]);
  });
});

function card(overrides: Partial<{ riscoIdentificado: string; processo: string; ocorrencias: { resumo: string }[] }> = {}) {
  return {
    riscoIdentificado: 'Perda de material durante o corte',
    processo: 'Microtomia',
    ocorrencias: [{ resumo: 'Lâmina quebrada' }],
    ...overrides,
  };
}

describe('filtrarCardsCorrelacao', () => {
  it('busca vazia retorna todos os cards (cópia, não a mesma referência)', () => {
    const cards = [card()];
    const resultado = filtrarCardsCorrelacao(cards, '');
    expect(resultado).toEqual(cards);
    expect(resultado).not.toBe(cards);
  });

  it('filtra por texto do risco identificado', () => {
    const alvo = card({ riscoIdentificado: 'Contaminação de amostra' });
    const outro = card({ riscoIdentificado: 'Perda de material' });
    expect(filtrarCardsCorrelacao([alvo, outro], 'contaminação')).toEqual([alvo]);
  });

  it('filtra por texto do processo', () => {
    const alvo = card({ processo: 'Coloração especial' });
    const outro = card({ processo: 'Microtomia' });
    expect(filtrarCardsCorrelacao([alvo, outro], 'coloração')).toEqual([alvo]);
  });

  it('filtra por texto de uma ocorrência vinculada', () => {
    const alvo = card({ ocorrencias: [{ resumo: 'Requisição extraviada' }] });
    const outro = card({ ocorrencias: [{ resumo: 'Lâmina quebrada' }] });
    expect(filtrarCardsCorrelacao([alvo, outro], 'extraviada')).toEqual([alvo]);
  });

  it('busca é acento-insensível', () => {
    const alvo = card({ riscoIdentificado: 'Contaminação de amostra' });
    expect(filtrarCardsCorrelacao([alvo], 'contaminacao')).toEqual([alvo]);
  });

  it('sem correspondência, retorna vazio', () => {
    expect(filtrarCardsCorrelacao([card()], 'nada relacionado')).toEqual([]);
  });
});
