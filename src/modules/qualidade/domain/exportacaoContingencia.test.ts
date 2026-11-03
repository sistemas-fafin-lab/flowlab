import { describe, expect, it } from 'vitest';
import { camposDoPlano, nomeArquivoPlano, nomeArquivoZip, nomesUnicos, separarParagrafos } from './exportacaoContingencia.js';
import type { PlanoContingenciaDTO } from '../types';

function plano(overrides: Partial<PlanoContingenciaDTO> = {}): PlanoContingenciaDTO {
  return {
    id: 'p1',
    codigo: 'PC_TI-002',
    setorId: 's1',
    setorNome: 'TI',
    evento: 'Ataque de Ransomware',
    cenario: 'Servidores criptografados.',
    impactos: null,
    gatilhoAcionamento: 'Arquivos criptografados.',
    acoesImediatas: 'Isolar a rede.',
    responsaveis: 'Todo o Setor',
    comunicacao: null,
    materiais: null,
    fornecedorAlternativo: null,
    prazoMaximoInterrupcao: '6 horas',
    status: 'inativo',
    documento: null,
    criadoPor: 'u1',
    criadoEm: '2026-01-01T00:00:00Z',
    atualizadoPor: null,
    atualizadoEm: null,
    ...overrides,
  };
}

describe('separarParagrafos', () => {
  it('quebra tópicos com marcador na mesma linha', () => {
    expect(separarParagrafos('• Operação paralisada: vendas. • Atraso logístico: expedição.')).toEqual([
      '• Operação paralisada: vendas.',
      '• Atraso logístico: expedição.',
    ]);
  });

  it('quebra itens numerados depois de fim de frase', () => {
    expect(separarParagrafos('1. Isolamento de rede: desconectar. 2. Desconexão de backups: desvincular.')).toEqual([
      '1. Isolamento de rede: desconectar.',
      '2. Desconexão de backups: desvincular.',
    ]);
  });

  it('não quebra número no meio da frase', () => {
    expect(separarParagrafos('Restaurar em 6 horas e 2 turnos')).toEqual(['Restaurar em 6 horas e 2 turnos']);
  });

  it('mantém quebras de linha digitadas e descarta linhas vazias', () => {
    expect(separarParagrafos('Linha A\n\nLinha B')).toEqual(['Linha A', 'Linha B']);
  });

  it('campo vazio vira travessão', () => {
    expect(separarParagrafos(null)).toEqual(['—']);
    expect(separarParagrafos('   ')).toEqual(['—']);
  });
});

describe('camposDoPlano', () => {
  it('segue a ordem do drawer de detalhe', () => {
    expect(camposDoPlano(plano()).map((c) => c.rotulo)).toEqual([
      'Evento',
      'Prazo máximo de interrupção',
      'Cenário',
      'Impactos',
      'Gatilho de acionamento',
      'Ações imediatas',
      'Responsáveis',
      'Comunicação',
      'Materiais',
      'Fornecedor alternativo',
    ]);
  });

  it('preenche o valor e usa travessão no campo nulo', () => {
    const campos = camposDoPlano(plano());
    expect(campos.find((c) => c.rotulo === 'Responsáveis')?.paragrafos).toEqual(['Todo o Setor']);
    expect(campos.find((c) => c.rotulo === 'Impactos')?.paragrafos).toEqual(['—']);
  });
});

describe('nomeArquivoPlano', () => {
  it('junta código e evento com a extensão do formato', () => {
    expect(nomeArquivoPlano(plano(), 'pdf')).toBe('PC_TI-002 - Ataque de Ransomware.pdf');
    expect(nomeArquivoPlano(plano(), 'docx')).toBe('PC_TI-002 - Ataque de Ransomware.docx');
  });

  it('remove caracteres proibidos em nome de arquivo', () => {
    expect(nomeArquivoPlano(plano({ codigo: 'PC/01', evento: 'Falha: "energia" *?' }), 'pdf')).toBe('PC 01 - Falha energia.pdf');
  });

  it('limita o tamanho do nome', () => {
    const nome = nomeArquivoPlano(plano({ evento: 'x'.repeat(300) }), 'pdf');
    expect(nome.length).toBeLessThanOrEqual(84);
    expect(nome.endsWith('.pdf')).toBe(true);
  });

  it('usa um nome padrão quando não sobra nada', () => {
    expect(nomeArquivoPlano(plano({ codigo: '', evento: '???' }), 'docx')).toBe('plano-de-contingencia.docx');
  });
});

describe('nomesUnicos', () => {
  it('numera nomes repetidos sem mexer nos únicos', () => {
    expect(nomesUnicos(['a.pdf', 'b.pdf', 'a.pdf', 'A.pdf'])).toEqual(['a.pdf', 'b.pdf', 'a (2).pdf', 'A (3).pdf']);
  });
});

describe('nomeArquivoZip', () => {
  it('usa a data local da exportação', () => {
    expect(nomeArquivoZip(new Date(2026, 10, 3))).toBe('planos-de-contingencia-2026-11-03.zip');
  });
});
