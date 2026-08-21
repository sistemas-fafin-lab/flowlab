import { describe, expect, it } from 'vitest';
import { coletaFixture as coleta } from '../testing/coleta';
import { resumoColeta } from './coleta';

describe('resumoColeta', () => {
  it('devolve null quando não há coleta registrada', () => {
    expect(resumoColeta(null)).toBeNull();
  });

  it('devolve coletado por, horário e observações quando a coleta existe', () => {
    expect(resumoColeta(coleta({ observacoes: 'Jejum respeitado.' }))).toEqual({
      coletadoPor: 'Maria Souza',
      coletadoEm: '2026-08-21T10:30:00.000Z',
      observacoes: 'Jejum respeitado.',
    });
  });

  it('trata observações em branco como ausentes', () => {
    expect(resumoColeta(coleta({ observacoes: '   ' }))?.observacoes).toBeNull();
  });
});
