import { useEffect, useMemo, useState } from 'react';
import { evaService, SEMANAS_TENDENCIA } from '../services/evaService';
import { seriePorDia, seriePorSemana, type FotoDia, type Resolvido } from '../domain/tendencias';
import type { Dia } from '../domain/datas';

/** Dias úteis no gráfico de atrasados e fila. */
export const DIAS_TENDENCIA = 30;

/** Tendências do Início (D42): lê uma vez por dia carregado; falha sozinha (o cartão diz). */
export function useTendencias(hoje: Dia | null) {
  const [dados, setDados] = useState<{ fotos: FotoDia[]; resolvidos: Resolvido[] } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!hoje) return undefined;
    let vivo = true;
    evaService.lerTendencias(hoje)
      .then((d) => { if (vivo) { setDados(d); setErro(null); } })
      .catch((e) => { if (vivo) setErro(e instanceof Error ? e.message : 'Não consegui ler as tendências.'); });
    return () => { vivo = false; };
  }, [hoje]);

  const semanas = useMemo(() => (dados && hoje ? seriePorSemana(dados.resolvidos, hoje, SEMANAS_TENDENCIA) : null), [dados, hoje]);
  const dias = useMemo(() => (dados && hoje ? seriePorDia(dados.fotos, hoje, DIAS_TENDENCIA) : null), [dados, hoje]);
  return { semanas, dias, erro, carregando: !dados && !erro };
}
