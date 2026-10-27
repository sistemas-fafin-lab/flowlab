import { describe, expect, it } from 'vitest';
import {
  caminhoDoPedido,
  formatarDataPagamento,
  JANELA_MS,
  planejarEnvios,
  variaveisDoPedido,
  type PedidoPagamentoRow,
} from './paymentRequestEmail.js';

const AGORA = new Date('2026-10-20T15:00:00Z');
const HA_POUCO = '2026-10-20T14:55:00Z';
const ONTEM = '2026-10-19T15:00:00Z';

const pedido = (campos: Partial<PedidoPagamentoRow>): PedidoPagamentoRow => ({
  id: 'p1',
  codigo: 'PEDIDO DE PAGAMENTO 20/10 - 01',
  codigo_compacto: '20/10 - 01',
  fornecedor: 'Papelaria Conceição',
  valor_total: 1250.9,
  tipo_solicitacao: 'PAGAMENTO',
  forma_pagamento: 'PIX',
  data_pagamento: '2026-10-22',
  department: 'Estoque',
  solicitado_por: 'Sol Estoque',
  solicitante_id: 'u-sol',
  email_usuario: 'sol@lab.com',
  autorizado_por: 'Gestora',
  autorizado_por_id: 'u-gestora',
  descricao_detalhada: 'Material do mês',
  status: 'awaiting_authorization',
  rejection_reason: null,
  rejeitado_por: null,
  created_at: HA_POUCO,
  updated_at: HA_POUCO,
  autorizado_em: null,
  ...campos,
});

const modelos = (plano: ReturnType<typeof planejarEnvios>) =>
  plano.erro ?? plano.envios.map((e) => `${e.para}:${e.modelo}`);

describe('quem é avisado em cada evento', () => {
  it('pedido criado aguardando autorização: avisa o autorizador', () => {
    expect(modelos(planejarEnvios(pedido({}), 'criado', 'u-sol', AGORA))).toEqual([
      'autorizador:payment_awaiting_authorization',
    ]);
  });

  it('pedido que nasceu autorizado (quem pede é o autorizador): avisa o Financeiro', () => {
    const p = pedido({ status: 'pending', solicitante_id: 'u-gestora', autorizado_em: HA_POUCO });
    expect(modelos(planejarEnvios(p, 'criado', 'u-gestora', AGORA))).toEqual(['financeiro:payment_ready_for_approval']);
  });

  it('autorizado: avisa o solicitante e o Financeiro', () => {
    const p = pedido({ status: 'pending', autorizado_em: HA_POUCO });
    expect(modelos(planejarEnvios(p, 'decidido', 'u-gestora', AGORA))).toEqual([
      'solicitante:payment_authorized',
      'financeiro:payment_ready_for_approval',
    ]);
  });

  it('rejeitado pelo autorizador: avisa o solicitante, com o motivo no sininho', () => {
    const p = pedido({ status: 'rejected', rejeitado_por: 'Gestora', rejection_reason: 'Sem NF' });
    const plano = planejarEnvios(p, 'decidido', 'u-gestora', AGORA);
    expect(modelos(plano)).toEqual(['solicitante:payment_authorization_rejected']);
    expect(plano.envios[0].conteudo).toContain('Sem NF');
  });
});

describe('transferência na aba Departamentos', () => {
  it('avisa o novo autorizador, só a pedido de quem gerencia departamentos', () => {
    const p = pedido({ autorizado_por: 'Bruno', autorizado_por_id: 'u-bruno' });
    expect(modelos(planejarEnvios(p, 'transferido', 'u-rh', AGORA, true))).toEqual([
      'autorizador:payment_authorization_transferred',
    ]);
    expect(planejarEnvios(p, 'transferido', 'u-rh', AGORA, false)).toMatchObject({ status: 403 });
  });

  it('não avisa pedido que não espera mais autorização ou transferido há muito tempo', () => {
    expect(modelos(planejarEnvios(pedido({ status: 'pending' }), 'transferido', 'u-rh', AGORA, true))).toEqual([]);
    expect(modelos(planejarEnvios(pedido({ updated_at: ONTEM }), 'transferido', 'u-rh', AGORA, true))).toEqual([]);
  });
});

describe('a rota não serve para mandar e-mail à toa', () => {
  it('só quem fez o pedido avisa da criação, e só o autorizador avisa da decisão', () => {
    expect(planejarEnvios(pedido({}), 'criado', 'u-outro', AGORA)).toMatchObject({ status: 403 });
    const autorizado = pedido({ status: 'pending', autorizado_em: HA_POUCO });
    expect(planejarEnvios(autorizado, 'decidido', 'u-sol', AGORA)).toMatchObject({ status: 403 });
  });

  it('fora da janela de 15 minutos, não envia nada', () => {
    expect(JANELA_MS).toBe(15 * 60 * 1000);
    expect(modelos(planejarEnvios(pedido({ created_at: ONTEM }), 'criado', 'u-sol', AGORA))).toEqual([]);
    const autorizadoOntem = pedido({ status: 'pending', autorizado_em: ONTEM });
    expect(modelos(planejarEnvios(autorizadoOntem, 'decidido', 'u-gestora', AGORA))).toEqual([]);
  });

  it('estado que não bate com o evento não envia nada', () => {
    expect(modelos(planejarEnvios(pedido({ status: 'approved' }), 'criado', 'u-sol', AGORA))).toEqual([]);
    expect(modelos(planejarEnvios(pedido({}), 'decidido', 'u-gestora', AGORA))).toEqual([]);
    // Rejeitado pelo Financeiro (sem passar pelo autorizador) não é decisão do autorizador.
    const rejeitadoSemNome = pedido({ status: 'rejected', rejeitado_por: null });
    expect(modelos(planejarEnvios(rejeitadoSemNome, 'decidido', 'u-gestora', AGORA))).toEqual([]);
  });
});

describe('conteúdo', () => {
  it('escapa o que veio do usuário e formata valor e data sem voltar um dia', () => {
    const v = variaveisDoPedido(
      pedido({ fornecedor: '<script>x</script>', descricao_detalhada: 'A & B' }),
      'https://flow-lab.vercel.app/requests/payments?aba=autorizacao&pedido=p1',
    );
    expect(v.fornecedor).toBe('&lt;script&gt;x&lt;/script&gt;');
    expect(v.descricao).toBe('A &amp; B');
    expect(v.valor).toMatch(/R\$\s1\.250,90/);
    expect(v.data_pagamento).toBe('22/10/2026 (quinta-feira)');
    expect(v.action_url).toBe('https://flow-lab.vercel.app/requests/payments?aba=autorizacao&amp;pedido=p1');
  });

  it('na rejeição, "autorizador" é quem rejeitou', () => {
    const v = variaveisDoPedido(pedido({ rejeitado_por: 'Gestora Nova', autorizado_por: 'Gestora' }), 'x');
    expect(v.autorizador).toBe('Gestora Nova');
  });

  it('link abre a aba certa com o pedido', () => {
    expect(caminhoDoPedido('p 1', 'pendente')).toBe('/requests/payments?aba=pendente&pedido=p%201');
    expect(formatarDataPagamento(null)).toBe('sem data');
  });
});
