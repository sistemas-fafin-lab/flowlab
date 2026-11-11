import React from 'react';
import type { ConveniosDaFonte } from '../domain/cobertura';

const PILULA = 'px-2 py-0.5 text-[11px] font-medium rounded-full';
const PILULA_NORMAL = `${PILULA} bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300`;

/** Os convênios de um exame como pílulas: na busca ("Convênios (n)"). */
const ListaConvenios: React.FC<{
  convenios: readonly string[];
  /** convênio em destaque (o que casa com a busca) */
  destacar?: (convenio: string) => boolean;
}> = ({ convenios, destacar }) => (
  <div className="flex flex-wrap gap-1 mt-1.5">
    {convenios.map((convenio) => (
      <span
        key={convenio}
        className={
          destacar?.(convenio)
            ? `${PILULA} bg-blue-600 text-white ring-2 ring-blue-300 dark:bg-blue-500 dark:ring-blue-400/50`
            : PILULA_NORMAL
        }
      >
        {convenio}
      </span>
    ))}
  </div>
);

/**
 * Os convênios que atendem um não coberto da leitura, uma linha por fonte pagadora com
 * as pílulas dos convênios dela. Fonte com um convênio só, de mesmo nome, vira só a pílula.
 */
export const ConveniosPorFonte: React.FC<{ grupos: readonly ConveniosDaFonte[] }> = ({ grupos }) => (
  <ul className="mt-1.5 space-y-1">
    {grupos.map(({ fonte, convenios }) => (
      <li key={fonte} className="flex flex-wrap items-center gap-1">
        {convenios.length === 1 && convenios[0] === fonte ? (
          <span className={PILULA_NORMAL}>{fonte}</span>
        ) : (
          <>
            <span className="mr-0.5 text-[11px] font-semibold text-gray-600 dark:text-gray-300">{fonte}:</span>
            {convenios.map((convenio) => (
              <span key={convenio} className={PILULA_NORMAL}>
                {convenio}
              </span>
            ))}
          </>
        )}
      </li>
    ))}
  </ul>
);

export default ListaConvenios;
