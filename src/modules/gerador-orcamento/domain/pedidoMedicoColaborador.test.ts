import { describe, expect, it } from 'vitest';
import type { ItemColaboradorDisponivel, ItemTabelaColaborador } from '../types';
import type { ExameLidoNoPedido } from './pedidoMedico';
import { resolverLeituraColaborador } from './pedidoMedicoColaborador';

const HEMOGRAMA: ItemColaboradorDisponivel = {
  tuss: '40304361',
  nome: 'Hemograma Completo',
  precoParticular: 25,
  precoColaborador: { disponivel: true, valor: 19.66 },
};
const PAINEL_INTERNO: ItemColaboradorDisponivel = {
  tuss: '',
  nome: 'Painel Interno Colaborador',
  precoParticular: null,
  precoColaborador: { disponivel: true, valor: 30 },
};
const TSH: ItemTabelaColaborador = {
  tuss: '40316521',
  nome: 'TSH',
  precoParticular: 40,
  precoColaborador: { disponivel: false, motivo: 'pouca_vantagem' },
};
const LISTA = [HEMOGRAMA, PAINEL_INTERNO, TSH];

/** Exame lido como o servidor devolve no modo colaborador: com o resultado da regra. */
const lido = (nomeNoPedido: string, item: ItemTabelaColaborador | null): ExameLidoNoPedido => ({
  nomeNoPedido,
  item: item && { tuss: item.tuss, nome: item.nome, precoColaborador: item.precoColaborador },
  relacionados: [],
  tipo: null,
});

describe('resolverLeituraColaborador', () => {
  it('separa os disponíveis (vão ao carrinho) dos "consultar a gestão" (com o motivo, à parte)', () => {
    const leitura = resolverLeituraColaborador(
      [lido('Hemograma', HEMOGRAMA), lido('TSH', TSH), lido('Painel interno', PAINEL_INTERNO)],
      LISTA,
    );

    expect(leitura.disponiveis).toEqual([
      { nomeNoPedido: 'Hemograma', exame: HEMOGRAMA },
      { nomeNoPedido: 'Painel interno', exame: PAINEL_INTERNO },
    ]);
    expect(leitura.consultarGestao).toEqual([
      { nomeNoPedido: 'TSH', exame: TSH, motivo: 'Pouca vantagem sobre o preço particular' },
    ]);
    expect(leitura.semCorrespondencia).toEqual([]);
  });

  it('não reconhecidos e reconhecidos fora da lista da tela vão para os não encontrados, como hoje', () => {
    const forDaLista: ItemTabelaColaborador = {
      tuss: '1',
      nome: 'Exame que a tela não carregou',
      precoParticular: null,
      precoColaborador: { disponivel: true, valor: 10 },
    };
    const naoReconhecido: ExameLidoNoPedido = {
      nomeNoPedido: 'Lipo B',
      item: null,
      relacionados: ['Hemograma Completo'],
      tipo: 'variante',
    };

    const leitura = resolverLeituraColaborador([naoReconhecido, lido('Outro', forDaLista)], LISTA);

    expect(leitura.semCorrespondencia).toEqual([
      { nomeNoPedido: 'Lipo B', relacionados: ['Hemograma Completo'], tipo: 'variante' },
      { nomeNoPedido: 'Outro', relacionados: [], tipo: null },
    ]);
    expect(leitura.disponiveis).toEqual([]);
    expect(leitura.consultarGestao).toEqual([]);
  });

  it('o mesmo exame lido duas vezes aparece uma vez só', () => {
    const leitura = resolverLeituraColaborador(
      [lido('Hemograma', HEMOGRAMA), lido('HMG', HEMOGRAMA), lido('TSH', TSH), lido('TSH us', TSH)],
      LISTA,
    );

    expect(leitura.disponiveis).toEqual([{ nomeNoPedido: 'Hemograma', exame: HEMOGRAMA }]);
    expect(leitura.consultarGestao).toHaveLength(1);
  });

  it('separa pelo resultado da regra que o servidor devolveu, mesmo que a lista da tela esteja desatualizada', () => {
    // A tela carregou o Hemograma disponível e o TSH indisponível; depois os parâmetros
    // mudaram e o servidor, que lê a regra a cada leitura, devolveu o contrário.
    const leitura = resolverLeituraColaborador(
      [
        { ...lido('Hemograma', HEMOGRAMA), item: { tuss: HEMOGRAMA.tuss, nome: HEMOGRAMA.nome, precoColaborador: { disponivel: false, motivo: 'pouca_vantagem' } } },
        { ...lido('TSH', TSH), item: { tuss: TSH.tuss, nome: TSH.nome, precoColaborador: { disponivel: true, valor: 21.5 } } },
      ],
      LISTA,
    );

    expect(leitura.consultarGestao).toEqual([
      {
        nomeNoPedido: 'Hemograma',
        exame: { ...HEMOGRAMA, precoColaborador: { disponivel: false, motivo: 'pouca_vantagem' } },
        motivo: 'Pouca vantagem sobre o preço particular',
      },
    ]);
    // O que vai ao carrinho leva o valor do servidor.
    expect(leitura.disponiveis).toEqual([
      { nomeNoPedido: 'TSH', exame: { ...TSH, precoColaborador: { disponivel: true, valor: 21.5 } } },
    ]);
  });

  it('sem o resultado da regra na resposta (servidor de antes da mudança), vale o da lista da tela', () => {
    const semRegra = (nomeNoPedido: string, item: ItemTabelaColaborador): ExameLidoNoPedido => ({
      nomeNoPedido,
      item: { tuss: item.tuss, nome: item.nome },
      relacionados: [],
      tipo: null,
    });

    const leitura = resolverLeituraColaborador([semRegra('Hemograma', HEMOGRAMA), semRegra('TSH', TSH)], LISTA);

    expect(leitura.disponiveis).toEqual([{ nomeNoPedido: 'Hemograma', exame: HEMOGRAMA }]);
    expect(leitura.consultarGestao).toEqual([
      { nomeNoPedido: 'TSH', exame: TSH, motivo: 'Pouca vantagem sobre o preço particular' },
    ]);
  });
});
