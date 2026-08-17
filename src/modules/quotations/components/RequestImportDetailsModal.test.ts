import { describe, expect, it } from 'vitest';
import { buildRequestImportDetails, buildMaintenanceImportDetails } from './RequestImportDetailsModal';
import type { Request, RequestItem, MaintenanceRequest } from '../../../types';

const requestItem = (overrides: Partial<RequestItem>): RequestItem => ({
  id: 'item-1',
  productId: null,
  productName: 'Produto',
  quantity: 1,
  category: 'general',
  ...overrides,
});

const request = (overrides: Partial<Request>): Request => ({
  id: 'REQ-001',
  type: 'SC',
  items: [requestItem({})],
  reason: 'Reposição de estoque',
  requestedBy: 'Maria Silva',
  requestDate: '2026-01-10',
  status: 'pending',
  priority: 'standard',
  ...overrides,
});

describe('buildRequestImportDetails', () => {
  it('inclui todos os itens da solicitação, não só os 3 primeiros', () => {
    const items = Array.from({ length: 5 }, (_, i) =>
      requestItem({ id: `item-${i}`, productName: `Produto ${i}`, quantity: i + 1 })
    );

    const details = buildRequestImportDetails(request({ items }));

    expect(details.items).toHaveLength(5);
  });

  it('expõe solicitante, data e prioridade como campos', () => {
    const details = buildRequestImportDetails(
      request({ requestedBy: 'João Souza', requestDate: '2026-02-05', priority: 'urgent' })
    );

    expect(details.fields).toEqual(
      expect.arrayContaining([
        { label: 'Solicitante', value: 'João Souza' },
        { label: 'Prioridade', value: 'Urgente' },
      ])
    );
  });

  it('expõe a justificativa completa (reason)', () => {
    const details = buildRequestImportDetails(request({ reason: 'Motivo bem detalhado e completo' }));

    expect(details.justification).toEqual({
      label: 'Justificativa',
      value: 'Motivo bem detalhado e completo',
    });
  });

  it('inclui o tipo (SC/SM) e o status como badges', () => {
    const details = buildRequestImportDetails(request({ type: 'SM', status: 'approved' }));

    expect(details.badges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'SM' }),
        expect.objectContaining({ label: 'Aprovada' }),
      ])
    );
  });
});

const maintenanceRequest = (overrides: Partial<MaintenanceRequest>): MaintenanceRequest => ({
  id: 'mnt-1',
  codigo: 'MNT-001',
  requesterId: 'user-1',
  requesterName: 'Maria Silva',
  requesterEmail: 'maria@example.com',
  department: 'TI',
  localOcorrencia: 'Sala de servidores',
  descricao: 'Ar-condicionado parou de funcionar',
  impactoOperacional: 'Risco de superaquecimento dos servidores',
  dataIdentificacao: '2026-01-10',
  prioridade: 'urgent',
  status: 'pending',
  images: [],
  createdAt: '2026-01-10T00:00:00.000Z',
  updatedAt: '2026-01-10T00:00:00.000Z',
  ...overrides,
});

describe('buildMaintenanceImportDetails', () => {
  it('não expõe lista de itens (MNT não tem itens)', () => {
    const details = buildMaintenanceImportDetails(maintenanceRequest({}));

    expect(details.items).toBeUndefined();
  });

  it('expõe local da ocorrência e departamento como campos', () => {
    const details = buildMaintenanceImportDetails(
      maintenanceRequest({ localOcorrencia: 'Recepção', department: 'TI' })
    );

    expect(details.fields).toEqual(
      expect.arrayContaining([
        { label: 'Local da ocorrência', value: 'Recepção' },
        { label: 'Departamento', value: 'TI' },
      ])
    );
  });

  it('expõe descrição e impacto operacional na justificativa', () => {
    const details = buildMaintenanceImportDetails(
      maintenanceRequest({
        descricao: 'Vazamento no teto',
        impactoOperacional: 'Sala interditada',
      })
    );

    expect(details.justification?.value).toContain('Vazamento no teto');
    expect(details.justification?.value).toContain('Sala interditada');
  });

  it('inclui o código e a prioridade como badges', () => {
    const details = buildMaintenanceImportDetails(
      maintenanceRequest({ codigo: 'MNT-042', prioridade: 'urgent' })
    );

    expect(details.title).toContain('MNT-042');
    expect(details.badges).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: 'Urgente' })])
    );
  });
});
