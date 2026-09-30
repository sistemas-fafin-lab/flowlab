import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Lock, X, XCircle } from 'lucide-react';
import DatePicker from '../../../components/DatePicker';
import { chamarApi } from '../hooks/useContasReceber';
import type { LotePreviaAplis, NfAPreencherAplis, PreviaAplis } from '../types';
import { formatCurrency, formatData } from '../utils/formato';
import {
  corpoTituloAplis,
  corteAplisPadrao,
  emParalelo,
  PISO_CORTE_APLIS,
  resumoExecucao,
  selecaoPadraoAplis,
  selecaoPadraoNfs,
} from '../utils/atualizarAplis';
import type { CorpoTituloAplis, EstadoCriacao, EstadoPreenchimentoNf } from '../utils/atualizarAplis';

// Prévia do "Atualizar do apLIS": lotes fechados no apLIS a partir da data de
// corte que ainda não têm título (.scratch/faturamento-titulos-automaticos).
// O operador desmarca as exceções e confirma: cada lote marcado vira um título
// por uma chamada própria a titulo-criar — a mesma rota do "Novo título".
// Numa segunda seção, os títulos existentes sem número cujo lote já tem NF-e no
// apLIS: cada um marcado é preenchido por titulo-atualizar-numero-nota com
// somenteSeVazio (nunca sobrescreve um número digitado; o vencimento não muda).
//
// Um GET por data de corte, sem paginação: um mês tem ~200 lotes.

/** Chamadas simultâneas a titulo-criar. Cada uma leva ~6–8 s (4 consultas ao
 *  apLIS pelo túnel + Supabase); mais que isso só disputa o mesmo túnel. */
const CRIACOES_EM_PARALELO = 4;

const CAMPO =
  'mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100';

interface Props {
  aberto: boolean;
  onFechar: () => void;
  /** Ao menos um título foi criado ou teve a NF preenchida: a lista de títulos
   *  precisa ser relida. */
  onAlterados: () => void;
}

interface ResultadoLinha {
  estado: EstadoCriacao;
  mensagem?: string;
}

interface ResultadoNf {
  estado: EstadoPreenchimentoNf;
  mensagem?: string;
}

/** Uma fila só para as duas seções: as NFs vão primeiro (uma RPC cada, rápidas)
 *  e os títulos depois (~6–8 s cada). */
type Tarefa = { tipo: 'nf'; nf: NfAPreencherAplis } | { tipo: 'titulo'; item: LotePreviaAplis };

// Não usa o criarTitulo do hook: ele relê a lista a cada título (seriam ~180
// recargas); aqui a lista é relida uma vez, no fim. chamarApi lê o token a cada
// chamada — a execução passa de 5 min e o supabase-js renova a sessão por baixo.
function criarTituloDoLote(corpo: CorpoTituloAplis) {
  return chamarApi<{ dataVencimento?: string | null }>(
    '/api/faturamento/titulo-criar',
    'Não foi possível criar o título.',
    { method: 'POST', body: corpo },
  );
}

function preencherNf(nf: NfAPreencherAplis) {
  return chamarApi<{ resultado?: 'atualizado' | 'ja-preenchido' }>(
    '/api/faturamento/titulo-atualizar-numero-nota',
    'Não foi possível preencher o número da nota.',
    { method: 'POST', body: { idNota: nf.idNota, numeroNota: nf.nfeNumeros[0], somenteSeVazio: true } },
  );
}

/** timestamptz → DD/MM no fuso da operação. */
function diaMes(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
  });
}

