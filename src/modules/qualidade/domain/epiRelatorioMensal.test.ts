import { describe, expect, it } from 'vitest';
import { copiarIdentificacaoEpi, type ProdutoComIdentificacaoEpi } from './epiRelatorioMensal.js';

const luva: ProdutoComIdentificacaoEpi = {
  id: 'p-luva',
  isEpi: true,
  epiTipo: 'CA',
  epiNumero: '12345',
  epiValidade: '2027-03-31',
};

describe('copiarIdentificacaoEpi', () => {
  it('item de produto EPI recebe a cópia da identificação vigente', () => {
    const itens = [{ id: 'i1', productId: 'p-luva', productName: 'Luva', quantity: 2, category: 'general' }];

    expect(copiarIdentificacaoEpi(itens, [luva])).toEqual([
      {
        id: 'i1',
        productId: 'p-luva',
        productName: 'Luva',
        quantity: 2,
        category: 'general',
        identificacaoEpi: { tipo: 'CA', numero: '12345', validade: '2027-03-31' },
      },
    ]);
  });

  it('EPI sem identificação no cadastro recebe cópia vazia, sem erro', () => {
    const mascara: ProdutoComIdentificacaoEpi = { id: 'p-mascara', isEpi: true, epiTipo: '', epiNumero: '', epiValidade: '' };
    const itens = [{ id: 'i1', productId: 'p-mascara', productName: 'Máscara', quantity: 1, category: 'general' }];

    expect(copiarIdentificacaoEpi(itens, [mascara])[0].identificacaoEpi).toEqual({
      tipo: null,
      numero: null,
      validade: null,
    });
  });

  it('item de produto que não é EPI fica intacto', () => {
    const papel: ProdutoComIdentificacaoEpi = { id: 'p-papel', isEpi: false, epiTipo: '', epiNumero: '', epiValidade: '' };
    const item = { id: 'i1', productId: 'p-papel', productName: 'Papel A4', quantity: 5, category: 'general' };

    const [resultado] = copiarIdentificacaoEpi([item], [papel]);

    expect(resultado).toEqual(item);
    expect(resultado).not.toHaveProperty('identificacaoEpi');
  });

  it('item digitado à mão, sem produto cadastrado, não recebe cópia', () => {
    const item = { id: 'i1', productId: null, productName: 'Luva', quantity: 1, category: 'general' };

    const [resultado] = copiarIdentificacaoEpi([item], [luva]);

    expect(resultado).not.toHaveProperty('identificacaoEpi');
  });

  it('numa solicitação mista, só os itens EPI recebem a cópia, na mesma ordem', () => {
    const papel: ProdutoComIdentificacaoEpi = { id: 'p-papel', isEpi: false, epiTipo: '', epiNumero: '', epiValidade: '' };
    const itens = [
      { id: 'i1', productId: 'p-papel', productName: 'Papel A4', quantity: 5, category: 'general' },
      { id: 'i2', productId: 'p-luva', productName: 'Luva', quantity: 2, category: 'general' },
      { id: 'i3', productId: null, productName: 'Caneta', quantity: 1, category: 'general' },
    ];

    const resultado = copiarIdentificacaoEpi(itens, [papel, luva]);

    expect(resultado.map((i) => i.id)).toEqual(['i1', 'i2', 'i3']);
    expect(resultado.map((i) => 'identificacaoEpi' in i)).toEqual([false, true, false]);
  });
});
