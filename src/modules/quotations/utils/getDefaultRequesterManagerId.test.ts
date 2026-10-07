import { describe, expect, it } from 'vitest';
import { getDefaultRequesterManagerId } from './getDefaultRequesterManagerId';

describe('getDefaultRequesterManagerId', () => {
  it('Compras: sugere quem criou a SC', () => {
    expect(
      getDefaultRequesterManagerId(
        { quotationType: 'compras' },
        { requestRequestedByUserId: 'user-sc', maintenanceRequesterId: 'user-manut' },
      ),
    ).toBe('user-sc');
  });

  it('Contratação: sugere o solicitante da manutenção', () => {
    expect(
      getDefaultRequesterManagerId(
        { quotationType: 'contratacao' },
        { requestRequestedByUserId: 'user-sc', maintenanceRequesterId: 'user-manut' },
      ),
    ).toBe('user-manut');
  });

  it('SC antiga, sem usuário gravado: campo vazio', () => {
    expect(
      getDefaultRequesterManagerId({ quotationType: 'compras' }, { requestRequestedByUserId: null }),
    ).toBeNull();
  });

  it('cotação sem vínculo: campo vazio', () => {
    expect(getDefaultRequesterManagerId({ quotationType: 'compras' }, {})).toBeNull();
    expect(getDefaultRequesterManagerId({ quotationType: 'contratacao' }, {})).toBeNull();
  });

  it('mantém o gestor já gravado na cotação (reenvio) em vez da origem', () => {
    expect(
      getDefaultRequesterManagerId(
        { quotationType: 'compras', requesterManagerId: 'gestor-escolhido' },
        { requestRequestedByUserId: 'user-sc' },
      ),
    ).toBe('gestor-escolhido');
  });
});
