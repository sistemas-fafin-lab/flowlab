import { describe, expect, it } from 'vitest';
import { WAHA_AVISO_MS, diagnosticarSaude, explicarErroGranola, type EntradaSaude } from './saude';

const AGORA = Date.parse('2026-11-24T14:00:00Z');
const OK: EntradaSaude = {
  agora: AGORA,
  config: {
    whatsapp_ativo: true,
    granola_folder_id: 'fol_1',
    granola_verificado_em: '2026-11-24T12:00:00Z',
    granola_ultimo_erro: null,
    waha_status: 'WORKING',
    waha_verificado_em: '2026-11-24T13:59:00Z',
  },
  ia: { ok: 4, falhas: 0, ultimoErro: null },
};
const com = (c: Partial<EntradaSaude['config']>, ia: Partial<EntradaSaude['ia']> = {}): EntradaSaude => ({ ...OK, config: { ...OK.config, ...c }, ia: { ...OK.ia, ...ia } });

describe('diagnosticarSaude (D39)', () => {
  it('tudo funcionando: nada a avisar', () => {
    expect(diagnosticarSaude(OK)).toEqual([]);
  });

  it('Granola com erro: a causa em português, pelo WhatsApp também', () => {
    const [p] = diagnosticarSaude(com({ granola_ultimo_erro: 'a assinatura do workspace do Granola está inativa (renove no Granola…)' }));
    expect(p).toEqual({
      chave: 'granola_erro', titulo: 'Granola sem sincronizar', whatsapp: true,
      texto: 'A assinatura do workspace do Granola está inativa. Renove no Granola para a sincronização voltar.',
    });
  });

  it('Granola parado há mais de 4 dias, sem erro gravado', () => {
    const [p] = diagnosticarSaude(com({ granola_verificado_em: '2026-11-19T12:00:00Z' }));
    expect(p).toMatchObject({ chave: 'granola_parou', texto: expect.stringContaining('não sincroniza desde 19/11 às 09:00') });
    // Sem pasta escolhida, o Granola nem é conferido.
    expect(diagnosticarSaude(com({ granola_folder_id: null, granola_ultimo_erro: 'x' }))).toEqual([]);
  });

  it('VPS sem sinal só depois de 15 min, e o aviso não vai pelo WhatsApp', () => {
    expect(diagnosticarSaude(com({ waha_verificado_em: new Date(AGORA - 10 * 60_000).toISOString() }))).toEqual([]);
    const [p] = diagnosticarSaude(com({ waha_verificado_em: new Date(AGORA - WAHA_AVISO_MS - 60_000).toISOString() }));
    expect(p).toMatchObject({ chave: 'waha_sem_sinal', whatsapp: false, texto: expect.stringContaining('parou de dar sinal desde 24/11') });
    // WhatsApp desligado em Configurações: a VPS parada não é problema.
    expect(diagnosticarSaude(com({ whatsapp_ativo: false, waha_verificado_em: '2026-11-20T10:00:00Z' }))).toEqual([]);
  });

  it('sessão do WhatsApp desconectada: o que fazer em cada estado; "iniciando" não avisa', () => {
    expect(diagnosticarSaude(com({ waha_status: 'SCAN_QR_CODE' }))[0]).toMatchObject({ chave: 'waha_desconectado', whatsapp: false, texto: expect.stringContaining('QR code') });
    expect(diagnosticarSaude(com({ waha_status: 'INACESSIVEL' }))[0].texto).toContain('O WAHA não responde');
    expect(diagnosticarSaude(com({ waha_status: 'STARTING' }))).toEqual([]);
  });

  it('IA fora: 3 falhas de vez e nenhum acerto nas últimas 2 h', () => {
    expect(diagnosticarSaude(com({}, { ok: 0, falhas: 3, ultimoErro: 'HTTP 529 overloaded' }))[0])
      .toMatchObject({ chave: 'ia_fora', whatsapp: true, texto: expect.stringContaining('as últimas 3 chamadas falharam no Claude e no Gemini (último erro: HTTP 529 overloaded)') });
    expect(diagnosticarSaude(com({}, { ok: 1, falhas: 5 }))).toEqual([]);
    expect(diagnosticarSaude(com({}, { ok: 0, falhas: 2 }))).toEqual([]);
  });
});

describe('explicarErroGranola', () => {
  it('cada erro conhecido vira o que fazer', () => {
    expect(explicarErroGranola('chave do Granola inválida ou revogada')).toContain('Gere outra no Granola');
    expect(explicarErroGranola('a chave do Granola não tem acesso a esta pasta')).toContain('Confira a pasta');
    expect(explicarErroGranola('Pasta do Granola não configurada (Configurações da EVA).')).toBe('Nenhuma pasta do Granola escolhida (EVA → Configurações).');
    expect(explicarErroGranola('Falha ao falar com o Granola: timeout')).toBe('A última sincronização do Granola falhou: Falha ao falar com o Granola: timeout');
  });
});
