import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertCircle,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  MinusCircle,
  Paperclip,
  Plus,
  Search,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useTheme } from '../../../../hooks/useTheme';
import { formatCurrency } from '../../../../utils/paymentUtils';
import { dayKey } from '../../../../utils/datas';
import { FORMA_PAGAMENTO_ROTULO, SITUACAO_OCORRENCIA } from '../../constants';
import { acaoAoDesfazer, podeDarBaixa } from '../../domain/baixa';
import { competenciaDaData, formatarCompetencia, paraCampoMes, somarMeses } from '../../domain/competencia';
import { corDoSlot, slotsDeCor } from '../../domain/coresCategorias';
import { linhasExportacaoMes } from '../../domain/exportacao';
import { chaveTexto } from '../../domain/listaDespesas';
import { ORDEM_SITUACAO, montarOcorrenciasDoMes, totaisDoMes, type OcorrenciaDoMes, type SituacaoOcorrencia } from '../../domain/situacao';
import { useCanManageGastosTI } from '../../hooks/useCanManageGastosTI';
import { useCategoriasTI } from '../../hooks/useCategoriasTI';
import { useDespesasTI } from '../../hooks/useDespesasTI';
import { useLancamentosTI } from '../../hooks/useLancamentosTI';
import type { AjusteInput } from '../../domain/ajuste';
import GastosTIShell from '../GastosTIShell';
import { nomesDistintos } from '../../domain/listaDespesas';
import { useFornecedoresTI } from '../../hooks/useFornecedoresTI';
import type { DespesaInput } from '../../types';
import AjusteOcorrenciaModal from './AjusteOcorrenciaModal';
import BaixaLoteModal from './BaixaLoteModal';
import BaixaModal from './BaixaModal';
import DispensaModal from './DispensaModal';
import GastoAvulsoModal, { type PagamentoAvulso } from './GastoAvulsoModal';

const VIDRO = 'bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl border border-white/50 dark:border-slate-700/50 shadow-sm';

const ICONE_SITUACAO: Record<SituacaoOcorrencia, LucideIcon> = {
  vencida: AlertCircle,
  a_vencer: Clock,
  paga: CheckCircle2,
  dispensada: MinusCircle,
};

const formatarData = (iso: string): string => {
  const [, mes, dia] = iso.split('-');
  return `${dia}/${mes}`;
};

const botaoLinha =
  'px-2 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none';

type Modal =
  | { tipo: 'baixa'; chave: string }
  | { tipo: 'ajuste'; chave: string }
  | { tipo: 'dispensa'; chave: string }
  | { tipo: 'lote' }
  | { tipo: 'avulso' }
  | null;

