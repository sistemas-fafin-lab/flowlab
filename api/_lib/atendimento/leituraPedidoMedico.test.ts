// Testes portados de lib/alvaro-orcamento/analyze.test.ts da Tabela-Particular
// (parseAiResponseText / matchAiResponse). O total em R$ e o fallback de exibição
// bruta do AiModal não vêm junto: a tela soma pelo carrinho, e resposta sem lista
// de exames vira `null` (o handler responde erro).

import { describe, expect, it } from 'vitest';
import { casarExamesLidos, lerRespostaIa } from './leituraPedidoMedico.js';

describe('lerRespostaIa', () => {
  it('interpreta JSON puro devolvido pela IA', () => {
    expect(lerRespostaIa('{"exams":[]}')).toEqual({ exams: [] });
  });

  it('remove cercas ```json``` antes de interpretar', () => {
    const texto = '```json\n{"exams":["Hemograma"]}\n```';
    expect(lerRespostaIa(texto)).toEqual({ exams: ['Hemograma'] });
  });

  it('devolve null sem lançar quando a resposta não é JSON válido', () => {
    expect(lerRespostaIa('Não consegui identificar exames neste pedido.')).toBeNull();
  });
});

describe('casarExamesLidos', () => {
  const hemograma = { tuss: '40304361', nome: 'Hemograma Completo' };
  const glicemia = { tuss: '40302040', nome: 'Glicemia de Jejum' };
  const lista = [hemograma, glicemia];

  it('casa exames no formato { exams: [{name, matched}] } pelo campo matched', () => {
    const resposta = {
      exams: [
        { name: 'Hemograma', matched: 'Hemograma Completo' },
        { name: 'Exame Inexistente', matched: null },
      ],
    };

    expect(casarExamesLidos(resposta, lista)).toEqual([
      { nomeNoPedido: 'Hemograma', item: hemograma },
      { nomeNoPedido: 'Exame Inexistente', item: null },
    ]);
  });

  it('o matched é comparado sem acento nem maiúsculas', () => {
    const resposta = { exams: [{ name: 'glicemia', matched: 'GLICEMIA DE JEJUM ' }] };

    expect(casarExamesLidos(resposta, lista)).toEqual([{ nomeNoPedido: 'glicemia', item: glicemia }]);
  });

  it('casa exames no formato { exams: [string] } por aproximação de nome quando não há matched', () => {
    const resposta = { exams: ['glicemia jejum'] };

    expect(casarExamesLidos(resposta, lista)).toEqual([{ nomeNoPedido: 'glicemia jejum', item: glicemia }]);
  });

  it('matched que não existe na lista cai na aproximação pelo nome lido', () => {
    const resposta = { exams: [{ name: 'Hemograma Completo', matched: 'HEMOGRAMA COM PLAQUETAS' }] };

    expect(casarExamesLidos(resposta, lista)).toEqual([{ nomeNoPedido: 'Hemograma Completo', item: hemograma }]);
  });

  it('palavras de até duas letras não contam na aproximação', () => {
    // "de" é ignorada; "xx" também — sem palavra que conte, não há aproximação.
    expect(casarExamesLidos({ exams: ['de xx'] }, lista)).toEqual([{ nomeNoPedido: 'de xx', item: null }]);
  });

  it('entradas de exams em formato inesperado (nem string nem {name}) são ignoradas sem lançar', () => {
    const resposta = { exams: [42, { foo: 'bar' }, 'Hemograma Completo'] };

    expect(casarExamesLidos(resposta, lista)).toEqual([{ nomeNoPedido: 'Hemograma Completo', item: hemograma }]);
  });

  it('payload sem exams devolve null', () => {
    expect(casarExamesLidos({ foo: 'bar' }, lista)).toBeNull();
  });

  it('valor não-objeto devolve null', () => {
    expect(casarExamesLidos('texto qualquer', lista)).toBeNull();
    expect(casarExamesLidos(null, lista)).toBeNull();
  });

  it('payload com exams truthy mas não-array devolve null', () => {
    expect(casarExamesLidos({ exams: 'nenhum exame encontrado' }, lista)).toBeNull();
  });
});
