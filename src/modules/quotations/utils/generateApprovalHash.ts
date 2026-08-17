export interface ApprovalHashInput {
  quotationId: string;
  approverId: string;
  approverName: string;
  amount: number;
  timestamp: string;
}

// Gera uma "assinatura eletrônica" (SHA-256, em hex) que amarra a aprovação
// à cotação, ao aprovador, ao valor e ao instante em que ocorreu — funciona
// como um código de verificação, não como um desenho de assinatura.
//
// amount e timestamp são normalizados antes de entrar no hash: o valor volta
// do Postgres (DECIMAL) como string via PostgREST, e o timestamp volta com
// formatação diferente da que o JS gerou (offset "+00:00", precisão de
// microssegundos). Sem normalizar, recalcular o hash a partir do que foi
// persistido nunca bateria com o hash gravado no momento da aprovação.
export async function generateApprovalHash(input: ApprovalHashInput): Promise<string> {
  // crypto.subtle só existe em contexto seguro (HTTPS ou localhost); num
  // deploy self-hosted acessado por HTTP puro na rede local ele é undefined,
  // e sem essa checagem o erro que aparece é um TypeError opaco de "reading
  // 'digest' of undefined".
  if (!crypto?.subtle) {
    throw new Error('Geração da assinatura eletrônica requer conexão segura (HTTPS).');
  }

  const canonical = [
    input.quotationId,
    input.approverId,
    input.approverName,
    Number(input.amount).toFixed(2),
    new Date(input.timestamp).toISOString(),
  ].join('|');

  const data = new TextEncoder().encode(canonical);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}
