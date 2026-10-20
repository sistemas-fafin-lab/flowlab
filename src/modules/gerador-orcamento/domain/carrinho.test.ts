import { describe, expect, it } from 'vitest';
import type { ItemGeradorOrcamento } from '../types';
import { adicionarAoCarrinho, alterarQuantidade, chaveExame, removerDoCarrinho } from './carrinho';

function exame(nome: string, tuss: string, preco = 10): ItemGeradorOrcamento {
  return { tuss, nome, preco, elegivelDescontoParticular: false, conveniosAceitos: [] };
}

const HEMOGRAMA = exame('Hemograma Completo', '40304361', 25);
const PLAQUETAS = exame('Hemograma com Plaquetas', '40304361', 30);
const GLICOSE = exame('Glicose', '40302040', 12);

describe('adicionarAoCarrinho', () => {
  it('entra no fim do carrinho com quantidade 1', () => {
    const carrinho = adicionarAoCarrinho(adicionarAoCarrinho([], GLICOSE), HEMOGRAMA);

    expect(carrinho).toEqual([
      { item: GLICOSE, quantidade: 1 },
      { item: HEMOGRAMA, quantidade: 1 },
    ]);
  });

  it('exames com o mesmo TUSS e nomes diferentes viram itens separados', () => {
    const carrinho = adicionarAoCarrinho(adicionarAoCarrinho([], HEMOGRAMA), PLAQUETAS);

    expect(carrinho).toEqual([
      { item: HEMOGRAMA, quantidade: 1 },
      { item: PLAQUETAS, quantidade: 1 },
    ]);
  });

  it('adicionar de novo um exame que já está no carrinho não duplica nem muda a quantidade', () => {
    const carrinho = [{ item: HEMOGRAMA, quantidade: 3 }];

    expect(adicionarAoCarrinho(carrinho, HEMOGRAMA)).toEqual([{ item: HEMOGRAMA, quantidade: 3 }]);
  });
});

describe('alterarQuantidade', () => {
  const carrinho = [
    { item: HEMOGRAMA, quantidade: 1 },
    { item: PLAQUETAS, quantidade: 1 },
  ];

  it('muda só o exame indicado, mesmo com outro exame do mesmo TUSS no carrinho', () => {
    expect(alterarQuantidade(carrinho, chaveExame(PLAQUETAS), 3)).toEqual([
      { item: HEMOGRAMA, quantidade: 1 },
      { item: PLAQUETAS, quantidade: 3 },
    ]);
  });

  it('quantidade nunca fica abaixo de 1', () => {
    expect(alterarQuantidade(carrinho, chaveExame(HEMOGRAMA), 0)[0].quantidade).toBe(1);
    expect(alterarQuantidade(carrinho, chaveExame(HEMOGRAMA), -4)[0].quantidade).toBe(1);
  });

  it('quantidade fracionada é arredondada para baixo', () => {
    expect(alterarQuantidade(carrinho, chaveExame(HEMOGRAMA), 2.7)[0].quantidade).toBe(2);
  });

  it('valor que não é número (campo apagado) mantém a quantidade atual', () => {
    const comTres = [{ item: HEMOGRAMA, quantidade: 3 }];
    expect(alterarQuantidade(comTres, chaveExame(HEMOGRAMA), Number.NaN)).toEqual(comTres);
  });
});

describe('removerDoCarrinho', () => {
  it('tira só o exame indicado', () => {
    const carrinho = [
      { item: HEMOGRAMA, quantidade: 2 },
      { item: PLAQUETAS, quantidade: 1 },
      { item: GLICOSE, quantidade: 1 },
    ];

    expect(removerDoCarrinho(carrinho, chaveExame(HEMOGRAMA))).toEqual([
      { item: PLAQUETAS, quantidade: 1 },
      { item: GLICOSE, quantidade: 1 },
    ]);
  });
});
