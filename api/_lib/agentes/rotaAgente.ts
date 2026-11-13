// api/_lib/agentes/rotaAgente.ts
// O começo comum de toda rota HTTP de agente externo (D8):
// método → chave → permissão no manifesto. Depois vêm os parâmetros, a cota +
// auditoria e a operação, que são de cada rota. Spec: .scratch/lab-brain-chamados/spec.md.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { agentePode, type Agente, type Operacao } from './permissoes.js';

export interface PortaDoAgente {
  metodo: 'GET' | 'POST';
  /** Confere a chave Bearer da rota; lança se a variável de ambiente faltar. */
  chaveValida: (req: VercelRequest) => boolean;
  agente: Agente;
  operacao: Operacao;
  /** Prefixo dos logs, ex.: `[integracoes/lab-brain-chamado-criar]`. */
  log: string;
}

/**
 * Responde 405, 503 (chave sem configuração no ambiente), 401 ou 403 e devolve false;
 * devolve true quando a rota pode seguir. Nenhuma recusa daqui consome cota.
 */
export function autorizarAgente(req: VercelRequest, res: VercelResponse, porta: PortaDoAgente): boolean {
  if (req.method !== porta.metodo) {
    res.setHeader('Allow', porta.metodo);
    res.status(405).json({ success: false, error: 'Método não permitido' });
    return false;
  }

  let autorizado: boolean;
  try {
    autorizado = porta.chaveValida(req);
  } catch (err) {
    console.error(`${porta.log} erro de configuração:`, describeError(err));
    // 503 e não 500: a rota está fechada por falta de configuração, não quebrada.
    res.status(503).json({ success: false, error: 'Integração não configurada' });
    return false;
  }
  if (!autorizado) {
    res.status(401).json({ success: false, error: 'Não autorizado' });
    return false;
  }

  if (!agentePode(porta.agente, porta.operacao)) {
    res.status(403).json({ success: false, error: 'Operação não permitida para este agente' });
    return false;
  }
  return true;
}

/** Responde 429 com Retry-After quando a cota acabou e devolve true; senão false. */
export function recusarSemCota(
  res: VercelResponse,
  cota: { permitido: boolean; retryAfter: number },
  limitePorMinuto: number,
): boolean {
  if (cota.permitido) return false;
  res.setHeader('Retry-After', String(cota.retryAfter));
  res.status(429).json({ success: false, error: `Limite de ${limitePorMinuto} chamadas por minuto atingido.` });
  return true;
}
