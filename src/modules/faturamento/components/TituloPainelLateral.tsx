import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Pencil,
  Unlink,
  X,
} from 'lucide-react';
import type {
  AlteracaoLancamento,
  DivergenciaAplis,
  GlosaAplisTitulo,
  TituloBaixa,
  TituloGuia,
  TituloLote,
  TituloReceber,
} from '../types';
import ListaResumida from './ListaResumida';
import MotivoDesativacaoBox from './MotivoDesativacaoBox';
import { Atraso, SeloAplis } from './TituloSelos';
import { rotuloStatusAplis, STATUS_GLOSA_DASHBOARD } from '../utils/recursoGlosaVisual';
import { formatCurrency, formatData, formatDataHora } from '../utils/formato';
import { dataEnvioEfetiva } from '../utils/envioAoVivo';
import { descreverAlteracao } from '../utils/correcaoLancamento';
import { STATUS_CORES, STATUS_ROTULOS } from '../utils/tituloStatus';

// Detalhes de um título num painel lateral (.scratch/titulos-painel-lateral):
// baixas, glosas do apLIS, alterações e lotes → guias. Montado com `key` do
// título, então o estado abaixo é sempre de um título só — sem os mapas por id
// que a antiga linha expansível precisava. As guias só são buscadas quando o
// operador abre o lote: são dezenas por lote e só interessam na hora de
// conferir uma glosa.

interface Props {
  /** Sempre a versão atual da lista: baixa, edição e cancelamento chegam aqui pelo refetch. */
  titulo: TituloReceber;
  divergencia: DivergenciaAplis | undefined;
  nfAposPagamento: boolean;
  podeEditar: boolean;
  /** Um modal (Editar/Baixa) está aberto por cima: o Esc é dele, não do painel. */
  camadaSobreposta: boolean;
  onFechar: () => void;
  onBaixa: (titulo: TituloReceber) => void;
  onCancelar: (titulo: TituloReceber) => void;
  onEditar: (titulo: TituloReceber) => void;
  onDesvincularLote: (notaId: string, loteId: string, motivo: string) => Promise<string | null>;
  buscarGuias: (loteId: string) => Promise<TituloGuia[]>;
  buscarEnvioLotes: (idsAplis: string[]) => Promise<Record<string, string | null>>;
  buscarBaixas: (notaId: string) => Promise<TituloBaixa[]>;
  buscarGlosasAplis: (lotesAplis: number[]) => Promise<GlosaAplisTitulo[]>;
  buscarAlteracoes: (notaId: string) => Promise<AlteracaoLancamento[]>;
}

const SECAO = 'mb-1 text-xs font-medium text-gray-500 dark:text-gray-400';
const ERRO = 'text-xs text-red-600 dark:text-red-400 flex items-center gap-1';

const ValorResumo: React.FC<{ rotulo: string; valor: string; cor: string }> = ({ rotulo, valor, cor }) => (
  <div className="rounded-lg bg-gray-50 dark:bg-gray-700/40 px-3 py-2">
    <p className="text-[11px] text-gray-500 dark:text-gray-400">{rotulo}</p>
    <p className={`text-sm font-semibold tabular-nums ${cor}`}>{valor}</p>
  </div>
);

