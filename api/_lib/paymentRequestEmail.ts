// api/_lib/paymentRequestEmail.ts
// Avisos do fluxo de autorização dos pedidos de pagamento
// (api/_lib/handlers/notifications-payment-request.ts). Puro: o handler lê o pedido e os
// destinatários no Supabase e só repassa aqui. Modelos em
// supabase/migrations/20261020150000_pagamentos_autorizacao.sql.

import { escapeHtml } from './html.js';

export type EventoPagamento = 'criado' | 'decidido';
export const EVENTOS: readonly EventoPagamento[] = ['criado', 'decidido'];

export type ModeloPagamento =
  | 'payment_awaiting_authorization'
  | 'payment_authorized'
  | 'payment_authorization_rejected'
  | 'payment_ready_for_approval';

export type Destinatario = 'autorizador' | 'solicitante' | 'financeiro';

/** Linha de payment_requests (snake_case), só com as colunas usadas aqui. */
export interface PedidoPagamentoRow {
  id: string;
  codigo: string;
  codigo_compacto: string | null;
  fornecedor: string;
  valor_total: number | string;
  tipo_solicitacao: string;
  forma_pagamento: string;
  data_pagamento: string | null;
  department: string | null;
  solicitado_por: string | null;
  solicitante_id: string | null;
  email_usuario: string | null;
  autorizado_por: string | null;
  autorizado_por_id: string | null;
  descricao_detalhada: string | null;
  status: string;
  rejection_reason: string | null;
  rejeitado_por: string | null;
  created_at: string;
  updated_at: string | null;
  autorizado_em: string | null;
}

export interface Envio {
  para: Destinatario;
  modelo: ModeloPagamento;
  /** Aba da tela de Pagamentos que o link abre. */
  aba: 'autorizacao' | 'pendente' | 'todos';
  /** Sininho (user_notifications). */
  titulo: string;
  conteudo: string;
  tipo: 'info' | 'success' | 'warning' | 'error';
}

/** Com `erro`, a rota recusa (status HTTP em `status`); sem, envia `envios` (talvez nenhum). */
export interface Plano {
  envios: Envio[];
  erro?: string;
  status?: number;
}

/**
 * Janela em que o evento ainda vale. Só quem agiu pode pedir o aviso, e só logo depois:
 * a rota não serve para reenviar e-mail de pedido antigo nem para encher a caixa de alguém.
 */
export const JANELA_MS = 15 * 60 * 1000;

const recente = (iso: string | null, agora: Date): boolean =>
  !!iso && agora.getTime() - new Date(iso).getTime() <= JANELA_MS;

const TIPOS: Record<string, string> = { PAGAMENTO: 'Pagamento', REEMBOLSO: 'Reembolso', ADIANTAMENTO: 'Adiantamento' };
const FORMAS: Record<string, string> = { PIX: 'PIX', DINHEIRO: 'Dinheiro', BOLETO: 'Boleto', CAJU: 'Caju', SOLIDES: 'Solides' };
const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

export const formatarValor = (valor: number | string): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor) || 0);

