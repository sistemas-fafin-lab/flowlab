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
  const tgo = { tuss: '40302580', nome: 'TGO - TRANSAMINASE OXALACETICA' };
  const lipoA = { tuss: '40302210', nome: 'LIPOPROTEÍNA - a' };
  const cariotipo = { tuss: '40501051', nome: 'CARIÓTIPO COM BANDA G PARA 100 CÉLULAS' };
  const lista = [hemograma, glicemia, tgo, lipoA, cariotipo];

  /** Exame lido sem relacionados nem tipo — o resultado da maioria dos casos. */
  const lido = (nomeNoPedido: string, item: (typeof lista)[number] | null) => ({
    nomeNoPedido,
    item,
    relacionados: [],
    tipo: null,
  });

  it('casa exames no formato { exams: [{name, matched}] } pelo campo matched', () => {
    const resposta = {
      exams: [
        { name: 'Hemograma', matched: 'Hemograma Completo' },
        { name: 'Exame Inexistente', matched: null },
      ],
    };

    expect(casarExamesLidos(resposta, lista)).toEqual([
      lido('Hemograma', hemograma),
      lido('Exame Inexistente', null),
    ]);
  });

  it('sigla reconhecida pela IA casa pelo matched', () => {
    const resposta = { exams: [{ name: 'TGO', matched: 'TGO - TRANSAMINASE OXALACETICA' }] };

    expect(casarExamesLidos(resposta, lista)).toEqual([lido('TGO', tgo)]);
  });

  it('o matched é comparado sem acento nem maiúsculas', () => {
    const resposta = { exams: [{ name: 'glicemia', matched: 'GLICEMIA DE JEJUM ' }] };

    expect(casarExamesLidos(resposta, lista)).toEqual([lido('glicemia', glicemia)]);
  });

  it('sem matched, casa quando o nome lido é igual ao da lista', () => {
    const resposta = { exams: [{ name: 'HEMOGRAMA COMPLETO', matched: null }] };

    expect(casarExamesLidos(resposta, lista)).toEqual([lido('HEMOGRAMA COMPLETO', hemograma)]);
  });

  // Regressão: a aproximação por palavras ligava estes dois a exames diferentes.
  it('"Lipo B" não casa com LIPOPROTEÍNA - a só por conter "lipo"', () => {
    expect(casarExamesLidos({ exams: [{ name: 'Lipo B', matched: null }] }, lista)).toEqual([lido('Lipo B', null)]);
  });

  it('"Células LE" não casa com o CARIÓTIPO só por conter "células"', () => {
    expect(casarExamesLidos({ exams: [{ name: 'Células LE', matched: null }] }, lista)).toEqual([
      lido('Células LE', null),
    ]);
  });

  it('exame só como texto casa apenas por nome igual ao da lista', () => {
    expect(casarExamesLidos({ exams: ['glicemia de jejum', 'glicemia jejum'] }, lista)).toEqual([
      lido('glicemia de jejum', glicemia),
      lido('glicemia jejum', null),
    ]);
  });

  it('matched que não existe na lista, com nome lido diferente, não casa', () => {
    const resposta = { exams: [{ name: 'Hemograma', matched: 'HEMOGRAMA COM PLAQUETAS' }] };

    expect(casarExamesLidos(resposta, lista)).toEqual([lido('Hemograma', null)]);
  });

  it('matched que não existe na lista ainda casa pelo nome lido igual', () => {
    const resposta = { exams: [{ name: 'Hemograma Completo', matched: 'HEMOGRAMA COM PLAQUETAS' }] };

    expect(casarExamesLidos(resposta, lista)).toEqual([lido('Hemograma Completo', hemograma)]);
  });

  it('não encontrado traz os relacionados com o nome da lista e o tipo', () => {
    const resposta = {
      exams: [{ name: 'Lipo B', matched: null, relacionados: ['LIPOPROTEINA - A'], tipo: 'variante' }],
    };

    expect(casarExamesLidos(resposta, lista)).toEqual([
      { nomeNoPedido: 'Lipo B', item: null, relacionados: ['LIPOPROTEÍNA - a'], tipo: 'variante' },
    ]);
  });

  it('relacionados fora da lista e repetidos são descartados, na ordem da IA', () => {
    const resposta = {
      exams: [
        {
          name: 'Lipoproteína',
          matched: null,
          relacionados: ['Apolipoproteína B', 'lipoproteína - a', 42, 'Glicemia de Jejum', 'LIPOPROTEÍNA - A'],
          tipo: 'generico',
        },
      ],
    };

    expect(casarExamesLidos(resposta, lista)).toEqual([
      {
        nomeNoPedido: 'Lipoproteína',
        item: null,
        relacionados: ['LIPOPROTEÍNA - a', 'Glicemia de Jejum'],
        tipo: 'generico',
      },
    ]);
  });

  it('tipo fora de variante/generico vira null', () => {
    const resposta = { exams: [{ name: 'Lipo B', matched: null, relacionados: ['LIPOPROTEÍNA - a'], tipo: 'parecido' }] };

    expect(casarExamesLidos(resposta, lista)).toEqual([
      { nomeNoPedido: 'Lipo B', item: null, relacionados: ['LIPOPROTEÍNA - a'], tipo: null },
    ]);
  });

  it('relacionados que não é lista vira lista vazia', () => {
    const resposta = { exams: [{ name: 'Lipo B', matched: null, relacionados: 'LIPOPROTEÍNA - a', tipo: 'variante' }] };

    expect(casarExamesLidos(resposta, lista)).toEqual([
      { nomeNoPedido: 'Lipo B', item: null, relacionados: [], tipo: 'variante' },
    ]);
  });

  it('exame reconhecido ignora relacionados e tipo', () => {
    const resposta = {
      exams: [{ name: 'TGO', matched: 'TGO - TRANSAMINASE OXALACETICA', relacionados: ['Hemograma Completo'], tipo: 'variante' }],
    };

    expect(casarExamesLidos(resposta, lista)).toEqual([lido('TGO', tgo)]);
  });

  it('entradas de exams em formato inesperado (nem string nem {name}) são ignoradas sem lançar', () => {
    const resposta = { exams: [42, { foo: 'bar' }, 'Hemograma Completo'] };

    expect(casarExamesLidos(resposta, lista)).toEqual([lido('Hemograma Completo', hemograma)]);
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
