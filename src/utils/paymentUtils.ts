import { 
  PaymentRequestFormValues, 
  PaymentRequestPayload, 
  PaymentDateValidation,
  PaymentRequestStatus 
} from '../types';

/**
 * Normaliza uma data para 00:00:00.000
 * Se a data não for válida, retorna a data atual normalizada
 */
export function normalizeDate(date: Date | string | null | undefined): Date {
  let normalizedDate: Date;

  if (!date) {
    normalizedDate = new Date();
  } else if (typeof date === 'string') {
    normalizedDate = new Date(date);
  } else {
    normalizedDate = new Date(date);
  }

  // Verifica se a data é válida
  if (isNaN(normalizedDate.getTime())) {
    normalizedDate = new Date();
  }

  // Normaliza para 00:00:00.000
  normalizedDate.setHours(0, 0, 0, 0);
  return normalizedDate;
}

/**
 * Retorna a próxima data válida (terça ou quinta) com pelo menos minHours de diferença
 * @param baseDate - Data base para cálculo
 * @param minHours - Mínimo de horas de diferença (padrão: 48)
 */
export function getNextValidDate(baseDate: Date | string, minHours: number = 48): Date {
  const base = normalizeDate(baseDate);
  const minDate = new Date(base.getTime() + minHours * 60 * 60 * 1000);
  
  let candidateDate = new Date(minDate);
  candidateDate.setHours(0, 0, 0, 0);
  
  // Incrementa 1 dia por vez até encontrar terça (2) ou quinta (4)
  while (true) {
    const dayOfWeek = candidateDate.getDay();
    
    // Verifica se é terça (2) ou quinta (4)
    if (dayOfWeek === 2 || dayOfWeek === 4) {
      // Verifica se a diferença é >= 48 horas
      const diffHours = (candidateDate.getTime() - base.getTime()) / (1000 * 60 * 60);
      if (diffHours >= minHours) {
        return candidateDate;
      }
    }
    
    // Incrementa 1 dia
    candidateDate.setDate(candidateDate.getDate() + 1);
  }
}

/**
 * Gera o código do pedido de pagamento
 * @param today - Data atual
 * @param existingPedidosCount - Número de pedidos já existentes no dia
 */
export function generatePedidoCode(today: Date, existingPedidosCount: number): {
  codigoCompleto: string;
  codigoCompacto: string;
} {
  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const sequenceNumber = String(existingPedidosCount + 1).padStart(2, '0');
  
  const codigoCompacto = `${day}/${month} - ${sequenceNumber}`;
  const codigoCompleto = `PEDIDO DE PAGAMENTO ${codigoCompacto}`;
  
  return {
    codigoCompleto,
    codigoCompacto
  };
}

/**
 * Valida a data de pagamento
 * - Deve ser válida
 * - Deve ter 48h ou mais em relação ao dia atual
 * - Deve cair em terça ou quinta
 */
export function validatePaymentDate(inputDate: Date | string): PaymentDateValidation {
  const today = normalizeDate(new Date());
  const paymentDate = normalizeDate(inputDate);
  
  // Verifica se a data é válida
  if (isNaN(paymentDate.getTime())) {
    return {
      valid: false,
      suggestedDate: getNextValidDate(today),
      message: 'Data inválida. Por favor, selecione uma data válida.'
    };
  }
  
  // Verifica se é terça (2) ou quinta (4)
  const dayOfWeek = paymentDate.getDay();
  if (dayOfWeek !== 2 && dayOfWeek !== 4) {
    return {
      valid: false,
      suggestedDate: getNextValidDate(today),
      message: 'A data de pagamento deve ser uma terça-feira ou quinta-feira.'
    };
  }
  
  // Verifica se tem pelo menos 48 horas de diferença
  const diffHours = (paymentDate.getTime() - today.getTime()) / (1000 * 60 * 60);
  if (diffHours < 48) {
    return {
      valid: false,
      suggestedDate: getNextValidDate(today),
      message: 'A data de pagamento deve ter pelo menos 48 horas de antecedência.'
    };
  }
  
  return {
    valid: true,
    date: paymentDate
  };
}

/**
 * Prepara o payload para envio ao backend
 */
export function preparePayload(
  formValues: PaymentRequestFormValues,
  codigo: string,
  codigoCompacto: string,
  department: string
): PaymentRequestPayload {
  const dataPagamento = typeof formValues.dataPagamento === 'string' 
    ? formValues.dataPagamento 
    : formValues.dataPagamento.toISOString().split('T')[0];

  return {
    codigo,
    codigoCompacto,
    tipoSolicitacao: formValues.tipoSolicitacao,
    documentoNumero: String(formValues.documentoNumero),
    fornecedor: formValues.fornecedor,
    cpfCnpj: formValues.cpfCnpj,
    valorTotal: formValues.valorTotal,
    formaPagamento: formValues.formaPagamento,
    dadosPagamento: formValues.dadosPagamento,
    descricaoDetalhada: formValues.descricaoDetalhada,
    solicitadoPor: formValues.solicitadoPor,
    autorizadoPor: formValues.autorizadoPor,
    dataPagamento,
    emailUsuario: formValues.emailUsuario,
    department,
    status: 'pending' as PaymentRequestStatus
  };
}

/**
 * Formata valor para moeda brasileira
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

/**
 * Formata CPF/CNPJ para exibição
 */
export function formatCpfCnpj(value: string): string {
  const numbers = value.replace(/\D/g, '');
  
  if (numbers.length === 11) {
    // CPF: 000.000.000-00
    return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  } else if (numbers.length === 14) {
    // CNPJ: 00.000.000/0000-00
    return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  
  return value;
}

/**
 * Valida CPF/CNPJ
 */
export function validateCpfCnpj(value: string): boolean {
  const numbers = value.replace(/\D/g, '');
  return numbers.length === 11 || numbers.length === 14;
}

/**
 * Formata data para exibição (DD/MM/YYYY)
 */
export function formatDateDisplay(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Retorna o nome do dia da semana
 */
export function getDayOfWeekName(date: Date): string {
  const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  return days[date.getDay()];
}

/**
 * Labels para tipos de solicitação
 */
export const PAYMENT_TYPE_LABELS: Record<string, string> = {
  'NOTA_FISCAL': 'Nota Fiscal',
  'BOLETO': 'Boleto',
  'REEMBOLSO': 'Reembolso',
  'ADIANTAMENTO': 'Adiantamento',
  'OUTROS': 'Outros'
};

/**
 * Labels para formas de pagamento
 */
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  'PIX': 'PIX',
  'TED': 'TED',
  'BOLETO': 'Boleto Bancário',
  'CARTAO_CREDITO': 'Cartão de Crédito',
  'CARTAO_DEBITO': 'Cartão de Débito',
  'DINHEIRO': 'Dinheiro'
};

/**
 * Labels para status
 */
export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  'pending': 'Pendente',
  'approved': 'Aprovado',
  'rejected': 'Rejeitado',
  'paid': 'Pago',
  'cancelled': 'Cancelado'
};

/**
 * Cores para status
 */
export const PAYMENT_STATUS_COLORS: Record<string, string> = {
  'pending': 'bg-yellow-100 text-yellow-800',
  'approved': 'bg-green-100 text-green-800',
  'rejected': 'bg-red-100 text-red-800',
  'paid': 'bg-blue-100 text-blue-800',
  'cancelled': 'bg-gray-100 text-gray-800'
};
