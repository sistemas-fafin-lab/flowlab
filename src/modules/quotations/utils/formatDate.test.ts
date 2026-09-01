import { describe, expect, it } from 'vitest';
import { formatDate } from './formatDate';

describe('formatDate', () => {
  it('formata uma string ISO válida em dd/mm/aaaa', () => {
    expect(formatDate('2026-01-10')).toBe('10/01/2026');
  });

  it('retorna um placeholder para string vazia', () => {
    expect(formatDate('')).toBe('—');
  });

  it('retorna um placeholder quando o valor é ausente', () => {
    expect(formatDate(undefined)).toBe('—');
  });

  it('retorna um placeholder em vez de "Invalid Date" para string inválida', () => {
    expect(formatDate('lixo')).toBe('—');
  });
});
