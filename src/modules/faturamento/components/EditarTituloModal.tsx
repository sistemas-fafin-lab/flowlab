import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Pencil, Trash2, X } from 'lucide-react';
import DatePicker from '../../../components/DatePicker';
import type {
  CancelamentoNfAnterior,
  CorrecaoLancamentoPayload,
  LancamentosTitulo,
  TituloGuia,
  TituloReceber,
} from '../types';
import { formatCurrency, formatData, hojeIso } from '../utils/formato';
import CorrecaoLancamentoForm from './CorrecaoLancamentoForm';

// Modal de edição do título. Começou (issue 33) só com o número da nota; agora
// também corrige os lançamentos digitados à mão — baixas e glosas
// (.scratch/titulos-edicao-lancamentos). O valor total do título continua fora:
// é o snapshot dos lotes do apLIS, nunca digitado. `titulo` presente é o que
// abre o modal; `null` fecha, sem estado próprio de "aberto".
//
// Trocar um número já preenchido pede uma escolha: "NF anterior cancelada"
// (motivo obrigatório; a NF anterior entra no histórico de NFs canceladas) ou
// "Correção de digitação" (só troca). O primeiro preenchimento não pergunta
// nada (.scratch/faturamento-nf-cancelada).

type TipoTroca = 'cancelada' | 'digitacao';

const CAMPO = 'mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100';

interface Props {
  titulo: TituloReceber | null;
  onFechar: () => void;
  onSalvar: (
    idNota: string,
    numeroNota: string,
    cancelamento?: CancelamentoNfAnterior,
  ) => Promise<string | null>;
  buscarLancamentos: (notaId: string) => Promise<LancamentosTitulo>;
  buscarGuias: (loteId: string) => Promise<TituloGuia[]>;
  onCorrigirLancamento: (payload: CorrecaoLancamentoPayload) => Promise<string | null>;
  onExcluirBaixa: (recebimentoId: string, motivo: string) => Promise<string | null>;
}

/** Chave do lançamento em edição: id da baixa, ou SEM_BAIXA para o grupo das
 *  glosas sem baixa. */
const SEM_BAIXA = 'sem-baixa';

const somaGlosas = (glosas: { valor: number }[]): number => glosas.reduce((s, g) => s + g.valor, 0);

