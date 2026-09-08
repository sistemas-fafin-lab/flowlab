// Riscos — visão unificada (fusão da antiga Matriz de Riscos + Mapa de
// Riscos por Setor): heatmap P×S em destaque, busca/filtro, e uma Seção por
// Setor com tabela + gráfico de incidência mensal de ocorrências vinculadas.
// openspec/changes/unificar-matriz-mapa-riscos/.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Link2, Plus, Search, ShieldAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { RiscoDTO } from '../types';
import {
  atualizarCorRisco,
  buscarAnosComOcorrenciaRisco,
  buscarFaixasClassificacao,
  buscarIncidenciaMensalPorRiscos,
  buscarSetoresRisco,
  listarRiscos,
} from '../riscos.js';
import { useCanManageQualidade } from '../hooks/useCanManageQualidade.js';
import { useTheme } from '../../../hooks/useTheme';
import { NovoRiscoDrawer } from './riscos/NovoRiscoDrawer.js';
import { RiscoDetalheDrawer } from './riscos/RiscoDetalheDrawer.js';
import { SeletorCorRisco } from './riscos/SeletorCorRisco.js';
import { BADGE_NIVEL, ROTULO_NIVEL, ROTULO_TRATAMENTO, corDoRisco } from './riscos/rotulos.js';
import { HeatmapMatrizRisco, type PontoRiscoHeatmap } from './ui/charts/HeatmapMatrizRisco.js';
import { LineChartMultiSerie, type PontoSerieLinha, type SerieLinha } from './ui/charts/LineChartMultiSerie.js';
import { ComboboxBusca } from './ui/ComboboxBusca.js';
import { ErrorState } from './ui/ErrorState.js';
import { Skeleton } from './ui/Skeleton.js';
import type { ColunaTabela } from './ui/TabelaExpansivel.js';
import { TabelaExpansivel } from './ui/TabelaExpansivel.js';

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function pontosVaziosDoAno(ano: number): PontoSerieLinha[] {
  return Array.from({ length: 12 }, (_, i) => ({ x: `${ano}-${String(i + 1).padStart(2, '0')}`, y: 0 }));
}

