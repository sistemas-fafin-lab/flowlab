import { describe, expect, it } from 'vitest';
import { caminhoAnexo, formatarTamanho, nomeSeguro, validarArquivo, TAMANHO_MAXIMO_ANEXO } from './anexos';

describe('validarArquivo', () => {
  it('aceita PDF, PNG e JPEG até 10 MB', () => {
    expect(validarArquivo({ name: 'contrato.pdf', size: 500_000, type: 'application/pdf' })).toBeNull();
    expect(validarArquivo({ name: 'print.png', size: 1, type: 'image/png' })).toBeNull();
    expect(validarArquivo({ name: 'foto.jpg', size: TAMANHO_MAXIMO_ANEXO, type: 'image/jpeg' })).toBeNull();
  });

  it('recusa outros tipos, arquivo vazio e acima de 10 MB', () => {
    expect(validarArquivo({ name: 'planilha.xlsx', size: 10, type: 'application/vnd.ms-excel' })).toMatch(/só PDF, PNG ou JPEG/);
    expect(validarArquivo({ name: 'vazio.pdf', size: 0, type: 'application/pdf' })).toMatch(/está vazio/);
    expect(validarArquivo({ name: 'grande.pdf', size: TAMANHO_MAXIMO_ANEXO + 1, type: 'application/pdf' })).toMatch(/limite é 10 MB/);
  });
});

describe('nomeSeguro', () => {
  it('tira acento, espaço e símbolo, mantendo a extensão em minúsculas', () => {
    expect(nomeSeguro('Contrato Microsoft (assinado) — 2026.PDF')).toBe('Contrato-Microsoft-assinado-2026.pdf');
    expect(nomeSeguro('Autorização da Diretoria.jpeg')).toBe('Autorizacao-da-Diretoria.jpeg');
  });

  it('limita o tamanho preservando a extensão', () => {
    const nome = nomeSeguro(`${'a'.repeat(200)}.pdf`);
    expect(nome.length).toBe(80);
    expect(nome.endsWith('.pdf')).toBe(true);
  });

  it('nome sem nada aproveitável vira "arquivo"', () => {
    expect(nomeSeguro('???.pdf')).toBe('arquivo.pdf');
    expect(nomeSeguro('.pdf')).toBe('pdf');
  });
});

describe('caminhoAnexo', () => {
  it('monta prefixo/id/único-nome', () => {
    expect(caminhoAnexo('despesas', 'd1', 'Contrato.pdf', 'u1')).toBe('despesas/d1/u1-Contrato.pdf');
  });
});

describe('formatarTamanho', () => {
  it('KB abaixo de 1 MB, MB com uma casa acima', () => {
    expect(formatarTamanho(500)).toBe('1 KB');
    expect(formatarTamanho(820 * 1024)).toBe('820 KB');
    expect(formatarTamanho(1.25 * 1024 * 1024)).toBe('1,3 MB');
  });
});
