import { describe, expect, it } from 'vitest';
import {
  buildQuotationManagerApprovalsUrl,
  buildQuotationsUrl,
  QUOTATIONS_MANAGER_APPROVALS_PATH,
} from './routes';

describe('buildQuotationsUrl', () => {
  it('sem status, aponta para a lista de cotações', () => {
    expect(buildQuotationsUrl('https://app.example')).toBe('https://app.example/quotations');
  });

  it('com status, pré-aplica o filtro pela query string', () => {
    expect(buildQuotationsUrl('', 'awaiting_approval')).toBe('/quotations?status=awaiting_approval');
  });
});

describe('buildQuotationManagerApprovalsUrl', () => {
  it('aponta para a tela "Minhas aprovações de cotação" dentro do módulo', () => {
    expect(QUOTATIONS_MANAGER_APPROVALS_PATH).toBe('/quotations/aprovacoes');
    expect(buildQuotationManagerApprovalsUrl('https://app.example')).toBe(
      'https://app.example/quotations/aprovacoes',
    );
  });

  it('com base vazia, gera o caminho relativo usado pelo card da Home', () => {
    expect(buildQuotationManagerApprovalsUrl('')).toBe('/quotations/aprovacoes');
  });
});
