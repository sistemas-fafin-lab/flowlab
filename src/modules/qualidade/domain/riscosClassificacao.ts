// Classificação de risco (Baixo/Médio/Alto/Crítico) — agregação pura (mesmo
// padrão de ocorrenciasIndicadores.ts), sem I/O, sem `new Date()`. Faixas de
// classificação são configuráveis (`qa_parametros`, módulo `riscos`, chave
// `riscos.faixas_classificacao`) — nunca fixas no código — por isso esta
// função recebe as faixas como argumento, resolvidas por quem chama
// (riscos.ts) a partir do banco.

import type { FaixaClassificacaoRisco, NivelClassificacaoRisco } from '../types';

/** Faixas de exemplo do documento do cliente — usadas como retaguarda quando a configuração de `qa_parametros` estiver ausente ou inválida. */
export const FAIXAS_CLASSIFICACAO_PADRAO: readonly FaixaClassificacaoRisco[] = [
  { min: 1, max: 4, nivel: 'baixo' },
  { min: 5, max: 9, nivel: 'medio' },
  { min: 10, max: 16, nivel: 'alto' },
  { min: 17, max: 25, nivel: 'critico' },
];

/** Cobertura 1–25 sem buraco nem sobreposição — mesmo intervalo da matriz 5×5 (1×1 a 5×5). */
export function faixasSaoValidas(faixas: readonly FaixaClassificacaoRisco[]): boolean {
  if (faixas.length === 0) return false;
  const ordenadas = [...faixas].sort((a, b) => a.min - b.min);
  if (ordenadas[0].min !== 1 || ordenadas[ordenadas.length - 1].max !== 25) return false;
  for (const faixa of ordenadas) {
    if (faixa.min > faixa.max) return false;
  }
  for (let i = 1; i < ordenadas.length; i++) {
    if (ordenadas[i].min !== ordenadas[i - 1].max + 1) return false;
  }
  return true;
}

/** Faixas configuradas em `qa_parametros`, com retaguarda para as faixas-padrão quando o JSON estiver ausente/mal formado (requisito: nunca derrubar a classificação). */
export function resolverFaixasClassificacao(valorParametro: unknown): readonly FaixaClassificacaoRisco[] {
  if (Array.isArray(valorParametro)) {
    const faixas = valorParametro as FaixaClassificacaoRisco[];
    const formatoValido = faixas.every(
      (f) => typeof f?.min === 'number' && typeof f?.max === 'number' && typeof f?.nivel === 'string',
    );
    if (formatoValido && faixasSaoValidas(faixas)) return faixas;
  }
  return FAIXAS_CLASSIFICACAO_PADRAO;
}

export function classificarScore(
  score: number | null,
  faixas: readonly FaixaClassificacaoRisco[] = FAIXAS_CLASSIFICACAO_PADRAO,
): NivelClassificacaoRisco | null {
  if (score == null) return null;
  const faixa = faixas.find((f) => score >= f.min && score <= f.max);
  return faixa?.nivel ?? null;
}