/** "22/10/2026 (quinta-feira)", direto do texto AAAA-MM-DD (sem passar por fuso). */
export function formatarDataPagamento(iso: string | null): string {
  if (!iso) return 'sem data';
  const [ano, mes, dia] = iso.slice(0, 10).split('-').map(Number);
  const semana = DIAS[new Date(ano, mes - 1, dia).getDay()];
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano} (${semana})`;
}

/** Caminho da tela de Pagamentos já na aba certa e com o pedido aberto. */
export const caminhoDoPedido = (id: string, aba: Envio['aba']): string =>
  `/requests/payments?aba=${aba}&pedido=${encodeURIComponent(id)}`;

/** O que avisar e a quem, conferindo que o pedido está no estado que o evento diz. */
export function planejarEnvios(
  pedido: PedidoPagamentoRow,
  evento: EventoPagamento,
  chamadorId: string,
  agora: Date,
): Plano {
  const codigo = pedido.codigo_compacto || pedido.codigo;
  const valor = formatarValor(pedido.valor_total);
  const solicitante = pedido.solicitado_por || 'Alguém';
  const autorizador = pedido.autorizado_por || 'O autorizador';
  const paraFinanceiro: Envio = {
    para: 'financeiro',
    modelo: 'payment_ready_for_approval',
    aba: 'pendente',
    titulo: 'Pedido de pagamento para aprovar',
    conteudo: `${codigo} (${valor}, ${pedido.fornecedor}) foi autorizado por ${autorizador}.`,
    tipo: 'info',
  };

  if (evento === 'criado') {
    if (pedido.solicitante_id !== chamadorId) {
      return { envios: [], status: 403, erro: 'Só quem fez o pedido avisa sobre ele.' };
    }
    if (!recente(pedido.created_at, agora)) return { envios: [] };
    if (pedido.status === 'awaiting_authorization') {
      return {
        envios: [
          {
            para: 'autorizador',
            modelo: 'payment_awaiting_authorization',
            aba: 'autorizacao',
            titulo: 'Pedido de pagamento para autorizar',
            conteudo: `${solicitante} pediu ${valor} para ${pedido.fornecedor} (${codigo}).`,
            tipo: 'warning',
          },
        ],
      };
    }
    // Quem pediu é o próprio autorizador: o pedido já nasceu autorizado.
    if (pedido.status === 'pending' && pedido.autorizado_por_id === pedido.solicitante_id) {
      return { envios: [paraFinanceiro] };
    }
    return { envios: [] };
  }

  if (pedido.autorizado_por_id !== chamadorId) {
    return { envios: [], status: 403, erro: 'Só o autorizador do pedido avisa sobre a decisão.' };
  }
  if (pedido.status === 'pending' && recente(pedido.autorizado_em, agora)) {
    return {
      envios: [
        {
          para: 'solicitante',
          modelo: 'payment_authorized',
          aba: 'todos',
          titulo: 'Pedido de pagamento autorizado',
          conteudo: `${autorizador} autorizou o pedido ${codigo}. Agora ele vai para a aprovação do Financeiro.`,
          tipo: 'success',
        },
        paraFinanceiro,
      ],
    };
  }
  if (pedido.status === 'rejected' && pedido.rejeitado_por && recente(pedido.updated_at, agora)) {
    return {
      envios: [
        {
          para: 'solicitante',
          modelo: 'payment_authorization_rejected',
          aba: 'todos',
          titulo: 'Pedido de pagamento rejeitado',
          conteudo: `${pedido.rejeitado_por} rejeitou o pedido ${codigo}: ${pedido.rejection_reason ?? 'sem motivo'}`,
          tipo: 'error',
        },
      ],
    };
  }
  return { envios: [] };
}

/** Variáveis dos modelos, já escapadas (o renderTemplate de api/_lib/email.ts não escapa). */
export function variaveisDoPedido(pedido: PedidoPagamentoRow, actionUrl: string): Record<string, string> {
  return {
    codigo: escapeHtml(pedido.codigo_compacto || pedido.codigo),
    fornecedor: escapeHtml(pedido.fornecedor),
    valor: escapeHtml(formatarValor(pedido.valor_total)),
    tipo: escapeHtml(TIPOS[pedido.tipo_solicitacao] ?? pedido.tipo_solicitacao),
    forma: escapeHtml(FORMAS[pedido.forma_pagamento] ?? pedido.forma_pagamento),
    data_pagamento: escapeHtml(formatarDataPagamento(pedido.data_pagamento)),
    solicitante: escapeHtml(pedido.solicitado_por || '—'),
    setor: escapeHtml(pedido.department || 'sem setor'),
    autorizador: escapeHtml(pedido.rejeitado_por || pedido.autorizado_por || '—'),
    descricao: escapeHtml(pedido.descricao_detalhada || '—'),
    motivo: escapeHtml(pedido.rejection_reason || '—'),
    action_url: escapeHtml(actionUrl),
  };
}
