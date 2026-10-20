import { describe, expect, it } from 'vitest';
import type { Exam } from '../../../hooks/useCostControl';
import { exameComMesmoVinculoAplis } from './vinculoAplis';

const exame = (id: string, aplisIdExameTipo: number | null, aplisIdTeste: number | null): Exam => ({
  id,
  code: '',
  tuss: '',
  name: `Exame ${id}`,
  location: '',
  direct: 0,
  indirect: 0,
  indirectItems: [],
  aplisIdExameTipo,
  aplisIdTeste,
});

describe('exameComMesmoVinculoAplis', () => {
  const catalogo = [exame('a', 30, 121), exame('b', 13, null), exame('c', null, null)];

  it('acha o exame que já tem a mesma cobrança e teste', () => {
    expect(exameComMesmoVinculoAplis(catalogo, null, 30, 121)?.id).toBe('a');
  });

  it('"sem teste" também conta: mesma cobrança sem teste em outro exame é duplicado', () => {
    expect(exameComMesmoVinculoAplis(catalogo, null, 13, null)?.id).toBe('b');
  });

  it('o exame sendo editado não conflita com ele mesmo', () => {
    expect(exameComMesmoVinculoAplis(catalogo, 'a', 30, 121)).toBeNull();
  });

  it('outro teste da mesma cobrança, ou a cobrança sem teste, ficam livres', () => {
    expect(exameComMesmoVinculoAplis(catalogo, null, 30, 25)).toBeNull();
    expect(exameComMesmoVinculoAplis(catalogo, null, 30, null)).toBeNull();
  });
});
