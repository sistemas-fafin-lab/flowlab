import { describe, expect, it } from 'vitest';
import {
  RESOLUCAO_MAX_CARACTERES,
  blocoResolucaoEmail,
  escaparHtml,
  exigeResolucao,
  validarResolucao,
} from './itResolucao';

describe('validarResolucao', () => {
  it('exige texto, com um mínimo de detalhe', () => {
    expect(validarResolucao('   ')).toMatch(/Descreva/);
    expect(validarResolucao('feito')).toMatch(/mínimo/);
    expect(validarResolucao('  Reinstalei o driver da impressora.  ')).toBeNull();
  });

  it('recusa texto longo demais', () => {
    expect(validarResolucao('a'.repeat(RESOLUCAO_MAX_CARACTERES + 1))).toMatch(/até/);
  });
});

describe('exigeResolucao', () => {
  it('chamado indo para resolvido pede o texto', () => {
    expect(exigeResolucao({ is_internal: false, status: 'in_progress' })).toBe(true);
    expect(exigeResolucao({ status: 'pending' })).toBe(true);
  });

  it('tarefa interna e chamado já resolvido, não', () => {
    expect(exigeResolucao({ is_internal: true, status: 'in_progress' })).toBe(false);
    expect(exigeResolucao({ is_internal: false, status: 'resolved' })).toBe(false);
  });
});

describe('blocoResolucaoEmail', () => {
  it('sem texto não gera bloco', () => {
    expect(blocoResolucaoEmail('')).toBe('');
    expect(blocoResolucaoEmail(null)).toBe('');
  });

  it('escapa o texto e cita os anexos', () => {
    const html = blocoResolucaoEmail('Troquei o <cabo> & testei', 2);
    expect(html).toContain('Troquei o &lt;cabo&gt; &amp; testei');
    expect(html).not.toContain('<cabo>');
    expect(html).toContain('2 anexos disponíveis');
  });

  it('um anexo, no singular; nenhum, sem a linha', () => {
    expect(blocoResolucaoEmail('Resolvido no servidor', 1)).toContain('1 anexo disponível');
    expect(blocoResolucaoEmail('Resolvido no servidor')).not.toContain('anexo');
  });
});

describe('escaparHtml', () => {
  it('escapa aspas também', () => {
    expect(escaparHtml(`"a" 'b'`)).toBe('&quot;a&quot; &#39;b&#39;');
  });
});
