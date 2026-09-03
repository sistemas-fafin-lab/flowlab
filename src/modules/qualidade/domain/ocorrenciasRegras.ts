// src/modules/qualidade/domain/ocorrenciasRegras.ts
// Regra pura de curadoria de Ocorrências. Sem I/O — quem chama
// (ocorrencias.ts, salvarCuradoriaOcorrencia) já traz os dados do form.

export interface CuradoriaOcorrenciaConcluidaInput {
  colaboradorId?: string | null;
  setorErroId?: string | null;
  motivoId?: string | null;
}

/**
 * R5 — Ocorrências não têm seletor manual de status (diferente de
 * Cortesias/IHQ): a curadoria conclui automaticamente quando responsável
 * (colaborador + setor) e motivo estão todos definidos — mesma leitura que
 * `tipoPendencia` (OcorrenciasPage.tsx) já usa para decidir o rótulo de
 * pendência.
 */
export function statusCuradoriaOcorrencia(input: CuradoriaOcorrenciaConcluidaInput): 'concluida' | 'pendente' {
  return input.colaboradorId && input.setorErroId && input.motivoId ? 'concluida' : 'pendente';
}
