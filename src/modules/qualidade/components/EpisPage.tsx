// Aba EPIs da Qualidade: escolhe o mês, vê as áreas com EPI entregue (e o aviso de pedidos
// de EPI do mês ainda não entregues) e gera o PDF do Relatório mensal de EPI de cada área,
// calculado na hora ou, com a área fechada, das linhas congeladas. Quem tem "Fechar relatórios
// de EPI" fecha e reabre a área, com motivo, e anexa o PDF assinado e digitalizado; quem tem
// "Ver relatórios de EPI" abre qualquer PDF assinado (.scratch/epi-relatorio-mensal/spec.md,
// histórias 16–42).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, FileCheck2, FileDown, HardHat, History, Loader2, Lock, Paperclip, Unlock, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../../hooks/useAuth';
import { hasPermission } from '../../../utils/permissions';
import { anoAtual } from '../anoAtual.js';
import {
  anexoMaisRecenteEpi,
  historicoFechamentoEpi,
  linhasDoRelatorioEpi,
  listarAreasEpiDoMes,
  montarLinhasEpi,
  TAMANHO_MAXIMO_PDF_ASSINADO_EPI,
  transicaoFechamentoEpi,
  validarPdfAssinadoEpi,
  type AcaoFechamentoEpi,
  type AreaEpiDoMes,
  type EventoFechamentoEpi,
  type SituacaoAreaEpi,
} from '../domain/epiRelatorioMensal.js';
import { mesPorExtenso, montarPdfRelatorioEpi, nomeArquivoRelatorioEpi } from '../domain/pdfRelatorioEpi.js';
import {
  anexarRelatorioEpi,
  buscarDadosRelatorioEpi,
  buscarFechamentosEpi,
  fecharRelatorioEpi,
  reabrirRelatorioEpi,
  urlPdfAssinadoEpi,
  type FechamentoEpiGravado,
} from '../epis.js';
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

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const botaoSecundario =
  'inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-4 py-2 text-sm font-medium text-slate-700 transition-all duration-200 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10';

const botaoPrimario =
  'inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-blue-500/25 transition-all duration-200 hover:from-blue-600 hover:to-blue-700 disabled:opacity-50';

type TipoAcao = AcaoFechamentoEpi['tipo'];

const ACAO: Record<TipoAcao, { rotulo: string; Icone: typeof Lock }> = {
  fechar: { rotulo: 'Fechar', Icone: Lock },
  reabrir: { rotulo: 'Reabrir', Icone: Unlock },
  anexar: { rotulo: 'Anexar assinado', Icone: Paperclip },
};

type Dialogo = { tipo: TipoAcao; area: AreaEpiDoMes; fechamento?: FechamentoEpiGravado } | null;

/**
 * Abre o PDF assinado numa aba nova por signed URL. A aba abre já no clique (antes do await):
 * aberta depois, o navegador bloqueia como pop-up. Devolve a mensagem de erro, se houver.
 */
async function abrirPdfAssinado(caminho: string): Promise<string | null> {
  const janela = window.open('', '_blank');
  try {
    const url = await urlPdfAssinadoEpi(caminho);
    if (janela) {
      janela.opener = null;
      janela.location.href = url;
    } else {
      window.location.href = url;
    }
    return null;
  } catch (e) {
    janela?.close();
    return e instanceof Error ? e.message : 'Não foi possível abrir o PDF assinado.';
  }
}

const SEM_EPI_ENTREGUE = 'Nenhum EPI entregue nesta área no mês';

/** Consultas da tela: os dados do mês (solicitações, produtos, movimentações) e os fechamentos. */
const consultaDadosEpi = (mes: string) => ({
  queryKey: ['qualidade-epis', mes],
  queryFn: () => buscarDadosRelatorioEpi(mes),
});
const consultaFechamentosEpi = (mes: string) => ({
  queryKey: ['qualidade-epis-fechamentos', mes],
  queryFn: () => buscarFechamentosEpi(mes),
});

