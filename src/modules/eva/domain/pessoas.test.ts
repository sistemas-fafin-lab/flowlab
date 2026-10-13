import { describe, expect, it } from 'vitest';
import { casarMembro, gradientePara, iniciais, normalizarNome } from './pessoas';

describe('iniciais e cor do avatar', () => {
  it('primeira e última inicial; nome único usa as duas primeiras letras', () => {
    expect(iniciais('Gabriel Carneiro')).toBe('GC');
    expect(iniciais('Ana Maria Costa')).toBe('AC');
    expect(iniciais('Vinícius')).toBe('VI');
    expect(iniciais('  ')).toBe('?');
  });
  it('a mesma pessoa sempre recebe a mesma cor', () => {
    expect(gradientePara('abc-123')).toBe(gradientePara('abc-123'));
  });
});

describe('casarMembro (RN08)', () => {
  const membros = [
    { id: 'u-gabriel', apelidos: ['Gabriel Carneiro', 'Gabriel'] },
    { id: 'u-vinicius', apelidos: ['Vinícius'] },
  ];

  it('"@Gabriel Carneiro" casa com o apelido, sem diferenciar maiúsculas', () => {
    expect(casarMembro('@Gabriel Carneiro', membros)).toBe('u-gabriel');
    expect(casarMembro('gabriel carneiro', membros)).toBe('u-gabriel');
  });

  it('acento não atrapalha, nos dois sentidos', () => {
    expect(casarMembro('@Vinicius', membros)).toBe('u-vinicius');
    expect(normalizarNome('@Vinícius  Souza')).toBe('vinicius souza');
  });

  it('"Equipe" e nomes desconhecidos ficam sem responsável', () => {
    expect(casarMembro('Equipe', membros)).toBeNull();
    expect(casarMembro('@Erika', membros)).toBeNull();
  });
});
