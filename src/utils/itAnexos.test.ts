import { describe, expect, it } from 'vitest';
import {
  ANEXO_MAX_BYTES,
  ANEXOS_MAX_POR_MENSAGEM,
  caminhoDoAnexo,
  ehImagem,
  formatarTamanho,
  juntarAnexos,
  lerAnexos,
  nomearCapturasColadas,
  tipoDoAnexo,
  validarAnexo,
} from './itAnexos';

const arq = (name: string, size = 1000) => ({ name, size });

describe('tipoDoAnexo', () => {
  it('tira o tipo da extensão, sem ligar para maiúsculas', () => {
    expect(tipoDoAnexo('print.PNG')).toBe('image/png');
    expect(tipoDoAnexo('planilha.csv')).toBe('text/csv');
    expect(tipoDoAnexo('relatorio.final.pdf')).toBe('application/pdf');
  });

  it('recusa o que o bucket não aceita', () => {
    expect(tipoDoAnexo('instalador.exe')).toBeNull();
    expect(tipoDoAnexo('sem-extensao')).toBeNull();
  });
});

describe('validarAnexo', () => {
  it('aceita imagem, PDF e documentos dentro do limite', () => {
    expect(validarAnexo(arq('erro.jpg'))).toBeNull();
    expect(validarAnexo(arq('contrato.docx', ANEXO_MAX_BYTES))).toBeNull();
  });

  it('recusa tipo desconhecido, arquivo vazio e acima de 10 MB', () => {
    expect(validarAnexo(arq('script.sh'))).toMatch(/tipo não aceito/);
    expect(validarAnexo(arq('vazio.txt', 0))).toMatch(/vazio/);
    expect(validarAnexo(arq('video.zip', ANEXO_MAX_BYTES + 1))).toMatch(/10 MB/);
  });
});

describe('juntarAnexos', () => {
  it('descarta inválidos e repetidos, guardando os erros', () => {
    const { arquivos, erros } = juntarAnexos([arq('a.png')], [arq('a.png'), arq('b.exe'), arq('c.pdf')]);
    expect(arquivos.map((a) => a.name)).toEqual(['a.png', 'c.pdf']);
    expect(erros).toHaveLength(1);
  });

  it('para no limite por mensagem', () => {
    const novos = Array.from({ length: ANEXOS_MAX_POR_MENSAGEM + 2 }, (_, i) => arq(`f${i}.png`));
    const { arquivos, erros } = juntarAnexos([], novos);
    expect(arquivos).toHaveLength(ANEXOS_MAX_POR_MENSAGEM);
    expect(erros[0]).toMatch(/No máximo/);
  });
});

describe('formatarTamanho', () => {
  it('usa B, KB e MB com vírgula', () => {
    expect(formatarTamanho(512)).toBe('512 B');
    expect(formatarTamanho(2048)).toBe('2 KB');
    expect(formatarTamanho(1.5 * 1024 * 1024)).toBe('1,5 MB');
    expect(formatarTamanho(null)).toBe('');
  });
});

describe('caminhoDoAnexo', () => {
  it('começa pela pasta do usuário e limpa o nome', () => {
    expect(caminhoDoAnexo('u1', 'c1', 'Relatório final (1).pdf', 123)).toBe('u1/c1/123_Relat_rio_final__1_.pdf');
  });
});

describe('lerAnexos', () => {
  it('aceita só itens com url e nome', () => {
    expect(
      lerAnexos([{ url: 'https://x/a.png', name: 'a.png', size: 10 }, { name: 'sem-url' }, null, 'lixo']),
    ).toEqual([{ url: 'https://x/a.png', name: 'a.png', size: 10 }]);
    expect(lerAnexos(null)).toEqual([]);
  });
});

describe('nomearCapturasColadas', () => {
  it('renomeia só as capturas genéricas', () => {
    const colados = [new File(['a'], 'image.png', { type: 'image/png' }), new File(['b'], 'nota.pdf')];
    expect(nomearCapturasColadas(colados, 99).map((f) => f.name)).toEqual(['captura-99-1.png', 'nota.pdf']);
  });
});

describe('ehImagem', () => {
  it('reconhece imagem pela extensão', () => {
    expect(ehImagem('foto.webp')).toBe(true);
    expect(ehImagem('doc.pdf')).toBe(false);
  });
});
