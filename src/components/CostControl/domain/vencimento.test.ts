import { describe, expect, it } from 'vitest';
import { situacaoVencimento } from './vencimento';

const HOJE = '2026-10-21';

describe('situacaoVencimento', () => {
  it('tabela sem vencimento informado fica sem_vencimento', () => {
    expect(situacaoVencimento(null, HOJE)).toBe('sem_vencimento');
  });

  it('contrato que venceu ontem está vencida', () => {
    expect(situacaoVencimento('2026-10-20', HOJE)).toBe('vencida');
  });

  it('contrato que vence hoje ainda não venceu: está a_vencer', () => {
    expect(situacaoVencimento(HOJE, HOJE)).toBe('a_vencer');
  });

  it('contrato que vence daqui a 30 dias ainda está a_vencer', () => {
    expect(situacaoVencimento('2026-11-20', HOJE)).toBe('a_vencer');
  });

  it('contrato que vence daqui a 31 dias está em_dia', () => {
    expect(situacaoVencimento('2026-11-21', HOJE)).toBe('em_dia');
  });
});
