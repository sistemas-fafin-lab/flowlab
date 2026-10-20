import { describe, expect, it } from 'vitest';
import type { ItemGeradorOrcamento } from '../types';
import { filtrarExames } from './busca';

function exame(nome: string, tuss: string): ItemGeradorOrcamento {
  return { tuss, nome, preco: 10, elegivelDescontoParticular: false, conveniosAceitos: [] };
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

  it('busca vazia ou só com espaços devolve a lista inteira', () => {
    expect(filtrarExames(LISTA, '')).toEqual(LISTA);
    expect(filtrarExames(LISTA, '   ')).toEqual(LISTA);
  });

  it('exames com o mesmo TUSS e nomes diferentes aparecem separados', () => {
    const plaquetas = exame('Hemograma com Plaquetas', '40304361');
    expect(filtrarExames([HEMOGRAMA, plaquetas, GLICOSE], '40304361')).toEqual([HEMOGRAMA, plaquetas]);
  });
});
