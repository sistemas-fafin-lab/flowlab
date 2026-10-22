import { describe, expect, it } from 'vitest';
import type { Exam } from '../../../hooks/useCostControl';
import { chaveNomeConvenio, examesMaisParecidos, semelhancaNomes } from './semelhancaNomes';

const exame = (id: string, name: string): Exam => ({
  id,
  code: '',
  tuss: '40307271',
  name,
  location: '',
  direct: 0,
  indirect: 0,
  indirectItems: [],
  aplisIdExameTipo: null,
  aplisIdTeste: null,
});

describe('semelhancaNomes', () => {
  it('nome contido no outro é totalmente semelhante, sem diferenciar acentos nem maiúsculas', () => {
    expect(semelhancaNomes('Hemograma', 'HEMOGRAMA COMPLETO')).toBe(1);
    expect(semelhancaNomes('Hormônio tireoestimulante (TSH)', 'HORMONIO TIREOESTIMULANTE - TSH')).toBe(1);
  });

  it('ignora palavras vazias ("de", "da"...) e as genéricas da tabela TUSS ("Dosagem", "Pesquisa E/ou")', () => {
    expect(semelhancaNomes('Dosagem de Ferritina', 'FERRITINA')).toBe(1);
    expect(semelhancaNomes('Tiroxina (t4), Dosagem', 'T4 TOTAL')).toBe(0.5);
    expect(semelhancaNomes('Rubéola - Igg, Dosagem', 'RUBÉOLA - IGG - PESQUISA E/OU DOSAGEM')).toBe(1);
  });

  it('aceita abreviação de 4 letras ou mais', () => {
    expect(semelhancaNomes('Fungos - Cult.', 'FUNGOS - CULTURA')).toBe(1);
  });

  it('aceita a mesma palavra em grafia diferente quando o começo comum é longo', () => {
    expect(semelhancaNomes('Triglicerídeos, Dosagem', 'TRIGLICÉRIDES - S')).toBe(1);
    expect(semelhancaNomes('Hepatite', 'Heparina')).toBe(0);
  });

  it('nomes sem palavra em comum não são semelhantes', () => {
    expect(semelhancaNomes('Glicose', 'GLICEMIA DE JEJUM')).toBe(0);
  });
});

describe('chaveNomeConvenio', () => {
  it('mesma chave para o mesmo nome escrito de outro jeito', () => {
    expect(chaveNomeConvenio('Hemograma  Completo')).toBe(chaveNomeConvenio('HEMOGRAMA - completo'));
  });
});

describe('examesMaisParecidos', () => {
  const total = exame('e1', 'IGE TOTAL');
  const painel = exame('e2', 'IgE Painel Alimentos (FX5E)');

  it('vincula ao exame cujo nome contém o do convênio, sem os menos parecidos', () => {
    expect(examesMaisParecidos('Ige, Total, Dosagem', [painel, total])).toEqual([total]);
  });

  it('com um exame só no TUSS ainda exige nome parecido', () => {
    expect(examesMaisParecidos('Hemograma', [exame('e3', 'HEMOGRAMA COMPLETO')]).map(e => e.id)).toEqual(['e3']);
    expect(examesMaisParecidos('Glicose', [exame('e4', 'GLICEMIA DE JEJUM')])).toEqual([]);
  });

  it('exames do TUSS igualmente parecidos: vale para todos (o convênio paga o mesmo)', () => {
    const soro = exame('s', 'CREATININA - S');
    const urina = exame('u', 'CREATININA - U');
    const urina24 = exame('u24', 'CREATININA - U-24');
    expect(examesMaisParecidos('Creatinina, Dosagem', [soro, urina, urina24])).toEqual([soro, urina, urina24]);
  });

  it('sem candidatos não vincula', () => {
    expect(examesMaisParecidos('Hemograma', [])).toEqual([]);
  });
});
