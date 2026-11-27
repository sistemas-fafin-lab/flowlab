import { describe, expect, it } from 'vitest';
import type { ItemColaboradorDisponivel, ItemTabelaColaborador } from '../types';
import { adicionarAoCarrinho, alterarQuantidade } from './carrinho';
import { exameDisponivel, filtrarExamesColaborador, motivoSemValor, totalColaborador } from './carrinhoColaborador';

const disponivel = (nome: string, tuss: string, valor: number): ItemColaboradorDisponivel => ({
  tuss,
  nome,
  precoParticular: null,
  precoColaborador: { disponivel: true, valor },
});

const HEMOGRAMA = disponivel('Hemograma Completo', '40304361', 19.66);
const GLICOSE = disponivel('Glicose', '40302040', 0.1);
const TSH: ItemTabelaColaborador = {
  tuss: '40316521',
  nome: 'TSH',
  precoParticular: 40,
  precoColaborador: { disponivel: false, motivo: 'pouca_vantagem' },
};

describe('totalColaborador', () => {
  it('soma valor colaborador × quantidade, sem desconto por volume nem erro de ponto flutuante', () => {
    let carrinho = [GLICOSE, HEMOGRAMA].reduce(adicionarAoCarrinho<ItemColaboradorDisponivel>, []);
    carrinho = alterarQuantidade(carrinho, '40302040::Glicose', 3);

    // 0,1 × 3 + 19,66 = 19,96 (em float, 0,1 × 3 = 0,30000000000000004)
    expect(totalColaborador(carrinho)).toBe(19.96);
  });

  it('carrinho vazio dá zero', () => {
    expect(totalColaborador([])).toBe(0);
  });

  it('mesmo com 10 exames ou mais de R$ 1.000, o total é a soma pura', () => {
    const exames = Array.from({ length: 10 }, (_, i) => disponivel(`Exame ${i}`, `${i}`, 150));
    expect(totalColaborador(exames.reduce(adicionarAoCarrinho<ItemColaboradorDisponivel>, []))).toBe(1500);
  });
});

describe('exameDisponivel', () => {
  it('só o exame com valor colaborador pode ir ao carrinho', () => {
    expect(exameDisponivel(HEMOGRAMA)).toBe(true);
    expect(exameDisponivel(TSH)).toBe(false);
  });
});

describe('motivoSemValor', () => {
  it('explica cada motivo de "consultar a gestão"', () => {
    expect(motivoSemValor('sem_custo')).toBe('Sem custo cadastrado');
    expect(motivoSemValor('custo_maior_ou_igual_particular')).toBe('Custo maior ou igual ao preço particular');
    expect(motivoSemValor('pouca_vantagem')).toBe('Pouca vantagem sobre o preço particular');
  });
});

describe('filtrarExamesColaborador', () => {
  const exames = [HEMOGRAMA, GLICOSE, TSH];

  it('acha por nome sem acento nem maiúsculas e por TUSS', () => {
    expect(filtrarExamesColaborador(exames, 'hemo')).toEqual([HEMOGRAMA]);
    expect(filtrarExamesColaborador(exames, '40316')).toEqual([TSH]);
    expect(filtrarExamesColaborador(exames, 'GLICOSE 4030')).toEqual([GLICOSE]);
  });

  it('busca vazia devolve todos, na ordem', () => {
    expect(filtrarExamesColaborador(exames, '  ')).toEqual(exames);
  });
});