const EditarTituloModal: React.FC<Props> = ({
  titulo,
  onFechar,
  onSalvar,
  buscarLancamentos,
  buscarGuias,
  onCorrigirLancamento,
  onExcluirBaixa,
}) => {
  const [numeroNota, setNumeroNota] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [numeroSalvo, setNumeroSalvo] = useState(false);
  // Número gravado no título agora. O `titulo` recebido não é atualizado depois
  // de salvar, e a escolha da troca compara com o que está no banco.
  const [numeroAtual, setNumeroAtual] = useState('');
  const [tipoTroca, setTipoTroca] = useState<TipoTroca | null>(null);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [dataCancelamento, setDataCancelamento] = useState(hojeIso());

  const limparTroca = () => {
    setTipoTroca(null);
    setMotivoCancelamento('');
    setDataCancelamento(hojeIso());
  };

  const [lancamentos, setLancamentos] = useState<LancamentosTitulo | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erroLancamentos, setErroLancamentos] = useState<string | null>(null);
  const [guias, setGuias] = useState<TituloGuia[]>([]);
  const [editando, setEditando] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<string | null>(null);
  const [motivoExclusao, setMotivoExclusao] = useState('');
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);
  const [excluindoAgora, setExcluindoAgora] = useState(false);

  // Título a que o modal está servindo agora. Uma resposta que chega depois de
  // o modal ter trocado de título é descartada — senão o título B mostraria as
  // baixas de A, e "Excluir" apagaria uma baixa de A achando que é de B.
  const notaAtual = useRef<string | null>(null);
  // Título cujas guias já foram pedidas: carregadas uma vez por abertura, não
  // a cada "Corrigir" (título sem guias nunca encheria a lista).
  const guiasPedidas = useRef<string | null>(null);

  const carregar = useCallback(async (notaId: string) => {
    setCarregando(true);
    setErroLancamentos(null);
    try {
      const resultado = await buscarLancamentos(notaId);
      if (notaAtual.current === notaId) setLancamentos(resultado);
    } catch (err) {
      if (notaAtual.current === notaId) {
        setErroLancamentos(err instanceof Error ? err.message : 'Não foi possível carregar os lançamentos.');
      }
    } finally {
      if (notaAtual.current === notaId) setCarregando(false);
    }
  }, [buscarLancamentos]);

  // Reabre sempre com o estado atual do título — inclusive se o operador
  // fechar e reabrir sobre outro título sem desmontar o componente.
  useEffect(() => {
    setNumeroNota(titulo?.numeroNota ?? '');
    setNumeroAtual(titulo?.numeroNota?.trim() ?? '');
    limparTroca();
    setErro(null);
    setNumeroSalvo(false);
    setLancamentos(null);
    setGuias([]);
    setEditando(null);
    setExcluindo(null);
    notaAtual.current = titulo?.id ?? null;
    guiasPedidas.current = null;
    if (titulo) void carregar(titulo.id);
  }, [titulo, carregar]);

  // As guias só servem ao formulário de correção (rateio da glosa por guia):
  // carregadas na primeira vez que um lançamento é aberto para edição.
  useEffect(() => {
    if (!titulo || editando === null || guiasPedidas.current === titulo.id) return;
    const notaId = titulo.id;
    guiasPedidas.current = notaId;
    Promise.all(titulo.lotes.map((lote) => buscarGuias(lote.id)))
      .then((listas) => { if (notaAtual.current === notaId) setGuias(listas.flat()); })
      .catch(() => {
        // Sem guias o formulário ainda funciona (glosa sem guia); libera nova tentativa.
        if (guiasPedidas.current === notaId) guiasPedidas.current = null;
      });
  }, [titulo, editando, buscarGuias]);

  const fechar = () => {
    setErro(null);
    onFechar();
  };

  // Trocar = o título já tinha número e o digitado é outro. Título cancelado
  // nunca chega a gravar (a RPC recusa), então não pergunta nada.
  const estaTrocando = (valor: string) =>
    titulo?.status !== 'cancelada' && numeroAtual !== '' && valor !== '' && valor !== numeroAtual;

  const submeterNumero = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!titulo) return;
    const valor = numeroNota.trim();
    if (!valor) {
      setErro('Informe o número da nota.');
      return;
    }
    const trocando = estaTrocando(valor);
    if (trocando && tipoTroca === null) {
      setErro('Diga se a NF anterior foi cancelada ou se é correção de digitação.');
      return;
    }
    const cancelada = trocando && tipoTroca === 'cancelada';
    if (cancelada && !motivoCancelamento.trim()) {
      setErro('Informe o motivo do cancelamento da NF anterior.');
      return;
    }
    if (cancelada && !dataCancelamento) {
      setErro('Informe a data do cancelamento.');
      return;
    }
    setErro(null);
    setNumeroSalvo(false);
    setSalvando(true);
    const erroRetornado = await onSalvar(
      titulo.id,
      valor,
      cancelada ? { motivo: motivoCancelamento.trim(), dataCancelamento } : undefined,
    );
    setSalvando(false);
    // Não fecha: o operador pode seguir corrigindo os lançamentos abaixo.
    if (erroRetornado) {
      setErro(erroRetornado);
      return;
    }
    setNumeroSalvo(true);
    setNumeroAtual(valor);
    limparTroca();
  };

  const salvarCorrecao = async (payload: CorrecaoLancamentoPayload): Promise<string | null> => {
    const falha = await onCorrigirLancamento(payload);
    if (!falha && titulo) {
      setEditando(null);
      await carregar(titulo.id);
    }
    return falha;
  };

  const confirmarExclusao = async () => {
    if (!titulo || !excluindo) return;
    if (!motivoExclusao.trim()) {
      setErroExclusao('Informe o motivo da exclusão.');
      return;
    }
    setErroExclusao(null);
    setExcluindoAgora(true);
    const falha = await onExcluirBaixa(excluindo, motivoExclusao.trim());
    setExcluindoAgora(false);
    if (falha) {
      setErroExclusao(falha);
      return;
    }
    setExcluindo(null);
    await carregar(titulo.id);
  };

  // Esc fecha o modal — e só ele, quando aberto por cima do painel de detalhes
  // do título. O Esc de um Select/DatePicker aberto (defaultPrevented) é deles.
  useEffect(() => {
    if (!titulo) return;
    const fecharNoEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented && !salvando) onFechar();
    };
    document.addEventListener('keydown', fecharNoEsc);
    return () => document.removeEventListener('keydown', fecharNoEsc);
  }, [titulo, salvando, onFechar]);

  if (!titulo) return null;

  const cancelado = titulo.status === 'cancelada';
  const trocandoNumero = estaTrocando(numeroNota.trim());
  const ocupado = editando !== null || excluindo !== null;
  const baixas = lancamentos?.baixas ?? [];
  const glosasSemBaixa = lancamentos?.glosasSemBaixa ?? [];

  const acoes = (chave: string, comExcluir: boolean) =>
    !cancelado && !ocupado && (
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => setEditando(chave)}
          className="px-2 py-1 rounded-lg text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center gap-1"
        >
          <Pencil className="w-3.5 h-3.5" /> Corrigir
        </button>
        {comExcluir && (
          <button
            type="button"
            onClick={() => {
              setExcluindo(chave);
              setMotivoExclusao('');
              setErroExclusao(null);
            }}
            className="px-2 py-1 rounded-lg text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" /> Excluir
          </button>
        )}
      </div>
    );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Editar título</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {titulo.operadoraNome ?? 'Operadora'} · total{' '}
              <strong className="tabular-nums">{formatCurrency(titulo.valorTotal)}</strong>
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

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          <form onSubmit={submeterNumero} className="space-y-3">
            <label className="block text-xs text-gray-500 dark:text-gray-400">
              Número da nota
              <div className="mt-1 flex gap-2">
                <input
                  type="text"
                  autoFocus
                  value={numeroNota}
                  onChange={(e) => {
                    setNumeroNota(e.target.value);
                    setNumeroSalvo(false);
                  }}
                  placeholder="Ex.: 12345"
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
                />
                <button
                  type="submit"
                  disabled={salvando}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
                  Salvar
                </button>
              </div>
            </label>
            {trocandoNumero && (
              <fieldset className="p-3 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-900/10 space-y-3">
                <legend className="px-1 text-xs font-medium text-amber-800 dark:text-amber-300">
                  O título tinha a NF {numeroAtual}. O que aconteceu com ela?
                </legend>
                <div className="flex flex-wrap gap-4 text-sm text-gray-700 dark:text-gray-200">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="tipo-troca"
                      checked={tipoTroca === 'cancelada'}
                      onChange={() => setTipoTroca('cancelada')}
                    />
                    NF anterior cancelada
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="tipo-troca"
                      checked={tipoTroca === 'digitacao'}
                      onChange={() => setTipoTroca('digitacao')}
                    />
                    Correção de digitação
                  </label>
                </div>
                {tipoTroca === 'cancelada' && (
                  <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
                    <label className="text-xs text-gray-500 dark:text-gray-400">
                      Motivo do cancelamento *
                      <textarea
                        value={motivoCancelamento}
                        onChange={(e) => setMotivoCancelamento(e.target.value)}
                        rows={2}
                        placeholder="Ex.: convênio trocado, valor bruto errado"
                        className={CAMPO}
                      />
                    </label>
                    <label className="text-xs text-gray-500 dark:text-gray-400">
                      Data do cancelamento *
                      <DatePicker
                        value={dataCancelamento}
                        onChange={setDataCancelamento}
                        controlClass={CAMPO}
                      />
                    </label>
                  </div>
                )}
              </fieldset>
            )}
            {numeroSalvo && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400">Número da nota salvo.</p>
            )}
            {erro && (
              <div className="p-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{erro}</span>
              </div>
            )}
          </form>

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Lançamentos</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {cancelado
                  ? 'Título cancelado: os lançamentos ficam só para consulta.'
                  : 'Corrija baixas e glosas digitadas errado. Toda correção pede um motivo e fica no histórico do título.'}
              </p>
            </div>

            {carregando && !lancamentos ? (
              <p className="text-xs text-gray-400 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando lançamentos…
              </p>
            ) : erroLancamentos ? (
              <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> {erroLancamentos}
              </p>
            ) : baixas.length === 0 && glosasSemBaixa.length === 0 ? (
              <p className="text-xs text-gray-400">Nenhuma baixa ou glosa lançada.</p>
            ) : (
              <div className="space-y-3">
                {baixas.map((baixa) => (
                  <div key={baixa.id} className="p-4 rounded-xl border border-gray-100 dark:border-gray-700 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm text-gray-700 dark:text-gray-200">
                        <p>
                          Baixa de{' '}
                          <strong className="tabular-nums text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(baixa.valorRecebido)}
                          </strong>{' '}
                          em {formatData(baixa.dataReceb)}
                          {baixa.formaRecebimento ? ` · ${baixa.formaRecebimento}` : ''}
                          {baixa.bancoNome ? ` · ${baixa.bancoNome}` : ''}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {baixa.glosas.length > 0
                            ? `${baixa.glosas.length} glosa(s) · ${formatCurrency(somaGlosas(baixa.glosas))}`
                            : 'Sem glosas'}
                          {baixa.registradoPorNome ? ` · registrada por ${baixa.registradoPorNome}` : ''}
                        </p>
                      </div>
                      {acoes(baixa.id, true)}
                    </div>

                    {editando === baixa.id && (
                      <CorrecaoLancamentoForm
                        notaId={titulo.id}
                        recebimentoId={baixa.id}
                        baixa={baixa}
                        glosas={baixa.glosas}
                        lotes={titulo.lotes}
                        guias={guias}
                        onCancelar={() => setEditando(null)}
                        onSalvar={salvarCorrecao}
                      />
                    )}

                    {excluindo === baixa.id && (
                      <div className="p-3 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-900/20 space-y-2">
                        <p className="text-sm text-rose-700 dark:text-rose-300">
                          Excluir esta baixa de {formatCurrency(baixa.valorRecebido)}
                          {baixa.glosas.length > 0
                            ? ` e as ${baixa.glosas.length} glosa(s) lançadas com ela (${formatCurrency(somaGlosas(baixa.glosas))})`
                            : ''}
                          ? O registro completo fica no histórico do título.
                        </p>
                        <textarea
                          value={motivoExclusao}
                          onChange={(e) => setMotivoExclusao(e.target.value)}
                          rows={2}
                          placeholder="Motivo da exclusão *"
                          aria-label="Motivo da exclusão"
                          className="w-full px-3 py-2 rounded-lg border border-rose-200 dark:border-rose-800 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
                        />
                        {erroExclusao && (
                          <p className="text-xs text-red-700 dark:text-red-300 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> {erroExclusao}
                          </p>
                        )}
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setExcluindo(null)}
                            className="px-3 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-gray-700"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => void confirmarExclusao()}
                            disabled={excluindoAgora}
                            className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 flex items-center gap-2"
                          >
                            {excluindoAgora && <Loader2 className="w-4 h-4 animate-spin" />}
                            Excluir baixa
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {glosasSemBaixa.length > 0 && (
                  <div className="p-4 rounded-xl border border-gray-100 dark:border-gray-700 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm text-gray-700 dark:text-gray-200">
                        <p>Glosas sem baixa</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {glosasSemBaixa.length} glosa(s) · {formatCurrency(somaGlosas(glosasSemBaixa))}
                        </p>
                      </div>
                      {acoes(SEM_BAIXA, false)}
                    </div>
                    {editando === SEM_BAIXA && (
                      <CorrecaoLancamentoForm
                        notaId={titulo.id}
                        recebimentoId={null}
                        baixa={null}
                        glosas={glosasSemBaixa}
                        lotes={titulo.lotes}
                        guias={guias}
                        onCancelar={() => setEditando(null)}
                        onSalvar={salvarCorrecao}
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-gray-100 dark:border-gray-700">
          <button
            type="button"
            onClick={fechar}
            className="px-4 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditarTituloModal;
