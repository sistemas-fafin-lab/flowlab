import { describe, expect, it } from 'vitest';
import { COR_OUTROS, MAX_CATEGORIAS_COM_COR, PALETA_CATEGORIAS, corDoSlot, slotsDeCor } from './coresCategorias';

const categorias = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `c${i + 1}`, nome: `Categoria ${i + 1}`, ordem: i + 1 }));

describe('slotsDeCor', () => {
  it('as 8 primeiras na ordem recebem os slots 0..7', () => {
    const slots = slotsDeCor(categorias(8));
    expect([...slots.values()]).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('da 9ª em diante ficam sem cor própria (Outros)', () => {
    const slots = slotsDeCor(categorias(10));
    expect(slots.get('c9')).toBeNull();
    expect(slots.get('c10')).toBeNull();
    expect(MAX_CATEGORIAS_COM_COR).toBe(8);
  });

  it('a cor segue a ordem definida, não a ordem do array', () => {
    const slots = slotsDeCor([
      { id: 'saas', nome: 'SaaS', ordem: 2 },
      { id: 'ia', nome: 'Inteligência Artificial', ordem: 1 },
    ]);
    expect(slots.get('ia')).toBe(0);
    expect(slots.get('saas')).toBe(1);
  });

  it('categoria inativa continua ocupando o seu slot (desativar não repinta as demais)', () => {
    const lista = categorias(4).map((c) => ({ ...c, ativo: c.id !== 'c2' }));
    const slots = slotsDeCor(lista);
    expect(slots.get('c2')).toBe(1);
    expect(slots.get('c3')).toBe(2);
    expect(slots.get('c4')).toBe(3);
  });
});

describe('corDoSlot', () => {
  it('usa o tom do tema', () => {
    expect(corDoSlot(0, 'light')).toBe(PALETA_CATEGORIAS.light[0]);
    expect(corDoSlot(0, 'dark')).toBe(PALETA_CATEGORIAS.dark[0]);
  });

  it('sem slot vira o cinza de Outros', () => {
    expect(corDoSlot(null, 'light')).toBe(COR_OUTROS);
    expect(corDoSlot(undefined, 'dark')).toBe(COR_OUTROS);
  });

  it('as duas paletas têm 8 cores distintas', () => {
    for (const tema of ['light', 'dark'] as const) {
      expect(new Set(PALETA_CATEGORIAS[tema]).size).toBe(8);
    }
  });
});
