import { describe, expect, it } from 'vitest';
import {
  moverCategoria,
  normalizarNomeCategoria,
  ordenarCategorias,
  proximaOrdem,
  validarNomeCategoria,
} from './categorias';

const cat = (id: string, nome: string, ordem: number) => ({ id, nome, ordem });

describe('ordenarCategorias', () => {
  it('ordena por ordem crescente', () => {
    const r = ordenarCategorias([cat('b', 'B', 2), cat('a', 'A', 1), cat('c', 'C', 3)]);
    expect(r.map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });

  it('desempata pelo nome quando a ordem se repete', () => {
    const r = ordenarCategorias([cat('s', 'SaaS', 2), cat('c', 'Cloud', 2), cat('i', 'IA', 1)]);
    expect(r.map((c) => c.id)).toEqual(['i', 'c', 's']);
  });

  it('não altera a lista recebida', () => {
    const lista = [cat('b', 'B', 2), cat('a', 'A', 1)];
    ordenarCategorias(lista);
    expect(lista.map((c) => c.id)).toEqual(['b', 'a']);
  });
});

describe('proximaOrdem', () => {
  it('é a maior ordem + 1', () => {
    expect(proximaOrdem([{ ordem: 1 }, { ordem: 8 }, { ordem: 3 }])).toBe(9);
  });

  it('começa em 1 sem categorias', () => {
    expect(proximaOrdem([])).toBe(1);
  });
});

describe('moverCategoria', () => {
  const ids = ['a', 'b', 'c'];

  it('sobe uma posição', () => {
    expect(moverCategoria(ids, 'b', 'subir')).toEqual(['b', 'a', 'c']);
  });

  it('desce uma posição', () => {
    expect(moverCategoria(ids, 'b', 'descer')).toEqual(['a', 'c', 'b']);
  });

  it('não sai da ponta de cima nem da de baixo', () => {
    expect(moverCategoria(ids, 'a', 'subir')).toEqual(ids);
    expect(moverCategoria(ids, 'c', 'descer')).toEqual(ids);
  });

  it('ignora id desconhecido', () => {
    expect(moverCategoria(ids, 'x', 'subir')).toEqual(ids);
  });
});

describe('normalizarNomeCategoria', () => {
  it('tira espaços das pontas e junta os repetidos', () => {
    expect(normalizarNomeCategoria('  Cloud   e  Hospedagem ')).toBe('Cloud e Hospedagem');
  });
});

describe('validarNomeCategoria', () => {
  const existentes = [
    { id: '1', nome: 'Inteligência Artificial' },
    { id: '2', nome: 'Segurança' },
  ];

  it('exige nome', () => {
    expect(validarNomeCategoria('   ', existentes)).toBe('Informe o nome da categoria.');
  });

  it('limita a 60 caracteres', () => {
    expect(validarNomeCategoria('x'.repeat(61), existentes)).toBe('Use no máximo 60 caracteres no nome.');
  });

  it('recusa nome repetido sem diferenciar maiúsculas nem acentos', () => {
    expect(validarNomeCategoria('inteligencia artificial', existentes)).toBe('Já existe uma categoria com esse nome.');
    expect(validarNomeCategoria('SEGURANÇA', existentes)).toBe('Já existe uma categoria com esse nome.');
    expect(validarNomeCategoria(' Seguranca ', existentes)).toBe('Já existe uma categoria com esse nome.');
  });

  it('aceita manter o próprio nome ao editar', () => {
    expect(validarNomeCategoria('Segurança', existentes, '2')).toBeNull();
  });

  it('aceita nome novo', () => {
    expect(validarNomeCategoria('Backup', existentes)).toBeNull();
  });
});
