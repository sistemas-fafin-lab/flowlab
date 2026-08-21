// Fixture compartilhada de ac_coletas para os testes do módulo.
import type { AcColeta } from '../types';

export const coletaFixture = (sobrescritas: Partial<AcColeta> = {}): AcColeta => ({
  id: 'c1',
  agendamento_id: 'a1',
  posto_id: null,
  location_id: null,
  coletado_por: 'Maria Souza',
  coletado_em: '2026-08-21T10:30:00.000Z',
  observacoes: null,
  validade_ok: true,
  etiquetado: true,
  created_at: '2026-08-21T10:30:00.000Z',
  updated_at: '2026-08-21T10:30:00.000Z',
  ...sobrescritas,
});
