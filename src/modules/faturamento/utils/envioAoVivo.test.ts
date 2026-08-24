import { describe, expect, it } from 'vitest';
import { dataEnvioEfetiva } from './envioAoVivo';

describe('dataEnvioEfetiva', () => {
  it('usa o valor ao vivo quando o apLIS devolve o lote', () => {
    const lote = { aplisId: '6607', dataEnvio: null };
    expect(dataEnvioEfetiva(lote, { '6607': '2026-08-21' })).toBe('2026-08-21');
  });

  it('sobrepõe o valor ao vivo mesmo quando o snapshot já tinha uma data', () => {
    const lote = { aplisId: '6607', dataEnvio: '2026-07-01' };
    expect(dataEnvioEfetiva(lote, { '6607': '2026-08-21' })).toBe('2026-08-21');
  });

  it('mantém null quando o apLIS confirma que o lote ainda não tem envio', () => {
    const lote = { aplisId: '6423', dataEnvio: '2026-07-01' };
    expect(dataEnvioEfetiva(lote, { '6423': null })).toBeNull();
  });

  it('cai para o snapshot quando a consulta ao vivo falhou (envios null)', () => {
    const lote = { aplisId: '6607', dataEnvio: '2026-07-01' };
    expect(dataEnvioEfetiva(lote, null)).toBe('2026-07-01');
  });

  it('cai para o snapshot quando o lote não tem aplisId (título antigo)', () => {
    const lote = { aplisId: null, dataEnvio: '2026-07-01' };
    expect(dataEnvioEfetiva(lote, { '6607': '2026-08-21' })).toBe('2026-07-01');
  });

  it('cai para o snapshot quando o apLIS não devolveu aquele lote', () => {
    const lote = { aplisId: '9999', dataEnvio: '2026-07-01' };
    expect(dataEnvioEfetiva(lote, { '6607': '2026-08-21' })).toBe('2026-07-01');
  });
});
