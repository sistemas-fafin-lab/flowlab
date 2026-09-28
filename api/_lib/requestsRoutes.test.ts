import { describe, expect, it } from 'vitest';
import { buildRequestsUrl, parseRequestStatusParam } from './requestsRoutes.js';

describe('buildRequestsUrl', () => {
  it('sem status aponta para a lista sem filtro', () => {
    expect(buildRequestsUrl('https://flow-lab.vercel.app')).toBe(
      'https://flow-lab.vercel.app/requests/purchases',
    );
  });

  it('com status adiciona o filtro na query string', () => {
    expect(buildRequestsUrl('https://flow-lab.vercel.app', 'pending')).toBe(
      'https://flow-lab.vercel.app/requests/purchases?status=pending',
    );
  });

  it('com base vazia gera caminho relativo para links do SPA', () => {
    expect(buildRequestsUrl('', 'approved')).toBe('/requests/purchases?status=approved');
  });
});

describe('parseRequestStatusParam', () => {
  it.each(['pending', 'approved', 'rejected', 'completed'])('aceita %s', (status) => {
    expect(parseRequestStatusParam(status)).toBe(status);
  });

  it.each([null, '', 'PENDING', 'awaiting_approval', 'toString'])(
    'rejeita %s',
    (value) => {
      expect(parseRequestStatusParam(value)).toBeNull();
    },
  );
});
