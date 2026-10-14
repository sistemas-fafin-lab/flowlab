// Contrato comum dos provedores de IA da EVA (plano §9.1). Os provedores nunca
// lançam exceção: devolvem a tentativa com o resultado classificado.

export type ProvedorIA = 'claude' | 'gemini';
export type Esforco = 'low' | 'medium' | 'high';
export type Finalidade = 'analise_reuniao' | 'resposta_whatsapp' | 'chat';

/** Mesmos valores do CHECK de ti_agente_chamadas_ia.resultado. */
export type ResultadoChamada = 'ok' | 'erro' | 'configuracao' | 'recusa' | 'cortada' | 'schema_invalido';

export interface PedidoIA {
  /** Instruções fixas (pt-BR). Vão primeiro: são a parte que o cache reaproveita. */
  instrucoes: string;
  /** Contexto estável entre chamadas próximas (cards, projetos…). Cacheado junto. */
  contexto?: string;
  /** O que muda a cada chamada: a reunião, a pergunta, a mensagem recebida. */
  conteudo: string;
  /** JSON Schema da saída (já convertido do zod). */
  schema: Record<string, unknown>;
  esforco: Esforco;
}

export interface TentativaIA {
  provedor: ProvedorIA;
  modelo: string;
  resultado: ResultadoChamada;
  /** Texto bruto da resposta (JSON esperado) quando a chamada voltou. */
  texto?: string;
  erro?: string;
  tokensEntrada?: number;
  tokensSaida?: number;
  duracaoMs: number;
}

export interface ClienteIA {
  provedor: ProvedorIA;
  modelo: string;
  chamar(pedido: PedidoIA): Promise<TentativaIA>;
}

/** Tira cerca de markdown (```json … ```) que alguns modelos põem apesar da instrução. */
export function limparJson(texto: string): string {
  const t = texto.trim();
  if (!t.startsWith('```')) return t;
  const linhas = t.split('\n');
  const fim = linhas[linhas.length - 1].trim().startsWith('```') ? -1 : linhas.length;
  return linhas.slice(1, fim).join('\n').trim();
}

export function mensagemDeErro(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.length > 300 ? `${msg.slice(0, 300)}…` : msg;
}
