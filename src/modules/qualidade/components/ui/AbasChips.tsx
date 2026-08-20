import type { CorTabela } from './TabelaExpansivel.js';
import { ACCENT_TABELA } from './TabelaExpansivel.js';

export interface AbaChip<T extends string> {
  valor: T;
  rotulo: string;
  contagem: number;
}

interface AbasChipsProps<T extends string> {
  abas: AbaChip<T>[];
  atual: T;
  onMudar: (valor: T) => void;
  cor: CorTabela;
}

/**
 * Seletor de aba estilizado como cards/pills (glass em repouso, gradiente
 * sólido quando ativo) — substitui a aba sublinhada tradicional para seguir
 * o mesmo padrão visual dos chips de legenda usados nos cards de indicadores.
 */
export function AbasChips<T extends string>({ abas, atual, onMudar, cor }: AbasChipsProps<T>) {
  const accent = ACCENT_TABELA[cor];

  return (
    <div className="flex flex-wrap gap-2">
      {abas.map((aba) => {
        const ativo = aba.valor === atual;
        return (
          <button
            key={aba.valor}
            type="button"
            onClick={() => onMudar(aba.valor)}
            className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
              ativo
                ? `${accent.gradiente} text-white shadow-md ${accent.sombra}`
                : 'glass-surface text-gray-600 hover:bg-white/90 dark:text-slate-300 dark:hover:bg-white/10'
            }`}
          >
            {aba.rotulo} ({aba.contagem})
          </button>
        );
      })}
    </div>
  );
}
