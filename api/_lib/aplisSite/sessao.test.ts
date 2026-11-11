import { describe, expect, it } from 'vitest';
import { urlDoSite } from './sessao.js';

describe('urlDoSite', () => {
  it('usa a origem de APLIS_BASE_URL', () => {
    expect(urlDoSite('https://lab.aplis.inf.br/api/integracao.php')).toBe('https://lab.aplis.inf.br');
    expect(urlDoSite(' https://outro.aplis.inf.br/api/integracao.php ')).toBe('https://outro.aplis.inf.br');
  });

  it('sem APLIS_BASE_URL (ou inválida), o site padrão', () => {
    expect(urlDoSite(undefined)).toBe('https://lab.aplis.inf.br');
    expect(urlDoSite('')).toBe('https://lab.aplis.inf.br');
    expect(urlDoSite('lixo')).toBe('https://lab.aplis.inf.br');
  });
});
