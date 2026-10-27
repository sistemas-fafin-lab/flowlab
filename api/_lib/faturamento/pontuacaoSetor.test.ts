import { describe, expect, it } from 'vitest';
import { pontuarMes } from './pontuacaoSetor.js';
import type { EntradaPontuacao, FatosPontuacao } from './pontuacaoSetor.js';

function entrada(fatos: FatosPontuacao = {}, overrides: Partial<EntradaPontuacao> = {}): EntradaPontuacao {
  return { mes: '2026-09', fatos, lancamentos: [], membros: [], ...overrides };
}

function criterio(resumo: ReturnType<typeof pontuarMes>, frente: string, chave: string) {
  const achado = resumo.frentes.find((f) => f.frente === frente)?.criterios.find((c) => c.chave === chave);
  if (!achado) throw new Error(`critério ${frente}/${chave} não apareceu`);
  return achado;
}

describe('pontuarMes — meta mensal e meta superada', () => {
  it('abaixo da meta: 0 nos dois critérios', () => {
    const resumo = pontuarMes(entrada({ meta: { valorMeta: 1_000_000, faturado: 999_999.99 } }));

    expect(criterio(resumo, 'faturamento', 'metaMensal').pontosAtingidos).toBe(0);
    expect(criterio(resumo, 'faturamento', 'metaSuperada').pontosAtingidos).toBe(0);
  });

  it('igual à meta: 5 em "Meta mensal"', () => {
    const resumo = pontuarMes(entrada({ meta: { valorMeta: 1_000_000, faturado: 1_000_000 } }));

    expect(criterio(resumo, 'faturamento', 'metaMensal').pontosAtingidos).toBe(5);
    expect(criterio(resumo, 'faturamento', 'metaSuperada').pontosAtingidos).toBe(0);
  });

  it('entre 100% e 115%: 5 em "Meta mensal"', () => {
    const resumo = pontuarMes(entrada({ meta: { valorMeta: 1_000_000, faturado: 1_149_999.99 } }));

    expect(criterio(resumo, 'faturamento', 'metaMensal').pontosAtingidos).toBe(5);
    expect(criterio(resumo, 'faturamento', 'metaSuperada').pontosAtingidos).toBe(0);
  });

  it('exatamente 115%: 10 em "Meta superada" e 0 em "Meta mensal"', () => {
    const resumo = pontuarMes(entrada({ meta: { valorMeta: 1_000_000, faturado: 1_150_000 } }));

    expect(criterio(resumo, 'faturamento', 'metaMensal').pontosAtingidos).toBe(0);
    expect(criterio(resumo, 'faturamento', 'metaSuperada').pontosAtingidos).toBe(10);
  });

  it('115% exato quando 1,15 × meta não é exato no ponto flutuante (meta 7, faturado 8,05)', () => {
    const resumo = pontuarMes(entrada({ meta: { valorMeta: 7, faturado: 8.05 } }));

    expect(criterio(resumo, 'faturamento', 'metaSuperada').pontosAtingidos).toBe(10);
    expect(criterio(resumo, 'faturamento', 'metaMensal').pontosAtingidos).toBe(0);
  });

  it('sem meta cadastrada: "meta não cadastrada" e 0 nos dois', () => {
    const resumo = pontuarMes(entrada({ meta: { valorMeta: null, faturado: 1_114_775.43 } }));

    for (const chave of ['metaMensal', 'metaSuperada']) {
      expect(criterio(resumo, 'faturamento', chave)).toMatchObject({
        pontosAtingidos: 0,
        observacao: 'Meta não cadastrada',
        detalhe: { meta: null, faturado: 1_114_775.43, percentual: null },
      });
    }
  });

  it('meta zerada (o banco aceita 0) vale como não cadastrada: não dá 10 pontos de graça', () => {
    const resumo = pontuarMes(entrada({ meta: { valorMeta: 0, faturado: 500 } }));

    for (const chave of ['metaMensal', 'metaSuperada']) {
      expect(criterio(resumo, 'faturamento', chave)).toMatchObject({ pontosAtingidos: 0, observacao: 'Meta não cadastrada' });
    }
  });

  it('o detalhe mostra meta, faturado e % atingido com uma casa', () => {
    const resumo = pontuarMes(entrada({ meta: { valorMeta: 1_000_000, faturado: 1_114_775.43 } }));

    expect(criterio(resumo, 'faturamento', 'metaMensal').detalhe).toEqual({
      tipo: 'meta',
      meta: 1_000_000,
      faturado: 1_114_775.43,
      percentual: 111.5,
    });
  });

  it('os dois critérios trazem tipo automático e os pontos base da regra', () => {
    const resumo = pontuarMes(entrada({ meta: { valorMeta: 1, faturado: 0 } }));

    expect(criterio(resumo, 'faturamento', 'metaMensal')).toMatchObject({ tipo: 'automatico', pontosBase: 5, rotulo: 'Meta mensal' });
    expect(criterio(resumo, 'faturamento', 'metaSuperada')).toMatchObject({ tipo: 'automatico', pontosBase: 10, rotulo: 'Meta superada' });
  });
});

describe('pontuarMes — Frentes', () => {
  it('as duas Frentes aparecem; critério sem fato nem lançamento fica de fora', () => {
    const resumo = pontuarMes(entrada({ meta: { valorMeta: 1_000_000, faturado: 1_000_000 } }));

    expect(resumo.frentes.map((f) => [f.rotulo, f.criterios.map((c) => c.chave)])).toEqual([
      ['Faturamento', ['metaMensal', 'metaSuperada']],
      ['Recurso de Glosa', []],
    ]);
    expect(resumo.frentes[1].total).toBe(0);
  });

  it('total da Frente: soma dos pontos atingidos, com uma casa', () => {
    const resumo = pontuarMes(entrada(
      { meta: { valorMeta: 1_000_000, faturado: 1_200_000 } },
      {
        lancamentos: [
          { frente: 'faturamento', chave: 'dominioPops', pontos: 0.1, observacao: 'leu os POPs' },
          { frente: 'faturamento', chave: 'melhoriaSetor', pontos: 0.2, observacao: 'curso' },
        ],
      },
    ));

    expect(resumo.frentes[0].total).toBe(10.3);
  });
});
