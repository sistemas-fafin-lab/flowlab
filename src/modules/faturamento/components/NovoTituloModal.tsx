import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Building2, ChevronLeft, ChevronRight, Loader2, Search, X } from 'lucide-react';
import DatePicker from '../../../components/DatePicker';
import { supabase } from '../../../lib/supabase';
import type { LotesMeta, LoteFaturamento } from '../types';
import { formatCurrency, formatData, hojeIso } from '../utils/formato';

// Modal de criação de título: o operador escolhe lotes do apLIS ainda não
// faturados e os agrupa numa cobrança.
//
// Os lotes vêm de /api/faturamento/lotes?somenteSemTitulo=1 — o mesmo endpoint da
// aba Faturas, que já sabe anotar quais lotes pertencem a um título ativo. O
// filtro recorta a página, então `meta.registros` conta o universo do apLIS antes
// do recorte — a paginação aqui é a mesma limitação já registrada no achado 3.4.
//
// A seleção guarda os OBJETOS `LoteFaturamento` escolhidos, não só os ids: assim
// ela sobrevive à troca de página/período/busca (a lista recarregada não contém
// mais o lote marcado antes), e o resumo, o guard de fonte pagadora e o envio
// (submeter) leem sempre a mesma lista — antes divergiam (achado 4.1).

const TAMANHO_PAGINA = 50;

// O apLIS não grava DtaEnvio nos lotes da AMHP-DF (IdFontePagadora 1025), mesmo
// já faturados e protocolados — não é falta de envio, é um campo que essa
// operadora nunca preenche. Tratar como "sem envio" geraria um aviso falso.
const ID_FONTE_PAGADORA_AMHP_DF = 1025;

const CAMPO =
  'mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100';
const CAMPO_FULL = `${CAMPO} w-full`;

interface Props {
  aberto: boolean;
  onFechar: () => void;
  onCriar: (dados: {
    idsLote: number[];
    numeroNota: string;
    dataEmissao: string;
    competencia?: string;
    dataVencimento?: string;
    observacoes?: string;
  }) => Promise<string | null>;
}