const MesAMesPage: React.FC = () => {
  const podeGerenciar = useCanManageGastosTI();
  const { theme } = useTheme();
  const hoje = dayKey(new Date());
  const [competencia, setCompetencia] = useState(() => competenciaDaData(hoje) as string);
  const { categorias } = useCategoriasTI();
  const { despesas, loading: carregandoDespesas, error: erroDespesas, registrarReajuste, criarDespesa } = useDespesasTI();
  const { fornecedores, criarFornecedorRapido } = useFornecedoresTI();
  const lancamentosTI = useLancamentosTI(competencia);
  const { lancamentos, loading: carregandoLancamentos, error: erroLancamentos } = lancamentosTI;

  const [filtroSituacao, setFiltroSituacao] = useState<SituacaoOcorrencia | ''>('');
  const [busca, setBusca] = useState('');
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<Modal>(null);
  const [confirmandoDesfazer, setConfirmandoDesfazer] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Trocar de mês limpa a seleção (não faz sentido levá-la para outro mês); o filtro de situação fica.
  useEffect(() => {
    setSelecionadas(new Set());
    setConfirmandoDesfazer(null);
  }, [competencia]);

  const slots = useMemo(() => slotsDeCor(categorias), [categorias]);
  const nomeCategoria = useMemo(() => new Map(categorias.map((c) => [c.id, c.nome])), [categorias]);
  const ocorrencias = useMemo(
    () => montarOcorrenciasDoMes(despesas, lancamentos, competencia, hoje),
    [despesas, lancamentos, competencia, hoje],
  );
  const totais = useMemo(() => totaisDoMes(ocorrencias), [ocorrencias]);
  const visiveis = useMemo(() => {
    const termo = chaveTexto(busca);
    return ocorrencias.filter(
      (o) =>
        (!filtroSituacao || o.situacao === filtroSituacao) &&
        (!termo || chaveTexto(o.despesa.descricao).includes(termo) || chaveTexto(o.despesa.fornecedorNome).includes(termo)),
    );
  }, [ocorrencias, filtroSituacao, busca]);

  const porChave = useMemo(() => new Map(ocorrencias.map((o) => [o.chave, o])), [ocorrencias]);
  const selecionadasValidas = useMemo(
    () => [...selecionadas].map((c) => porChave.get(c)).filter((o): o is OcorrenciaDoMes => Boolean(o && podeDarBaixa(o))),
    [selecionadas, porChave],
  );
  const totalSelecionado = selecionadasValidas.reduce((soma, o) => soma + o.valorPrevisto, 0);
  const selecionaveis = visiveis.filter(podeDarBaixa);
  const todasSelecionadas = selecionaveis.length > 0 && selecionaveis.every((o) => selecionadas.has(o.chave));

  const alternarSelecao = (chave: string) =>
    setSelecionadas((atual) => {
      const nova = new Set(atual);
      if (nova.has(chave)) nova.delete(chave);
      else nova.add(chave);
      return nova;
    });

  const alternarTodas = () =>
    setSelecionadas(todasSelecionadas ? new Set() : new Set(selecionaveis.map((o) => o.chave)));

  const fecharModal = useCallback(() => setModal(null), []);
  const ocorrenciaDoModal = modal && 'chave' in modal ? porChave.get(modal.chave) ?? null : null;
  const lancamentoDoModal = ocorrenciaDoModal?.lancamento ?? null;

  /**
   * "Só este mês" grava na ocorrência. "Deste mês em diante" vira reajuste da
   * despesa; se o mês já tinha um ajuste ainda não pago, o valor dele acompanha
   * (senão o ajuste antigo continuaria mandando no mês — RN04 item 1).
   */
  const salvarAjuste = async (o: OcorrenciaDoMes, input: AjusteInput): Promise<string | null> => {
    if (input.escopo === 'mes') return lancamentosTI.ajustar(o, input);
    const erro = await registrarReajuste(o.despesa.id, {
      vigenteDesde: o.competencia,
      valor: input.valorPrevisto,
      motivo: input.motivo,
      quantidade: null,
      observacao: input.observacao,
    });
    if (erro) return erro;
    if (o.lancamento && o.lancamento.status !== 'pago') {
      return lancamentosTI.ajustar(o, { ...input, escopo: 'mes', vencimento: o.vencimento, formaPagamento: o.formaPagamento });
    }
    return null;
  };

  const autorizadores = useMemo(() => nomesDistintos(despesas.map((d) => d.autorizadoPor)), [despesas]);

  /** Exporta o que está na tela (filtros aplicados), valores como número (RF16). */
  const exportar = () => {
    const livro = XLSX.utils.book_new();
    const aba = XLSX.utils.aoa_to_sheet(linhasExportacaoMes(visiveis, (id) => nomeCategoria.get(id) ?? ''));
    aba['!cols'] = [{ wch: 12 }, { wch: 36 }, { wch: 24 }, { wch: 24 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 30 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(livro, aba, formatarCompetencia(competencia).replace('/', '-'));
    XLSX.writeFile(livro, `gastos_ti_mes_${competencia.slice(0, 7)}.xlsx`);
  };

  /**
   * Cria a despesa única e, se já foi pago, dá baixa logo em seguida. Se a
   * baixa falhar, a despesa já existe: o modal fecha (salvar de novo
   * duplicaria) e o aviso diz o que ficou faltando.
   */
  const salvarAvulso = async (despesa: DespesaInput, pagamento: PagamentoAvulso | null): Promise<string | null> => {
    const criada = await criarDespesa(despesa);
    if (criada.ok === false) return criada.erro;
    if (!pagamento || despesa.valorBase === null || !despesa.competenciaInicio || despesa.diaVencimento === null) return null;
    const vencimento = `${despesa.competenciaInicio.slice(0, 8)}${String(despesa.diaVencimento).padStart(2, '0')}`;
    const baixa = await lancamentosTI.registrarBaixa(
      { despesa: { id: criada.id }, competencia: despesa.competenciaInicio, valorPrevisto: despesa.valorBase, vencimento, formaPagamento: despesa.formaPagamento },
      { valorPago: despesa.valorBase, pagoEm: pagamento.pagoEm, formaPagamento: despesa.formaPagamento, notaFiscal: pagamento.notaFiscal, observacao: null },
    );
    if (baixa.ok === false) {
      setAviso(`O gasto foi registrado, mas a baixa não: ${baixa.erro} Dê baixa na lista.`);
      return null;
    }
    if (pagamento.arquivos.length > 0) {
      const erroAnexos = await lancamentosTI.adicionarAnexos(baixa.id, pagamento.arquivos);
      if (erroAnexos) setAviso(`O gasto foi registrado e pago, mas nem todos os anexos subiram: ${erroAnexos}`);
    }
    return null;
  };

  const desfazer = async (o: OcorrenciaDoMes) => {
    if (confirmandoDesfazer !== o.chave) {
      setConfirmandoDesfazer(o.chave);
      return;
    }
    setOcupado(o.chave);
    const erro = await lancamentosTI.desfazer(o);
    setOcupado(null);
    setConfirmandoDesfazer(null);
    if (erro) setAviso(erro);
  };

  // Skeleton só na primeira carga; trocar de mês esmaece a tabela em vez de piscar (RNF03).
  const carregando = carregandoDespesas && despesas.length === 0;
  const erro = erroDespesas ?? erroLancamentos;
  const ehMesAtual = competencia === competenciaDaData(hoje);

  const kpis: { rotulo: string; valor: number; sub: string; cor: string }[] = [
    { rotulo: 'Previsto', valor: totais.previsto, sub: `${ocorrencias.length - totais.quantidade.dispensada} cobranças`, cor: 'from-violet-500 to-purple-600' },
    { rotulo: 'Pago', valor: totais.pago, sub: `${totais.quantidade.paga} pagas`, cor: 'from-emerald-500 to-emerald-600' },
    { rotulo: 'Em aberto', valor: totais.emAberto, sub: `${totais.quantidade.a_vencer + totais.quantidade.vencida} a pagar`, cor: 'from-blue-500 to-blue-600' },
    { rotulo: 'Vencido', valor: totais.vencido, sub: `${totais.quantidade.vencida} sem baixa`, cor: 'from-red-500 to-rose-600' },
  ];

  return (
    <GastosTIShell
      subtitulo="Previsto e realizado de cada competência"
      acoes={
        <>
          <button
            type="button"
            onClick={exportar}
            disabled={visiveis.length === 0}
            title="Exporta as cobranças da competência com os filtros aplicados"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700 hover:text-violet-700 dark:hover:text-violet-300 disabled:opacity-50 disabled:pointer-events-none transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar
          </button>
          {podeGerenciar && (
            <button
              type="button"
              onClick={() => setModal({ tipo: 'avulso' })}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 shadow-lg shadow-violet-500/25 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Gasto avulso
            </button>
          )}
        </>
      }
    >
      <div className={`${VIDRO} rounded-3xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in-up`} style={{ animationDelay: '0.15s' }}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCompetencia((c) => somarMeses(c, -1))}
            aria-label="Mês anterior"
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <label className="sr-only" htmlFor="mes-a-mes-competencia">
            Competência
          </label>
          <input
            id="mes-a-mes-competencia"
            type="month"
            value={paraCampoMes(competencia)}
            onChange={(e) => {
              const c = competenciaDaData(e.target.value);
              if (c) setCompetencia(c);
            }}
            className="min-w-[170px] bg-transparent border-0 rounded-xl px-2 py-1 text-center text-base font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 dark:[color-scheme:dark]"
          />
          <button
            type="button"
            onClick={() => setCompetencia((c) => somarMeses(c, 1))}
            aria-label="Próximo mês"
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          {!ehMesAtual && (
            <button
              type="button"
              onClick={() => setCompetencia(competenciaDaData(hoje) as string)}
              className="ml-1 px-3 py-1.5 rounded-xl text-xs font-medium text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-900/30 hover:bg-violet-100 dark:hover:bg-violet-900/50"
            >
              Mês atual
            </button>
          )}
        </div>
        <div className="relative sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="search"
            aria-label="Buscar cobranças"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar despesa ou fornecedor"
            className="w-full border border-gray-200 dark:border-gray-600 bg-white/80 dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500/30 rounded-xl pl-9 pr-3 py-2"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
        {kpis.map((k) => (
          <div key={k.rotulo} className={`${VIDRO} relative overflow-hidden rounded-3xl px-4 py-3`}>
            <div className={`absolute -right-6 -top-6 w-20 h-20 rounded-full blur-2xl opacity-20 bg-gradient-to-br ${k.cor}`} />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{k.rotulo}</p>
            <p className="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">{formatCurrency(k.valor)}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">{k.sub}</p>
          </div>
        ))}
      </div>

      {aviso && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-2xl border border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <p>{aviso}</p>
          <button type="button" onClick={() => setAviso(null)} aria-label="Fechar aviso" className="flex-shrink-0 p-0.5 hover:opacity-70">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className={`${VIDRO} rounded-3xl overflow-hidden animate-fade-in-up`} style={{ animationDelay: '0.25s' }}>
        <div className="flex flex-wrap items-center gap-2 px-4 pt-4 pb-3">
          {[{ valor: '' as const, rotulo: 'Todas', quantidade: ocorrencias.length }, ...ORDEM_SITUACAO.map((s) => ({ valor: s, rotulo: SITUACAO_OCORRENCIA[s].rotulo, quantidade: totais.quantidade[s] }))].map((chip) => {
            const ativo = filtroSituacao === chip.valor;
            return (
              <button
                key={chip.valor || 'todas'}
                type="button"
                onClick={() => setFiltroSituacao(chip.valor)}
                aria-pressed={ativo}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  ativo
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {chip.rotulo} ({chip.quantidade})
              </button>
            );
          })}
        </div>

        {podeGerenciar && selecionadasValidas.length > 0 && (
          <div className="mx-4 mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-2xl bg-violet-50 dark:bg-violet-900/20 border border-violet-200/70 dark:border-violet-800/60 px-4 py-2.5 text-sm">
            <span className="text-violet-800 dark:text-violet-200">
              {selecionadasValidas.length} {selecionadasValidas.length === 1 ? 'selecionada' : 'selecionadas'} ·{' '}
              <strong>{formatCurrency(totalSelecionado)}</strong>
            </span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setSelecionadas(new Set())} className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800">
                Limpar
              </button>
              <button type="button" onClick={() => setModal({ tipo: 'lote' })} className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700">
                Dar baixa em lote
              </button>
            </div>
          </div>
        )}

        {carregando ? (
          <div className="p-4 space-y-2" aria-busy="true">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="h-12 rounded-xl bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
            ))}
          </div>
        ) : erro ? (
          <p className="p-6 text-sm text-red-700 dark:text-red-300">{erro}</p>
        ) : ocorrencias.length === 0 ? (
          <div className="p-10 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
              <CalendarRange className="w-7 h-7 text-violet-600 dark:text-violet-300" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Nenhuma cobrança em {formatarCompetencia(competencia)}</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">As cobranças aparecem aqui a partir das despesas cadastradas e da recorrência de cada uma.</p>
          </div>
        ) : (
          <div className={`overflow-x-auto transition-opacity ${carregandoLancamentos ? 'opacity-60' : ''}`}>
            <table className="w-full text-sm">
              <thead className="bg-slate-50/80 dark:bg-slate-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  {podeGerenciar && (
                    <th scope="col" className="pl-4 pr-1 py-2.5 w-8">
                      <input
                        type="checkbox"
                        aria-label="Selecionar todas as cobranças em aberto"
                        checked={todasSelecionadas}
                        disabled={selecionaveis.length === 0}
                        onChange={alternarTodas}
                        className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                      />
                    </th>
                  )}
                  <th scope="col" className="px-3 py-2.5 text-left font-semibold">Despesa</th>
                  <th scope="col" className="px-3 py-2.5 text-left font-semibold">Vencimento</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">Previsto</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">Pago</th>
                  <th scope="col" className="px-3 py-2.5 text-left font-semibold">Situação</th>
                  {podeGerenciar && <th scope="col" className="px-3 py-2.5 text-right font-semibold">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-700/50">
                {visiveis.map((o) => {
                  const Icone = ICONE_SITUACAO[o.situacao];
                  const desfazerAcao = acaoAoDesfazer(o);
                  const anexos = o.lancamento?.anexos.length ?? 0;
                  return (
                    <tr key={o.chave} className="text-slate-700 dark:text-slate-200">
                      {podeGerenciar && (
                        <td className="pl-4 pr-1 py-2.5">
                          {podeDarBaixa(o) && (
                            <input
                              type="checkbox"
                              aria-label={`Selecionar ${o.despesa.descricao}`}
                              checked={selecionadas.has(o.chave)}
                              onChange={() => alternarSelecao(o.chave)}
                              className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                            />
                          )}
                        </td>
                      )}
                      <td className="px-3 py-2.5 max-w-[300px]">
                        <span className="block font-medium text-slate-900 dark:text-slate-100 truncate" title={o.despesa.descricao}>
                          {o.despesa.descricao}
                        </span>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400 dark:text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <span aria-hidden="true" className="w-2 h-2 rounded-full" style={{ backgroundColor: corDoSlot(slots.get(o.despesa.categoriaId), theme) }} />
                            {nomeCategoria.get(o.despesa.categoriaId) ?? '—'}
                          </span>
                          <span className="truncate">{o.despesa.fornecedorNome}</span>
                          <span>{FORMA_PAGAMENTO_ROTULO[o.formaPagamento]}</span>
                          {o.estimada && <span className="px-1.5 rounded bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300">estimado</span>}
                          {o.ajustada && <span className="px-1.5 rounded bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">ajustada</span>}
                          {o.foraDaRecorrencia && (
                            <span className="px-1.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200" title="A despesa não tem mais cobrança neste mês">
                              fora da recorrência
                            </span>
                          )}
                          {anexos > 0 && (
                            <span className="inline-flex items-center gap-0.5" title={`${anexos} anexo(s)`}>
                              <Paperclip className="w-3 h-3" /> {anexos}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {formatarData(o.vencimento)}
                        {o.vencimento !== o.vencimentoOriginal && (
                          <span className="block text-xs text-slate-400 line-through">{formatarData(o.vencimentoOriginal)}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">
                        {formatCurrency(o.valorPrevisto)}
                        {o.valorPrevisto !== o.previstoOriginal && (
                          <span className="block text-xs text-slate-400 line-through">{formatCurrency(o.previstoOriginal)}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">
                        {o.situacao === 'paga' && o.lancamento ? (
                          <>
                            {formatCurrency(o.lancamento.valorPago ?? 0)}
                            {o.lancamento.pagoEm && <span className="block text-xs text-slate-400">em {formatarData(o.lancamento.pagoEm)}</span>}
                          </>
                        ) : o.situacao === 'dispensada' && o.lancamento?.motivoDispensa ? (
                          <span className="text-xs text-slate-400 whitespace-normal" title={o.lancamento.motivoDispensa}>
                            {o.lancamento.motivoDispensa.length > 40 ? `${o.lancamento.motivoDispensa.slice(0, 40)}…` : o.lancamento.motivoDispensa}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${SITUACAO_OCORRENCIA[o.situacao].classe}`}>
                          <Icone className="w-3 h-3" aria-hidden="true" />
                          {SITUACAO_OCORRENCIA[o.situacao].rotulo}
                        </span>
                      </td>
                      {podeGerenciar && (
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          {podeDarBaixa(o) ? (
                            <>
                              <button type="button" onClick={() => setModal({ tipo: 'baixa', chave: o.chave })} className={`${botaoLinha} text-white bg-violet-600 hover:bg-violet-700`}>
                                Dar baixa
                              </button>{' '}
                              {!o.foraDaRecorrencia && (
                                <>
                                  <button type="button" onClick={() => setModal({ tipo: 'ajuste', chave: o.chave })} className={`${botaoLinha} text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800`}>
                                    Ajustar
                                  </button>{' '}
                                </>
                              )}
                              <button type="button" onClick={() => setModal({ tipo: 'dispensa', chave: o.chave })} className={`${botaoLinha} text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800`}>
                                Dispensar
                              </button>
                              {o.lancamento?.status === 'previsto' && (
                                <>
                                  {' '}
                                  <button
                                    type="button"
                                    onClick={() => desfazer(o)}
                                    onBlur={() => setConfirmandoDesfazer(null)}
                                    disabled={ocupado === o.chave}
                                    title={o.foraDaRecorrencia ? 'Apaga este lançamento' : 'Volta para a previsão calculada pela despesa'}
                                    className={`${botaoLinha} ${confirmandoDesfazer === o.chave ? 'text-white bg-red-600 hover:bg-red-700' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                  >
                                    {confirmandoDesfazer === o.chave ? 'Confirmar' : o.foraDaRecorrencia ? 'Excluir' : 'Desfazer ajuste'}
                                  </button>
                                </>
                              )}
                            </>
                          ) : (
                            <>
                              {o.situacao === 'paga' && (
                                <>
                                  <button type="button" onClick={() => setModal({ tipo: 'baixa', chave: o.chave })} className={`${botaoLinha} text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800`}>
                                    Editar
                                  </button>{' '}
                                </>
                              )}
                              {desfazerAcao !== 'nada' && (
                                <button
                                  type="button"
                                  onClick={() => desfazer(o)}
                                  onBlur={() => setConfirmandoDesfazer(null)}
                                  disabled={ocupado === o.chave}
                                  title={desfazerAcao === 'voltar_para_previsto' ? 'Volta para a previsão ajustada do mês' : 'Volta para a previsão calculada'}
                                  className={`${botaoLinha} ${confirmandoDesfazer === o.chave ? 'text-white bg-red-600 hover:bg-red-700' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                >
                                  {confirmandoDesfazer === o.chave ? 'Confirmar' : o.foraDaRecorrencia ? 'Excluir' : 'Desfazer'}
                                </button>
                              )}
                            </>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {visiveis.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">Nenhuma cobrança com esse filtro.</p>
            )}
          </div>
        )}
      </div>

      {modal?.tipo === 'baixa' && ocorrenciaDoModal && (
        <BaixaModal
          ocorrencia={ocorrenciaDoModal}
          onSalvar={async (input, arquivos) => {
            const resultado = await lancamentosTI.registrarBaixa(ocorrenciaDoModal, input);
            if (resultado.ok === false) return resultado.erro;
            if (arquivos.length > 0) {
              const erroAnexos = await lancamentosTI.adicionarAnexos(resultado.id, arquivos);
              if (erroAnexos) setAviso(`O pagamento foi registrado, mas nem todos os anexos subiram: ${erroAnexos} Anexe de novo em "Editar".`);
            }
            return null;
          }}
          onAdicionarAnexos={lancamentoDoModal ? (arquivos) => lancamentosTI.adicionarAnexos(lancamentoDoModal.id, arquivos) : undefined}
          onRemoverAnexo={lancamentoDoModal ? (path) => lancamentosTI.removerAnexo(lancamentoDoModal.id, path) : undefined}
          onFechar={fecharModal}
        />
      )}
      {modal?.tipo === 'ajuste' && ocorrenciaDoModal && (
        <AjusteOcorrenciaModal ocorrencia={ocorrenciaDoModal} onSalvar={(input) => salvarAjuste(ocorrenciaDoModal, input)} onFechar={fecharModal} />
      )}
      {modal?.tipo === 'dispensa' && ocorrenciaDoModal && (
        <DispensaModal ocorrencia={ocorrenciaDoModal} onSalvar={(motivo) => lancamentosTI.dispensar(ocorrenciaDoModal, motivo)} onFechar={fecharModal} />
      )}
      {modal?.tipo === 'avulso' && (
        <GastoAvulsoModal
          competencia={competencia}
          categorias={categorias}
          fornecedores={fornecedores}
          criarFornecedorRapido={criarFornecedorRapido}
          sugestoesAutorizador={autorizadores}
          onSalvar={salvarAvulso}
          onFechar={fecharModal}
        />
      )}
      {modal?.tipo === 'lote' && (
        <BaixaLoteModal
          ocorrencias={selecionadasValidas}
          competencia={competencia}
          onSalvar={async (pagoEm) => {
            const erroLote = await lancamentosTI.baixaEmLote(selecionadasValidas, pagoEm);
            if (!erroLote) setSelecionadas(new Set());
            return erroLote;
          }}
          onFechar={fecharModal}
        />
      )}
    </GastosTIShell>
  );
};

export default MesAMesPage;
