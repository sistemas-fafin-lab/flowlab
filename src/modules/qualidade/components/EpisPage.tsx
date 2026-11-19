// Aba EPIs da Qualidade: escolhe o mês, vê as áreas com EPI entregue (e o aviso de pedidos
// de EPI do mês ainda não entregues) e gera o PDF do Relatório mensal de EPI de cada área,
// calculado na hora (.scratch/epi-relatorio-mensal/spec.md, histórias 16–32).

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, FileDown, HardHat } from 'lucide-react';
import { useMemo, useState } from 'react';
import { anoAtual } from '../anoAtual.js';
import { listarAreasEpiDoMes, montarLinhasEpi, type SituacaoAreaEpi } from '../domain/epiRelatorioMensal.js';
import { mesAnoBR, montarPdfRelatorioEpi, nomeArquivoRelatorioEpi } from '../domain/pdfRelatorioEpi.js';
import { buscarDadosRelatorioEpi } from '../epis.js';
import { ErrorState } from './ui/ErrorState.js';
import { SeletorPeriodoPorMes } from './ui/SeletorPeriodoPorMes.js';
import { Skeleton } from './ui/Skeleton.js';
import { Pilula, TEXTO_FRACO, type Tom } from './ui/tons.js';

const SITUACAO: Record<SituacaoAreaEpi, { rotulo: string; tom: Tom }> = {
  aberto: { rotulo: 'Aberto', tom: 'blue' },
  fechado: { rotulo: 'Fechado', tom: 'amber' },
  assinado: { rotulo: 'Assinado', tom: 'emerald' },
};

const TODAS = '';

const campoFiltro = 'glass-field rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200';

const plural = (n: number, singular: string, varios: string) => `${n} ${n === 1 ? singular : varios}`;

export function Epis() {
  const [periodo, setPeriodo] = useState({ inicio: '', fim: '' });
  const [filtroArea, setFiltroArea] = useState(TODAS);
  const mes = periodo.inicio && periodo.fim ? periodo.inicio.slice(0, 7) : '';

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['qualidade-epis', mes],
    queryFn: () => buscarDadosRelatorioEpi(mes),
    enabled: Boolean(mes),
  });

  const areas = useMemo(() => (data ? listarAreasEpiDoMes(data, mes) : []), [data, mes]);
  const visiveis = filtroArea === TODAS ? areas : areas.filter((a) => a.area === filtroArea);

  function gerarPdf(area: string) {
    if (!data) return;
    const linhas = montarLinhasEpi(data, { area, mes });
    montarPdfRelatorioEpi({ area, mes, linhas }).save(nomeArquivoRelatorioEpi(area, mes));
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">EPIs</h1>
        <p className="text-sm text-gray-600 dark:text-slate-400">
          Relatório mensal de EPI por área: uma linha por EPI entregue em solicitação de materiais, com uma assinatura
          por linha, para imprimir e colher as assinaturas.
        </p>
      </div>

      <SeletorPeriodoPorMes
        inicio={periodo.inicio}
        fim={periodo.fim}
        anoPadrao={anoAtual()}
        onMudar={(novo) => {
          setPeriodo(novo);
          setFiltroArea(TODAS);
        }}
      />

      {!mes && <p className="text-sm text-gray-500 dark:text-slate-400">Selecione o mês para ver as áreas.</p>}

      {mes && isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-14 w-full" />
          ))}
        </div>
      )}

      {mes && isError && (
        <ErrorState
          titulo="Não foi possível carregar os EPIs do mês"
          descricao="Verifique sua conexão ou tente novamente."
          aoTentarNovamente={() => refetch()}
        />
      )}

      {mes && data && areas.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-slate-400">Nenhum EPI entregue nem pedido em {mesAnoBR(mes)}.</p>
      )}

      {mes && data && areas.length > 0 && (
        <div className="space-y-3">
          <label className="flex max-w-xs flex-col gap-1 text-xs font-medium text-gray-500 dark:text-slate-400">
            Área
            <select className={campoFiltro} value={filtroArea} onChange={(e) => setFiltroArea(e.target.value)}>
              <option value={TODAS}>Todas as áreas</option>
              {areas.map((a) => (
                <option key={a.area} value={a.area}>
                  {a.area}
                </option>
              ))}
            </select>
          </label>

          <ul className="space-y-2">
            {visiveis.map((a) => (
              <li
                key={a.area}
                className="glass-surface flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <HardHat className="h-5 w-5 shrink-0 text-blue-500" aria-hidden />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{a.area}</span>
                      <Pilula tom={SITUACAO[a.situacao].tom}>{SITUACAO[a.situacao].rotulo}</Pilula>
                    </div>
                    <div className={TEXTO_FRACO}>{plural(a.linhas, 'EPI entregue', 'EPIs entregues')}</div>
                    {a.pendentes > 0 && (
                      <div className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                        <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                        {plural(a.pendentes, 'pedido de EPI do mês ainda não entregue', 'pedidos de EPI do mês ainda não entregues')}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => gerarPdf(a.area)}
                  disabled={a.linhas === 0}
                  title={a.linhas === 0 ? 'Nenhum EPI entregue nesta área no mês' : undefined}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-blue-500/25 transition-all duration-200 hover:from-blue-600 hover:to-blue-700 disabled:opacity-50"
                >
                  <FileDown className="h-4 w-4" aria-hidden />
                  Gerar PDF
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