const Selo: React.FC<{ cor: 'amber' | 'blue' | 'gray' | 'rose'; children: React.ReactNode }> = ({ cor, children }) => {
  const cores = {
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300',
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
    gray: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
    rose: 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300',
  };
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] ${cores[cor]}`}>{children}</span>;
};

function EstadoLinha({ resultado }: { resultado: ResultadoLinha | undefined }) {
  if (!resultado) return null;
  const { estado, mensagem } = resultado;
  if (estado === 'aguardando') return <span className="text-xs text-gray-400">na fila</span>;
  if (estado === 'criando') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> criando…
      </span>
    );
  }
  if (estado === 'criado') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="w-3.5 h-3.5" /> criado{mensagem ? ` · ${mensagem}` : ''}
      </span>
    );
  }
  return (
    <span className="inline-flex items-start gap-1 text-xs text-red-600 dark:text-red-400">
      <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> falhou: {mensagem}
    </span>
  );
}

function EstadoNf({ resultado }: { resultado: ResultadoNf | undefined }) {
  if (!resultado) return null;
  const { estado, mensagem } = resultado;
  if (estado === 'aguardando') return <span className="text-xs text-gray-400">na fila</span>;
  if (estado === 'preenchendo') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> preenchendo…
      </span>
    );
  }
  if (estado === 'preenchido') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="w-3.5 h-3.5" /> preenchida
      </span>
    );
  }
  if (estado === 'ja-preenchido') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
        <AlertTriangle className="w-3.5 h-3.5" /> já preenchida — o número digitado foi mantido
      </span>
    );
  }
  return (
    <span className="inline-flex items-start gap-1 text-xs text-red-600 dark:text-red-400">
      <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> falhou: {mensagem}
    </span>
  );
}

function Selos({ item }: { item: LotePreviaAplis }) {
  const { desvinculado } = item;
  return (
    <div className="flex flex-wrap gap-1">
      {item.jaRecebidoAplis && <Selo cor="blue">já recebido no apLIS</Selo>}
      {item.semNf && <Selo cor="amber">sem NF — a baixa exige o número</Selo>}
      {item.emissaoMesAnterior && <Selo cor="gray">emissão em mês anterior</Selo>}
      {desvinculado && (
        <Selo cor="rose">
          desvinculado do título {desvinculado.numeroNota ?? '(sem número)'} em {diaMes(desvinculado.em)}:{' '}
          {desvinculado.motivo}
        </Selo>
      )}
    </div>
  );
}

const AtualizarAplisModal: React.FC<Props> = ({ aberto, onFechar, onAlterados }) => {
  const [desde, setDesde] = useState(() => corteAplisPadrao());
  const [previa, setPrevia] = useState<PreviaAplis | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [resultados, setResultados] = useState<Map<number, ResultadoLinha>>(new Map());
  const [selecionadasNf, setSelecionadasNf] = useState<Set<string>>(new Set());
  const [resultadosNf, setResultadosNf] = useState<Map<string, ResultadoNf>>(new Map());
  const [executando, setExecutando] = useState(false);
  const [resumo, setResumo] = useState<string | null>(null);
  // Identifica a execução em curso. Fechar o modal troca o id: a execução velha
  // para de iniciar lotes e deixa de mexer na tela (os que já estão no ar
  // terminam no servidor — o que foi criado fica, e reabrir mostra o que falta).
  const execucaoRef = useRef(0);

  // O servidor recusa data antes do piso; o campo nem deixa chegar lá.
  const alterarDesde = (valor: string) => {
    if (!valor) return;
    setDesde(valor < PISO_CORTE_APLIS ? PISO_CORTE_APLIS : valor);
  };

  const fechar = useCallback(() => {
    if (
      executando &&
      !window.confirm(
        'A atualização ainda está em andamento. Se fechar agora, o que ainda não começou fica para a próxima vez (o que já foi feito não é desfeito). Fechar mesmo assim?',
      )
    ) {
      return;
    }
    execucaoRef.current += 1;
    setDesde(corteAplisPadrao());
    setPrevia(null);
    setErro(null);
    setSelecionados(new Set());
    setResultados(new Map());
    setSelecionadasNf(new Set());
    setResultadosNf(new Map());
    setExecutando(false);
    setResumo(null);
    onFechar();
  }, [executando, onFechar]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const params = new URLSearchParams({ desde });
      const body = await chamarApi<Partial<PreviaAplis>>(
        `/api/faturamento/titulos-aplis-previa?${params.toString()}`,
        'Não foi possível consultar o apLIS.',
      );
      const lotes = body.lotes ?? [];
      const nfsAPreencher = body.nfsAPreencher ?? [];
      setPrevia({ desde: body.desde ?? desde, lotes, nfsAPreencher });
      setSelecionados(selecaoPadraoAplis(lotes));
      setResultados(new Map());
      setSelecionadasNf(selecaoPadraoNfs(nfsAPreencher));
      setResultadosNf(new Map());
      setResumo(null);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível consultar o apLIS.');
      setPrevia(null);
    } finally {
      setCarregando(false);
    }
  }, [desde]);

  useEffect(() => {
    if (aberto) void carregar();
  }, [aberto, carregar]);

  // Sair da página também encerra a execução (como fechar o modal): sem isto,
  // os lotes restantes continuariam sendo criados sem ninguém vendo.
  useEffect(() => () => {
    execucaoRef.current += 1;
  }, []);

  useEffect(() => {
    if (!executando) return;
    const avisar = (evento: BeforeUnloadEvent) => evento.preventDefault();
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [executando]);

  const alternar = (idLote: number) => {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(idLote)) novo.delete(idLote);
      else novo.add(idLote);
      return novo;
    });
  };

  const alternarNf = (idNota: string) => {
    setSelecionadasNf((atual) => {
      const novo = new Set(atual);
      if (novo.has(idNota)) novo.delete(idNota);
      else novo.add(idNota);
      return novo;
    });
  };

  const confirmar = async () => {
    const alvos = (previa?.lotes ?? []).filter(
      (item) => item.bloqueio === null && selecionados.has(item.lote.idLote),
    );
    const alvosNf = (previa?.nfsAPreencher ?? []).filter(
      (nf) => nf.situacao === 'preenchivel' && selecionadasNf.has(nf.idNota),
    );
    if (alvos.length === 0 && alvosNf.length === 0) return;

    const execucao = ++execucaoRef.current;
    const vigente = () => execucaoRef.current === execucao;
    const estados = new Map<number, ResultadoLinha>(
      alvos.map((item) => [item.lote.idLote, { estado: 'aguardando' }]),
    );
    const estadosNf = new Map<string, ResultadoNf>(
      alvosNf.map((nf) => [nf.idNota, { estado: 'aguardando' }]),
    );
    const marcar = (idLote: number, resultado: ResultadoLinha) => {
      estados.set(idLote, resultado);
      if (vigente()) setResultados(new Map(estados));
    };
    const marcarNf = (idNota: string, resultado: ResultadoNf) => {
      estadosNf.set(idNota, resultado);
      if (vigente()) setResultadosNf(new Map(estadosNf));
    };

    setResultados(new Map(estados));
    setResultadosNf(new Map(estadosNf));
    setResumo(null);
    setExecutando(true);

    const tarefas: Tarefa[] = [
      ...alvosNf.map((nf): Tarefa => ({ tipo: 'nf', nf })),
      ...alvos.map((item): Tarefa => ({ tipo: 'titulo', item })),
    ];
    // Um "hoje" para a execução inteira: a observação não muda de dia no meio.
    const hoje = new Date();
    await emParalelo(
      tarefas,
      CRIACOES_EM_PARALELO,
      async (tarefa) => {
        if (tarefa.tipo === 'nf') {
          const { idNota } = tarefa.nf;
          marcarNf(idNota, { estado: 'preenchendo' });
          try {
            const { resultado } = await preencherNf(tarefa.nf);
            marcarNf(idNota, { estado: resultado === 'ja-preenchido' ? 'ja-preenchido' : 'preenchido' });
          } catch (err) {
            marcarNf(idNota, {
              estado: 'falhou',
              mensagem: err instanceof Error ? err.message : 'Não foi possível preencher o número da nota.',
            });
          }
          return;
        }
        const { item } = tarefa;
        const { idLote } = item.lote;
        marcar(idLote, { estado: 'criando' });
        try {
          const { dataVencimento } = await criarTituloDoLote(corpoTituloAplis(item.lote, hoje));
          marcar(idLote, {
            estado: 'criado',
            mensagem: dataVencimento ? `vence ${formatData(dataVencimento)}` : 'sem vencimento',
          });
        } catch (err) {
          marcar(idLote, {
            estado: 'falhou',
            mensagem: err instanceof Error ? err.message : 'Não foi possível criar o título.',
          });
        }
      },
      () => !vigente(),
    );

    const { criados, nfsPreenchidas, texto } = resumoExecucao(
      [...estados.values()].map((r) => r.estado),
      [...estadosNf.values()].map((r) => r.estado),
    );
    if (criados > 0 || nfsPreenchidas > 0) onAlterados();
    if (!vigente()) return;
    setExecutando(false);
    setResumo(texto);
  };

  if (!aberto) return null;

  const lotes = previa?.lotes ?? [];
  const validos = lotes.filter((item) => item.bloqueio === null);
  const marcados = validos.filter((item) => selecionados.has(item.lote.idLote));
  const totalMarcados = marcados.reduce((soma, item) => soma + item.lote.valor, 0);
  // Depois de confirmar, a prévia vira o relatório da execução: sem mexer na
  // seleção nem na data (reabrir o modal traz o que ainda falta).
  const nfs = previa?.nfsAPreencher ?? [];
  const nfsValidas = nfs.filter((nf) => nf.situacao === 'preenchivel');
  const nfsMarcadas = nfsValidas.filter((nf) => selecionadasNf.has(nf.idNota));
  const travado = executando || resultados.size > 0 || resultadosNf.size > 0;
  const todosMarcados = validos.length > 0 && marcados.length === validos.length;
  const todasNfsMarcadas = nfsValidas.length > 0 && nfsMarcadas.length === nfsValidas.length;
  const totalTarefas = resultados.size + resultadosNf.size;
  const concluidos =
    [...resultados.values()].filter((r) => r.estado === 'criado' || r.estado === 'falhou').length
    + [...resultadosNf.values()].filter(
      (r) => r.estado === 'preenchido' || r.estado === 'ja-preenchido' || r.estado === 'falhou',
    ).length;
  const rotuloConfirmar = [
    marcados.length > 0 && `criar ${marcados.length} título${marcados.length === 1 ? '' : 's'}`,
    nfsMarcadas.length > 0 && `preencher ${nfsMarcadas.length} NF${nfsMarcadas.length === 1 ? '' : 's'}`,
  ].filter(Boolean).join(' e ') || 'nada marcado'; // botão desabilitado nesse caso

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Atualizar do apLIS</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Lotes fechados no apLIS que ainda não têm título e NFs a preencher · dados do apLIS até ontem
            </p>
          </div>
          <button
            type="button"
            onClick={fechar}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <label className="inline-block text-xs text-gray-500 dark:text-gray-400">
            Fechados a partir de
            <DatePicker value={desde} onChange={alterarDesde} controlClass={CAMPO} disabled={travado} />
            <span className="mt-1 block text-[11px] text-gray-400">
              Mínimo {formatData(PISO_CORTE_APLIS)} — os anteriores já foram lançados
            </span>
          </label>

          <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
            {carregando ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500 dark:text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" /> Consultando o apLIS…
              </div>
            ) : erro ? (
              <div className="p-4 text-sm text-red-600 dark:text-red-400 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{erro}</span>
              </div>
            ) : lotes.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                Nenhum lote novo: todos os lotes fechados desde {formatData(desde)} já têm título.
              </div>
            ) : (
              <div className="max-h-[55vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/40 sticky top-0">
                    <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
                      <th className="px-3 py-2 w-8">
                        <input
                          type="checkbox"
                          checked={todosMarcados}
                          disabled={travado || validos.length === 0}
                          onChange={() =>
                            setSelecionados(
                              todosMarcados ? new Set() : new Set(validos.map((item) => item.lote.idLote)),
                            )
                          }
                          className="rounded border-gray-300 dark:border-gray-600"
                          aria-label="Marcar todos"
                        />
                      </th>
                      <th className="px-3 py-2">Operadora</th>
                      <th className="px-3 py-2">Lote</th>
                      <th className="px-3 py-2 text-right">Valor</th>
                      <th className="px-3 py-2">Emissão</th>
                      <th className="px-3 py-2">Fechamento</th>
                      <th className="px-3 py-2">NF</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {lotes.map((item) => {
                      const { lote } = item;
                      const bloqueado = item.bloqueio !== null;
                      return (
                        <tr key={lote.idLote} className={bloqueado ? 'opacity-60' : undefined}>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={!bloqueado && selecionados.has(lote.idLote)}
                              disabled={bloqueado || travado}
                              onChange={() => alternar(lote.idLote)}
                              className="rounded border-gray-300 dark:border-gray-600"
                              aria-label={`Criar título do lote ${lote.idLote}`}
                            />
                          </td>
                          <td className="px-3 py-2 text-gray-700 dark:text-gray-200 truncate max-w-[220px]">
                            {lote.fontePagadora.nome ?? lote.fontePagadora.razaoSocial ?? '—'}
                          </td>
                          <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100 tabular-nums">
                            {lote.idLote}
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-gray-900 dark:text-gray-100 tabular-nums">
                            {formatCurrency(lote.valor)}
                          </td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-300 tabular-nums">
                            {formatData(lote.dtaCriacao)}
                          </td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-300 tabular-nums">
                            {formatData(lote.dtaFechamento)}
                          </td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-300 tabular-nums">
                            {lote.nfeNumero ?? '—'}
                          </td>
                          <td className="px-3 py-2">
                            {bloqueado && (
                              <span className="mb-1 inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                <Lock className="w-3.5 h-3.5" /> sem valor a faturar
                              </span>
                            )}
                            <Selos item={item} />
                            <div className="mt-1">
                              <EstadoLinha resultado={resultados.get(lote.idLote)} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {!carregando && !erro && lotes.length > 0 && !travado && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {marcados.length} de {validos.length} lote{validos.length === 1 ? '' : 's'} marcado
              {marcados.length === 1 ? '' : 's'} ·{' '}
              <strong className="tabular-nums">{formatCurrency(totalMarcados)}</strong>
              {lotes.length > validos.length && (
                <> · {lotes.length - validos.length} sem valor a faturar</>
              )}
            </p>
          )}

          {!carregando && !erro && nfs.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                NFs a preencher
                <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                  títulos sem número cujo lote já tem NF-e no apLIS · o vencimento não muda
                </span>
              </h3>
              <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden max-h-[35vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/40 sticky top-0">
                    <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
                      <th className="px-3 py-2 w-8">
                        <input
                          type="checkbox"
                          checked={todasNfsMarcadas}
                          disabled={travado || nfsValidas.length === 0}
                          onChange={() =>
                            setSelecionadasNf(
                              todasNfsMarcadas ? new Set() : new Set(nfsValidas.map((nf) => nf.idNota)),
                            )
                          }
                          className="rounded border-gray-300 dark:border-gray-600"
                          aria-label="Marcar todas as NFs"
                        />
                      </th>
                      <th className="px-3 py-2">Operadora</th>
                      <th className="px-3 py-2">Lote</th>
                      <th className="px-3 py-2">NF-e</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {nfs.map((nf) => {
                      const divergente = nf.situacao === 'divergente';
                      return (
                        <tr key={nf.idNota} className={divergente ? 'opacity-60' : undefined}>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={!divergente && selecionadasNf.has(nf.idNota)}
                              disabled={divergente || travado}
                              onChange={() => alternarNf(nf.idNota)}
                              className="rounded border-gray-300 dark:border-gray-600"
                              aria-label={`Preencher a NF do título dos lotes ${nf.idsLote.join(', ')}`}
                            />
                          </td>
                          <td className="px-3 py-2 text-gray-700 dark:text-gray-200 truncate max-w-[220px]">
                            {nf.operadora}
                          </td>
                          <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100 tabular-nums">
                            {nf.idsLote.join(', ')}
                          </td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-300 tabular-nums">
                            {nf.nfeNumeros.join(', ')}
                          </td>
                          <td className="px-3 py-2">
                            {divergente && (
                              <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                <Lock className="w-3.5 h-3.5" /> NFs divergentes — preencha à mão
                              </span>
                            )}
                            <EstadoNf resultado={resultadosNf.get(nf.idNota)} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {executando && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                <span>
                  Atualizando: <strong className="tabular-nums">{concluidos}</strong> de{' '}
                  <strong className="tabular-nums">{totalTarefas}</strong>
                </span>
                <span className="text-amber-700 dark:text-amber-300">
                  Não feche esta janela até terminar — cada título leva alguns segundos.
                </span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all"
                  style={{ width: `${totalTarefas ? (concluidos / totalTarefas) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {resumo && (
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{resumo}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 dark:border-gray-700">
          <button
            type="button"
            onClick={fechar}
            className="px-4 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Fechar
          </button>
          {!travado && (
            <button
              type="button"
              onClick={() => void confirmar()}
              disabled={carregando || (marcados.length === 0 && nfsMarcadas.length === 0)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {rotuloConfirmar.charAt(0).toUpperCase() + rotuloConfirmar.slice(1)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AtualizarAplisModal;