const TituloPainelLateral: React.FC<Props> = ({
  titulo,
  divergencia,
  nfAposPagamento,
  podeEditar,
  camadaSobreposta,
  onFechar,
  onBaixa,
  onCancelar,
  onEditar,
  onDesvincularLote,
  buscarGuias,
  buscarEnvioLotes,
  buscarBaixas,
  buscarGlosasAplis,
  buscarAlteracoes,
}) => {
  const [baixas, setBaixas] = useState<TituloBaixa[] | null>(null);
  const [erroBaixas, setErroBaixas] = useState<string | null>(null);
  const [alteracoes, setAlteracoes] = useState<AlteracaoLancamento[]>([]);
  const [erroAlteracoes, setErroAlteracoes] = useState<string | null>(null);
  const [glosas, setGlosas] = useState<GlosaAplisTitulo[]>([]);
  const [erroGlosas, setErroGlosas] = useState<string | null>(null);
  // DtaEnvio ao vivo dos lotes, chave = aplisId (issue 15). Null = ainda não
  // revalidado ou a consulta falhou — dataEnvioEfetiva cai pro snapshot nos dois.
  const [envios, setEnvios] = useState<Record<string, string | null> | null>(null);
  const [loteAberto, setLoteAberto] = useState<string | null>(null);
  const [guias, setGuias] = useState<Record<string, TituloGuia[]>>({});
  // Por lote, não um booleano só: abrir um segundo lote enquanto o primeiro
  // carrega não pode piscar "Carregando guias…" no lote errado.
  const [carregandoGuias, setCarregandoGuias] = useState<Record<string, boolean>>({});
  const [erroGuias, setErroGuias] = useState<Record<string, string>>({});
  // Issue 46: qual lote está com a caixa de motivo aberta para desvincular.
  const [loteParaDesvincular, setLoteParaDesvincular] = useState<TituloLote | null>(null);
  const [motivoDesvincular, setMotivoDesvincular] = useState('');
  const [desvinculando, setDesvinculando] = useState(false);
  const [erroDesvincular, setErroDesvincular] = useState<string | null>(null);

  // Esc fecha uma camada por vez: com Editar/Baixa por cima, o painel fica.
  useEffect(() => {
    if (camadaSobreposta) return;
    const fecharNoEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onFechar();
    };
    document.addEventListener('keydown', fecharNoEsc);
    return () => document.removeEventListener('keydown', fecharNoEsc);
  }, [camadaSobreposta, onFechar]);

  // A página atrás não rola enquanto o painel está aberto.
  useEffect(() => {
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflowAnterior; };
  }, []);

  // Revalida o dataEnvio dos lotes direto no apLIS — o snapshot gravado na
  // criação do título fica preso pra sempre quando o envio só aconteceu
  // DEPOIS de o título existir (issue 15).
  useEffect(() => {
    const idsAplis = [...new Set(
      titulo.lotes.map((lote) => lote.aplisId).filter((id): id is string => Boolean(id)),
    )];
    if (idsAplis.length === 0) return;

    let cancelado = false;
    void buscarEnvioLotes(idsAplis)
      .then((mapa) => { if (!cancelado) setEnvios(mapa); })
      .catch(() => {
        // Túnel fora do ar, lote não encontrado etc.: fica no snapshot.
      });
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Glosas do apLIS do título: de onde vêm Glosado, Glosa recebida e Glosa acatada.
  useEffect(() => {
    const lotesAplis = titulo.lotes.map((lote) => Number(lote.aplisId)).filter((id) => Number.isInteger(id) && id > 0);
    let cancelado = false;
    void buscarGlosasAplis(lotesAplis)
      .then((lista) => { if (!cancelado) setGlosas(lista); })
      .catch((err) => {
        if (!cancelado) {
          setErroGlosas(err instanceof Error ? err.message : 'Não foi possível carregar as glosas do apLIS.');
        }
      });
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Issue 39: baixas e alterações, relidas quando `statusAtualizadoEm` avança —
  // uma baixa ou correção feita com o painel aberto recalcula o título e muda
  // esse campo, sem trocar o título aberto.
  useEffect(() => {
    const notaId = titulo.id;
    setErroBaixas(null);
    setErroAlteracoes(null);
    let cancelado = false;
    // Falha do histórico não derruba as baixas: cada um mostra o próprio erro.
    void buscarAlteracoes(notaId)
      .then((lista) => { if (!cancelado) setAlteracoes(lista); })
      .catch((err) => {
        if (!cancelado) {
          setErroAlteracoes(err instanceof Error ? err.message : 'Não foi possível carregar as alterações.');
        }
      });
    void buscarBaixas(notaId)
      .then((lista) => { if (!cancelado) setBaixas(lista); })
      .catch((err) => {
        if (!cancelado) setErroBaixas(err instanceof Error ? err.message : 'Não foi possível carregar as baixas.');
      });
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titulo.statusAtualizadoEm]);

  const abrirLote = async (loteId: string) => {
    if (loteAberto === loteId) {
      setLoteAberto(null);
      return;
    }
    setLoteAberto(loteId);
    if (guias[loteId]) return;

    setCarregandoGuias((atual) => ({ ...atual, [loteId]: true }));
    setErroGuias((atual) => ({ ...atual, [loteId]: '' }));
    try {
      const lista = await buscarGuias(loteId);
      setGuias((atual) => ({ ...atual, [loteId]: lista }));
    } catch (err) {
      // Sem isto, uma falha de rede/RLS virava rejeição não tratada e o
      // "nenhuma guia congelada" abaixo daria a conclusão errada na hora de
      // conferir uma glosa.
      setErroGuias((atual) => ({
        ...atual,
        [loteId]: err instanceof Error ? err.message : 'Não foi possível carregar as guias.',
      }));
    } finally {
      setCarregandoGuias((atual) => ({ ...atual, [loteId]: false }));
    }
  };

  const abrirDesvincular = (lote: TituloLote) => {
    setErroDesvincular(null);
    setMotivoDesvincular('');
    setLoteParaDesvincular(lote);
  };

  const cancelarDesvincular = () => {
    setLoteParaDesvincular(null);
    setMotivoDesvincular('');
    setErroDesvincular(null);
  };

  const confirmarDesvincular = async () => {
    if (!loteParaDesvincular || !motivoDesvincular.trim()) return;
    setDesvinculando(true);
    const erro = await onDesvincularLote(titulo.id, loteParaDesvincular.id, motivoDesvincular.trim());
    setDesvinculando(false);
    if (erro) {
      setErroDesvincular(erro);
    } else {
      setLoteParaDesvincular(null);
      setMotivoDesvincular('');
    }
  };

  const encerrado = titulo.status === 'cancelada' || titulo.valorSaldo <= 0;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/25 dark:bg-black/45 backdrop-blur-sm animate-fade-in"
        onClick={onFechar}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Detalhes do título ${titulo.numeroNota || 'sem número de nota'}`}
        className="fixed inset-y-2 right-2 z-50 w-[640px] max-w-[calc(100vw-1rem)] flex flex-col rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl animate-slide-in-right"
      >
        {/* ── Cabeçalho: resumo do título e ações ─────────────────────────── */}
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  {titulo.numeroNota ? `NF ${titulo.numeroNota}` : 'Sem número de nota'}
                </h2>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_CORES[titulo.status]}`}>
                  {STATUS_ROTULOS[titulo.status]}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300 truncate">
                {titulo.operadoraNome ?? '—'}
                {nfAposPagamento && (
                  <span
                    title="Esta operadora só permite emitir a NF depois do pagamento"
                    className="ml-2 inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                  >
                    NF após pagamento
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 flex flex-wrap items-center gap-x-2">
                <span>vencimento {formatData(titulo.dataVencimento)}</span>
                <Atraso titulo={titulo} />
              </p>
              {divergencia && <SeloAplis divergencia={divergencia} />}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {podeEditar && (
                <>
                  <button
                    type="button"
                    onClick={() => onEditar(titulo)}
                    disabled={titulo.status === 'cancelada'}
                    title="Editar título (número da nota, baixas e glosas)"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onBaixa(titulo)}
                    disabled={titulo.status === 'cancelada'}
                    title="Registrar baixa"
                    className="p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <DollarSign className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onCancelar(titulo)}
                    disabled={encerrado}
                    title="Cancelar título"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Ban className="w-4 h-4" />
                  </button>
                  <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" aria-hidden="true" />
                </>
              )}
              <button
                type="button"
                onClick={onFechar}
                aria-label="Fechar detalhes"
                title="Fechar (Esc)"
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <ValorResumo rotulo="Total" valor={formatCurrency(titulo.valorTotal)} cor="text-gray-900 dark:text-gray-100" />
            <ValorResumo rotulo="Recebido" valor={formatCurrency(titulo.valorRecebido)} cor="text-emerald-600 dark:text-emerald-400" />
            <ValorResumo
              rotulo="Glosado"
              valor={titulo.glosasAplis ? formatCurrency(titulo.glosasAplis.glosado) : '—'}
              cor="text-amber-600 dark:text-amber-400"
            />
            <ValorResumo rotulo="Saldo" valor={formatCurrency(titulo.valorSaldo)} cor="text-gray-900 dark:text-gray-100" />
          </div>
        </div>

        {/* ── Corpo: mesmo conteúdo e ordem da antiga linha expandida ──────── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {titulo.observacoes && (
            <p className="text-xs text-gray-500 dark:text-gray-400">{titulo.observacoes}</p>
          )}

          {/* Issue 39: histórico de baixas — cada lançamento de `recebimentos`,
              não só o total agregado da coluna Recebido. */}
          <div>
            <p className={SECAO}>Baixas registradas</p>
            {erroBaixas ? (
              <p className={ERRO}>
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {erroBaixas}
              </p>
            ) : baixas === null ? (
              <p className="text-xs text-gray-400">Carregando baixas…</p>
            ) : baixas.length === 0 ? (
              <p className="text-xs text-gray-400">Nenhuma baixa registrada.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-400">
                    <th className="py-1">Data</th>
                    <th className="py-1 text-right">Valor</th>
                    <th className="py-1 pl-3">Registrado por</th>
                  </tr>
                </thead>
                <tbody>
                  {baixas.map((baixa) => (
                    <tr key={baixa.id} className="text-gray-600 dark:text-gray-300">
                      <td className="py-1">{formatData(baixa.dataReceb)}</td>
                      <td className="py-1 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(baixa.valorRecebido)}
                      </td>
                      <td className="py-1 pl-3">{baixa.registradoPorNome ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Glosas do apLIS que compõem Glosado, Glosa recebida e Glosa acatada,
              uma por requisição. */}
          {(erroGlosas || glosas.length > 0) && (
            <div>
              <p className={SECAO}>Glosas do apLIS</p>
              {erroGlosas ? (
                <p className={ERRO}>
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {erroGlosas}
                </p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-400">
                      <th className="py-1">Requisição</th>
                      <th className="py-1 pl-3">Motivo</th>
                      <th className="py-1 text-right">Glosado</th>
                      <th className="py-1 pl-3">Classificação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {glosas.map((glosa) => (
                      <tr key={glosa.idRequisicao} className="text-gray-600 dark:text-gray-300 align-top">
                        <td className="py-1 pr-3">
                          <div className="tabular-nums whitespace-nowrap">
                            {glosa.codRequisicao ?? glosa.idRequisicao}
                            <span className="text-gray-400"> · lote {glosa.idLoteFaturamento}</span>
                          </div>
                          {(glosa.numGuia || glosa.paciente) && (
                            <div className="text-gray-400 truncate max-w-[12rem]">
                              {[glosa.numGuia && `guia ${glosa.numGuia}`, glosa.paciente].filter(Boolean).join(' · ')}
                            </div>
                          )}
                        </td>
                        <td className="py-1 pl-3 pr-3"><ListaResumida itens={glosa.motivos} /></td>
                        <td className="py-1 text-right tabular-nums text-amber-600 dark:text-amber-400 whitespace-nowrap">
                          {glosa.valorGlosado === null ? '—' : formatCurrency(glosa.valorGlosado)}
                        </td>
                        <td className="py-1 pl-3" title={rotuloStatusAplis(glosa.statusAplis)}>
                          {glosa.status ? (
                            <span className={`px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_GLOSA_DASHBOARD[glosa.status].cor}`}>
                              {STATUS_GLOSA_DASHBOARD[glosa.status].label}
                            </span>
                          ) : (
                            <span className="text-gray-400">{rotuloStatusAplis(glosa.statusAplis)}</span>
                          )}
                          {glosa.glosaAcatada !== null && (
                            <div
                              className="mt-0.5 tabular-nums text-rose-600 dark:text-rose-400 whitespace-nowrap"
                              title="Glosa acatada: sai do saldo do título"
                            >
                              acatada {formatCurrency(glosa.glosaAcatada)}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Correções de baixas/glosas pelo "Editar título" — só aparece quando
              houve alguma (ou quando a busca falhou). */}
          {(erroAlteracoes || alteracoes.length > 0) && (
            <div>
              <p className={SECAO}>Alterações</p>
              {erroAlteracoes ? (
                <p className={ERRO}>
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {erroAlteracoes}
                </p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-400">
                      <th className="py-1">Quando</th>
                      <th className="py-1">O quê</th>
                      <th className="py-1">De → para</th>
                      <th className="py-1">Motivo</th>
                      <th className="py-1">Por</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alteracoes.map((alteracao) => {
                      const { oQue, de, para } = descreverAlteracao(alteracao);
                      return (
                        <tr key={alteracao.id} className="text-gray-600 dark:text-gray-300 align-top">
                          <td className="py-1 pr-3 whitespace-nowrap">{formatDataHora(alteracao.feitoEm)}</td>
                          <td className="py-1 pr-3">{oQue}</td>
                          <td className="py-1 pr-3 tabular-nums">{de} → {para}</td>
                          <td className="py-1 pr-3">{alteracao.motivo}</td>
                          <td className="py-1">{alteracao.feitoPorNome}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          <div>
            <p className={SECAO}>Lotes</p>
            <div className="space-y-1">
              {titulo.lotes.length === 0 ? (
                <p className="text-xs text-gray-400">Título sem lotes vinculados.</p>
              ) : (
                titulo.lotes.map((lote) => {
                  // Issue 46: bloqueio espelha as regras de fat_desvincular_lote
                  // (20260904100000_fat_desvincular_lote.sql) — cancelado, baixa já
                  // registrada ou único lote do título — só para desabilitar o botão
                  // de antemão. Se as duas regras divergirem (RPC mudar sem atualizar
                  // aqui), a RPC continua a autoridade: confirmarDesvincular exibe o
                  // erro dela quando o servidor rejeita algo que o client achou permitido.
                  //
                  // "Baixa registrada" usa a lista de `baixas` (Issue 39), não
                  // `titulo.valorRecebido > 0` — uma baixa de glosa integral zera
                  // valorRecebido mas ainda é uma baixa registrada. Enquanto a lista
                  // não carregou/falhou, trata como "tem baixa" (fail-safe).
                  const bloqueioDesvinculo = titulo.status === 'cancelada'
                    ? 'Título cancelado não aceita edição de lotes.'
                    : baixas === null
                    ? 'Verificando baixas do título…'
                    : baixas.length > 0
                    ? 'Título já tem baixa registrada — não é possível alterar os lotes.'
                    : titulo.lotes.length <= 1
                    ? 'Não é possível remover o único lote do título.'
                    : null;
                  return (
                    <div key={lote.id} className="rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => void abrirLote(lote.id)}
                        onKeyDown={(e) => {
                          // Ignora keydown que borbulhou do botão "Desvincular" aninhado
                          // (e.target !== e.currentTarget) — sem isto, Enter/Espaço nesse
                          // botão também disparava abrirLote() por cima da própria ação.
                          if (e.target !== e.currentTarget) return;
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            void abrirLote(lote.id);
                          }
                        }}
                        className="w-full flex items-center gap-x-3 gap-y-0.5 flex-wrap px-3 py-2 text-left text-xs cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30"
                      >
                        {loteAberto === lote.id
                          ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                          : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                        <span className="font-medium text-gray-800 dark:text-gray-100">
                          Lote {lote.codigoLote}
                        </span>
                        {lote.protocolo && (
                          <span className="text-gray-400">protocolo {lote.protocolo}</span>
                        )}
                        {lote.statusLabel && (
                          <span className="text-gray-400">{lote.statusLabel}</span>
                        )}
                        <span className="text-gray-400">
                          envio {formatData(dataEnvioEfetiva(lote, envios))}
                        </span>
                        <span className="ml-auto text-gray-500 dark:text-gray-400 tabular-nums">
                          {lote.qtdRequisicoes} guias · {formatCurrency(lote.valorTotal)}
                        </span>
                        {podeEditar && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); abrirDesvincular(lote); }}
                            disabled={Boolean(bloqueioDesvinculo)}
                            title={bloqueioDesvinculo ?? 'Desvincular lote'}
                            className="p-1 rounded text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Unlink className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {loteParaDesvincular?.id === lote.id && (
                        <div className="border-t border-gray-100 dark:border-gray-700 px-3 py-2">
                          <MotivoDesativacaoBox
                            pergunta={`Remover o lote ${lote.codigoLote} deste título? O valor total do título será recalculado.`}
                            motivo={motivoDesvincular}
                            onChangeMotivo={setMotivoDesvincular}
                            onCancelar={cancelarDesvincular}
                            onConfirmar={() => void confirmarDesvincular()}
                            confirmando={desvinculando}
                          />
                          {erroDesvincular && (
                            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{erroDesvincular}</p>
                          )}
                        </div>
                      )}

                      {loteAberto === lote.id && (
                        <div className="border-t border-gray-100 dark:border-gray-700 px-3 py-2 overflow-x-auto">
                          {carregandoGuias[lote.id] && !guias[lote.id] ? (
                            <p className="text-xs text-gray-400">Carregando guias…</p>
                          ) : erroGuias[lote.id] ? (
                            <p className={ERRO}>
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              {erroGuias[lote.id]}
                            </p>
                          ) : (guias[lote.id]?.length ?? 0) === 0 ? (
                            <p className="text-xs text-gray-400">
                              Nenhuma guia congelada para este lote.
                            </p>
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-left text-gray-400">
                                  <th className="py-1 pr-2">Guia</th>
                                  <th className="py-1 pr-2">Requisição</th>
                                  <th className="py-1 pr-2">Paciente</th>
                                  <th className="py-1 pr-2">Procedimento</th>
                                  <th className="py-1 pr-2">Execução</th>
                                  <th className="py-1 text-right">Valor</th>
                                </tr>
                              </thead>
                              <tbody>
                                {guias[lote.id]?.map((guia) => (
                                  <tr key={guia.id} className="text-gray-600 dark:text-gray-300">
                                    <td className="py-1 pr-2">{guia.numeroGuia}</td>
                                    <td className="py-1 pr-2">
                                      {guia.codigoRequisicao ?? (
                                        <span className="text-gray-400 italic">indisponível</span>
                                      )}
                                    </td>
                                    <td className="py-1 pr-2 truncate max-w-[120px]" title={guia.pacienteNome ?? undefined}>
                                      {guia.pacienteNome ?? '—'}
                                    </td>
                                    <td className="py-1 pr-2 truncate max-w-[140px]" title={guia.procedimentoDescricao ?? undefined}>
                                      {guia.procedimentoDescricao ?? '—'}
                                    </td>
                                    <td className="py-1 pr-2 tabular-nums">{formatData(guia.dataExecucao)}</td>
                                    <td className="py-1 text-right tabular-nums">{formatCurrency(guia.valor)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default TituloPainelLateral;
