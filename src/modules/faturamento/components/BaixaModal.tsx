import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Plus, Trash2, X } from 'lucide-react';
import Select from '../../../components/Select';
import DatePicker from '../../../components/DatePicker';
import type { BaixaInput, GlosaLancamentoInput, TituloGuia, TituloReceber } from '../../billing/types';
import { formatCurrency, hojeIso } from '../utils/formato';

// Registro de uma baixa sobre um título, com as glosas que explicam a diferença
// entre o previsto e o recebido.
//
// As duas coisas entram juntas de propósito: se a baixa fosse gravada sozinha, o
// saldo do título passaria a cobrar um valor que a operadora já recusou pagar, e
// o aging perseguiria essa diferença para sempre.

const FORMAS = ['TED', 'PIX', 'Boleto', 'Depósito', 'Cheque', 'Outro'];
const FORMAS_OPCOES = FORMAS.map((forma) => ({ value: forma, label: forma }));
const STATUS_GLOSA_OPCOES = [
  { value: 'aberta', label: 'Aberta' },
  { value: 'em_recurso', label: 'Em recurso' },
  { value: 'definitiva', label: 'Definitiva' },
];

const CAMPO =
  'mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100';
const CAMPO_GRID =
  'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100';

interface Props {
  titulo: TituloReceber | null;
  /**
   * 'baixa' registra pagamento + as glosas que explicam a diferença.
   * 'glosa' lança só glosas — o caso da que chega no demonstrativo ANTES de
   * qualquer pagamento. São caminhos de escrita diferentes (RPC transacional vs.
   * INSERT direto), porque uma baixa de R$ 0 só para carregar glosas deixaria um
   * recebimento fantasma na conta do título.
   */
  modo: 'baixa' | 'glosa';
  onFechar: () => void;
  onRegistrar: (dados: BaixaInput) => Promise<string | null>;
  onLancarGlosas: (notaId: string, glosas: GlosaLancamentoInput[]) => Promise<string | null>;
  /** Guias congeladas de um lote, para o rateio por guia. */
  buscarGuias: (loteId: string) => Promise<TituloGuia[]>;
}

interface LinhaGlosa extends GlosaLancamentoInput {
  /** Chave estável de render; o array é reordenado ao remover linhas. */
  chave: number;
}

let proximaChave = 1;

const novaLinha = (valor = 0): LinhaGlosa => ({
  chave: proximaChave++,
  valor,
  motivo: '',
  status: 'aberta',
  requisicaoId: null,
});

