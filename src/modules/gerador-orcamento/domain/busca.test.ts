import { describe, expect, it } from 'vitest';
import type { ItemGeradorOrcamento } from '../types';
import { filtrarExames } from './busca';

function exame(nome: string, tuss: string, preco = 10): ItemGeradorOrcamento {
  return { tuss, nome, preco, elegivelDescontoParticular: false, conveniosAceitos: [] };
}

const HEMOGRAMA = exame('Hemograma Completo', '40304361');
const GLICOSE = exame('Glicose', '40302040');
const TSH = exame('Hormônio Tireoestimulante (TSH)', '40316521');
const LISTA = [HEMOGRAMA, GLICOSE, TSH];

describe('filtrarExames', () => {
  it('acha pelo nome sem diferenciar maiúsculas nem acentos', () => {
    expect(filtrarExames(LISTA, 'hormonio')).toEqual([TSH]);
    expect(filtrarExames(LISTA, 'GLICOSE')).toEqual([GLICOSE]);
  });

  it('acha pelo código TUSS, inclusive por parte dele', () => {
    expect(filtrarExames(LISTA, '40304361')).toEqual([HEMOGRAMA]);
    expect(filtrarExames(LISTA, '4031')).toEqual([TSH]);
  });

  it('com várias palavras, cada uma precisa aparecer no nome ou no TUSS', () => {
    expect(filtrarExames(LISTA, 'hemograma completo')).toEqual([HEMOGRAMA]);
    expect(filtrarExames(LISTA, 'completo hemo')).toEqual([HEMOGRAMA]);
    expect(filtrarExames(LISTA, 'tsh 40316521')).toEqual([TSH]);
    expect(filtrarExames(LISTA, 'hemograma glicose')).toEqual([]);
  });

  it('acha pelo preço, escrito com vírgula, com ponto, com R$ ou só a parte inteira', () => {
    const vitaminaD = exame('Vitamina D', '40302830', 141);
    const ferritina = exame('Ferritina', '40316270', 82.5);
    const lista = [vitaminaD, ferritina, exame('Glicose', '40302040', 24)];
    expect(filtrarExames(lista, '141,00')).toEqual([vitaminaD]);
    expect(filtrarExames(lista, '141.00')).toEqual([vitaminaD]);
    expect(filtrarExames(lista, 'R$ 141')).toEqual([vitaminaD]);
    expect(filtrarExames(lista, 'R$141,00')).toEqual([vitaminaD]);
    expect(filtrarExames(lista, '82,5')).toEqual([ferritina]);
    expect(filtrarExames(lista, 'vitamina 141')).toEqual([vitaminaD]);
  });

  it('acha preço acima de mil com ou sem o ponto do milhar', () => {
    const painel = exame('Painel Genético', '40503046', 1467);
    const lista = [painel, GLICOSE];
    expect(filtrarExames(lista, '1.467,00')).toEqual([painel]);
    expect(filtrarExames(lista, '1467,00')).toEqual([painel]);
    expect(filtrarExames(lista, 'R$ 1.467')).toEqual([painel]);
  });

  it('busca vazia ou só com espaços devolve a lista inteira', () => {
    expect(filtrarExames(LISTA, '')).toEqual(LISTA);
    expect(filtrarExames(LISTA, '   ')).toEqual(LISTA);
  });

  it('exames com o mesmo TUSS e nomes diferentes aparecem separados', () => {
    const plaquetas = exame('Hemograma com Plaquetas', '40304361');
    expect(filtrarExames([HEMOGRAMA, plaquetas, GLICOSE], '40304361')).toEqual([HEMOGRAMA, plaquetas]);
  });
});
