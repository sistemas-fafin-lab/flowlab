// Regras puras de Cortesias (R1-R5) — portadas verbatim de
// apps/backend/src/modules/cortesias/rules/{situacaoPrazo,conferenciaValores,calcularEstadoCota}.ts
// para rodar no cliente agora que a leitura de indicadores/cotas é
// supabase-js direto (ver design.md D6). Sem I/O, sem `new Date()` (P4).

import type { EstadoCota, SituacaoPrazoCortesia } from '../types';

function paraDataUtc(dataIso: string): number {
  const [ano, mes, dia] = dataIso.split('-').map(Number);
  return Date.UTC(ano!, mes! - 1, dia!);
}

function contarDiasUteis(inicioMs: number, fimMs: number): number {
  let dias = 0;
  for (let atual = inicioMs; atual < fimMs; atual += 86_400_000) {
    const diaDaSemana = new Date(atual + 86_400_000).getUTCDay();
    if (diaDaSemana !== 0 && diaDaSemana !== 6) dias++;
  }
  return dias;
}

/** Dias entre `dataSolicitacao` e `dataAutorizacao` — `null` sem autorização ainda. */
export function calcularDiasAteAutorizacao(
  dataSolicitacao: string,
  dataAutorizacao: string | null,
  considerarDiasUteis: boolean,
): number | null {
  if (!dataAutorizacao) return null;
  const inicioMs = paraDataUtc(dataSolicitacao);
  const fimMs = paraDataUtc(dataAutorizacao);
  return considerarDiasUteis ? contarDiasUteis(inicioMs, fimMs) : Math.round((fimMs - inicioMs) / 86_400_000);
}

/** Dias em aberto entre `dataSolicitacao` e `hoje` (explícito — P4, sem `new Date()` aqui) — usado só quando ainda não há autorização. */
export function calcularDiasEmAberto(dataSolicitacao: string, hoje: string, considerarDiasUteis: boolean): number {
  const inicioMs = paraDataUtc(dataSolicitacao);
  const fimMs = paraDataUtc(hoje);
  return considerarDiasUteis ? contarDiasUteis(inicioMs, fimMs) : Math.round((fimMs - inicioMs) / 86_400_000);
}

/**
 * R1 — sem autorização é estado próprio, nunca vira "fora do prazo" (esse só
 * existe para quem já foi autorizado, mas depois do prazo). Só depois que os
 * dias em aberto (da solicitação até `hoje`) passam do prazo de aprovação é
 * que uma pendência sem autorização vira "não autorizada" — timeout, pedido
 * explícito do usuário (2026-08-20): esperar autorização indefinidamente não
 * é uma opção, então o vencimento do prazo é tratado como negativa.
 */
export function calcularSituacaoPrazo(
  diasAteAutorizacao: number | null,
  dataAutorizacao: string | null,
  prazoAprovacaoDias: number,
  diasEmAberto: number | null,
): SituacaoPrazoCortesia {
  if (!dataAutorizacao || diasAteAutorizacao === null) {
    return diasEmAberto !== null && diasEmAberto > prazoAprovacaoDias ? 'nao_autorizada' : 'sem_autorizacao';
  }
  return diasAteAutorizacao <= prazoAprovacaoDias ? 'dentro_prazo' : 'fora_prazo';
}

/** R2 — aprovada fora do prazo é erro; nunca inclui "sem_autorizacao" nem "nao_autorizada" (essa nunca foi aprovada). */
export function calcularAprovadaForaDoPrazo(situacaoPrazo: SituacaoPrazoCortesia): boolean {
  return situacaoPrazo === 'fora_prazo';
}

/** R3 — divergência entre particular e cobrado+concedido, acima da tolerância. */
export function calcularDivergenciaValores(
  valorParticular: number | null,
  valorCobrado: number | null,
  valorConcedido: number | null,
  toleranciaDivergenciaValor: number,
): boolean {
  if (valorParticular === null) return false;
  const somaCobradoConcedido = (valorCobrado ?? 0) + (valorConcedido ?? 0);
  return Math.abs(valorParticular - somaCobradoConcedido) > toleranciaDivergenciaValor;
}

/** R4 — `valorConcedido` nulo é alerta de cadastro, nunca vira 0. */
export function calcularPrecoCortesiaNaoCadastrado(valorConcedido: number | null): boolean {
  return valorConcedido === null;
}

/** R5 — realizado < cota: normal; = cota: atenção; > cota: excedido. Sempre recalculada na leitura. */
export function calcularEstadoCota(cotaMensal: number, realizado: number): EstadoCota {
  if (realizado < cotaMensal) return 'normal';
  if (realizado === cotaMensal) return 'atencao';
  return 'excedido';
}
