import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EstadoCota } from '../types';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorState } from './ui/ErrorState.js';
import { SeletorPeriodoPorMes } from './ui/SeletorPeriodoPorMes.js';
import { Skeleton } from './ui/Skeleton.js';
import type { ColunaTabela } from './ui/TabelaExpansivel.js';
import { TabelaExpansivel } from './ui/TabelaExpansivel.js';
import { anoAtual } from '../anoAtual.js';
import { atualizarCota, buscarCotas, criarCota, ErroApi } from '../cortesias.js';
import { useCanManageQualidade } from '../hooks/useCanManageQualidade.js';
import { usePeriodoCompartilhado } from '../providers/PeriodoProvider.js';

type CotaLinha = Awaited<ReturnType<typeof buscarCotas>>[number];

const BADGE_ESTADO: Record<EstadoCota, string> = {
  normal: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  atencao: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  excedido: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

const campoFiltro =
  'glass-field rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200';

export function CortesiasCotas() {
  const queryClient = useQueryClient();
  const canManage = useCanManageQualidade();
  const { periodo: periodoSalvo, definirPeriodo } = usePeriodoCompartilhado();
  const { inicio, fim } = periodoSalvo;
  const [clinicaIdLis, setClinicaIdLis] = useState('');
  const [cotaMensal, setCotaMensal] = useState('');
  const [vigenciaInicio, setVigenciaInicio] = useState('');

  const periodoCompleto = Boolean(inicio && fim);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['cortesias-cotas', inicio, fim],
    queryFn: () => buscarCotas({ inicio, fim }),
    enabled: periodoCompleto,
  });

  const criar = useMutation({
    mutationFn: () =>
      criarCota({
        clinicaIdLis: Number(clinicaIdLis),
        cotaMensal: Number(cotaMensal),
        vigenciaInicio,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cortesias-cotas'] });
      setClinicaIdLis('');
      setCotaMensal('');
      setVigenciaInicio('');
    },
  });

  const editarCotaMensal = useMutation({
    mutationFn: ({ id, valor }: { id: string; valor: number }) =>
      atualizarCota(id, { cotaMensal: valor }, { inicio, fim }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cortesias-cotas'] }),
  });

  const colunas: ColunaTabela<CotaLinha>[] = [
    {
      chave: 'clinica',
      titulo: 'Clínica',
      valor: (cota) => cota.clinicaNome ?? `Clínica ${cota.clinicaIdLis}`,
      filtravel: true,
      larguraMin: 'min-w-[16rem]',
    },
    {
      chave: 'cotaMensal',
      titulo: 'Cota mensal',
      valor: (cota) => cota.cotaMensal,
      render: (cota) => (
        <input
          type="number"
          min={0}
          defaultValue={cota.cotaMensal}
          disabled={!canManage}
          onClick={(e) => e.stopPropagation()}
          onBlur={(e) => {
            const valor = Number(e.target.value);
            if (valor !== cota.cotaMensal) editarCotaMensal.mutate({ id: cota.id, valor });
          }}
          className={`${campoFiltro} w-24`}
        />
      ),
      larguraMin: 'min-w-[8rem]',
    },
    { chave: 'realizado', titulo: 'Realizado', valor: (cota) => cota.realizadoPeriodo, larguraMin: 'min-w-[7rem]' },
    {
      chave: 'estado',
      titulo: 'Estado',
      valor: (cota) => cota.estado,
      filtravel: true,
      tipoFiltro: 'select',
      render: (cota) => <span className={`rounded-full px-2 py-1 text-xs font-medium ${BADGE_ESTADO[cota.estado]}`}>{cota.estado}</span>,
      larguraMin: 'min-w-[8rem]',
    },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <Link
          to="/qualidade/cortesias"
          className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Voltar para a worklist
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Cotas de Cortesias</h1>
        <p className="text-sm text-gray-600 dark:text-slate-400">
          Cota mensal por clínica (R5). Cota por médico ainda não é suportada — o LIS não documenta uma fonte
          confiável de CRM para cortesias.
        </p>
      </div>

      <SeletorPeriodoPorMes
        inicio={inicio}
        fim={fim}
        anoPadrao={anoAtual()}
        onMudar={definirPeriodo}
      />

      {canManage && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            criar.mutate();
          }}
          className="flex flex-wrap items-end gap-3 glass-surface rounded-2xl p-4"
        >
          <label className="flex flex-col text-xs font-medium text-gray-500 dark:text-slate-400">
            Clínica (id do LIS)
            <input
              className={campoFiltro}
              value={clinicaIdLis}
              onChange={(e) => setClinicaIdLis(e.target.value)}
              placeholder="ex.: 501"
            />
          </label>
          <label className="flex flex-col text-xs font-medium text-gray-500 dark:text-slate-400">
            Cota mensal
            <input
              className={campoFiltro}
              value={cotaMensal}
              onChange={(e) => setCotaMensal(e.target.value)}
              placeholder="ex.: 10"
            />
          </label>
          <label className="flex flex-col text-xs font-medium text-gray-500 dark:text-slate-400">
            Vigência (início)
            <input
              type="date"
              className={campoFiltro}
              value={vigenciaInicio}
              onChange={(e) => setVigenciaInicio(e.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={!clinicaIdLis || !cotaMensal || !vigenciaInicio || criar.isPending}
            className="rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-blue-500/25 transition-all duration-200 hover:from-blue-600 hover:to-blue-700 disabled:opacity-50"
          >
            {criar.isPending ? 'Criando…' : 'Nova cota'}
          </button>
        </form>
      )}

      {!periodoCompleto && (
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Selecione o período para ver o realizado e o estado de cada cota.
        </p>
      )}

      {periodoCompleto && isLoading && (
        <div className="space-y-2">
          {[1, 2].map((n) => (
            <Skeleton key={n} className="h-12 w-full" />
          ))}
        </div>
      )}

      {periodoCompleto && isError && (
        <ErrorState
          titulo="Não foi possível carregar as cotas"
          descricao={
            error instanceof ErroApi && error.status === 401
              ? 'Sua sessão não está autenticada. Faça login novamente.'
              : 'Verifique sua conexão ou tente novamente.'
          }
          aoTentarNovamente={() => refetch()}
        />
      )}

      {periodoCompleto && !isLoading && !isError && data && data.length === 0 && (
        <p className="glass-surface rounded-2xl p-8 text-center text-sm text-gray-500 dark:text-slate-400">
          Nenhuma cota cadastrada ainda.
        </p>
      )}

      {periodoCompleto && !isLoading && !isError && data && data.length > 0 && (
        <TabelaExpansivel
          titulo="Cotas de Cortesias"
          colunas={colunas}
          dados={data}
          chaveLinha={(cota) => cota.id}
          cor="emerald"
        />
      )}
    </div>
  );
}