const BaixaModal: React.FC<Props> = ({ titulo, modo, onFechar, onRegistrar, onLancarGlosas, buscarGuias }) => {
  const [valorRecebido, setValorRecebido] = useState('');
  const [dataRecebimento, setDataRecebimento] = useState(hojeIso);
  const [bancoNome, setBancoNome] = useState('');
  const [formaRecebimento, setFormaRecebimento] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const [detalharPorGuia, setDetalharPorGuia] = useState(false);
  const [guias, setGuias] = useState<TituloGuia[]>([]);
  const [carregandoGuias, setCarregandoGuias] = useState(false);

  const [glosas, setGlosas] = useState<LinhaGlosa[]>([]);
  const [confirmaExcedente, setConfirmaExcedente] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const saldo = titulo?.valorSaldo ?? 0;

  // Reabrir o modal em outro título não pode herdar os valores do anterior.
  useEffect(() => {
    if (!titulo) return;
    setValorRecebido(modo === 'glosa' ? '' : saldo > 0 ? saldo.toFixed(2) : '');
    setDataRecebimento(hojeIso());
    setBancoNome('');
    setFormaRecebimento('');
    setObservacoes('');
    setDetalharPorGuia(false);
    setGuias([]);
    setGlosas(modo === 'glosa' ? [novaLinha()] : []);
    setConfirmaExcedente(false);
    setErro(null);
  }, [titulo, saldo, modo]);

  const carregarGuias = useCallback(async () => {
    if (!titulo) return;
    setCarregandoGuias(true);
    try {
      const listas = await Promise.all(titulo.lotes.map((lote) => buscarGuias(lote.id)));
      setGuias(listas.flat());
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível carregar as guias.');
    } finally {
      setCarregandoGuias(false);
    }
  }, [titulo, buscarGuias]);

  const alternarDetalhe = () => {
    const proximo = !detalharPorGuia;
    setDetalharPorGuia(proximo);
    if (proximo && guias.length === 0) void carregarGuias();
  };

  const recebido = Number(valorRecebido.replace(',', '.')) || 0;
  const totalGlosas = glosas.reduce((soma, g) => soma + (Number(g.valor) || 0), 0);
  // O que sobra depois desta baixa e destas glosas. Negativo significa que o
  // operador lançou mais do que o título deve.
  const restante = useMemo(
    () => Math.round((saldo - recebido - totalGlosas) * 100) / 100,
    [saldo, recebido, totalGlosas],
  );

  // Cada novo valor de restante negativo precisa de uma confirmação própria — uma
  // baixa de 250,00 digitada como 2500,00 não pode herdar o "sim" de uma edição
  // anterior (achado 4.4: hoje o saldo negativo é aceito sem aviso nenhum).
  useEffect(() => {
    setConfirmaExcedente(false);
  }, [restante]);

  /** Preenche uma glosa com exatamente a diferença que sobrou. */
  const glosarDiferenca = () => {
    if (restante <= 0) return;
    setGlosas((atual) => [...atual, novaLinha(restante)]);
  };

  const atualizar = (chave: number, campo: keyof GlosaLancamentoInput, valor: unknown) => {
    setGlosas((atual) =>
      atual.map((linha) => (linha.chave === chave ? { ...linha, [campo]: valor } : linha)),
    );
  };

  const submeter = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!titulo) return;
    setErro(null);

    if (modo === 'glosa' && glosas.length === 0) {
      setErro('Informe ao menos uma glosa.');
      return;
    }
    // Checado ANTES do "recebido <= 0 && sem glosa" de propósito: aquele guard só
    // barra quando não há nenhuma glosa, então um valor negativo digitado por
    // engano passava disfarçado assim que a linha de glosa era adicionada.
    if (modo === 'baixa' && recebido < 0) {
      setErro('Valor recebido não pode ser negativo.');
      return;
    }
    if (modo === 'baixa' && recebido <= 0 && glosas.length === 0) {
      setErro('Informe um valor recebido ou ao menos uma glosa.');
      return;
    }
    if (glosas.some((g) => !g.motivo.trim())) {
      setErro('Toda glosa precisa de um motivo.');
      return;
    }
    if (glosas.some((g) => !(Number(g.valor) > 0))) {
      setErro('Toda glosa precisa de um valor maior que zero.');
      return;
    }
    if (restante < 0 && !confirmaExcedente) {
      setErro('Recebido + glosas excede o saldo do título. Confirme abaixo para registrar mesmo assim.');
      return;
    }

    // `chave` é só para o React; não vai para o banco.
    const limpas: GlosaLancamentoInput[] = glosas.map((linha) => ({
      valor: Number(linha.valor) || 0,
      motivo: linha.motivo,
      codigoGlosa: linha.codigoGlosa ?? null,
      status: linha.status ?? 'aberta',
      requisicaoId: linha.requisicaoId ?? null,
      loteId: linha.loteId ?? null,
    }));

    setSalvando(true);
    const falha = modo === 'glosa'
      ? await onLancarGlosas(titulo.id, limpas)
      : await onRegistrar({
        notaId: titulo.id,
        valorRecebido: recebido,
        dataRecebimento,
        bancoNome: bancoNome.trim() || null,
        formaRecebimento: formaRecebimento || null,
        observacoes: observacoes.trim() || null,
        glosas: limpas,
      });
    setSalvando(false);

    if (falha) setErro(falha);
    else onFechar();
  };

  if (!titulo) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {modo === 'glosa' ? 'Lançar glosa' : 'Registrar baixa'} — {titulo.numeroNota}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {titulo.operadoraNome ?? 'Operadora'} · saldo{' '}
              <strong className="tabular-nums">{formatCurrency(saldo)}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submeter} className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {modo === 'baixa' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="text-xs text-gray-500 dark:text-gray-400">
              Valor recebido *
              <input
                type="number"
                step="0.01"
                min="0"
                value={valorRecebido}
                onChange={(e) => setValorRecebido(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 tabular-nums"
              />
            </label>
            <label className="text-xs text-gray-500 dark:text-gray-400">
              Data
              <DatePicker
                value={dataRecebimento}
                onChange={setDataRecebimento}
                controlClass={CAMPO}
              />
            </label>
            <label className="text-xs text-gray-500 dark:text-gray-400">
              Banco
              <input
                type="text"
                value={bancoNome}
                onChange={(e) => setBancoNome(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
              />
            </label>
            <label className="text-xs text-gray-500 dark:text-gray-400">
              Forma
              <Select
                value={formaRecebimento}
                onChange={setFormaRecebimento}
                options={FORMAS_OPCOES}
                placeholder="—"
                controlClass={CAMPO}
              />
            </label>
          </div>
          )}

          {/* Resumo do que sobra: é o número que decide se falta lançar glosa. */}
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700/40 text-sm">
            <span className="text-gray-500 dark:text-gray-400">
              Recebido <strong className="tabular-nums text-gray-800 dark:text-gray-100">{formatCurrency(recebido)}</strong>
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              Glosas <strong className="tabular-nums text-gray-800 dark:text-gray-100">{formatCurrency(totalGlosas)}</strong>
            </span>
            <span className={restante < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-gray-500 dark:text-gray-400'}>
              Restante <strong className="tabular-nums">{formatCurrency(restante)}</strong>
            </span>
            {restante > 0 && (
              <button
                type="button"
                onClick={glosarDiferenca}
                className="ml-auto text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                Lançar a diferença como glosa
              </button>
            )}
          </div>

          {/* Saldo negativo é aceito pelo banco (pagamento a maior existe de
              verdade), mas não pode passar de um clique distraído — exige
              confirmação explícita mostrando quanto excede (achado 4.4). */}
          {restante < 0 && (
            <label className="flex items-start gap-2 px-4 py-3 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-900/20 text-sm text-rose-700 dark:text-rose-300">
              <input
                type="checkbox"
                checked={confirmaExcedente}
                onChange={(e) => setConfirmaExcedente(e.target.checked)}
                className="mt-0.5 rounded border-rose-300 dark:border-rose-700"
              />
              <span>
                Recebido + glosas excede o saldo do título em{' '}
                <strong className="tabular-nums">{formatCurrency(Math.abs(restante))}</strong>.
                Confirmo que quero registrar mesmo assim.
              </span>
            </label>
          )}

          {/* ── Glosas ───────────────────────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Glosas</h3>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <input
                    type="checkbox"
                    checked={detalharPorGuia}
                    onChange={alternarDetalhe}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  Detalhar por guia
                </label>
                <button
                  type="button"
                  onClick={() => setGlosas((atual) => [...atual, novaLinha()])}
                  className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar
                </button>
              </div>
            </div>

            {carregandoGuias && (
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando guias do título…
              </div>
            )}

            {glosas.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Nenhuma glosa. Se a operadora pagou o valor cheio, siga sem lançar nada.
              </p>
            ) : (
              <div className="space-y-2">
                {glosas.map((glosa) => (
                  <div
                    key={glosa.chave}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start p-3 rounded-xl border border-gray-100 dark:border-gray-700"
                  >
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={glosa.valor || ''}
                      onChange={(e) => atualizar(glosa.chave, 'valor', Number(e.target.value))}
                      placeholder="Valor"
                      className="sm:col-span-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 tabular-nums"
                    />
                    <input
                      type="text"
                      value={glosa.motivo}
                      onChange={(e) => atualizar(glosa.chave, 'motivo', e.target.value)}
                      placeholder="Motivo *"
                      className="sm:col-span-4 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
                    />
                    {detalharPorGuia && (
                      <Select
                        value={glosa.requisicaoId ?? ''}
                        onChange={(v) => atualizar(glosa.chave, 'requisicaoId', v || null)}
                        options={[
                          { value: '', label: 'Sem guia específica' },
                          ...guias.map((guia) => ({
                            value: guia.id,
                            label: `${guia.numeroGuia} · ${formatCurrency(guia.valor)}${guia.pacienteNome ? ` · ${guia.pacienteNome}` : ''}`,
                          })),
                        ]}
                        controlClass={CAMPO_GRID}
                        wrapperClass="sm:col-span-3"
                      />
                    )}
                    <Select
                      value={glosa.status ?? 'aberta'}
                      onChange={(v) => atualizar(glosa.chave, 'status', v)}
                      options={STATUS_GLOSA_OPCOES}
                      controlClass={CAMPO_GRID}
                      wrapperClass={detalharPorGuia ? 'sm:col-span-2' : 'sm:col-span-5'}
                    />
                    <button
                      type="button"
                      onClick={() => setGlosas((atual) => atual.filter((l) => l.chave !== glosa.chave))}
                      className="sm:col-span-1 p-2 rounded-lg text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-gray-100 dark:hover:bg-gray-700 justify-self-end"
                      aria-label="Remover glosa"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {/* Só a glosa DEFINITIVA fecha o título; as outras seguem cobráveis. */}
                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                  Glosa definitiva encerra o saldo correspondente. Aberta ou em recurso continuam contando como valor a recuperar.
                </p>
              </div>
            )}
          </div>

          {modo === 'baixa' && (
            <label className="block text-xs text-gray-500 dark:text-gray-400">
              Observações
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={2}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
              />
            </label>
          )}

          {erro && (
            <div className="p-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{erro}</span>
            </div>
          )}
        </form>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 dark:border-gray-700">
          <button
            type="button"
            onClick={onFechar}
            className="px-4 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submeter}
            disabled={salvando || (restante < 0 && !confirmaExcedente)}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 flex items-center gap-2 ${
              modo === 'glosa' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
            {modo === 'glosa' ? 'Lançar glosa' : 'Registrar baixa'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BaixaModal;
