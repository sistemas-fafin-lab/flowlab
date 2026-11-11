import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import Select from '../../../components/Select';
import type { EscolhaCobertura } from '../domain/cobertura';

const CONTROLE =
  'w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/80 text-sm text-slate-800 dark:text-gray-100';
const TODOS = '';
const SEM_FONTE = '\u0000sem-fonte';

/**
 * Escolha da Conferência de cobertura: a fonte pagadora e, opcionalmente, um convênio
 * dela. A busca do Select ignora acento e maiúsculas — a mesma normalização da busca de
 * exames (selectBusca.ts). Trocar a fonte limpa o convênio.
 */
const SeletorConvenio: React.FC<{
  /** fontes já em ordem (fontesDaLista) */
  fontes: readonly string[];
  /** convênios da fonte escolhida, já em ordem (conveniosDaFonte) */
  convenios: readonly string[];
  escolha: EscolhaCobertura | null;
  onEscolher: (escolha: EscolhaCobertura | null) => void;
  /** um campo embaixo do outro (coluna estreita do carrinho); sem ele, lado a lado a partir de sm */
  empilhado?: boolean;
}> = ({ fontes, convenios, escolha, onEscolher, empilhado = false }) => {
  const opcoesFonte = useMemo(() => fontes.map((f) => ({ value: f, label: f })), [fontes]);
  const opcoesConvenio = useMemo(
    () => [{ value: TODOS, label: 'Todos os convênios da fonte' }, ...convenios.map((c) => ({ value: c, label: c }))],
    [convenios],
  );
  return (
    <div className={`flex flex-col gap-2 ${empilhado ? '' : 'sm:flex-row sm:items-center'}`}>
      <Select
        ariaLabel="Fonte pagadora"
        value={escolha?.fonte ?? ''}
        onChange={(fonte) => onEscolher(fonte ? { fonte, convenio: null } : null)}
        options={opcoesFonte}
        placeholder="Conferir cobertura da fonte pagadora…"
        searchable
        searchPlaceholder="Buscar fonte pagadora…"
        emptyText="Nenhuma fonte pagadora encontrada."
        controlClass={CONTROLE}
        wrapperClass="flex-1 min-w-0"
      />
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Select
          ariaLabel="Convênio"
          // Sem fonte, nenhum valor casa com uma opção e o Select mostra o placeholder.
          value={escolha ? (escolha.convenio ?? TODOS) : SEM_FONTE}
          onChange={(convenio) => escolha && onEscolher({ fonte: escolha.fonte, convenio: convenio || null })}
          options={opcoesConvenio}
          placeholder="Convênio (opcional)"
          searchable
          searchPlaceholder="Buscar convênio…"
          emptyText="Nenhum convênio encontrado."
          disabled={!escolha}
          controlClass={CONTROLE}
          wrapperClass="flex-1 min-w-0"
        />
        {escolha && (
          <button
            type="button"
            aria-label="Limpar fonte pagadora e convênio"
            title="Limpar fonte pagadora e convênio"
            onClick={() => onEscolher(null)}
            className="shrink-0 p-2 rounded-xl text-gray-400 border border-gray-200 hover:text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default SeletorConvenio;
