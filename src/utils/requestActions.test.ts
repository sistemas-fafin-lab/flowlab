import { describe, expect, it } from 'vitest';
import { canSeeRequest, requestActions, type RequestForActions, type RequestViewer } from './requestActions';

const sc = (r: Partial<RequestForActions> = {}): RequestForActions => ({
  type: 'SC',
  status: 'pending',
  approverId: 'paulo',
  department: 'Qualidade',
  ...r,
});

const paulo: RequestViewer = { userId: 'paulo', department: 'Área técnica', canApproveRequests: false };
const louise: RequestViewer = { userId: 'louise', department: 'Administrativo', canApproveRequests: true };
const mateus: RequestViewer = { userId: 'mateus', department: 'Compras', canApproveRequests: true };

describe('requestActions', () => {
  it('aprovador decide a SC pendente em que é aprovador, sem ser no lugar de ninguém', () => {
    expect(requestActions(sc(), paulo)).toMatchObject({ canDecide: true, decidesWithoutApprover: false });
  });

  it('admin não decide a SC que tem aprovador', () => {
    expect(requestActions(sc(), louise).canDecide).toBe(false);
  });

  it('admin decide no lugar a SC sem aprovador', () => {
    expect(requestActions(sc({ approverId: null }), louise)).toMatchObject({ canDecide: true, decidesWithoutApprover: true });
  });

  it('sem canApproveRequests, ninguém decide a SC sem aprovador', () => {
    expect(requestActions(sc({ approverId: null }), paulo).canDecide).toBe(false);
  });

  it('SM continua como hoje: decide quem tem canApproveRequests, sem aviso de aprovador', () => {
    const sm = sc({ type: 'SM', approverId: null });

    expect(requestActions(sm, louise)).toMatchObject({ canDecide: true, decidesWithoutApprover: false });
    expect(requestActions(sm, paulo).canDecide).toBe(false);
  });

  it('comprador não inicia cotação nem finaliza SC pendente', () => {
    expect(requestActions(sc(), mateus)).toMatchObject({ canDecide: false, canStartQuotation: false, canFinalize: false });
    expect(requestActions(sc({ approverId: null }), mateus)).toMatchObject({ canStartQuotation: false, canFinalize: false });
  });

  it('comprador inicia cotação e finaliza a SC aprovada', () => {
    expect(requestActions(sc({ status: 'approved' }), mateus)).toMatchObject({ canStartQuotation: true, canFinalize: true });
  });

  it('SM continua como hoje: comprador finaliza a pendente e inicia cotação na aprovada', () => {
    expect(requestActions(sc({ type: 'SM', approverId: null }), mateus)).toMatchObject({ canStartQuotation: false, canFinalize: true });
    expect(requestActions(sc({ type: 'SM', approverId: null, status: 'approved' }), mateus)).toMatchObject({ canStartQuotation: true, canFinalize: true });
  });

  it('aprovador sem canApproveRequests não ganha o operacional de Compras', () => {
    expect(requestActions(sc({ status: 'approved' }), paulo)).toMatchObject({ canStartQuotation: false, canFinalize: false });
  });

  it.each(['approved', 'rejected', 'completed'] as const)('SC %s: ninguém decide', (status) => {
    expect(requestActions(sc({ status }), paulo).canDecide).toBe(false);
    expect(requestActions(sc({ status, approverId: null }), louise).canDecide).toBe(false);
  });
});

describe('canSeeRequest', () => {
  it('aprovador vê a SC de outro setor em que é aprovador', () => {
    expect(canSeeRequest(sc({ department: 'Qualidade' }), paulo)).toBe(true);
  });

  it('terceiro sem canApproveRequests não vê a SC de outro setor', () => {
    const ana: RequestViewer = { userId: 'ana', department: 'Recepção', canApproveRequests: false };
    expect(canSeeRequest(sc({ department: 'Qualidade' }), ana)).toBe(false);
  });

  it('vê as do próprio setor, e quem tem canApproveRequests vê todas', () => {
    const ana: RequestViewer = { userId: 'ana', department: 'Qualidade', canApproveRequests: false };
    expect(canSeeRequest(sc({ approverId: null }), ana)).toBe(true);
    expect(canSeeRequest(sc({ department: 'Recepção' }), mateus)).toBe(true);
  });
});
