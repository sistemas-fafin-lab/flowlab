import { describe, expect, it } from 'vitest';
import { coletaFixture as coleta } from '../testing/coleta';
import { resumoColeta, validarEdicaoColeta, type FormEdicaoColeta } from './coleta';

describe('resumoColeta', () => {
  it('devolve null quando não há coleta registrada', () => {
    expect(resumoColeta(null)).toBeNull();
  });

  it('devolve coletado por, horário e observações quando a coleta existe', () => {
    expect(resumoColeta(coleta({ observacoes: 'Jejum respeitado.' }))).toEqual({
      coletadoPor: 'Maria Souza',
      coletadoEm: '2026-08-21T10:30:00.000Z',
      observacoes: 'Jejum respeitado.',
    });
  });

  it('trata observações em branco como ausentes', () => {
    expect(resumoColeta(coleta({ observacoes: '   ' }))?.observacoes).toBeNull();
  });
});

describe('validarEdicaoColeta', () => {
  const agora = new Date(2026, 9, 20, 12, 0);
  const form = (s: Partial<FormEdicaoColeta> = {}): FormEdicaoColeta => ({
    pacienteNome: '  Ireni   Lousado  Barbosa ',
    telefone: '(11) 98765-4321',
    postoId: 'posto-1',
    coletadoPor: ' Eliane ',
    coletadoEm: '2026-10-19T09:53',
    observacoes: '  ',
    validadeOk: true,
    etiquetado: null,
    ...s,
  });

  it('normaliza os campos e converte a data local para ISO', () => {
    expect(validarEdicaoColeta(form(), agora)).toEqual({
      dados: {
        pacienteNome: 'Ireni Lousado Barbosa',
        telefone: '11987654321',
        postoId: 'posto-1',
        coletadoPor: 'Eliane',
        coletadoEm: new Date(2026, 9, 19, 9, 53).toISOString(),
        observacoes: null,
        validadeOk: true,
        etiquetado: null,
      },
    });
  });

  it('aceita telefone vazio', () => {
    const r = validarEdicaoColeta(form({ telefone: '' }), agora);
    expect('dados' in r && r.dados.telefone).toBeNull();
  });

  it.each([
    [{ pacienteNome: '   ' }, 'Informe o nome do paciente.'],
    [{ telefone: '(11) 9876' }, 'Telefone inválido — inclua o DDD.'],
    [{ postoId: '' }, 'Selecione o posto.'],
    [{ coletadoPor: '' }, 'Informe quem coletou.'],
    [{ coletadoEm: '' }, 'Informe a data e a hora da coleta.'],
    [{ coletadoEm: '2026-10-21T08:00' }, 'A data da coleta não pode estar no futuro.'],
  ])('recusa %o', (s, erro) => {
    expect(validarEdicaoColeta(form(s), agora)).toEqual({ erro });
  });
});
