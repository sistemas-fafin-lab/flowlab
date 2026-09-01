// Mapa de riscos por setor — visão de auditoria
// (.scratch/qualidade-riscos-indicadores/issues/04-riscos-dashboard-mapa-alertas.md).

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { MapaRiscoLinhaDTO } from '../types';
import { buscarMapaRiscosPorSetor, buscarSetoresRisco } from '../riscos.js';
import { BADGE_NIVEL, ROTULO_NIVEL, ROTULO_TRATAMENTO } from './riscos/rotulos.js';
import { ComboboxBusca } from './ui/ComboboxBusca.js';
import { ErrorState } from './ui/ErrorState.js';
import { Skeleton } from './ui/Skeleton.js';
import type { ColunaTabela } from './ui/TabelaExpansivel.js';
import { TabelaExpansivel } from './ui/TabelaExpansivel.js';

const colunas: ColunaTabela<MapaRiscoLinhaDTO>[] = [
  { chave: 'processo', titulo: 'Processo', valor: (l) => l.processo, filtravel: true, larguraMin: 'min-w-[10rem]' },
  {
    chave: 'risco',
    titulo: 'Risco',
    valor: (l) => l.riscoIdentificado,
    quebrarLinha: true,
    larguraMin: 'min-w-[18rem]',
  },
  { chave: 'p', titulo: 'P', valor: (l) => l.probabilidade ?? '', larguraMin: 'min-w-[3rem]' },
  { chave: 's', titulo: 'S', valor: (l) => l.severidade ?? '', larguraMin: 'min-w-[3rem]' },
  {
    chave: 'nivel',
    titulo: 'Nível',
    valor: (l) => l.nivel ?? '',
    filtravel: true,
    tipoFiltro: 'select',
    render: (l) =>
      l.nivel ? (
        <span className={`rounded-full px-2 py-1 text-xs font-medium ${BADGE_NIVEL[l.nivel]}`}>{ROTULO_NIVEL[l.nivel]}</span>
      ) : (
        <span className="text-xs text-gray-400">Sem classificação</span>
      ),
    larguraMin: 'min-w-[8rem]',
  },
  {
    chave: 'status',
    titulo: 'Status',
    valor: (l) => (l.tratamento ? ROTULO_TRATAMENTO[l.tratamento] : 'Sem tratamento'),
    filtravel: true,
    tipoFiltro: 'select',
    larguraMin: 'min-w-[9rem]',
  },
];

export function MapaRiscosPorSetor() {
  const [setorId, setSetorId] = useState('');
  const { data: setores } = useQuery({ queryKey: ['riscos-setores'], queryFn: buscarSetoresRisco });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['mapa-riscos-setor', setorId],
    queryFn: () => buscarMapaRiscosPorSetor(setorId),
    enabled: Boolean(setorId),
  });

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <Link
          to="/qualidade/riscos"
          className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Voltar para Riscos
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Mapa de Riscos por Setor</h1>
        <p className="text-sm text-gray-600 dark:text-slate-400">
          Visão de auditoria — todos os riscos de um setor, com probabilidade, severidade, nível e status de tratamento.
        </p>
      </div>

      <label className="flex flex-col gap-1 text-xs font-medium text-gray-500 dark:text-slate-400">
        Setor
        <ComboboxBusca itens={setores} valor={setorId} onMudar={setSetorId} placeholder="— selecione um setor —" className="w-64" />
      </label>

      {!setorId && <p className="text-sm text-gray-500 dark:text-slate-400">Selecione um setor para ver o mapa de riscos.</p>}

      {setorId && isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-12 w-full" />
          ))}
        </div>
      )}

      {setorId && isError && <ErrorState titulo="Não foi possível carregar o mapa de riscos" aoTentarNovamente={() => refetch()} />}

      {setorId && !isLoading && !isError && data && data.length === 0 && (
        <p className="glass-surface rounded-2xl p-8 text-center text-sm text-gray-500 dark:text-slate-400">
          Nenhum risco cadastrado para este setor.
        </p>
      )}

      {setorId && !isLoading && !isError && data && data.length > 0 && (
        <TabelaExpansivel
          titulo="Riscos do setor"
          caption="Mapa de riscos por setor"
          colunas={colunas}
          dados={data}
          chaveLinha={(l) => l.riscoId}
          cor="amber"
        />
      )}
    </div>
  );
}
