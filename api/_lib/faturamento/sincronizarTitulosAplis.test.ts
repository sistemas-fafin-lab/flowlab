import { describe, expect, it } from 'vitest';
import type { DadosLoteTitulo } from './bdLab.js';
import { idAplisNumerico, lotesParaSincronizar } from './sincronizarTitulosAplis.js';

const dados = (sobre: Partial<DadosLoteTitulo> = {}): DadosLoteTitulo => ({
  status: 12,
  dtaEnvio: '2026-03-30',
  dtaFechamento: '2026-03-25',
  protocolo: 'PEG442612',
  nfeNumero: '9735',
  numeroRps: 812,
  responsavelFechamento: 'Renata Bento',
  ...sobre,
});

describe('lotesParaSincronizar', () => {
  it('leva cada lote encontrado no apLIS com o rótulo STLOT', () => {
    expect(lotesParaSincronizar(['5308'], new Map([[5308, dados()]]))).toEqual([{
      aplis_id: '5308',
      status_aplis: 12,
      status: 'NFe Emitida',
      data_envio: '2026-03-30',
      data_fechamento: '2026-03-25',
      protocolo: 'PEG442612',
      nfe_numero: '9735',
      numero_rps: 812,
      responsavel_fechamento: 'Renata Bento',
    }]);
  });

  it('lote fora do apLIS ou com id não numérico fica de fora', () => {
    expect(lotesParaSincronizar(['7777', 'MANUAL-1'], new Map([[5308, dados()]]))).toEqual([]);
  });

  it('código fora do catálogo ainda tem rótulo', () => {
    expect(lotesParaSincronizar(['1'], new Map([[1, dados({ status: 99 })]]))[0].status).toBe('Status 99');
  });
});

describe('idAplisNumerico', () => {
  it('só inteiro positivo', () => {
    expect(idAplisNumerico('5308')).toBe(5308);
    expect(idAplisNumerico('0')).toBeNull();
    expect(idAplisNumerico('53.5')).toBeNull();
    expect(idAplisNumerico('abc')).toBeNull();
  });
});
