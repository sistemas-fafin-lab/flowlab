import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { TipoCido } from '../types';
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, Check, CheckCircle, ChevronRight, Clock, Edit, FileText, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { BuscaCido } from './cancer/BuscaCido.js';
import { CasoDrawer } from './cancer/CasoDrawer.js';
import { ExportacaoRhcCard } from './cancer/ExportacaoRhcCard.js';
import { PaginaWorklist } from './ui/PaginaWorklist.js';
import type { ColunaTabela } from './ui/TabelaExpansivel.js';
import type { Tom } from './ui/tons.js';
import { Etiqueta, Pilula, TOM, TEXTO_FORTE, TEXTO_FRACO } from './ui/tons.js';
import { buscarFunilCancer, salvarClassificacaoCancer, sincronizarCancer } from '../cancer.js';
import { useCanManageQualidade } from '../hooks/useCanManageQualidade.js';
import { usePeriodoCompartilhado } from '../providers/PeriodoProvider.js';

type FunilResposta = Awaited<ReturnType<typeof buscarFunilCancer>>;
type CasoLinha = FunilResposta['casos'][number];
type ParametrosFixos = FunilResposta['parametrosFixos'];

// Split manual (sem `new Date`) para não sofrer deslocamento de fuso horário
// ao formatar uma data `YYYY-MM-DD` vinda do banco.
function formatarData(data: string | null): string {
  if (!data) return '—';
  const [ano, mes, dia] = data.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

const ROTULO_SEXO: Record<number, string> = { 0: 'Não declarado', 1: 'Masculino', 2: 'Feminino' };

/** Em que ponto do funil o caso está — só leitura dos campos já gravados, nunca decide nada (R2). */
type Etapa = 'triar' | 'classificar' | 'pronto' | 'exportado' | 'nao_cancer' | 'inconclusivo';

const VISUAL_ETAPA: Record<Etapa, { rotulo: string; tom: Tom; icone: LucideIcon }> = {
  triar: { rotulo: 'Triagem pendente', tom: 'amber', icone: Clock },
  classificar: { rotulo: 'Classificar CID-O', tom: 'blue', icone: Edit },
  pronto: { rotulo: 'Pronto para exportar', tom: 'indigo', icone: FileText },
  exportado: { rotulo: 'Exportado', tom: 'emerald', icone: CheckCircle },
  nao_cancer: { rotulo: 'Não é câncer', tom: 'slate', icone: X },
  inconclusivo: { rotulo: 'Inconclusivo', tom: 'slate', icone: AlertTriangle },
};

function etapaDoCaso(caso: CasoLinha): Etapa {
  if (caso.triagem === 'pendente') return 'triar';
  if (caso.triagem === 'nao_cancer') return 'nao_cancer';
  if (caso.triagem === 'inconclusivo') return 'inconclusivo';
  if (caso.exportacaoId) return 'exportado';
  if (caso.cidoTopografiaCodigo && caso.cidoMorfologiaCodigo) return 'pronto';
  return 'classificar';
}

function subEtapa(caso: CasoLinha, etapa: Etapa): string {
  switch (etapa) {
    case 'classificar':
      if (!caso.cidoTopografiaCodigo && !caso.cidoMorfologiaCodigo) return 'Faltam topografia e morfologia';
      return !caso.cidoTopografiaCodigo ? 'Falta topografia' : 'Falta morfologia';
    case 'pronto':
      return 'Confirmado e classificado';
    case 'nao_cancer':
      return 'Fora do registro';
    case 'inconclusivo':
      return 'Rever no caso';
    default:
      return '';
  }
}

/** R8 — laudo alterado depois de o caso já ter saído num lote RHC. */
function temRetificacao(caso: CasoLinha): boolean {
  return caso.revisaoPendente && Boolean(caso.exportacaoId);
}

/** Filtros acionados pelas "saídas" do funil. */
type FiltroFunil = 'triar' | 'fora' | 'classificar' | 'pronto' | 'retificacao';

const ROTULO_FILTRO: Record<FiltroFunil, string> = {
  triar: 'A triar',
  fora: 'Fora do registro',
  classificar: 'A classificar',
  pronto: 'Prontos para exportar',
  retificacao: 'Laudo alterado após exportação',
};

function casoNoFiltro(caso: CasoLinha, filtro: FiltroFunil): boolean {
  const etapa = etapaDoCaso(caso);
  if (filtro === 'fora') return etapa === 'nao_cancer' || etapa === 'inconclusivo';
  if (filtro === 'retificacao') return temRetificacao(caso);
  return etapa === filtro;
}

/** "codigo_cid_o:M-85003" → texto legível do porquê o caso é candidato (heurística, nunca decisão). */
function motivoCandidatura(indicador: string | undefined): string {
  if (!indicador) return '';
  const separador = indicador.indexOf(':');
  if (separador < 0) return indicador;
  const tipo = indicador.slice(0, separador);
  const valor = indicador.slice(separador + 1);
  return tipo === 'codigo_cid_o' ? `Código ${valor} no diagnóstico do LIS` : `“${valor}” no texto do laudo`;
}

/**
 * Topografia/Morfologia editáveis direto na linha — só quando a triagem já
 * confirmou "É câncer" (mesma trava de `classificacao.ts`/CasoDrawer); os
 * dois códigos são gravados juntos (`salvarClassificacaoCancer` exige os
 * dois), então a escolha aqui reaproveita o valor atual do outro campo.
 *
 * Quando o backend já achou uma correspondência confiável no LIS
 * (`sugestaoTopografia`/`sugestaoMorfologia` — código exato para morfologia,
 * descrição do fragmento para topografia) e o campo ainda não foi
 * classificado, a célula mostra a sugestão num quadro tracejado (nunca como
 * se já fosse fato) com confirmação explícita — "Outro código" abre a busca.
 */
function CelulaClassificacao({ caso, tipo, canManage }: { caso: CasoLinha; tipo: TipoCido; canManage: boolean }) {
  const queryClient = useQueryClient();
  const [escolhendoOutro, setEscolhendoOutro] = useState(false);
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
    return descricaoConfirmada ? (
      <span className="text-sm text-gray-500 dark:text-slate-400" title='Confirme a triagem como "É câncer" no caso para classificar.'>
        {descricaoConfirmada}
      </span>
    ) : (
      <span className="text-xs leading-[18px] text-gray-500 dark:text-slate-400">Disponível após confirmar a triagem</span>
    );
  }

  if (!codigoAtual && sugestao && !escolhendoOutro) {
    return (
      <div className="flex flex-col gap-[5px] rounded-[10px] border border-dashed border-indigo-300 bg-indigo-500/[.07] px-2.5 py-2 dark:border-indigo-400/55">
        <span className="inline-flex items-center gap-[5px] text-[11px] font-bold uppercase leading-[14px] tracking-[.04em] text-indigo-700 dark:text-indigo-300">
          <Sparkles className="h-3 w-3" aria-hidden />
          Sugestão
        </span>
        <span className={`text-[13px] leading-[18px] ${TEXTO_FORTE}`}>
          {sugestao.codigo} · {sugestao.descricao}
        </span>
        <span className="text-[11px] leading-[14px] text-gray-500 dark:text-slate-400">
          {tipo === 'topografia' ? 'Do local do fragmento cadastrado no LIS' : 'Do código do diagnóstico no LIS'}
        </span>
        {canManage && (
          <div className="mt-0.5 flex gap-1.5">
            <button
              type="button"
              title={`Confirmar sugestão: ${sugestao.codigo} — ${sugestao.descricao}`}
              disabled={mutation.isPending}
              onClick={(e) => {
                e.stopPropagation();
                mutation.mutate(sugestao);
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 px-2.5 py-1 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Check className="h-3 w-3" aria-hidden />
              Confirmar
            </button>
            <button
              type="button"
              disabled={mutation.isPending}
              onClick={(e) => {
                e.stopPropagation();
                setEscolhendoOutro(true);
              }}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:text-slate-300 dark:hover:bg-white/10"
            >
              Outro código
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <BuscaCido
        tipo={tipo}
        valorAtual={codigoAtual ?? ''}
        descricaoAtual={codigoAtual && descricaoConfirmada ? `${codigoAtual} · ${descricaoConfirmada}` : null}
        placeholder={tipo === 'topografia' ? 'Selecionar topografia' : 'Selecionar morfologia'}
        onEscolher={(entrada) => mutation.mutate(entrada)}
        desabilitado={mutation.isPending || !canManage}
        abrirAoMontar={escolhendoOutro}
        className="min-w-[14rem]"
      />
      {!codigoAtual && !sugestao && (
        <div
          className="mt-1 text-[11px] leading-[14px] text-gray-500 dark:text-slate-400"
          title="Este caso não tem código de diagnóstico nem local de fragmento estruturado no LIS para bater com o catálogo CID-O."
        >
          Sem sugestão automática: escolha pelo laudo
        </div>
      )}
    </div>
  );
}

function CelulaEtapa({ caso }: { caso: CasoLinha }) {
  const etapa = etapaDoCaso(caso);
  const visual = VISUAL_ETAPA[etapa];
  const sub = subEtapa(caso, etapa);
  return (
    <div className="flex flex-col items-start gap-1">
      <Pilula tom={visual.tom} icone={visual.icone}>
        {visual.rotulo}
      </Pilula>
      {sub && <span className={TEXTO_FRACO}>{sub}</span>}
      {temRetificacao(caso) && (
        <Etiqueta tom="red">
          <AlertTriangle className="h-3 w-3" aria-hidden />
          Laudo alterado
        </Etiqueta>
      )}
    </div>
  );
}

function CelulaCandidato({ caso }: { caso: CasoLinha }) {
  if (!caso.candidatura.candidato) return <span className="text-gray-500 dark:text-slate-400">—</span>;
  const alta = caso.candidatura.confianca === 'alta';
  return (
    <div className="flex flex-col items-start gap-1" title={caso.candidatura.indicadores.join(' · ')}>
      <span
        className={`inline-flex items-center gap-[5px] rounded-full border border-dashed border-indigo-300 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:border-indigo-400/55 dark:text-indigo-300 ${
          alta ? 'bg-indigo-500/15' : 'bg-indigo-500/5'
        }`}
      >
        <Sparkles className="h-3 w-3" aria-hidden />
        {alta ? 'Alta' : 'Média'}
      </span>
      <span className={TEXTO_FRACO}>{motivoCandidatura(caso.candidatura.indicadores[0])}</span>
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
    { chave: 'cnes', titulo: 'CNES', valor: () => fixos.cnes, ordenavel: false, larguraMin: 'min-w-[6rem]', className: 'tabular-nums' },
    {
      chave: 'nomePaciente',
      titulo: 'Nome paciente',
      valor: (caso) => caso.nomePacienteLis,
      render: (caso) => <span className={`font-medium ${TEXTO_FORTE}`}>{caso.nomePacienteLis}</span>,
      filtravel: true,
      quebrarLinha: true,
      larguraMin: 'min-w-[13rem]',
    },
    {
      chave: 'sexo',
      titulo: 'Sexo',
      valor: (caso) => (caso.sexoLis === null ? '' : (ROTULO_SEXO[caso.sexoLis] ?? String(caso.sexoLis))),
      filtravel: true,
      tipoFiltro: 'select',
      larguraMin: 'min-w-[7rem]',
    },
    { chave: 'cpf', titulo: 'CPF', valor: (caso) => caso.cpfLis ?? '', filtravel: true, larguraMin: 'min-w-[9rem]', className: 'tabular-nums' },
    {
      chave: 'prontuario',
      titulo: 'Prontuário',
      valor: (caso) => caso.codRequisicao,
      filtravel: true,
      larguraMin: 'min-w-[7.25rem]',
      className: 'tabular-nums',
    },
    {
      chave: 'etapa',
      titulo: 'Etapa',
      valor: (caso) => VISUAL_ETAPA[etapaDoCaso(caso)].rotulo,
      render: (caso) => <CelulaEtapa caso={caso} />,
      filtravel: true,
      tipoFiltro: 'select',
      larguraMin: 'min-w-[13rem]',
    },
    {
      chave: 'candidatura',
      titulo: 'Candidato',
      valor: (caso) => caso.candidatura.confianca ?? '',
      render: (caso) => <CelulaCandidato caso={caso} />,
      filtravel: true,
      tipoFiltro: 'select',
      quebrarLinha: true,
      larguraMin: 'min-w-[15rem]',
    },
    {
      chave: 'diagnostico',
      titulo: 'Data diagnóstico',
      valor: (caso) => caso.dtaDiagnostico,
      render: (caso) => formatarData(caso.dtaDiagnostico),
      larguraMin: 'min-w-[8rem]',
    },
    {
      chave: 'topografiaDescricao',
      titulo: 'Topografia',
      valor: (caso) => caso.cidoTopografiaDescricao ?? '',
      render: (caso) => <CelulaClassificacao caso={caso} tipo="topografia" canManage={canManage} />,
      quebrarLinha: true,
      larguraMin: 'min-w-[18rem]',
    },
    {
      chave: 'topografiaCodigo',
      titulo: 'Cod. CID topografia',
      valor: (caso) => caso.cidoTopografiaCodigo ?? '',
      larguraMin: 'min-w-[7.5rem]',
      className: 'tabular-nums',
    },
    {
      chave: 'morfologiaDescricao',
      titulo: 'Morfologia',
      valor: (caso) => caso.cidoMorfologiaDescricao ?? '',
      render: (caso) => <CelulaClassificacao caso={caso} tipo="morfologia" canManage={canManage} />,
      quebrarLinha: true,
      larguraMin: 'min-w-[19rem]',
    },
    {
      chave: 'morfologiaCodigo',
      titulo: 'Cod. CID morfologia',
      valor: (caso) => caso.cidoMorfologiaCodigo ?? '',
      larguraMin: 'min-w-[7.5rem]',
      className: 'tabular-nums',
    },
    {
      chave: 'coleta',
      titulo: 'Data coleta',
      valor: (caso) => caso.dtaColeta ?? '',
      render: (caso) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="whitespace-nowrap">{formatarData(caso.dtaColeta)}</span>
          {caso.dtaColetaDivergente && <Etiqueta tom="amber">divergente</Etiqueta>}
        </div>
      ),
      larguraMin: 'min-w-[10.5rem]',
    },
    { chave: 'registrador', titulo: 'Registrador', valor: (caso) => caso.registrador ?? '', larguraMin: 'min-w-[8rem]' },
  ];
}

interface EtapaFunil {
  rotulo: string;
  valor: number;
  saida: { filtro: FiltroFunil; texto: string; tom: Tom; quantidade: number; titulo?: string };
}

function Funil({
  resposta,
  filtro,
  onFiltrar,
}: {
  resposta: FunilResposta;
  filtro: FiltroFunil | null;
  onFiltrar: (filtro: FiltroFunil | null) => void;
}) {
  const contar = (f: FiltroFunil) => resposta.casos.filter((caso) => casoNoFiltro(caso, f)).length;
  const naoCancer = resposta.casos.filter((caso) => caso.triagem === 'nao_cancer').length;
  const inconclusivos = resposta.casos.filter((caso) => caso.triagem === 'inconclusivo').length;
  const retificacoes = contar('retificacao');

  const etapas: EtapaFunil[] = [
    { rotulo: 'Universo', valor: resposta.universo, saida: { filtro: 'triar', texto: `${contar('triar')} a triar`, tom: 'amber', quantidade: contar('triar') } },
    {
      rotulo: 'Triados',
      valor: resposta.triados,
      saida: {
        filtro: 'fora',
        texto: `${naoCancer + inconclusivos} fora do registro`,
        tom: 'slate',
        quantidade: naoCancer + inconclusivos,
        titulo: [naoCancer ? `${naoCancer} não câncer` : '', inconclusivos ? `${inconclusivos} inconclusivo${inconclusivos > 1 ? 's' : ''}` : '']
          .filter(Boolean)
          .join(' · '),
      },
    },
    {
      rotulo: 'Confirmados',
      valor: resposta.confirmados,
      saida: { filtro: 'classificar', texto: `${contar('classificar')} a classificar`, tom: 'blue', quantidade: contar('classificar') },
    },
    {
      rotulo: 'Classificados',
      valor: resposta.classificados,
      saida: { filtro: 'pronto', texto: `${contar('pronto')} a exportar`, tom: 'indigo', quantidade: contar('pronto') },
    },
    {
      rotulo: 'Exportados',
      valor: resposta.exportados,
      saida: {
        filtro: 'retificacao',
        texto: `${retificacoes} ${retificacoes === 1 ? 'laudo alterado' : 'laudos alterados'}`,
        tom: 'red',
        quantidade: retificacoes,
      },
    },
  ];

  const percentual = (valor: number) => (resposta.universo > 0 ? Math.round((valor / resposta.universo) * 100) : 0);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[10px] font-bold uppercase leading-[14px] tracking-[.08em] text-gray-500 dark:text-slate-400">Funil do período</span>
        <span className={TEXTO_FRACO}>Clique nos indicadores coloridos para filtrar os casos</span>
      </div>
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-5">
        {etapas.map((etapa, k) => {
          const pct = k === 0 ? 100 : percentual(etapa.valor);
          const ativo = filtro === etapa.saida.filtro;
          return (
            <div key={etapa.rotulo} className="glass-surface relative flex min-w-0 flex-col gap-2.5 rounded-2xl px-4 py-3.5">
              <span className={TEXTO_FRACO}>{etapa.rotulo}</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold tabular-nums leading-7 text-slate-900 dark:text-white">{etapa.valor}</span>
                <span className={TEXTO_FRACO}>{k === 0 ? 'casos' : `${pct}%`}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[.07]">
                <span className="block h-full rounded-full bg-gradient-to-r from-rose-500 to-pink-500" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex min-h-6 items-center">
                {etapa.saida.quantidade > 0 && (
                  <button
                    type="button"
                    aria-pressed={ativo}
                    title={etapa.saida.titulo || etapa.saida.texto}
                    onClick={() => onFiltrar(ativo ? null : etapa.saida.filtro)}
                    className={`inline-flex max-w-full items-center gap-1.5 truncate whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-shadow ${TOM[etapa.saida.tom].pilula} ${
                      ativo ? TOM[etapa.saida.tom].anel : ''
                    }`}
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden />
                    {etapa.saida.texto}
                  </button>
                )}
              </div>
              {k < etapas.length - 1 && (
                <span
                  aria-hidden
                  className="absolute -right-[13px] top-1/2 z-[1] hidden h-[22px] w-[22px] -translate-y-1/2 items-center justify-center rounded-full border border-slate-200/90 bg-slate-50 text-gray-500 dark:border-gray-700/60 dark:bg-gray-900 dark:text-slate-400 md:flex"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Cancer() {
  const canManage = useCanManageQualidade();
  const { periodo, definirPeriodo } = usePeriodoCompartilhado();
  const [idSelecionado, setIdSelecionado] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroFunil | null>(null);

  return (
    <PaginaWorklist<FunilResposta, CasoLinha>
      titulo="Registro de Câncer"
      descricao="Funil de triagem: o sistema monta o universo pelo laudo definitivo, mas nunca decide se é câncer."
      dominio="cancer-funil"
      periodo={periodo}
      onMudarPeriodo={definirPeriodo}
      canManage={canManage}
      queryFn={buscarFunilCancer}
      syncFn={sincronizarCancer}
      errorTitulo="Não foi possível carregar o funil"
      descricaoGuardaPeriodo="Selecione o período para carregar o funil."
      mensagemVazio={(resposta) =>
        resposta.casos.length === 0
          ? 'Nenhum caso positivo neste período. Verifique o período ou sincronize com o LIS.'
          : 'Nenhum caso neste filtro.'
      }
      linhas={(resposta) => (filtro ? resposta.casos.filter((caso) => casoNoFiltro(caso, filtro)) : resposta.casos)}
      colunas={(resposta) => criarColunas(resposta.parametrosFixos, canManage)}
      tituloTabela="Casos positivos do período"
      cor="rose"
      chaveLinha={(caso) => caso.id}
      onClickLinha={(caso) => setIdSelecionado(caso.id)}
      extraCabecalhoTabela={(resposta) => (
        <>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-indigo-300 bg-indigo-500/[.06] px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:border-indigo-400/55 dark:text-indigo-300">
            <Sparkles className="h-3 w-3" aria-hidden />
            Sugestão automática: confira no laudo antes de confirmar
          </span>
          {filtro && (
            <button
              type="button"
              onClick={() => setFiltro(null)}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-gray-100 py-0.5 pl-2.5 pr-2 text-xs font-medium text-gray-900 transition-colors hover:bg-gray-200 dark:border-white/[.14] dark:bg-white/[.06] dark:text-slate-100 dark:hover:bg-white/10"
            >
              Filtro: {ROTULO_FILTRO[filtro]} ({resposta.casos.filter((caso) => casoNoFiltro(caso, filtro)).length})
              <X className="h-3.5 w-3.5" aria-label="Limpar filtro" />
            </button>
          )}
        </>
      )}
      acimaDaTabela={(resposta) => {
        if (!resposta) return null;
        return (
          <>
            {resposta.retificacaoPendente > 0 && (
              <div className="flex items-center gap-2 rounded-2xl bg-red-50 p-4 text-red-800 dark:bg-red-900/20 dark:text-red-300">
                <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
                <p className="text-sm font-medium">
                  {resposta.retificacaoPendente} caso(s) já exportado(s) tiveram o laudo alterado (R8) — revisão urgente.
                </p>
              </div>
            )}

            <Funil resposta={resposta} filtro={filtro} onFiltrar={setFiltro} />

            <ExportacaoRhcCard
              canManage={canManage}
              casosProntos={resposta.casos.filter((caso) => etapaDoCaso(caso) === 'pronto').length}
            />
          </>
        );
      }}
      drawer={(resposta) =>
        idSelecionado && resposta ? (
          <CasoDrawer
            id={idSelecionado}
            parametrosFixos={resposta.parametrosFixos}
            canManage={canManage}
            onFechar={() => setIdSelecionado(null)}
          />
        ) : null
      }
    />
  );
}
