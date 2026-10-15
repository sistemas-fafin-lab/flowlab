import { describe, expect, it } from 'vitest';
import { ehTeclaDeTexto, filtrarOpcoes, normalizarBusca } from './selectBusca';

const pessoas = [
  { label: 'Ana Souza', description: 'TI' },
  { label: 'José Gonçalves', description: 'Faturamento' },
  { label: 'Gabriel Carneiro', description: 'TI', keywords: 'gabriel.carneiro@fafin.com.br' },
];

describe('busca dos dropdowns', () => {
  it('ignora maiúsculas e acentos', () => {
    expect(normalizarBusca('  José GONÇALVES ')).toBe('jose goncalves');
    expect(filtrarOpcoes(pessoas, 'jose').map((p) => p.label)).toEqual(['José Gonçalves']);
    expect(filtrarOpcoes(pessoas, 'GONCALVES').map((p) => p.label)).toEqual(['José Gonçalves']);
  });

  it('cada palavra precisa aparecer no rótulo, na descrição ou nos termos extras', () => {
    expect(filtrarOpcoes(pessoas, 'ti').map((p) => p.label)).toEqual(['Ana Souza', 'Gabriel Carneiro']);
    expect(filtrarOpcoes(pessoas, 'ana ti').map((p) => p.label)).toEqual(['Ana Souza']);
    expect(filtrarOpcoes(pessoas, 'fafin.com').map((p) => p.label)).toEqual(['Gabriel Carneiro']);
    expect(filtrarOpcoes(pessoas, 'ana faturamento')).toEqual([]);
  });

  it('busca vazia devolve tudo, na ordem original', () => {
    expect(filtrarOpcoes(pessoas, '   ')).toEqual(pessoas);
  });

  it('só tecla de caractere abre a busca já digitando', () => {
    expect(ehTeclaDeTexto({ key: 'a' })).toBe(true);
    expect(ehTeclaDeTexto({ key: 'ç' })).toBe(true);
    expect(ehTeclaDeTexto({ key: ' ' })).toBe(false);
    expect(ehTeclaDeTexto({ key: 'ArrowDown' })).toBe(false);
    expect(ehTeclaDeTexto({ key: 'c', ctrlKey: true })).toBe(false);
  });
});
