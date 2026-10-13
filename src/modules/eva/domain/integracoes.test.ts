import { describe, expect, it } from 'vitest';
import { montarIntegracoes, type ConfigIntegracoes } from './integracoes';

const AGORA = new Date('2026-10-13T15:00:00Z').getTime();
const cfg = (c: Partial<ConfigIntegracoes>): ConfigIntegracoes => ({
  granola_folder_id: 'fol_x', granola_verificado_em: null, granola_ultimo_erro: null, waha_status: null, waha_verificado_em: null, ...c,
});
const chip = (lista: ReturnType<typeof montarIntegracoes>, id: string) => lista.find((c) => c.id === id);

describe('chips do Início (D25)', () => {
  it('sem configuração, os dois dizem que ainda não estão configurados', () => {
    const l = montarIntegracoes(null, null, false, AGORA);
    expect(l.map((c) => [c.id, c.state, c.detail])).toEqual([
      ['granola', 'pending', 'ainda não configurado'],
      ['waha', 'pending', 'ainda não configurado'],
    ]);
  });

  it('Granola: pasta sem sincronização, sincronizado, parado e com erro', () => {
    expect(chip(montarIntegracoes(cfg({}), null, false, AGORA), 'granola')?.detail).toBe('aguardando a 1ª sincronização');
    const ok = chip(montarIntegracoes(cfg({ granola_verificado_em: '2026-10-13T12:00:00Z' }), null, false, AGORA), 'granola');
    expect(ok).toMatchObject({ state: 'online', detail: 'sincronizado 13/10 às 09:00' });
    const parado = chip(montarIntegracoes(cfg({ granola_verificado_em: '2026-10-08T12:00:00Z' }), null, false, AGORA), 'granola');
    expect(parado).toMatchObject({ state: 'offline', detail: 'sem sincronizar desde 08/10 às 09:00' });
    const erro = chip(montarIntegracoes(cfg({ granola_verificado_em: '2026-10-13T12:00:00Z', granola_ultimo_erro: 'HTTP 401' }), null, false, AGORA), 'granola');
    expect(erro).toMatchObject({ state: 'offline', detail: 'erro na última sincronização' });
  });

  it('Wa-ha: conectado só com aviso recente da VPS', () => {
    const recente = '2026-10-13T14:58:00Z';
    expect(chip(montarIntegracoes(cfg({ waha_status: 'WORKING', waha_verificado_em: recente }), null, false, AGORA), 'waha')).toMatchObject({ state: 'online', detail: 'conectado' });
    expect(chip(montarIntegracoes(cfg({ waha_status: 'SCAN_QR_CODE', waha_verificado_em: recente }), null, false, AGORA), 'waha')).toMatchObject({ state: 'offline', detail: 'aguardando o QR code' });
    expect(chip(montarIntegracoes(cfg({ waha_status: 'WORKING', waha_verificado_em: '2026-10-13T14:00:00Z' }), null, false, AGORA), 'waha')).toMatchObject({ state: 'offline', detail: 'sem sinal da VPS' });
  });

  it('sugestões pendentes: só para gestor e só quando há alguma', () => {
    expect(chip(montarIntegracoes(null, 3, false, AGORA), 'sugestoes')).toBeUndefined();
    expect(chip(montarIntegracoes(null, 0, true, AGORA), 'sugestoes')).toBeUndefined();
    expect(chip(montarIntegracoes(null, 1, true, AGORA), 'sugestoes')).toMatchObject({ name: '1 sugestão', href: '/it/eva' });
    expect(chip(montarIntegracoes(null, 4, true, AGORA), 'sugestoes')?.name).toBe('4 sugestões');
  });
});
