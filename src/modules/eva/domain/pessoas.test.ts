import { describe, expect, it } from 'vitest';
import { casarMembro, formatarWhatsapp, gradientePara, iniciais, juntarNomes, nomeParaCitar, normalizarNome } from './pessoas';

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

describe('nomes no grupo da equipe (D35)', () => {
  it('juntarNomes: "Ana", "Ana e Bruno", "Ana, Bruno e Carla"', () => {
    expect(juntarNomes([])).toBe('');
    expect(juntarNomes(['Ana'])).toBe('Ana');
    expect(juntarNomes(['Ana', 'Bruno'])).toBe('Ana e Bruno');
    expect(juntarNomes(['Ana', 'Bruno', 'Carla'])).toBe('Ana, Bruno e Carla');
  });

  it('cita pelo primeiro nome; com xará na equipe (sem olhar acento), pelo nome inteiro', () => {
    const equipe = ['Gabriel Carneiro', 'Ana Souza', 'Vinícius Lima'];
    expect(nomeParaCitar('Gabriel Carneiro', equipe)).toBe('Gabriel');
    expect(nomeParaCitar('Gabriel  Carneiro', [...equipe, 'Gabriel Rocha'])).toBe('Gabriel Carneiro');
    expect(nomeParaCitar('Vinícius Lima', [...equipe, 'Vinicius Prado'])).toBe('Vinícius Lima');
    // A própria pessoa na lista não conta como xará.
    expect(nomeParaCitar('Ana Souza', ['Ana Souza', 'ana souza'])).toBe('Ana');
  });
});

describe('formatarWhatsapp', () => {
  it('com e sem o 9º dígito; vazio vira traço', () => {
    expect(formatarWhatsapp('5561999924986')).toBe('+55 61 99992-4986');
    expect(formatarWhatsapp('556199924986')).toBe('+55 61 9992-4986');
    expect(formatarWhatsapp(null)).toBe('—');
  });
});
