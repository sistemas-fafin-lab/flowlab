// Seção "Correlação" do detalhe de 1 risco — ocorrências vinculadas (N:N,
// livre) mescladas com a ocorrência de origem (1:N, imutável), sem duplicar.
// (.scratch/qualidade-riscos-indicadores/issues/05-riscos-correlacao-ocorrencias.md)

import { buscarOcorrenciasCorrelacionadas, buscarOcorrenciasParaVincular, desvincularRiscoOcorrencia, vincularRiscoOcorrencia } from '../../correlacaoRiscosOcorrencias.js';
import { SecaoCorrelacao } from '../ui/SecaoCorrelacao.js';
import { formatarDataCurta } from './rotulos.js';

interface OcorrenciasCorrelacionadasRiscoProps {
  riscoId: string;
  ocorrenciaOrigemId: string | null;
  canManage: boolean;
}

export function OcorrenciasCorrelacionadasRisco({ riscoId, ocorrenciaOrigemId, canManage }: OcorrenciasCorrelacionadasRiscoProps) {
  return (
    <SecaoCorrelacao
      ariaLabel="Correlação com ocorrências"
      tituloSecao="Ocorrências relacionadas"
      rotuloBotaoVincular="Vincular ocorrência"
      placeholderBusca="Buscar por descrição ou requisição…"
      mensagemVazio="Nenhuma ocorrência relacionada ainda."
      canManage={canManage}
      queryKey={['risco-ocorrencias-correlacionadas', riscoId]}
      queryFn={() => buscarOcorrenciasCorrelacionadas({ id: riscoId, ocorrenciaOrigemId })}
      renderItem={(o) => (
        <>
          <p className="truncate text-slate-700 dark:text-slate-300">{o.resumo || '—'}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500">{formatarDataCurta(o.dtaOcorrencia)}</p>
        </>
      )}
      candidatosQueryKeyPrefix="ocorrencias-para-vincular"
      buscarCandidatos={buscarOcorrenciasParaVincular}
      renderCandidato={(c) => (
        <>
          <span className="block truncate text-slate-700 dark:text-slate-300">{c.resumo || '—'}</span>
          <span className="text-gray-400 dark:text-slate-500">
            {formatarDataCurta(c.dtaOcorrencia)}
            {c.codRequisicao ? ` · Req. ${c.codRequisicao}` : ''}
          </span>
        </>
      )}
      vincular={(ocorrenciaId) => vincularRiscoOcorrencia(riscoId, ocorrenciaId)}
      desvincular={desvincularRiscoOcorrencia}
    />
  );
}