export function Epis() {
  const [periodo, setPeriodo] = useState({ inicio: '', fim: '' });
  const [filtroArea, setFiltroArea] = useState(TODAS);

  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [historicoAberto, setHistoricoAberto] = useState<string | null>(null);
  const [erroAbrir, setErroAbrir] = useState<string | null>(null);
  const abrir = async (caminho: string) => {
    setErroAbrir(null);
    setErroAbrir(await abrirPdfAssinado(caminho));
  };
  const mes = periodo.inicio && periodo.fim ? periodo.inicio.slice(0, 7) : '';
  const { userProfile } = useAuth();
  const podeFechar = hasPermission(userProfile?.permissions || [], 'canCloseEpiReport');

  const dadosQuery = useQuery({ ...consultaDadosEpi(mes), enabled: Boolean(mes) });
  const fechamentosQuery = useQuery({ ...consultaFechamentosEpi(mes), enabled: Boolean(mes) });
  const data = dadosQuery.data;
  const fechamentos = fechamentosQuery.data;
  const isLoading = dadosQuery.isLoading || fechamentosQuery.isLoading;
  const isError = dadosQuery.isError || fechamentosQuery.isError;
  const refetch = () => {
    dadosQuery.refetch();
    fechamentosQuery.refetch();
  };

  const fechamentoPorArea = useMemo(() => new Map((fechamentos ?? []).map((f) => [f.area, f])), [fechamentos]);
  const areas = useMemo(
    () => (data && fechamentos ? listarAreasEpiDoMes(data, mes, fechamentos) : []),
    [data, fechamentos, mes],
  );
  const visiveis = filtroArea === TODAS ? areas : areas.filter((a) => a.area === filtroArea);
  const pronto = Boolean(data && fechamentos);

  function gerarPdf(area: string) {
    if (!data) return;
    const linhas = linhasDoRelatorioEpi(data, { area, mes }, fechamentoPorArea.get(area));
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

      {mes && pronto && areas.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Nenhum EPI entregue nem pedido em {mesPorExtenso(mes)}.
        </p>
      )}

      {mes && pronto && areas.length > 0 && (
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

          {erroAbrir && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {erroAbrir}
            </p>
          )}

          <ul className="space-y-2">
            {visiveis.map((a) => {
              const fechamento = fechamentoPorArea.get(a.area);
              const historico = historicoFechamentoEpi(
                fechamento,
                fechamento?.reaberturas ?? [],
                fechamento?.anexos ?? [],
              );
              const podeFecharArea = transicaoFechamentoEpi(a.situacao, { tipo: 'fechar' }).ok;
              const podeAnexarArea = transicaoFechamentoEpi(a.situacao, { tipo: 'anexar' }).ok;
              const assinado = a.situacao === 'assinado' ? anexoMaisRecenteEpi(fechamento?.anexos ?? []) : undefined;
              const mostrarHistorico = historicoAberto === a.area;
              return (
                <li key={a.area} className="glass-surface rounded-2xl px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
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
                            {plural(
                              a.pendentes,
                              'pedido de EPI do mês ainda não entregue',
                              'pedidos de EPI do mês ainda não entregues',
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {historico.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setHistoricoAberto(mostrarHistorico ? null : a.area)}
                          aria-expanded={mostrarHistorico}
                          className={botaoSecundario}
                        >
                          <History className="h-4 w-4" aria-hidden />
                          Histórico
                        </button>
                      )}
                      {podeFechar &&
                        (podeFecharArea ? (
                          <button
                            type="button"
                            onClick={() => setDialogo({ tipo: 'fechar', area: a })}
                            disabled={a.linhas === 0}
                            title={a.linhas === 0 ? SEM_EPI_ENTREGUE : undefined}
                            className={botaoSecundario}
                          >
                            <Lock className="h-4 w-4" aria-hidden />
                            Fechar
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDialogo({ tipo: 'reabrir', area: a })}
                            className={botaoSecundario}
                          >
                            <Unlock className="h-4 w-4" aria-hidden />
                            Reabrir
                          </button>
                        ))}
                      {podeFechar && podeAnexarArea && fechamento && (
                        <button
                          type="button"
                          onClick={() => setDialogo({ tipo: 'anexar', area: a, fechamento })}
                          className={botaoSecundario}
                        >
                          <Paperclip className="h-4 w-4" aria-hidden />
                          Anexar assinado
                        </button>
                      )}
                      {assinado && (
                        <button
                          type="button"
                          onClick={() => abrir(assinado.caminho)}
                          title={`${assinado.nomeArquivo}, enviado por ${assinado.enviadoPor} em ${dataHora(assinado.enviadoEm)}`}
                          className={botaoSecundario}
                        >
                          <FileCheck2 className="h-4 w-4" aria-hidden />
                          Ver assinado
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => gerarPdf(a.area)}
                        disabled={a.linhas === 0}
                        title={a.linhas === 0 ? SEM_EPI_ENTREGUE : undefined}
                        className={botaoPrimario}
                      >
                        <FileDown className="h-4 w-4" aria-hidden />
                        Gerar PDF
                      </button>
                    </div>
                  </div>
                  {mostrarHistorico && <HistoricoArea eventos={historico} aoAbrir={abrir} />}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {dialogo && (
        <DialogoFechamento
          tipo={dialogo.tipo}
          area={dialogo.area}
          fechamento={dialogo.fechamento}
          mes={mes}
          aoFechar={() => setDialogo(null)}
        />
      )}
    </div>
  );
}

const EVENTO: Record<EventoFechamentoEpi['tipo'], string> = {
  fechou: 'Fechado',
  reabriu: 'Reaberto',
  anexou: 'PDF assinado anexado',
};

function HistoricoArea({ eventos, aoAbrir }: { eventos: EventoFechamentoEpi[]; aoAbrir: (caminho: string) => void }) {
  return (
    <ol className="mt-3 space-y-1.5 border-t border-slate-200/60 pt-3 text-xs text-slate-600 dark:border-white/10 dark:text-slate-300">
      {eventos.map((e, i) => (
        <li key={i}>
          <span className="font-medium">{EVENTO[e.tipo]}</span> por {e.por} em {dataHora(e.em)}
          {e.tipo === 'reabriu' && <span className="text-slate-500 dark:text-slate-400"> — motivo: {e.motivo}</span>}
          {e.tipo === 'anexou' && (
            <>
              {' — '}
              <button
                type="button"
                onClick={() => aoAbrir(e.caminho)}
                className="font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
              >
                {e.nomeArquivo}
              </button>
            </>
          )}
        </li>
      ))}
    </ol>
  );
}

interface DialogoFechamentoProps {
  tipo: TipoAcao;
  area: AreaEpiDoMes;
  /** O fechamento a que o PDF assinado é anexado (só para anexar). */
  fechamento?: FechamentoEpiGravado;
  mes: string;
  aoFechar: () => void;
}

function DialogoFechamento({ tipo, area, fechamento, mes, aoFechar }: DialogoFechamentoProps) {
  const queryClient = useQueryClient();
  const [motivo, setMotivo] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const mutacao = useMutation({
    mutationFn: async () => {
      if (tipo === 'reabrir') return reabrirRelatorioEpi(area.area, mes, motivo.trim());
      if (tipo === 'anexar') {
        if (!fechamento || !arquivo) throw new Error('Escolha o PDF assinado.');
        return anexarRelatorioEpi(fechamento, mes, arquivo);
      }
      // Congela o conteúdo atual: busca de novo, sem confiar no cache da tela.
      const dados = await queryClient.fetchQuery({ ...consultaDadosEpi(mes), staleTime: 0 });
      return fecharRelatorioEpi(area.area, mes, montarLinhasEpi(dados, { area: area.area, mes }));
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: consultaFechamentosEpi(mes).queryKey });
      aoFechar();
    },
    onError: (e) => setErro(e instanceof Error ? e.message : 'Não foi possível concluir. Tente novamente.'),
  });

  function confirmar() {
    const acao: AcaoFechamentoEpi = tipo === 'reabrir' ? { tipo, motivo } : { tipo };
    const transicao = transicaoFechamentoEpi(area.situacao, acao);
    if ('erro' in transicao) {
      setErro(transicao.erro);
      return;
    }
    if (tipo === 'anexar') {
      const invalido = arquivo ? validarPdfAssinadoEpi(arquivo) : 'Escolha o PDF assinado.';
      if (invalido) {
        setErro(invalido);
        return;
      }
    }
    setErro(null);
    mutacao.mutate();
  }

  const { rotulo, Icone } = ACAO[tipo];
  const titulo = `${rotulo} ${area.area} — ${mesPorExtenso(mes)}`;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-20 sm:pt-24"
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={mutacao.isPending ? undefined : aoFechar}
      />
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200/50 bg-white shadow-2xl dark:border-white/10 dark:bg-gray-800">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-white/10">
          <div className="flex items-center gap-2">
            <Icone className="h-5 w-5 shrink-0 text-blue-500" aria-hidden />
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">{titulo}</h2>
          </div>
          <button
            type="button"
            onClick={aoFechar}
            disabled={mutacao.isPending}
            aria-label="Fechar"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-white/5"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <form
          className="space-y-4 px-5 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!mutacao.isPending) confirmar();
          }}
        >
          {tipo === 'fechar' ? (
            <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
              <p>
                As {plural(area.linhas, 'linha atual fica congelada', 'linhas atuais ficam congeladas')}: o PDF passa a
                sair desse conteúdo, mesmo que solicitações ou produtos mudem depois.
              </p>
              {area.pendentes > 0 && (
                <p className="flex items-start gap-1.5 font-medium text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  Atenção:{' '}
                  {plural(
                    area.pendentes,
                    'pedido de EPI do mês ainda não foi entregue',
                    'pedidos de EPI do mês ainda não foram entregues',
                  )}{' '}
                  e não {area.pendentes === 1 ? 'entrará' : 'entrarão'} no relatório fechado.
                </p>
              )}
            </div>
          ) : tipo === 'anexar' ? (
            <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
              <p>
                Anexe o PDF do relatório impresso, assinado e digitalizado. A área passa para assinado; os PDFs
                anexados antes continuam no histórico.
              </p>
              <label className="flex flex-col gap-1 font-medium text-slate-700 dark:text-slate-200">
                PDF assinado (até {TAMANHO_MAXIMO_PDF_ASSINADO_EPI / (1024 * 1024)} MB)
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(e) => {
                    setErro(null);
                    setArquivo(e.target.files?.[0] ?? null);
                  }}
                  className="text-sm font-normal text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-blue-700 dark:text-slate-300 dark:file:bg-blue-500/10 dark:file:text-blue-300"
                />
              </label>
            </div>
          ) : (
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
              Motivo da reabertura
              <textarea
                autoFocus
                rows={3}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className={`${campoFiltro} resize-y`}
                placeholder="Ex.: faltou a entrega de uma luva na solicitação de 05/10"
              />
            </label>
          )}

          {erro && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400">
              {erro}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={aoFechar} disabled={mutacao.isPending} className={botaoSecundario}>
              Cancelar
            </button>
            <button type="submit" disabled={mutacao.isPending} className={botaoPrimario}>
              {mutacao.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Icone className="h-4 w-4" aria-hidden />
              )}
              {rotulo}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
