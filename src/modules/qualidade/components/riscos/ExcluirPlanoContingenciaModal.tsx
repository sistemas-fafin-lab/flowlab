// Confirmação por escrito da exclusão de um plano de contingência: só libera o
// botão quando a pessoa digita o código do plano. Avisa quantos testes saem junto.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { excluirPlanoContingencia, listarTestesContingencia } from '../../contingencias.js';
import { confirmaExclusaoDoPlano } from '../../domain/riscosContingencia.js';
import type { PlanoContingenciaDTO } from '../../types';
import { campoInput } from './rotulos.js';

interface ExcluirPlanoContingenciaModalProps {
  plano: PlanoContingenciaDTO;
  onCancelar: () => void;
  onExcluido: () => void;
}

function avisoDosTestes(total: number | undefined): string {
  if (total === undefined) return 'O histórico de testes do plano também será excluído.';
  if (total === 0) return 'O plano não tem testes registrados.';
  return total === 1 ? 'O teste registrado também será excluído.' : `Os ${total} testes registrados também serão excluídos.`;
}

export function ExcluirPlanoContingenciaModal({ plano, onCancelar, onExcluido }: ExcluirPlanoContingenciaModalProps) {
  const queryClient = useQueryClient();
  const [digitado, setDigitado] = useState('');
  const confirmado = confirmaExclusaoDoPlano(digitado, plano.codigo);

  // Mesma chave do histórico no drawer: normalmente já está em cache.
  const { data: testes } = useQuery({
    queryKey: ['plano-contingencia-testes', plano.id],
    queryFn: () => listarTestesContingencia(plano.id),
  });

  const mutacao = useMutation({
    mutationFn: () => excluirPlanoContingencia(plano.id),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: ['plano-contingencia', plano.id] });
      queryClient.removeQueries({ queryKey: ['plano-contingencia-testes', plano.id] });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['contingencias'] }),
        queryClient.invalidateQueries({ queryKey: ['painel-riscos'] }),
      ]);
      onExcluido();
    },
  });

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-20 sm:pt-24"
      role="dialog"
      aria-modal="true"
      aria-label="Excluir plano de contingência"
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={mutacao.isPending ? undefined : onCancelar} />
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200/50 bg-white shadow-2xl dark:border-white/10 dark:bg-gray-800">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-white/10">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" aria-hidden />
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Excluir plano de contingência</h2>
          </div>
          <button
            type="button"
            onClick={onCancelar}
            disabled={mutacao.isPending}
            aria-label="Fechar"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-white/5"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <form
          className="space-y-4 px-5 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (confirmado && !mutacao.isPending) mutacao.mutate();
          }}
        >
          <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
            <p>
              O plano <strong>{plano.codigo}</strong> — {plano.evento} será excluído. {avisoDosTestes(testes?.length)}
            </p>
            <p className="font-medium text-red-600 dark:text-red-400">Esta ação não pode ser desfeita.</p>
          </div>

          <label className="block text-sm text-slate-700 dark:text-slate-300">
            Para confirmar, digite o código do plano: <strong className="select-all">{plano.codigo}</strong>
            <input
              className={campoInput}
              value={digitado}
              onChange={(e) => setDigitado(e.target.value)}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              aria-invalid={digitado.trim() !== '' && !confirmado}
            />
          </label>

          {mutacao.isError && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400">
              Não foi possível excluir o plano. {mutacao.error instanceof Error ? mutacao.error.message : ''}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancelar}
              disabled={mutacao.isPending}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!confirmado || mutacao.isPending}
              className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {mutacao.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
              Excluir definitivamente
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
