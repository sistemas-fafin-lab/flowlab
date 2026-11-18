import { describe, expect, it } from 'vitest';
import { avisoFontesAplis, fontesDaMeta, textoFontesAplis } from './fontesAplis';

describe('fontesDaMeta', () => {
  it('meta ausente vira fontes vazias', () => {
    expect(fontesDaMeta(undefined)).toEqual({
      dadoAte: null, retratoSiteEm: null, bancoIndisponivel: false, lotesDoSite: 0, titulosSemFonte: 0,
    });
  });
});

describe('textoFontesAplis', () => {
  it('mostra o site e o banco', () => {
    const texto = textoFontesAplis(fontesDaMeta({ dadoAte: '2026-11-16', retratoSiteEm: '2026-11-18T10:12:00Z' }));
    expect(texto).toBe('site do apLIS em 18/11/2026, 07:12 · banco até 16/11/2026');
  });

  it('banco fora do ar', () => {
    expect(textoFontesAplis(fontesDaMeta({ bancoIndisponivel: true }))).toBe('banco de backup fora do ar');
  });
});

describe('avisoFontesAplis', () => {
  it('nada a avisar com o site lido', () => {
    expect(avisoFontesAplis(fontesDaMeta({ dadoAte: '2026-11-16', retratoSiteEm: '2026-11-18T10:12:00Z' }))).toBeNull();
  });

  it('avisa quando o site nunca foi lido', () => {
    expect(avisoFontesAplis(fontesDaMeta({ dadoAte: '2026-11-16' }))).toMatch(/ainda não foi lido/);
  });

  it('avisa os títulos que ficaram de fora', () => {
    expect(avisoFontesAplis(fontesDaMeta({ bancoIndisponivel: true, titulosSemFonte: 2 }))).toMatch(/2 títulos ficaram de fora/);
  });
});