/** Primeiro dia do mês corrente, em ISO local. */
function inicioDoMes(): string {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`;
}

const NovoTituloModal: React.FC<Props> = ({ aberto, onFechar, onCriar }) => {
  const [periodoIni, setPeriodoIni] = useState(inicioDoMes);
  const [periodoFim, setPeriodoFim] = useState(hojeIso);
  const [busca, setBusca] = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const [pagina, setPagina] = useState(1);

  const [lotes, setLotes] = useState<LoteFaturamento[]>([]);
  const [meta, setMeta] = useState<LotesMeta | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erroLista, setErroLista] = useState<string | null>(null);

  const [selecionados, setSelecionados] = useState<Map<number, LoteFaturamento>>(new Map());
  const [numeroNota, setNumeroNota] = useState('');
  const [dataEmissao, setDataEmissao] = useState(hojeIso);
  const [competencia, setCompetencia] = useState('');
  const [dataVencimento, setDataVencimento] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setBuscaDebounced(busca.trim()), 350);
    return () => clearTimeout(timer);
  }, [busca]);

  // Trocar período ou busca volta para a primeira página: a página 4 de um
  // filtro novo raramente existe no outro.
  useEffect(() => {
    setPagina(1);
  }, [periodoIni, periodoFim, buscaDebounced]);

  // Fecha zerando tudo: reabrir com a seleção anterior faria o operador criar um
  // título com lotes que ele já esqueceu ter marcado. Período e emissão também
  // voltam ao default — senão o modal reabre num período antigo sem nenhuma
  // seleção visível para explicar por quê.
  const fechar = useCallback(() => {
    setSelecionados(new Map());
    setNumeroNota('');
    setCompetencia('');
    setDataVencimento('');
    setObservacoes('');
    setErroForm(null);
    setPeriodoIni(inicioDoMes());
    setPeriodoFim(hojeIso());
    setDataEmissao(hojeIso());
    onFechar();
  }, [onFechar]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroLista(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Sessão expirada. Faça login novamente.');

      const params = new URLSearchParams({
        periodoIni,
        periodoFim,
        pagina: String(pagina),
        tamanho: String(TAMANHO_PAGINA),
        somenteSemTitulo: '1',
      });
      if (buscaDebounced) params.set('busca', buscaDebounced);

      const res = await fetch(`/api/faturamento/lotes?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json().catch(() => ({}))) as {
        success?: boolean; error?: string; lotes?: LoteFaturamento[]; meta?: LotesMeta;
      };
      if (!res.ok || !body.success) throw new Error(body.error || 'Não foi possível listar os lotes.');
      setLotes(body.lotes ?? []);
      setMeta(body.meta ?? null);
    } catch (err) {
      setErroLista(err instanceof Error ? err.message : 'Não foi possível listar os lotes.');
      setLotes([]);
      setMeta(null);
    } finally {
      setCarregando(false);
    }
  }, [periodoIni, periodoFim, pagina, buscaDebounced]);

  useEffect(() => {
    if (aberto) void carregar();
  }, [aberto, carregar]);

  const alternar = (lote: LoteFaturamento) => {
    setSelecionados((atual) => {
      const proximo = new Map(atual);
      if (proximo.has(lote.idLote)) proximo.delete(lote.idLote);
      else proximo.set(lote.idLote, lote);
      return proximo;
    });
  };

  const marcados = useMemo(() => [...selecionados.values()], [selecionados]);
  const totalSelecionado = marcados.reduce((soma, lote) => soma + lote.valor, 0);

  // Um título cobra uma operadora só. Avisar aqui evita o 400 da rota depois de
  // o operador ter preenchido o formulário inteiro — e agora enxerga TODOS os
  // marcados, inclusive os que saíram da página visível.
  //
  // Fonte pagadora sem id (apLIS não identificou) usa uma chave própria por
  // lote em vez de colapsar em 0: dois lotes "sem fonte" não são necessariamente
  // da mesma operadora, e assumir que são deixaria passar uma mistura real.
  const fontes = new Set(
    marcados.map((lote) => lote.fontePagadora.id ?? `sem-fonte-${lote.idLote}`),
  );
  const misturouFontes = fontes.size > 1;
  const qtdPaginas = meta?.qtdPaginas ?? 0;
  const lotesSemEnvio = lotes.filter(
    (lote) => !lote.dtaEnvio && lote.fontePagadora.id !== ID_FONTE_PAGADORA_AMHP_DF,
  ).length;

  const submeter = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setErroForm(null);

    if (selecionados.size === 0) {
      setErroForm('Selecione ao menos um lote.');
      return;
    }
    if (misturouFontes) {
      setErroForm('Todos os lotes precisam ser da mesma fonte pagadora.');
      return;
    }
    setSalvando(true);
    const erro = await onCriar({
      idsLote: marcados.map((lote) => lote.idLote),
      numeroNota: numeroNota.trim(),
      dataEmissao,
      competencia: competencia || undefined,
      dataVencimento: dataVencimento || undefined,
      observacoes: observacoes.trim() || undefined,
    });
    setSalvando(false);

    if (erro) setErroForm(erro);
    else fechar();
  };

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Novo título a receber</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Agrupe lotes do apLIS ainda não faturados numa cobrança
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

        <form onSubmit={submeter} className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* ── Seleção de lotes ─────────────────────────────────────────── */}
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-gray-500 dark:text-gray-400">
              De
              <DatePicker value={periodoIni} onChange={setPeriodoIni} controlClass={CAMPO} />
            </label>
            <label className="text-xs text-gray-500 dark:text-gray-400">
              Até
              <DatePicker value={periodoFim} onChange={setPeriodoFim} controlClass={CAMPO} />
            </label>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por operadora, paciente, guia…"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>

          <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
            {carregando ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500 dark:text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando lotes…
              </div>
            ) : erroLista ? (
              <div className="p-4 text-sm text-red-600 dark:text-red-400 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                {erroLista}
              </div>
            ) : lotes.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                Nenhum lote disponível no período. Lotes já cobrados por um título não aparecem aqui.
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/40 sticky top-0">
                    <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
                      <th className="px-3 py-2 w-10" />
                      <th className="px-3 py-2">Lote</th>
                      <th className="px-3 py-2">Fonte pagadora</th>
                      <th className="px-3 py-2">Envio</th>
                      <th className="px-3 py-2 text-right">Guias</th>
                      <th className="px-3 py-2 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {lotes.map((lote) => (
                      <tr
                        key={lote.idLote}
                        onClick={() => alternar(lote)}
                        className={`cursor-pointer ${
                          selecionados.has(lote.idLote)
                            ? 'bg-blue-50 dark:bg-blue-900/20'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
                        }`}
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selecionados.has(lote.idLote)}
                            onChange={() => alternar(lote)}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded border-gray-300 dark:border-gray-600"
                          />
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100 tabular-nums">
                          {lote.idLote}
                        </td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-300 truncate max-w-[220px]">
                          {lote.fontePagadora.nome ?? lote.fontePagadora.razaoSocial ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-gray-500 dark:text-gray-400 tabular-nums">
                          {lote.dtaEnvio || lote.fontePagadora.id === ID_FONTE_PAGADORA_AMHP_DF ? (
                            formatData(lote.dtaEnvio)
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400"
                              title="Lote ainda não foi enviado à operadora: o título nasce sem vencimento e fica de fora do aging até alguém preencher."
                            >
                              <AlertTriangle className="w-3.5 h-3.5" /> sem envio
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-300 tabular-nums">
                          {lote.qtdRequisicoes}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-gray-900 dark:text-gray-100 tabular-nums">
                          {formatCurrency(lote.valor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {!carregando && !erroLista && lotes.length > 0 && (
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>
                {meta?.registros ?? lotes.length} lote{(meta?.registros ?? lotes.length) === 1 ? '' : 's'} no período
                {!!meta?.filtrados && (
                  <> · {meta.filtrados} ocultado{meta.filtrados === 1 ? '' : 's'} nesta página (já com título)</>
                )}
              </span>
              <div className="flex items-center gap-2">
                <span>Página {pagina} de {Math.max(qtdPaginas, 1)}</span>
                <button
                  type="button"
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                  disabled={pagina <= 1 || carregando}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setPagina((p) => p + 1)}
                  disabled={pagina >= qtdPaginas || carregando}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Próxima <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {!carregando && !erroLista && lotesSemEnvio > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              {lotesSemEnvio} lote{lotesSemEnvio === 1 ? '' : 's'} nesta página ainda não {lotesSemEnvio === 1 ? 'foi enviado' : 'foram enviados'} à operadora — se selecionado, o título nasce sem vencimento.
            </div>
          )}

          {selecionados.size > 0 && (
            <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-sm">
              <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-300" />
              <span className="text-blue-800 dark:text-blue-200">
                {selecionados.size} lote{selecionados.size === 1 ? '' : 's'} ·{' '}
                <strong className="tabular-nums">{formatCurrency(totalSelecionado)}</strong>
              </span>
              {misturouFontes && (
                <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  Fontes pagadoras diferentes
                </span>
              )}
            </div>
          )}

          {/* ── Dados do título ──────────────────────────────────────────── */}
          <h3 className="pt-2 border-t border-gray-100 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300">
            Dados do título que você está criando
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="text-xs text-gray-500 dark:text-gray-400">
              Número da nota
              <input
                type="text"
                value={numeroNota}
                onChange={(e) => setNumeroNota(e.target.value)}
                placeholder="Ex.: 12345"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
              />
              {/* Esse campo não busca nada: é o número da NF que o operador está
                  atribuindo ao título NOVO acima, não um filtro da lista de lotes.
                  Opcional: operadoras com NF só depois do pagamento (issue 31)
                  criam o título sem número e completam depois. */}
              <span className="mt-1 block text-[11px] text-gray-400">
                Opcional — deixe em branco se a nota ainda não foi emitida. Não filtra a lista acima
              </span>
            </label>
            <label className="text-xs text-gray-500 dark:text-gray-400">
              Emissão
              <DatePicker value={dataEmissao} onChange={setDataEmissao} controlClass={CAMPO_FULL} />
            </label>
            <label className="text-xs text-gray-500 dark:text-gray-400">
              Competência
              <input
                type="month"
                value={competencia}
                onChange={(e) => setCompetencia(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
              />
            </label>
            <label className="text-xs text-gray-500 dark:text-gray-400">
              Vencimento
              <DatePicker value={dataVencimento} onChange={setDataVencimento} controlClass={CAMPO_FULL} allowClear />
              {/* Em branco = o servidor resolve pelo RPS do lote ou pelo prazo da
                  operadora; explicar isso evita que o operador chute uma data. */}
              <span className="mt-1 block text-[11px] text-gray-400">
                Em branco: usa o vencimento do RPS ou o prazo da operadora
              </span>
            </label>
          </div>

          <label className="block text-xs text-gray-500 dark:text-gray-400">
            Observações
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
            />
          </label>

          {erroForm && (
            <div className="p-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{erroForm}</span>
            </div>
          )}
        </form>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 dark:border-gray-700">
          <button
            type="button"
            onClick={fechar}
            className="px-4 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submeter}
            disabled={salvando || selecionados.size === 0 || misturouFontes}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
            Criar título
          </button>
        </div>
      </div>
    </div>
  );
};

export default NovoTituloModal;
