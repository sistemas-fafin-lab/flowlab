import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import Select from '../../../components/Select';

/**
 * Escolha do convênio da Conferência de cobertura. A busca do Select ignora acento e
 * maiúsculas — a mesma normalização da busca de exames (selectBusca.ts).
 */
const SeletorConvenio: React.FC<{
  /** nomes já em ordem (conveniosDaLista) */
  convenios: readonly string[];
  convenio: string | null;
  onEscolher: (convenio: string | null) => void;
}> = ({ convenios, convenio, onEscolher }) => {
  const opcoes = useMemo(() => convenios.map((c) => ({ value: c, label: c })), [convenios]);
  return (
    <div className="flex items-center gap-2">
      <Select
        ariaLabel="Conferir cobertura do convênio"
        value={convenio ?? ''}
        onChange={(valor) => onEscolher(valor || null)}
        options={opcoes}
        placeholder="Conferir cobertura do convênio…"
        searchable
        searchPlaceholder="Buscar convênio…"
        emptyText="Nenhum convênio encontrado."
        controlClass="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/80 text-sm text-slate-800 dark:text-gray-100"
        wrapperClass="flex-1 min-w-0"
      />
      {convenio && (
        <button
          type="button"
          aria-label="Limpar convênio"
          title="Limpar convênio"
          onClick={() => onEscolher(null)}
          className="shrink-0 p-2 rounded-xl text-gray-400 border border-gray-200 hover:text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default SeletorConvenio;
