import { formatData } from './formato';

// Resumo da sincronização dos títulos com o apLIS que o "Atualizar do apLIS"
// roda ao abrir (POST /api/faturamento/titulos-sincronizar-aplis).

export interface ResumoSincronizacaoTitulos {
  meta?: { dadoAte: string | null };
  statusMudaram?: number;
  numerosPreenchidos?: number;
  refechamentos?: unknown[];
  lotesAtualizados?: number;
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Texto do aviso: o que mudou e até quando vai o dado do apLIS. */
export function textoSincronizacaoTitulos(r: ResumoSincronizacaoTitulos): string {
  const ate = r.meta?.dadoAte ? ` (dados do apLIS até ${formatData(r.meta.dadoAte)})` : '';
  const status = r.statusMudaram ?? 0;
  const numeros = r.numerosPreenchidos ?? 0;
  const refechamentos = r.refechamentos?.length ?? 0;
  const outros = Math.max(0, (r.lotesAtualizados ?? 0) - status);

  const partes = [
    status > 0 && plural(status, 'status atualizado', 'status atualizados'),
    numeros > 0 && plural(numeros, 'número de nota preenchido', 'números de nota preenchidos'),
    refechamentos > 0 && plural(refechamentos, 'emissão levada ao refechamento', 'emissões levadas ao refechamento'),
    outros > 0 && plural(outros, 'lote com envio, protocolo, NF-e ou responsável atualizado', 'lotes com envio, protocolo, NF-e ou responsável atualizados'),
  ].filter((p): p is string => Boolean(p));

  if (partes.length === 0) return `Títulos já estavam iguais ao apLIS${ate}.`;
  return `Títulos atualizados com o apLIS${ate}: ${partes.join(', ')}.`;
}
