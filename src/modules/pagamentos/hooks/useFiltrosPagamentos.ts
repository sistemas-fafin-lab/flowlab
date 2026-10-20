import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  filtrosDeParams,
  filtrosPadrao,
  filtrosParaParams,
  limparFiltros,
  type FiltrosPagamentos,
} from '../domain/filtrosPagamentos';

/**
 * Filtros da lista de pagamentos, guardados no endereço da página: sobrevivem ao F5 e vão
 * junto quando alguém manda o link. `replace` para cada tecla da busca não virar uma
 * entrada no histórico do navegador.
 */
export function useFiltrosPagamentos(aprova: boolean) {
  const [params, setParams] = useSearchParams();
  const padrao = useMemo(() => filtrosPadrao(aprova), [aprova]);
  const filtros = useMemo(() => filtrosDeParams(params, padrao), [params, padrao]);

  const alterar = useCallback(
    (patch: Partial<FiltrosPagamentos>) =>
      setParams((atuais) => filtrosParaParams({ ...filtrosDeParams(atuais, padrao), ...patch }, padrao), { replace: true }),
    [setParams, padrao],
  );

  const limpar = useCallback(
    () => setParams((atuais) => filtrosParaParams(limparFiltros(filtrosDeParams(atuais, padrao), padrao), padrao), { replace: true }),
    [setParams, padrao],
  );

  return { filtros, padrao, alterar, limpar };
}
