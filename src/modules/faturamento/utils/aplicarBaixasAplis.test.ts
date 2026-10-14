import { describe, expect, it } from 'vitest';
import type { TituloPreviaBaixasAplis } from '../types';
import {
  resumoAplicacao,
  selecaoPadraoBaixas,
  separarPrevia,
  titulosComBaixaRepetida,
  totalALancar,
} from './aplicarBaixasAplis';

function titulo(parcial: Partial<TituloPreviaBaixasAplis> & { idNota: string }): TituloPreviaBaixasAplis {
  return {
    numeroNota: '123',
    operadora: 'Unimed',
    tipo: 'so-no-aplis',
    recebidoSistema: 0,
    recebidoAplis: 100,
    baixas: [{ data: '2026-09-22', valor: 100, observacoes: 'Baixa do apLIS' }],
    pulado: null,
    ...parcial,
  };
}

describe('separarPrevia', () => {
  it('título com baixas e com número vai para os aplicáveis', () => {
    const { aplicaveis, pulados } = separarPrevia([titulo({ idNota: 'a' })]);
    expect(aplicaveis.map((t) => t.idNota)).toEqual(['a']);
    expect(pulados).toEqual([]);
  });

  it('título sem número da nota é pulado — sem número da nota', () => {
    const { aplicaveis, pulados } = separarPrevia([
      titulo({ idNota: 'a', numeroNota: null, baixas: [], pulado: 'sem-nota' }),
    ]);
    expect(aplicaveis).toEqual([]);
    expect(pulados).toEqual([{ titulo: expect.objectContaining({ idNota: 'a' }), motivo: 'sem número da nota' }]);
  });

  it('título com número mas sem baixa sugerida é pulado — sem data de recebimento no apLIS', () => {
    const { aplicaveis, pulados } = separarPrevia([titulo({ idNota: 'a', baixas: [] })]);
    expect(aplicaveis).toEqual([]);
    expect(pulados[0].motivo).toBe('sem data de recebimento no apLIS');
  });

  it('mantém a ordem da rota', () => {
    const { aplicaveis } = separarPrevia([titulo({ idNota: 'b' }), titulo({ idNota: 'a' })]);
    expect(aplicaveis.map((t) => t.idNota)).toEqual(['b', 'a']);
  });
});

describe('totalALancar', () => {
  it('soma as baixas só dos títulos marcados, em centavos', () => {
    const titulos = [
      titulo({
        idNota: 'a',
        baixas: [
          { data: '2026-09-01', valor: 0.1, observacoes: '' },
          { data: '2026-09-02', valor: 0.2, observacoes: '' },
        ],
      }),
      titulo({ idNota: 'b', baixas: [{ data: '2026-09-03', valor: 50, observacoes: '' }] }),
      titulo({ idNota: 'c', baixas: [{ data: '2026-09-03', valor: 1000, observacoes: '' }] }),
    ];
    expect(totalALancar(titulos, new Set(['a', 'b']))).toEqual({ titulos: 2, baixas: 3, valor: 50.3 });
  });

  it('nada marcado = zero', () => {
    expect(totalALancar([titulo({ idNota: 'a' })], new Set())).toEqual({ titulos: 0, baixas: 0, valor: 0 });
  });
});

describe('resumoAplicacao', () => {
  it('conta títulos lançados, parciais e com erro', () => {
    expect(resumoAplicacao(['lancado', 'lancado', 'parcial', 'falhou'])).toEqual({
      lancados: 2,
      parciais: 1,
      falharam: 1,
      texto: '2 títulos lançados, 1 lançado em parte, 1 falhou',
    });
  });

  it('singular e sem as partes zeradas', () => {
    expect(resumoAplicacao(['lancado']).texto).toBe('1 título lançado');
  });

  it('nenhum lançado', () => {
    expect(resumoAplicacao(['falhou', 'falhou']).texto).toBe('0 títulos lançados, 2 falharam');
  });
});

describe('titulosComBaixaRepetida', () => {
  const baixa = { data: '2026-09-22', valor: 100, observacoes: 'Baixa do apLIS — lote(s) 6329 (recebido em 22/09/2026)' };

  it('aponta os títulos que repetem a mesma baixa (lote vinculado aos dois)', () => {
    const titulos = [
      titulo({ idNota: 'a', baixas: [baixa] }),
      titulo({ idNota: 'b', baixas: [{ ...baixa, data: '2026-09-23', observacoes: 'outro lote' }, baixa] }),
      titulo({ idNota: 'c', baixas: [{ ...baixa, observacoes: 'Baixa do apLIS — lote(s) 7000 (recebido em 22/09/2026)' }] }),
    ];
    expect(titulosComBaixaRepetida(titulos)).toEqual(new Set(['a', 'b']));
  });

  it('nenhum repetido = conjunto vazio', () => {
    expect(titulosComBaixaRepetida([titulo({ idNota: 'a' })]).size).toBe(0);
  });
});

describe('selecaoPadraoBaixas', () => {
  it('marca os aplicáveis, menos os que repetem baixa de outro título', () => {
    const repetida = { data: '2026-09-22', valor: 100, observacoes: 'lote 1' };
    const titulos = [
      titulo({ idNota: 'a', baixas: [repetida] }),
      titulo({ idNota: 'b', baixas: [repetida] }),
      titulo({ idNota: 'c' }),
    ];
    expect(selecaoPadraoBaixas(titulos)).toEqual(new Set(['c']));
  });
});
