import { describe, expect, it } from 'vitest';
import {
  agruparPaginasPorCpf,
  cpfValido,
  extrairCompetenciaDaPagina,
  extrairCpfDaPagina,
  normalizarCpf,
  type PaginaExtraida,
} from './holeritesParsing.js';

describe('normalizarCpf', () => {
  it('remove pontuação', () => {
    expect(normalizarCpf('529.982.247-25')).toBe('52998224725');
  });
});

describe('cpfValido', () => {
  it('aceita CPF válido com máscara', () => {
    expect(cpfValido('529.982.247-25')).toBe(true);
  });

  it('aceita CPF válido sem máscara', () => {
    expect(cpfValido('52998224725')).toBe(true);
  });

  it('rejeita dígito verificador errado', () => {
    expect(cpfValido('529.982.247-26')).toBe(false);
  });

  it('rejeita todos os dígitos iguais', () => {
    expect(cpfValido('111.111.111-11')).toBe(false);
  });

  it('rejeita tamanho errado', () => {
    expect(cpfValido('123')).toBe(false);
  });
});

describe('extrairCpfDaPagina', () => {
  it('extrai CPF rotulado', () => {
    expect(extrairCpfDaPagina('Nome: Fulano\nCPF: 529.982.247-25\nCódigo: 1234')).toBe('52998224725');
  });

  it('extrai CPF sem rótulo explícito quando válido', () => {
    expect(extrairCpfDaPagina('Fulano de Tal  529.982.247-25  Ref.: Agosto/2026')).toBe('52998224725');
  });

  it('ignora número parecido com CPF mas inválido, e usa o rotulado válido', () => {
    // 111.111.111-11 tem formato de CPF mas falha no dígito verificador (todos iguais).
    expect(extrairCpfDaPagina('Matrícula: 111.111.111-11\nCPF: 529.982.247-25')).toBe('52998224725');
  });

  it('retorna null quando não há CPF legível/válido', () => {
    expect(extrairCpfDaPagina('Página sem nenhum dado de identificação')).toBeNull();
  });
});

describe('extrairCompetenciaDaPagina', () => {
  it('extrai mês por extenso', () => {
    expect(extrairCompetenciaDaPagina('Ref.: Agosto/2026')).toBe('2026-08-01');
  });

  it('extrai mês abreviado', () => {
    expect(extrairCompetenciaDaPagina('Ref: Ago/2026')).toBe('2026-08-01');
  });

  it('extrai mês numérico', () => {
    expect(extrairCompetenciaDaPagina('Ref.: 08/2026')).toBe('2026-08-01');
  });

  it('lida com acento (Março)', () => {
    expect(extrairCompetenciaDaPagina('Ref.: Março/2026')).toBe('2026-03-01');
  });

  it('retorna null sem "Ref."', () => {
    expect(extrairCompetenciaDaPagina('Holerite do mês de Agosto de 2026')).toBeNull();
  });
});

describe('agruparPaginasPorCpf', () => {
  const pagina = (numero: number, cpf: string | null, competencia: string | null = null): PaginaExtraida => ({
    numero,
    cpf,
    competencia,
  });

  it('agrupa páginas consecutivas do mesmo CPF em um único bloco', () => {
    const { blocos, paginasSemCpf } = agruparPaginasPorCpf([
      pagina(1, '111', '2026-08-01'),
      pagina(2, '111'),
      pagina(3, '222', '2026-08-01'),
      pagina(4, '222'),
    ]);
    expect(blocos).toEqual([
      { cpf: '111', competencia: '2026-08-01', paginaInicio: 1, paginaFim: 2 },
      { cpf: '222', competencia: '2026-08-01', paginaInicio: 3, paginaFim: 4 },
    ]);
    expect(paginasSemCpf).toEqual([]);
  });

  it('não assume número fixo de páginas por colaborador', () => {
    const { blocos } = agruparPaginasPorCpf([
      pagina(1, '111', '2026-08-01'),
      pagina(2, '222', '2026-08-01'),
      pagina(3, '222'),
      pagina(4, '222'),
    ]);
    expect(blocos).toEqual([
      { cpf: '111', competencia: '2026-08-01', paginaInicio: 1, paginaFim: 1 },
      { cpf: '222', competencia: '2026-08-01', paginaInicio: 2, paginaFim: 4 },
    ]);
  });

  it('páginas sem CPF não se juntam a blocos vizinhos e ficam reportadas à parte', () => {
    const { blocos, paginasSemCpf } = agruparPaginasPorCpf([
      pagina(1, '111', '2026-08-01'),
      pagina(2, null),
      pagina(3, '111', '2026-08-01'),
    ]);
    expect(blocos).toEqual([
      { cpf: '111', competencia: '2026-08-01', paginaInicio: 1, paginaFim: 1 },
      { cpf: '111', competencia: '2026-08-01', paginaInicio: 3, paginaFim: 3 },
    ]);
    expect(paginasSemCpf).toEqual([{ numero: 2 }]);
  });

  it('preenche a competência do bloco a partir de qualquer página que a traga', () => {
    const { blocos } = agruparPaginasPorCpf([
      pagina(1, '111', null),
      pagina(2, '111', '2026-08-01'),
    ]);
    expect(blocos[0].competencia).toBe('2026-08-01');
  });

  it('bloco sem nenhuma página com "Ref." legível fica com competencia null', () => {
    const { blocos } = agruparPaginasPorCpf([pagina(1, '111', null), pagina(2, '111', null)]);
    expect(blocos[0].competencia).toBeNull();
  });
});
