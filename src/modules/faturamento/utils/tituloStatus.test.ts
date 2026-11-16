import { describe, expect, it } from 'vitest';
import type { TituloLote, TituloReceber } from '../types';
import { statusExibido } from './tituloStatus';

const lote = (statusAplis: number | null, statusAplisAtualizadoEm: string | null = null): TituloLote => ({
  id: `l${statusAplis}`,
  aplisId: '5308',
  codigoLote: '5308',
  statusLabel: null,
  statusAplis,
  statusAplisAtualizadoEm,
  dataEnvio: null,
  protocolo: null,
  valorTotal: 0,
  qtdRequisicoes: 0,
  responsavelFechamento: null,
});

const titulo = (
  status: TituloReceber['status'],
  lotes: TituloLote[],
): Pick<TituloReceber, 'status' | 'statusAtualizadoEm' | 'lotes'> => ({
  status,
  statusAtualizadoEm: '2026-11-09T10:39:00Z',
  lotes,
});

describe('statusExibido', () => {
  it('mostra o status do lote no apLIS, não o das baixas', () => {
    const s = statusExibido(titulo('aberta', [lote(12, '2026-11-16T09:00:00Z')]));
    expect(s.rotulo).toBe('NFe Emitida');
    expect(s.atualizadoEm).toBe('2026-11-16T09:00:00Z');
  });

  it('cancelado no FlowLab vence o apLIS', () => {
    const s = statusExibido(titulo('cancelada', [lote(4)]));
    expect(s.rotulo).toBe('Cancelada');
    expect(s.atualizadoEm).toBe('2026-11-09T10:39:00Z');
  });

  it('sem status do apLIS cai no status pelas baixas', () => {
    expect(statusExibido(titulo('parcialmente_recebida', [lote(null)])).rotulo).toBe('Parcial');
    expect(statusExibido(titulo('aberta', [])).rotulo).toBe('Aberta');
  });

  it('lotes em status diferentes aparecem juntos, com a data mais recente', () => {
    const s = statusExibido(titulo('aberta', [
      lote(4, '2026-11-10T00:00:00Z'), lote(3, '2026-11-12T00:00:00Z'), lote(4, null),
    ]));
    expect(s.rotulo).toBe('Recebido / Faturado');
    expect(s.atualizadoEm).toBe('2026-11-12T00:00:00Z');
  });
});
