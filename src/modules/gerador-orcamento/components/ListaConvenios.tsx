import React from 'react';

/** Os convênios de um exame como pílulas: na busca ("Convênios (n)") e nos não cobertos da leitura. */
const ListaConvenios: React.FC<{
  convenios: readonly string[];
  /** convênio em destaque (o que casa com a busca) */
  destacar?: (convenio: string) => boolean;
}> = ({ convenios, destacar }) => (
  <div className="flex flex-wrap gap-1 mt-1.5">
    {convenios.map((convenio) => (
      <span
        key={convenio}
        className={`px-2 py-0.5 text-[11px] font-medium rounded-full ${
          destacar?.(convenio)
            ? 'bg-blue-600 text-white ring-2 ring-blue-300 dark:bg-blue-500 dark:ring-blue-400/50'
            : 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
        }`}
      >
        {convenio}
      </span>
    ))}
  </div>
);

export default ListaConvenios;
