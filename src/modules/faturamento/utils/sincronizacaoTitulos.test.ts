import { describe, expect, it } from 'vitest';
import { textoSincronizacaoTitulos } from './sincronizacaoTitulos';

describe('textoSincronizacaoTitulos', () => {
  it('nada mudou', () => {
    expect(textoSincronizacaoTitulos({ meta: { dadoAte: '2026-11-15' }, lotesAtualizados: 0, statusMudaram: 0, numerosPreenchidos: 0, refechamentos: [] }))
      .toBe('Títulos já estavam iguais ao apLIS (dados do apLIS até 15/11/2026).');
  });

  it('lista só o que mudou, no singular e no plural', () => {
    expect(textoSincronizacaoTitulos({
      meta: { dadoAte: null }, lotesAtualizados: 5, statusMudaram: 2, numerosPreenchidos: 1, refechamentos: [{}],
    })).toBe('Títulos atualizados com o apLIS: 2 status atualizados, 1 número de nota preenchido, '
      + '1 emissão levada ao refechamento, 3 lotes com envio, protocolo, NF-e ou responsável atualizados.');
  });
});
