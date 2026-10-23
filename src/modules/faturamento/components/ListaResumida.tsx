import React from 'react';

/** O primeiro item e "+N"; a lista inteira no título. */
const ListaResumida: React.FC<{ itens: string[] }> = ({ itens }) => {
  if (itens.length === 0) return <span className="text-gray-400 dark:text-gray-500">—</span>;
  return (
    <div className="max-w-xs" title={itens.join('\n')}>
      <span className="line-clamp-2">{itens[0]}</span>
      {itens.length > 1 && (
        <span className="text-xs text-gray-500 dark:text-gray-400">+{itens.length - 1}</span>
      )}
    </div>
  );
};

export default ListaResumida;
