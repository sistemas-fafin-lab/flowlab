export interface ItemTopLista {
  id: string;
  rotulo: string;
  valor: string;
}

interface TopListaProps {
  itens: ItemTopLista[];
  cor?: { light: string; dark: string };
  tema: 'light' | 'dark';
}

const COR_PADRAO = { light: '#2a78d6', dark: '#3987e5' };

/**
 * Lista ranqueada (badge numerado + rótulo + valor). Sem sparkline: o dado
 * disponível é um total do período, não uma série temporal por item — uma
 * tendência inventada aqui violaria "não inventar dado".
 */
export function TopLista({ itens, cor = COR_PADRAO, tema }: TopListaProps) {
  const corAtual = tema === 'dark' ? cor.dark : cor.light;

  if (itens.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-slate-400">Sem dados no período.</p>;
  }

  return (
    <ol className="space-y-1">
      {itens.map((item, indice) => (
        <li key={item.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-white/5">
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: corAtual }}
          >
            {indice + 1}
          </span>
          <span className="flex-1 truncate text-sm text-slate-700 dark:text-slate-300" title={item.rotulo}>
            {item.rotulo}
          </span>
          <span className="shrink-0 text-sm font-semibold text-slate-900 dark:text-white">{item.valor}</span>
        </li>
      ))}
    </ol>
  );
}
