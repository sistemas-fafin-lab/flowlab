import { describe, expect, it } from 'vitest';
import { ausenciaProxima, descreverAusencia, estaAusente, inicioDaAusencia, validarAusencia } from './ausencia';

const HOJE = '2026-11-24';
const FERIAS = { ausente_de: '2026-12-01', ausente_ate: '2026-12-05', ausencia_motivo: 'férias' };

describe('ausências (D40)', () => {
  it('ausente só dentro do período, os dois dias inclusos; sem "de", desde já', () => {
    expect(estaAusente(FERIAS, HOJE)).toBe(false);
    expect(estaAusente(FERIAS, '2026-12-01')).toBe(true);
    expect(estaAusente(FERIAS, '2026-12-05')).toBe(true);
    expect(estaAusente(FERIAS, '2026-12-06')).toBe(false);
    expect(estaAusente({ ausente_de: null, ausente_ate: '2026-11-25' }, HOJE)).toBe(true);
    expect(estaAusente({ ausente_de: null, ausente_ate: null }, HOJE)).toBe(false);
  });

  it('a ausência que começa em até 7 dias já aparece para o gestor se preparar', () => {
    expect(ausenciaProxima(FERIAS, HOJE)).toBe(true);
    expect(ausenciaProxima({ ...FERIAS, ausente_de: '2026-12-10', ausente_ate: '2026-12-20' }, HOJE)).toBe(false);
    expect(ausenciaProxima({ ...FERIAS, ausente_de: '2026-11-01', ausente_ate: '2026-11-10' }, HOJE)).toBe(false);
    expect(inicioDaAusencia(FERIAS, HOJE)).toBe('2026-12-01');
    expect(inicioDaAusencia({ ausente_de: '2026-11-20', ausente_ate: '2026-11-30' }, HOJE)).toBe(HOJE);
  });

  it('como aparece no texto', () => {
    expect(descreverAusencia(FERIAS, HOJE)).toBe('de férias de 01/12 a 05/12');
    expect(descreverAusencia(FERIAS, '2026-12-02')).toBe('de férias até 05/12');
    expect(descreverAusencia({ ausente_de: null, ausente_ate: '2026-11-26', ausencia_motivo: 'licença' }, HOJE)).toBe('ausente até 26/11 (licença)');
    expect(descreverAusencia({ ausente_de: null, ausente_ate: '2026-11-26' }, HOJE)).toBe('ausente até 26/11');
  });

  it('validação: o último dia é obrigatório, sem passado, até 120 dias', () => {
    expect(validarAusencia('2026-12-01', '2026-12-05', HOJE)).toEqual({ ok: true, de: '2026-12-01', ate: '2026-12-05' });
    expect(validarAusencia('', '2026-11-25', HOJE)).toEqual({ ok: true, de: HOJE, ate: '2026-11-25' });
    expect(validarAusencia('2026-12-01', '', HOJE)).toMatchObject({ ok: false, erro: expect.stringContaining('Até quando') });
    expect(validarAusencia('2026-11-01', '2026-11-20', HOJE)).toMatchObject({ ok: false, erro: 'O último dia (20/11) já passou.' });
    expect(validarAusencia('2026-12-05', '2026-12-01', HOJE)).toMatchObject({ ok: false, erro: 'O último dia vem antes do primeiro.' });
    expect(validarAusencia('2026-12-01', '2027-06-01', HOJE)).toMatchObject({ ok: false, erro: 'Marco no máximo 120 dias de uma vez.' });
  });
});
