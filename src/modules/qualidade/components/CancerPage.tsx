import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TipoCido } from '../types';
import { AlertTriangle, Check, HelpCircle, RefreshCw, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { BuscaCido } from './cancer/BuscaCido.js';
import { CasoDrawer } from './cancer/CasoDrawer.js';
import { ExportacaoRhcCard } from './cancer/ExportacaoRhcCard.js';
import { ErrorState } from './ui/ErrorState.js';
import { SeletorPeriodoPorMes } from './ui/SeletorPeriodoPorMes.js';
import { Skeleton } from './ui/Skeleton.js';
import type { ColunaTabela } from './ui/TabelaExpansivel.js';
import { TabelaExpansivel } from './ui/TabelaExpansivel.js';
import { anoAtual } from '../anoAtual.js';
import { buscarFunilCancer, ErroApi, salvarClassificacaoCancer, sincronizarCancer } from '../cancer.js';
import { useCanManageQualidade } from '../hooks/useCanManageQualidade.js';
import { usePeriodoCompartilhado } from '../providers/PeriodoProvider.js';

type CasoLinha = Awaited<ReturnType<typeof buscarFunilCancer>>['casos'][number];
type ParametrosFixos = Awaited<ReturnType<typeof buscarFunilCancer>>['parametrosFixos'];

// Split manual (sem `new Date`) para não sofrer deslocamento de fuso horário
// ao formatar uma data `YYYY-MM-DD` vinda do banco.
function formatarData(data: string | null): string {
  if (!data) return '—';
  const [ano, mes, dia] = data.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

const ROTULO_SEXO: Record<number, string> = { 0: 'Não declarado', 1: 'Masculino', 2: 'Feminino' };

/**
 * Topografia/Morfologia editáveis direto na linha — só quando a triagem já
 * confirmou "É câncer" (mesma trava de `classificacao.ts`/CasoDrawer); os
 * dois códigos são gravados juntos (`salvarClassificacaoCancer` exige os
 * dois), então a escolha aqui reaproveita o valor atual do outro campo.
 *
 * Quando o backend já achou uma correspondência confiável no LIS
 * (`sugestaoTopografia`/`sugestaoMorfologia` — código exato para morfologia,
 * descrição do fragmento para topografia) e o campo ainda não foi
 * classificado, a célula mostra a sugestão pré-preenchida em esmaecido/
 * amarelado (nunca como se já fosse fato) com um botão de confirmação
 * explícita — a busca continua disponível para escolher outra coisa.
 */
function CelulaClassificacao({ caso, tipo, canManage }: { caso: CasoLinha; tipo: TipoCido; canManage: boolean }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (entrada: { codigo: string }) =>
      salvarClassificacaoCancer(caso.id, {
        cidoTopografiaCodigo: tipo === 'topografia' ? entrada.codigo : (caso.cidoTopografiaCodigo ?? ''),
        cidoMorfologiaCodigo: tipo === 'morfologia' ? entrada.codigo : (caso.cidoMorfologiaCodigo ?? ''),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cancer-funil'] }),
  });

  const codigoAtual = tipo === 'topografia' ? caso.cidoTopografiaCodigo : caso.cidoMorfologiaCodigo;
  const descricaoConfirmada = tipo === 'topografia' ? caso.cidoTopografiaDescricao : caso.cidoMorfologiaDescricao;
  const sugestao = tipo === 'topografia' ? caso.sugestaoTopografia : caso.sugestaoMorfologia;

  if (caso.triagem !== 'cancer_confirmado') {
    return (
      <span className="text-sm text-gray-400 dark:text-slate-500" title='Confirme a triagem como "É câncer" no caso para classificar.'>
        {descricaoConfirmada ?? '—'}
      </span>
    );
  }

  const pendenteDeConfirmacao = !codigoAtual && sugestao !== null;

  return (
    <div className={`flex items-center gap-1 ${pendenteDeConfirmacao ? 'rounded-lg bg-amber-50 p-1 dark:bg-amber-900/10' : ''}`}>
      <BuscaCido
        tipo={tipo}
        valorAtual={codigoAtual ?? sugestao?.codigo ?? ''}
        descricaoAtual={descricaoConfirmada ?? sugestao?.descricao ?? null}
        sugerido={pendenteDeConfirmacao}
        onEscolher={(entrada) => mutation.mutate(entrada)}
        desabilitado={mutation.isPending || !canManage}
        className="min-w-[11rem]"
      />
      {pendenteDeConfirmacao && canManage && (
        <button
          type="button"
          title={`Confirmar sugestão: ${sugestao.codigo} — ${sugestao.descricao}`}
          disabled={mutation.isPending}
          onClick={(e) => {
            e.stopPropagation();
            mutation.mutate(sugestao);
          }}
          className="shrink-0 rounded-full bg-amber-100 p-1.5 text-amber-700 transition-colors hover:bg-amber-200 disabled:opacity-50 dark:bg-amber-900/40 dark:text-amber-300 dark:hover:bg-amber-900/60"
        >
          <Check className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
      {!codigoAtual && sugestao === null && (
        <span
          title="Sem sugestão automática — este caso não tem código de diagnóstico nem local de fragmento estruturado no LIS para bater com o catálogo CID-O. Selecione manualmente a partir do laudo."
          className="shrink-0"
        >
          <HelpCircle className="h-3.5 w-3.5 text-gray-300 dark:text-slate-600" aria-hidden />
        </span>
      )}
    </div>
  );
}

/**
 * Colunas pedidas explicitamente para a worklist (2026-08-14): CNES, Nome do
 * paciente, Sexo, CPF, Prontuário, Data Diagnóstico, Topografia (select com
 * busca) + código, Morfologia (select com busca) + código, Data Coleta,
 * Registrador. Nome/sexo/CPF são PII (P10) — lidos do LIS em lote a cada
 * carregamento, nunca persistidos (design.md D8, desvio explícito da
 * decisão original de deixar PII fora da listagem). Nome da mãe e data de
 * nascimento continuam fora daqui, só no drawer de 1 caso.
 */
function criarColunas(fixos: ParametrosFixos, canManage: boolean): ColunaTabela<CasoLinha>[] {
  return [
    { chave: 'cnes', titulo: 'CNES', valor: () => fixos.cnes, ordenavel: false, larguraMin: 'min-w-[6rem]' },
    {
      chave: 'nomePaciente',
      titulo: 'Nome paciente',
      valor: (caso) => caso.nomePacienteLis,
      filtravel: true,
      quebrarLinha: true,
      larguraMin: 'min-w-[14rem]',
    },
    {
      chave: 'sexo',
      titulo: 'Sexo',
      valor: (caso) => (caso.sexoLis === null ? '' : (ROTULO_SEXO[caso.sexoLis] ?? String(caso.sexoLis))),
      filtravel: true,
      tipoFiltro: 'select',
      larguraMin: 'min-w-[6rem]',
    },
    { chave: 'cpf', titulo: 'CPF', valor: (caso) => caso.cpfLis ?? '', filtravel: true, larguraMin: 'min-w-[9rem]' },
    { chave: 'prontuario', titulo: 'Prontuário', valor: (caso) => caso.codRequisicao, filtravel: true, larguraMin: 'min-w-[9rem]' },
    {
      chave: 'candidatura',
      titulo: 'Candidato',
      valor: (caso) => caso.candidatura.confianca ?? '',
      render: (caso) => {
        if (!caso.candidatura.candidato) return <span className="text-gray-400 dark:text-slate-500">—</span>;
        const cor = caso.candidatura.confianca === 'alta' ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
        return (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cor}`}
            title={caso.candidatura.indicadores.join(' · ')}
          >
            <Sparkles className="h-3 w-3" aria-hidden />
            {caso.candidatura.confianca === 'alta' ? 'Alta' : 'Média'}
          </span>
        );
      },
      filtravel: true,
      tipoFiltro: 'select',
      larguraMin: 'min-w-[7rem]',
    },
    {
      chave: 'diagnostico',
      titulo: 'Data diagnóstico',
      valor: (caso) => caso.dtaDiagnostico,
      render: (caso) => formatarData(caso.dtaDiagnostico),
      larguraMin: 'min-w-[9rem]',
    },
    {
      chave: 'topografiaDescricao',
      titulo: 'Topografia',
      valor: (caso) => caso.cidoTopografiaDescricao ?? '',
      render: (caso) => <CelulaClassificacao caso={caso} tipo="topografia" canManage={canManage} />,
      larguraMin: 'min-w-[12rem]',
    },
    { chave: 'topografiaCodigo', titulo: 'Cod. CID topografia', valor: (caso) => caso.cidoTopografiaCodigo ?? '', larguraMin: 'min-w-[8rem]' },
    {
      chave: 'morfologiaDescricao',
      titulo: 'Morfologia',
      valor: (caso) => caso.cidoMorfologiaDescricao ?? '',
      render: (caso) => <CelulaClassificacao caso={caso} tipo="morfologia" canManage={canManage} />,
      larguraMin: 'min-w-[14rem]',
    },
    { chave: 'morfologiaCodigo', titulo: 'Cod. CID morfologia', valor: (caso) => caso.cidoMorfologiaCodigo ?? '', larguraMin: 'min-w-[8rem]' },
    {
      chave: 'coleta',
      titulo: 'Data coleta',
      valor: (caso) => caso.dtaColeta ?? '',
      render: (caso) => (
        <>
          {formatarData(caso.dtaColeta)}
          {caso.dtaColetaDivergente && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              divergente
            </span>
          )}
        </>
      ),
      larguraMin: 'min-w-[9rem]',
    },
    { chave: 'registrador', titulo: 'Registrador', valor: (caso) => caso.registrador ?? '', larguraMin: 'min-w-[9rem]' },
  ];
}

export function Cancer() {
  const queryClient = useQueryClient();
  const canManage = useCanManageQualidade();
  const { periodo: periodoSalvo, definirPeriodo } = usePeriodoCompartilhado();
  const { inicio, fim } = periodoSalvo;
  const [idSelecionado, setIdSelecionado] = useState<string | null>(null);

  const periodoCompleto = Boolean(inicio && fim);
  const periodo = { inicio, fim };

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['cancer-funil', periodo],
    queryFn: () => buscarFunilCancer(periodo),
    enabled: periodoCompleto,
  });

  const sync = useMutation({
    mutationFn: () => sincronizarCancer(periodo),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cancer-funil'] }),
  });

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Registro de Câncer</h1>
          <p className="text-sm text-gray-600 dark:text-slate-400">
            Funil de triagem: o sistema monta o universo pelo laudo definitivo, mas nunca decide se é câncer.
          </p>
        </div>
        <div className="flex gap-2">
          {canManage && (
            <button
              type="button"
              disabled={!periodoCompleto || sync.isPending}
              onClick={() => sync.mutate()}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-blue-500/25 transition-all duration-200 hover:from-blue-600 hover:to-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${sync.isPending ? 'animate-spin' : ''}`} aria-hidden />
              Sincronizar
            </button>
          )}
        </div>
      </div>

      <SeletorPeriodoPorMes
        inicio={inicio}
        fim={fim}
        anoPadrao={anoAtual()}
        onMudar={definirPeriodo}
      />

      {!periodoCompleto && (
        <p className="text-sm text-gray-500 dark:text-slate-400">Selecione o período para carregar o funil.</p>
      )}

      {periodoCompleto && isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-16 w-full" />
          ))}
        </div>
      )}

      {periodoCompleto && isError && (
        <ErrorState
          titulo="Não foi possível carregar o funil"
          descricao={
            error instanceof ErroApi && error.status === 401
              ? 'Sua sessão não está autenticada. Faça login novamente.'
              : 'Verifique sua conexão ou tente novamente.'
          }
          aoTentarNovamente={() => refetch()}
        />
      )}

      {periodoCompleto && !isLoading && !isError && data && (
        <>
          {data.retificacaoPendente > 0 && (
            <div className="flex items-center gap-2 rounded-2xl bg-red-50 p-4 text-red-800 dark:bg-red-900/20 dark:text-red-300">
              <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
              <p className="text-sm font-medium">
                {data.retificacaoPendente} caso(s) já exportado(s) tiveram o laudo alterado (R8) — revisão urgente.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {[
              ['Universo', data.universo],
              ['Triados', data.triados],
              ['Confirmados', data.confirmados],
              ['Classificados', data.classificados],
              ['Exportados', data.exportados],
            ].map(([rotulo, valor]) => (
              <div key={rotulo as string} className="glass-surface rounded-2xl p-4">
                <p className="text-xs text-gray-500 dark:text-slate-400">{rotulo}</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{valor}</p>
              </div>
            ))}
          </div>

          {data.casos.length === 0 ? (
            <p className="glass-surface rounded-2xl p-8 text-center text-sm text-gray-500 dark:text-slate-400">
              Nenhum caso positivo neste período. Verifique o período ou sincronize com o LIS.
            </p>
          ) : (
            <TabelaExpansivel
              titulo="Casos positivos do período"
              caption="Casos positivos do período"
              colunas={criarColunas(data.parametrosFixos, canManage)}
              dados={data.casos}
              chaveLinha={(caso) => caso.id}
              onClickLinha={(caso) => setIdSelecionado(caso.id)}
              cor="rose"
            />
          )}

          <ExportacaoRhcCard registradorPadrao={data.parametrosFixos.registrador} canManage={canManage} />
        </>
      )}

      {idSelecionado && data && (
        <CasoDrawer
          id={idSelecionado}
          parametrosFixos={data.parametrosFixos}
          canManage={canManage}
          onFechar={() => setIdSelecionado(null)}
        />
      )}
    </div>
  );
}
