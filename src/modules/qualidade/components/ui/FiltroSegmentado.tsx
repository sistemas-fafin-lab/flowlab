import type { Tom } from './tons.js';
import { TOM } from './tons.js';

export interface OpcaoSegmento<K extends string> {
  chave: K;
  rotulo: string;
  quantidade: number;
  /** Sem tom = opção neutra ("Todas"). */
  tom?: Tom;
}

/** Controle segmentado compacto (cabeçalho das worklists) — cada opção mostra a contagem e, quando tem tom, um ponto colorido. */
export function FiltroSegmentado<K extends string>({
  opcoes,
  valor,
  onMudar,
  rotuloAcessivel,
}: {
  opcoes: OpcaoSegmento<K>[];
  valor: K;
  onMudar: (chave: K) => void;
  rotuloAcessivel: string;
}) {
  return (
    <div
      role="group"
      aria-label={rotuloAcessivel}
      className="flex gap-0.5 rounded-xl border border-gray-200 bg-gray-100 p-[3px] dark:border-white/[.07] dark:bg-white/[.04]"
    >
      {opcoes.map((opcao) => {
        const ativo = opcao.chave === valor;
        const cores = !ativo
          ? 'border-transparent text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200'
          : opcao.tom
            ? TOM[opcao.tom].pilula
            : 'border-gray-300 bg-white text-gray-900 dark:border-white/[.12] dark:bg-white/[.08] dark:text-slate-100';
        return (
          <button
            key={opcao.chave}
            type="button"
            aria-pressed={ativo}
            onClick={() => onMudar(opcao.chave)}
            className={`flex items-center gap-[7px] whitespace-nowrap rounded-[9px] border px-[11px] py-[5px] text-xs font-medium transition-colors ${cores}`}
          >
            {opcao.tom && <span className={`h-[7px] w-[7px] rounded-full ${TOM[opcao.tom].solido}`} aria-hidden />}
            <span>{opcao.rotulo}</span>
            <span className="font-bold tabular-nums">{opcao.quantidade}</span>
          </button>
        );
      })}
    </div>
  );
}
