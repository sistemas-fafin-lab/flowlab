// "Escolher planos…" do botão de ZIP em ContingenciasPage: a pessoa marca quais
// planos baixar e o formato. Um plano só sai como arquivo avulso; dois ou mais, em ZIP.

import { useMutation } from '@tanstack/react-query';
import { Check, Download, Loader2, Minus, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { filtrarPlanosPorBusca, type FormatoExportacao } from '../../domain/exportacaoContingencia.js';
import { baixarPlanoContingencia, baixarPlanosContingenciaZip } from '../../exportacaoContingencia.js';
import type { PlanoContingenciaDTO } from '../../types';
import { BADGE_STATUS_CONTINGENCIA, ROTULO_STATUS_CONTINGENCIA, campoInput } from './rotulos.js';

interface SelecionarPlanosExportacaoModalProps {
  planos: readonly PlanoContingenciaDTO[];
  onFechar: () => void;
}

const FORMATOS: { formato: FormatoExportacao; rotulo: string }[] = [
  { formato: 'pdf', rotulo: 'PDF' },
  { formato: 'docx', rotulo: 'Word (.docx)' },
];

interface CaixaSelecaoProps {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onChange: () => void;
  className?: string;
}

// Checkbox nativo (acessível) sem aparência padrão; o desenho vem do Tailwind + ícone por cima.
function CaixaSelecao({ checked, indeterminate = false, disabled, onChange, className = '' }: CaixaSelecaoProps) {
  return (
    <span className={`relative inline-flex h-[18px] w-[18px] shrink-0 ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        ref={(el) => {
          if (el) el.indeterminate = indeterminate;
        }}
        className="peer h-full w-full cursor-pointer appearance-none rounded-md border-2 border-gray-300 bg-white transition-colors hover:border-blue-400 checked:border-blue-600 checked:bg-blue-600 indeterminate:border-blue-600 indeterminate:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-500 dark:bg-gray-700 dark:ring-offset-gray-800 dark:checked:border-blue-500 dark:checked:bg-blue-500 dark:indeterminate:border-blue-500 dark:indeterminate:bg-blue-500"
      />
      <Check
        className="pointer-events-none absolute inset-0 m-auto h-3 w-3 text-white opacity-0 transition-opacity peer-checked:opacity-100"
        strokeWidth={3.5}
        aria-hidden
      />
      <Minus
        className="pointer-events-none absolute inset-0 m-auto h-3 w-3 text-white opacity-0 transition-opacity peer-indeterminate:opacity-100"
        strokeWidth={3.5}
        aria-hidden
      />
    </span>
  );
}

export function SelecionarPlanosExportacaoModal({ planos, onFechar }: SelecionarPlanosExportacaoModalProps) {
  const [busca, setBusca] = useState('');
  const [selecionados, setSelecionados] = useState<ReadonlySet<string>>(new Set());
  const [formato, setFormato] = useState<FormatoExportacao>('pdf');

  const visiveis = useMemo(() => filtrarPlanosPorBusca(planos, busca), [planos, busca]);
  const marcadosVisiveis = visiveis.filter((p) => selecionados.has(p.id)).length;
  const todosVisiveisMarcados = visiveis.length > 0 && marcadosVisiveis === visiveis.length;

  // Mantém a ordem da listagem, não a ordem dos cliques.
  const escolhidos = planos.filter((p) => selecionados.has(p.id));

  const mutacao = useMutation({
    mutationFn: () =>
      escolhidos.length === 1 ? baixarPlanoContingencia(escolhidos[0], formato) : baixarPlanosContingenciaZip(escolhidos, formato),
    onSuccess: onFechar,
  });

  const alternar = (id: string) =>
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });

  // Marcar/desmarcar age só nos visíveis: a busca não descarta o que já foi marcado.
  const alternarVisiveis = () =>
    setSelecionados((atual) => {
      const novo = new Set(atual);
      for (const p of visiveis) {
        if (todosVisiveisMarcados) novo.delete(p.id);
        else novo.add(p.id);
      }
      return novo;
    });

  const rotuloBotao =
    escolhidos.length === 0
      ? 'Selecione ao menos um plano'
      : escolhidos.length === 1
        ? 'Baixar 1 plano'
        : `Baixar ${escolhidos.length} planos (.zip)`;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-16 sm:pt-20"
      role="dialog"
      aria-modal="true"
      aria-label="Escolher planos para baixar"
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={mutacao.isPending ? undefined : onFechar} />
      <div className="relative flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-200/50 bg-white shadow-2xl dark:border-white/10 dark:bg-gray-800">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-white/10">
          <div>
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Escolher planos para baixar</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              {selecionados.size} de {planos.length} selecionado{selecionados.size === 1 ? '' : 's'}
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            disabled={mutacao.isPending}
            aria-label="Fechar"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-white/5"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="space-y-3 border-b border-gray-100 px-5 py-3 dark:border-white/10">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 mt-0.5 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
            <input
              className={`${campoInput} pl-9`}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por código, evento ou setor"
              aria-label="Buscar planos"
              autoFocus
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <label className="flex cursor-pointer items-center gap-2 text-slate-700 dark:text-slate-300">
              <CaixaSelecao
                checked={todosVisiveisMarcados}
                indeterminate={marcadosVisiveis > 0 && !todosVisiveisMarcados}
                disabled={visiveis.length === 0}
                onChange={alternarVisiveis}
              />
              {busca.trim() ? `Marcar os ${visiveis.length} encontrados` : 'Marcar todos'}
            </label>
            {selecionados.size > 0 && (
              <button
                type="button"
                onClick={() => setSelecionados(new Set())}
                className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                Limpar seleção
              </button>
            )}
          </div>
        </div>

        <ul className="flex-1 divide-y divide-gray-100 overflow-y-auto px-2 dark:divide-white/5">
          {visiveis.map((p) => (
            <li key={p.id}>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-white/5">
                <CaixaSelecao className="mt-0.5" checked={selecionados.has(p.id)} onChange={() => alternar(p.id)} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{p.codigo}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_STATUS_CONTINGENCIA[p.status]}`}>
                      {ROTULO_STATUS_CONTINGENCIA[p.status]}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-slate-400">{p.setorNome ?? '—'}</span>
                  </span>
                  <span className="block text-sm text-gray-600 dark:text-slate-400">{p.evento}</span>
                </span>
              </label>
            </li>
          ))}
          {visiveis.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-gray-500 dark:text-slate-400">Nenhum plano encontrado para “{busca.trim()}”.</li>
          )}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-4 dark:border-white/10">
          <div role="radiogroup" aria-label="Formato" className="flex rounded-xl bg-gray-100 p-1 dark:bg-white/10">
            {FORMATOS.map((f) => (
              <button
                key={f.formato}
                type="button"
                role="radio"
                aria-checked={formato === f.formato}
                onClick={() => setFormato(f.formato)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  formato === f.formato
                    ? 'bg-white text-slate-800 shadow-sm dark:bg-gray-700 dark:text-slate-100'
                    : 'text-gray-600 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {f.rotulo}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={escolhidos.length === 0 || mutacao.isPending}
            onClick={() => mutacao.mutate()}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-blue-500/25 hover:from-blue-600 hover:to-blue-700 disabled:opacity-50"
          >
            {mutacao.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
            {mutacao.isPending ? 'Gerando…' : rotuloBotao}
          </button>
          {mutacao.isError && (
            <p role="alert" className="w-full text-right text-xs text-red-600 dark:text-red-400">
              Não foi possível gerar os arquivos.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