export function Riscos() {
  const canManage = useCanManageQualidade();
  const { theme: tema } = useTheme();
  const queryClient = useQueryClient();

  const [busca, setBusca] = useState('');
  const [setorId, setSetorId] = useState('');
  const [ano, setAno] = useState<number | null>(null);
  const [novoAberto, setNovoAberto] = useState(false);
  const [detalheId, setDetalheId] = useState<string | null>(null);

  const { data: setores } = useQuery({ queryKey: ['riscos-setores'], queryFn: buscarSetoresRisco });

  const filtro = useMemo(() => ({ setorId: setorId || undefined }), [setorId]);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['riscos', filtro],
    queryFn: () => listarRiscos(filtro),
  });

  const { data: anosDisponiveis } = useQuery({ queryKey: ['riscos-anos'], queryFn: buscarAnosComOcorrenciaRisco });
  useEffect(() => {
    if (ano !== null || !anosDisponiveis) return;
    setAno(anosDisponiveis[0] ?? new Date().getFullYear());
  }, [anosDisponiveis, ano]);

  const buscaNormalizada = normalizar(busca.trim());
  const riscosFiltrados = useMemo(() => {
    const riscos = data ?? [];
    if (!buscaNormalizada) return riscos;
    return riscos.filter(
      (r) => normalizar(r.riscoIdentificado).includes(buscaNormalizada) || normalizar(r.processo).includes(buscaNormalizada),
    );
  }, [data, buscaNormalizada]);

  const heatmapVisivel = !busca.trim() && !setorId;

  const idsVisiveis = useMemo(() => riscosFiltrados.map((r) => r.id), [riscosFiltrados]);
  const { data: incidenciaPorRisco } = useQuery({
    queryKey: ['riscos-incidencia', idsVisiveis, ano],
    queryFn: () => buscarIncidenciaMensalPorRiscos(idsVisiveis, ano!),
    enabled: ano !== null && idsVisiveis.length > 0,
  });

  const porSetor = useMemo(() => {
    const mapa = new Map<string, { setorNome: string; riscos: RiscoDTO[] }>();
    for (const r of riscosFiltrados) {
      const atual = mapa.get(r.setorId) ?? { setorNome: r.setorNome ?? r.setorId, riscos: [] };
      atual.riscos.push(r);
      mapa.set(r.setorId, atual);
    }
    return [...mapa.values()].sort((a, b) => a.setorNome.localeCompare(b.setorNome, 'pt-BR'));
  }, [riscosFiltrados]);

  const pontosHeatmap: PontoRiscoHeatmap[] = useMemo(
    () =>
      (data ?? [])
        .filter((r): r is RiscoDTO & { probabilidade: number; severidade: number } => r.probabilidade !== null && r.severidade !== null)
        .map((r) => ({
          riscoId: r.id,
          setorNome: r.setorNome ?? '—',
          processo: r.processo,
          riscoIdentificado: r.riscoIdentificado,
          probabilidade: r.probabilidade,
          severidade: r.severidade,
          nivel: r.nivel,
          status: r.tratamento,
        })),
    [data],
  );

  const mutacaoCor = useMutation({
    mutationFn: ({ riscoId, cor }: { riscoId: string; cor: string }) => atualizarCorRisco(riscoId, cor),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['riscos'] }),
  });

  const { data: faixas } = useQuery({ queryKey: ['riscos-faixas'], queryFn: buscarFaixasClassificacao });

  function colunasDaSecao(): ColunaTabela<RiscoDTO>[] {
    return [
      { chave: 'processo', titulo: 'Processo', valor: (r) => r.processo, filtravel: true, larguraMin: 'min-w-[9rem]' },
      { chave: 'risco', titulo: 'Risco', valor: (r) => r.riscoIdentificado, quebrarLinha: true, larguraMin: 'min-w-[16rem]' },
      { chave: 'p', titulo: 'P', valor: (r) => r.probabilidade ?? '', larguraMin: 'min-w-[2.5rem]' },
      { chave: 's', titulo: 'S', valor: (r) => r.severidade ?? '', larguraMin: 'min-w-[2.5rem]' },
      { chave: 'score', titulo: 'Score', valor: (r) => r.score ?? '', larguraMin: 'min-w-[3.5rem]' },
      {
        chave: 'nivel',
        titulo: 'Nível',
        valor: (r) => r.nivel ?? '',
        render: (r) =>
          r.nivel ? (
            <span className={`rounded-full px-2 py-1 text-xs font-medium ${BADGE_NIVEL[r.nivel]}`}>{ROTULO_NIVEL[r.nivel]}</span>
          ) : (
            <span className="text-xs text-gray-400">—</span>
          ),
        larguraMin: 'min-w-[7rem]',
      },
      {
        chave: 'status',
        titulo: 'Status',
        valor: (r) => (r.tratamento ? ROTULO_TRATAMENTO[r.tratamento] : ''),
        larguraMin: 'min-w-[7rem]',
      },
      {
        chave: 'cor',
        titulo: 'Cor',
        valor: (r) => r.cor ?? '',
        render: (r) => (
          <SeletorCorRisco
            riscoId={r.id}
            cor={r.cor}
            canManage={canManage}
            onMudar={(cor) => mutacaoCor.mutate({ riscoId: r.id, cor })}
          />
        ),
        larguraMin: 'min-w-[3rem]',
      },
    ];
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            to="/qualidade/riscos"
            className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Voltar para Riscos
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Matriz de Riscos</h1>
          <p className="text-sm text-gray-600 dark:text-slate-400">
            Heatmap, cadastro e incidência de ocorrências por setor — tudo em um só lugar.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/qualidade/riscos/contingencias"
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-all duration-200 hover:bg-gray-50 dark:border-white/10 dark:bg-transparent dark:text-slate-300 dark:hover:bg-white/5"
          >
            <ShieldAlert className="h-4 w-4" aria-hidden />
            Contingências
          </Link>
          <Link
            to="/qualidade/riscos/correlacao"
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-all duration-200 hover:bg-gray-50 dark:border-white/10 dark:bg-transparent dark:text-slate-300 dark:hover:bg-white/5"
          >
            <Link2 className="h-4 w-4" aria-hidden />
            Correlação
          </Link>
          {canManage && (
            <button
              type="button"
              onClick={() => setNovoAberto(true)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-blue-500/25 transition-all duration-200 hover:from-blue-600 hover:to-blue-700"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Cadastrar novo risco
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-gray-500 dark:text-slate-400" style={{ minWidth: '14rem' }}>
          Buscar risco ou processo
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400 dark:text-slate-500" aria-hidden />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Digite para buscar…"
              className="glass-field w-full rounded-xl py-2 pl-8 pr-3 text-sm text-slate-800 dark:text-slate-200"
            />
          </div>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-500 dark:text-slate-400">
          Setor
          <ComboboxBusca itens={setores} valor={setorId} onMudar={setSetorId} placeholder="Todos os setores" className="w-56" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-500 dark:text-slate-400">
          Ano (incidência)
          <select
            value={ano ?? ''}
            onChange={(e) => setAno(Number(e.target.value))}
            className="glass-field rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
          >
            {(anosDisponiveis ?? []).map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
            {(!anosDisponiveis || anosDisponiveis.length === 0) && ano && <option value={ano}>{ano}</option>}
          </select>
        </label>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-12 w-full" />
          ))}
        </div>
      )}

      {isError && <ErrorState titulo="Não foi possível carregar os riscos" aoTentarNovamente={() => refetch()} />}

      {!isLoading && !isError && heatmapVisivel && faixas && pontosHeatmap.length > 0 && (
        <div className="glass-surface rounded-2xl p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">Heatmap de riscos (Probabilidade × Severidade)</h2>
          <HeatmapMatrizRisco pontos={pontosHeatmap} faixas={faixas} tema={tema} onClicarPonto={setDetalheId} />
        </div>
      )}

      {!isLoading && !isError && data && data.length === 0 && (
        <p className="glass-surface rounded-2xl p-8 text-center text-sm text-gray-500 dark:text-slate-400">
          Nenhum risco cadastrado ainda.
          {canManage ? ' Use "Cadastrar novo risco" para começar.' : ''}
        </p>
      )}

      {!isLoading &&
        !isError &&
        porSetor.map((secao) => {
          const series: SerieLinha[] = secao.riscos.map((r) => ({
            id: r.id,
            nome: `${r.processo} — ${r.riscoIdentificado}`.slice(0, 60),
            cor: corDoRisco(r),
            pontos: incidenciaPorRisco?.get(r.id) ?? pontosVaziosDoAno(ano ?? new Date().getFullYear()),
          }));
          return (
            <div key={secao.setorNome} className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{secao.setorNome}</h2>
              <TabelaExpansivel
                titulo={`Riscos — ${secao.setorNome}`}
                caption={`Riscos do setor ${secao.setorNome}`}
                colunas={colunasDaSecao()}
                dados={secao.riscos}
                chaveLinha={(r) => r.id}
                cor="rose"
                onClickLinha={(r) => setDetalheId(r.id)}
              />
              <div className="glass-surface rounded-2xl p-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                  Incidência de ocorrências vinculadas ({ano ?? '—'})
                </h3>
                <LineChartMultiSerie series={series} tema={tema} ariaLabel={`Incidência mensal de ocorrências por risco — ${secao.setorNome}`} />
              </div>
            </div>
          );
        })}

      {novoAberto && <NovoRiscoDrawer onFechar={() => setNovoAberto(false)} />}
      {detalheId && <RiscoDetalheDrawer id={detalheId} canManage={canManage} onFechar={() => setDetalheId(null)} />}
    </div>
  );
}
