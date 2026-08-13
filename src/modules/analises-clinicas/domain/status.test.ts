import { describe, expect, it } from 'vitest';
import { STATUS_LAUDO } from '../types';
import { rotuloStatus } from './status';

describe('rotuloStatus', () => {
  it('devolve o rótulo do status conhecido', () => {
    expect(rotuloStatus(STATUS_LAUDO, 'aguarda_liberacao')).toBe('Aguarda liberação');
    expect(rotuloStatus(STATUS_LAUDO, 'laudo_completo_liberado')).toBe('Laudo completo liberado');
  });

  it('devolve o próprio valor quando o status não está na lista', () => {
    expect(rotuloStatus(STATUS_LAUDO, 'status_novo')).toBe('status_novo');
  });

  it('funciona com qualquer lista { key, label }', () => {
    const lista = [
      { key: 'a', label: 'Alfa' },
      { key: 'b', label: 'Beta' },
    ];
    expect(rotuloStatus(lista, 'b')).toBe('Beta');
  });
});
