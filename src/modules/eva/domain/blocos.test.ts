import { describe, expect, it } from 'vitest';
import { DIAS_AGENDA_MAX, DIAS_AGENDA_PADRAO, MAX_BLOCOS, MAX_PASSOS, MAX_TEXTO_PASSO, lerBlocos, lerPassos } from './blocos';

const ctxBlocos = { projetos: ['p1', 'p2'], temReuniao: true };
const ctxPassos = { codigos: new Set(['IT-010', 'IT-011']), atrasados: new Set(['IT-010']) };

describe('blocos do chat (D34)', () => {
  it('lê cada tipo com a referência dele; o resto cai no padrão', () => {
    expect(lerBlocos([{ tipo: 'numeros', referencia: 'qualquer' }], ctxBlocos)).toEqual([{ tipo: 'numeros' }]);
    expect(lerBlocos([{ tipo: 'distribuicao', referencia: 'colunas' }], ctxBlocos)).toEqual([{ tipo: 'distribuicao', por: 'colunas' }]);
    expect(lerBlocos([{ tipo: 'distribuicao', referencia: '' }], ctxBlocos)).toEqual([{ tipo: 'distribuicao', por: 'pessoas' }]);
    expect(lerBlocos([{ tipo: 'agenda', referencia: '3' }], ctxBlocos)).toEqual([{ tipo: 'agenda', dias: 3 }]);
    expect(lerBlocos([{ tipo: 'agenda', referencia: '' }], ctxBlocos)).toEqual([{ tipo: 'agenda', dias: DIAS_AGENDA_PADRAO }]);
    expect(lerBlocos([{ tipo: 'agenda', referencia: '90' }], ctxBlocos)).toEqual([{ tipo: 'agenda', dias: DIAS_AGENDA_MAX }]);
  });

  it('projeto que não existe e reunião sem análise ficam de fora', () => {
    expect(lerBlocos([{ tipo: 'projeto', referencia: 'p9' }, { tipo: 'projeto', referencia: ' p2 ' }], ctxBlocos)).toEqual([{ tipo: 'projeto', projetoId: 'p2' }]);
    expect(lerBlocos([{ tipo: 'reuniao', referencia: '' }], { ...ctxBlocos, temReuniao: false })).toEqual([]);
    expect(lerBlocos([{ tipo: 'grafico', referencia: '' }], ctxBlocos)).toEqual([]);
  });

  it('sem repetir e no máximo dois', () => {
    const r = lerBlocos([
      { tipo: 'numeros', referencia: '' }, { tipo: 'numeros', referencia: '' },
      { tipo: 'projeto', referencia: 'p1' }, { tipo: 'reuniao', referencia: '' },
    ], ctxBlocos);
    expect(r).toEqual([{ tipo: 'numeros' }, { tipo: 'projeto', projetoId: 'p1' }]);
    expect(r).toHaveLength(MAX_BLOCOS);
    expect(lerBlocos(null, ctxBlocos)).toEqual([]);
  });
});

describe('próximos passos do chat (D34)', () => {
  it('pergunta curta; card que existe; cobrança só de atrasado', () => {
    expect(lerPassos([
      { tipo: 'perguntar', texto: '  E o que   vence amanhã? ' },
      { tipo: 'abrir_card', texto: 'it-011' },
      { tipo: 'cobrar_card', texto: 'IT-010' },
    ], ctxPassos)).toEqual([
      { tipo: 'perguntar', texto: 'E o que vence amanhã?' },
      { tipo: 'abrir_card', codigo: 'IT-011' },
      { tipo: 'cobrar_card', codigo: 'IT-010' },
    ]);
    expect(lerPassos([{ tipo: 'cobrar_card', texto: 'IT-011' }, { tipo: 'abrir_card', texto: 'IT-999' }, { tipo: 'perguntar', texto: '  ' }], ctxPassos)).toEqual([]);
    expect(lerPassos([{ tipo: 'perguntar', texto: 'x'.repeat(200) }], ctxPassos)[0]).toEqual({ tipo: 'perguntar', texto: 'x'.repeat(MAX_TEXTO_PASSO) });
  });

  it('sem repetir e no máximo três', () => {
    const r = lerPassos([
      { tipo: 'perguntar', texto: 'A?' }, { tipo: 'perguntar', texto: 'a?' },
      { tipo: 'perguntar', texto: 'B?' }, { tipo: 'perguntar', texto: 'C?' }, { tipo: 'perguntar', texto: 'D?' },
    ], ctxPassos);
    expect(r.map((p) => (p.tipo === 'perguntar' ? p.texto : ''))).toEqual(['A?', 'B?', 'C?']);
    expect(r).toHaveLength(MAX_PASSOS);
  });
});
