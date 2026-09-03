import { describe, expect, it } from 'vitest';
import { statusCuradoriaOcorrencia } from './ocorrenciasRegras.js';

describe('statusCuradoriaOcorrencia (R5)', () => {
  it('conclui quando colaborador, setor e motivo estão todos definidos', () => {
    expect(statusCuradoriaOcorrencia({ colaboradorId: 'c1', setorErroId: 's1', motivoId: 'm1' })).toBe('concluida');
  });

  it('fica pendente sem colaborador', () => {
    expect(statusCuradoriaOcorrencia({ colaboradorId: null, setorErroId: 's1', motivoId: 'm1' })).toBe('pendente');
  });

  it('fica pendente sem setor', () => {
    expect(statusCuradoriaOcorrencia({ colaboradorId: 'c1', setorErroId: null, motivoId: 'm1' })).toBe('pendente');
  });

  it('fica pendente sem motivo', () => {
    expect(statusCuradoriaOcorrencia({ colaboradorId: 'c1', setorErroId: 's1', motivoId: null })).toBe('pendente');
  });

  it('fica pendente sem nenhum dos três', () => {
    expect(statusCuradoriaOcorrencia({ colaboradorId: null, setorErroId: null, motivoId: null })).toBe('pendente');
  });

  it('trata undefined como ausente', () => {
    expect(statusCuradoriaOcorrencia({ colaboradorId: undefined, setorErroId: 's1', motivoId: 'm1' })).toBe('pendente');
  });
});
