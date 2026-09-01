// Seção "Riscos vinculados" do detalhe de 1 ocorrência — riscos vinculados
// (N:N, livre) mesclados com o(s) risco(s) nascido(s) desta ocorrência como
// origem (1:N, imutável), sem duplicar.
// (.scratch/qualidade-riscos-indicadores/issues/05-riscos-correlacao-ocorrencias.md)

import { useQuery } from '@tanstack/react-query';
import { buscarRiscosCorrelacionados, buscarRiscosParaVincular, desvincularRiscoOcorrencia, vincularRiscoOcorrencia } from '../../correlacaoRiscosOcorrencias.js';
import { classificarScore } from '../../domain/riscosClassificacao.js';
import { buscarFaixasClassificacao } from '../../riscos.js';
import { BADGE_NIVEL, ROTULO_NIVEL } from '../riscos/rotulos.js';
import { SecaoCorrelacao } from '../ui/SecaoCorrelacao.js';

interface RiscosVinculadosOcorrenciaProps {
  ocorrenciaId: string;
  canManage: boolean;
}

export function RiscosVinculadosOcorrencia({ ocorrenciaId, canManage }: RiscosVinculadosOcorrenciaProps) {
  const { data: faixas } = useQuery({ queryKey: ['riscos-faixas'], queryFn: buscarFaixasClassificacao });

  return (
    <SecaoCorrelacao
      ariaLabel="Riscos vinculados"
      tituloSecao="Riscos vinculados"
      rotuloBotaoVincular="Vincular risco"
      placeholderBusca="Buscar por risco ou processo…"
      mensagemVazio="Nenhum risco vinculado ainda."
      canManage={canManage}
      queryKey={['ocorrencia-riscos-correlacionados', ocorrenciaId]}
      queryFn={() => buscarRiscosCorrelacionados(ocorrenciaId)}
      renderItem={(r) => (
        <>
          <p className="truncate text-slate-700 dark:text-slate-300">{r.riscoIdentificado}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500">{r.processo}</p>
        </>
      )}
      renderBadgeExtra={(r) => {
        const nivel = r.score != null && faixas ? classificarScore(r.score, faixas) : null;
        return nivel ? <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_NIVEL[nivel]}`}>{ROTULO_NIVEL[nivel]}</span> : null;
      }}
      candidatosQueryKeyPrefix="riscos-para-vincular"
      buscarCandidatos={buscarRiscosParaVincular}
      renderCandidato={(c) => (
        <>
          <span className="block truncate text-slate-700 dark:text-slate-300">{c.riscoIdentificado}</span>
          <span className="text-gray-400 dark:text-slate-500">{c.processo}</span>
        </>
      )}
      vincular={(riscoId) => vincularRiscoOcorrencia(riscoId, ocorrenciaId)}
      desvincular={desvincularRiscoOcorrencia}
    />
  );
}
