import { describe, expect, it } from 'vitest';
import { formatarIdentificacaoEpi, identificacaoEpiVencida, passaFiltroEpi, respeitarPermissaoEpi } from './epi';

const epi = (campos: Partial<{ isEpi: boolean; epiTipo: '' | 'CA' | 'ANVISA'; epiNumero: string; epiValidade: string }> = {}) => ({
  isEpi: true,
  epiTipo: '' as const,
  epiNumero: '',
  epiValidade: '',
  ...campos,
});

describe('formatarIdentificacaoEpi', () => {
  it('junta o tipo e o número', () => {
    expect(formatarIdentificacaoEpi(epi({ epiTipo: 'CA', epiNumero: '12345' }))).toBe('CA 12345');
    expect(formatarIdentificacaoEpi(epi({ epiTipo: 'ANVISA', epiNumero: '80495510226' }))).toBe('ANVISA 80495510226');
  });

  it('sem tipo, mostra só o número', () => {
    expect(formatarIdentificacaoEpi(epi({ epiNumero: ' 12345 ' }))).toBe('12345');
  });

  it('sem número, fica vazio', () => {
    expect(formatarIdentificacaoEpi(epi({ epiTipo: 'CA', epiNumero: '  ' }))).toBe('');
  });
});

describe('identificacaoEpiVencida', () => {
  it('vence quando a validade é anterior a hoje', () => {
    expect(identificacaoEpiVencida(epi({ epiValidade: '2026-11-18' }), '2026-11-19')).toBe(true);
  });

  it('no próprio dia da validade ainda não venceu', () => {
    expect(identificacaoEpiVencida(epi({ epiValidade: '2026-11-19' }), '2026-11-19')).toBe(false);
  });

  it('sem validade não vence', () => {
    expect(identificacaoEpiVencida(epi(), '2026-11-19')).toBe(false);
  });

  it('produto que não é EPI nunca mostra o aviso', () => {
    expect(identificacaoEpiVencida(epi({ isEpi: false, epiValidade: '2020-01-01' }), '2026-11-19')).toBe(false);
  });
});

describe('passaFiltroEpi', () => {
  const HOJE = '2026-11-19';
  const comum = epi({ isEpi: false });
  const semIdentificacao = epi({ epiTipo: 'CA' });
  const vencido = epi({ epiTipo: 'CA', epiNumero: '1', epiValidade: '2026-01-01' });
  const emDia = epi({ epiTipo: 'CA', epiNumero: '2', epiValidade: '2027-01-01' });
  const filtrar = (filtro: Parameters<typeof passaFiltroEpi>[1]) =>
    [comum, semIdentificacao, vencido, emDia].filter((p) => passaFiltroEpi(p, filtro, HOJE));

  it('"todos" deixa passar qualquer produto', () => {
    expect(filtrar('todos')).toEqual([comum, semIdentificacao, vencido, emDia]);
  });

  it('"epi" mostra só os EPIs', () => {
    expect(filtrar('epi')).toEqual([semIdentificacao, vencido, emDia]);
  });

  it('"sem-identificacao" mostra os EPIs sem número', () => {
    expect(filtrar('sem-identificacao')).toEqual([semIdentificacao]);
  });

  it('"vencida" mostra os EPIs com a identificação vencida', () => {
    expect(filtrar('vencida')).toEqual([vencido]);
  });
});

describe('respeitarPermissaoEpi', () => {
  const salvamento = { name: 'Luva nitrílica', isEpi: true, epiTipo: 'CA' as const, epiNumero: ' 12345 ', epiValidade: '2027-05-01' };

  it('sem "Gerir EPI", tira a marcação e a identificação e mantém o resto', () => {
    expect(respeitarPermissaoEpi(salvamento, false)).toEqual({ name: 'Luva nitrílica' });
  });

  it('com "Gerir EPI", mantém os campos de EPI e limpa os espaços do número', () => {
    expect(respeitarPermissaoEpi(salvamento, true)).toEqual({ ...salvamento, epiNumero: '12345' });
  });

  it('ao desmarcar EPI, a identificação escondida é apagada', () => {
    expect(respeitarPermissaoEpi({ ...salvamento, isEpi: false }, true)).toEqual({
      name: 'Luva nitrílica', isEpi: false, epiTipo: '', epiNumero: '', epiValidade: '',
    });
  });

  it('um EPI pode ser salvo sem identificação', () => {
    const semId = { isEpi: true, epiTipo: '' as const, epiNumero: '', epiValidade: '' };
    expect(respeitarPermissaoEpi(semId, true)).toEqual(semId);
  });
});
