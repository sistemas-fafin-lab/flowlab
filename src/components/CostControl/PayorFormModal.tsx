import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Pencil, Plus, X, Save } from 'lucide-react';
import { formatBRL, type Exam, type Payor, type PayorEditData } from '../../hooks/useCostControl';
import AutocompleteInput from './AutocompleteInput';
import {
  analisarLinhaFontePagadora,
  examesDoTuss,
  buscarExamesPorTermo,
  buscarFontesPagadorasPorTermo,
  buscarTabelasAssociadasPorTermo,
} from './domain/busca';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface PayorFormModalProps {
  open: boolean;
  mode: 'edit' | 'create';
  payor: PayorEditData | null;
  // Id da linha em edição — tirado da checagem de linha duplicada (senão a
  // própria linha contaria como "já existe").
  editingPayorId?: string;
  exams: Exam[];
  payors: Payor[];
  onClose: () => void;
  onSave: (data: PayorEditData) => void;
  saving?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const EMPTY_FORM: PayorEditData = { payor: '', table: '', tus: '', price: 0, exameId: null };

const PayorFormModal: React.FC<PayorFormModalProps> = ({
  open,
  mode,
  payor,
  editingPayorId,
  exams,
  payors,
  onClose,
  onSave,
  saving = false,
}) => {
  const [form, setForm] = useState<PayorEditData>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  // Linha geral do TUSS (exameId null) — só quando o usuário pede. Por
  // padrão, escolher um exame grava a linha só pra ele. Ver
  // examesPorFontePagadora.
  const [aplicarATodos, setAplicarATodos] = useState(false);

  useEffect(() => {
    if (open) {
      const inicial = payor ?? EMPTY_FORM;
      setForm(inicial);
      setFormError(null);
      setAplicarATodos(!!inicial.tus.trim() && !inicial.exameId);
    }
  }, [open, payor]);

  const sugestoesFonte = useMemo(() => buscarFontesPagadorasPorTermo(payors, form.payor), [payors, form.payor]);
  const sugestoesTabela = useMemo(() => buscarTabelasAssociadasPorTermo(payors, form.table), [payors, form.table]);
  const sugestoesTuss = useMemo(() => buscarExamesPorTermo(exams, form.tus), [exams, form.tus]);
  const examesDoTussAtual = useMemo(() => examesDoTuss(exams, form.tus), [exams, form.tus]);

  // O que de fato vai pro banco: com "aplicar a todos", sem exameId.
  const dadosParaSalvar: PayorEditData = useMemo(
    () => (aplicarATodos && form.tus.trim() ? { ...form, exameId: null } : form),
    [aplicarATodos, form]
  );
  const analise = useMemo(
    () => analisarLinhaFontePagadora(payors, dadosParaSalvar, editingPayorId),
    [payors, dadosParaSalvar, editingPayorId]
  );

  if (!open) return null;

  // Um exame sem TUSS não tem como se identificar por texto — sem exameId,
  // a linha ficaria ambígua e (antes desta validação) acabava "compartilhando"
  // o mesmo preço com qualquer outro exame sem TUSS no catálogo. Ver
  // examesPorFontePagadora em domain/busca.ts.
  const exameVinculado = form.exameId ? exams.find(e => e.id === form.exameId) ?? null : null;
  const tussCompartilhado = examesDoTussAtual.length > 1;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !form.payor.trim()) return;
    if (!form.tus.trim() && !form.exameId) {
      setFormError('Selecione um exame da lista para vincular esta linha, ou informe um código TUSS.');
      return;
    }
    if (tussCompartilhado && !aplicarATodos && !form.exameId) {
      setFormError('Escolha o exame na lista do campo TUSS, ou marque "aplicar a todos os exames".');
      return;
    }
    if (analise.duplicada) {
      setFormError(
        dadosParaSalvar.exameId
          ? 'Já existe uma linha desta fonte pagadora e tabela para este exame — edite-a.'
          : 'Já existe uma linha desta fonte pagadora e tabela para todos os exames deste TUSS — edite-a.'
      );
      return;
    }
    setFormError(null);
    onSave(dadosParaSalvar);
  };

  const inputCls =
    'w-full px-3 py-2.5 text-sm rounded-xl bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition-all';

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={() => {
        if (!saving) onClose();
      }}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/25">
              {mode === 'create' ? <Plus className="w-5 h-5" /> : <Pencil className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {mode === 'create' ? 'Nova linha de fonte pagadora' : 'Editar fonte pagadora'}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {mode === 'create'
                  ? 'Preencha os dados da nova linha.'
                  : 'Ajuste os dados desta linha. A próxima reimportação pode sobrescrever esta edição.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">
                Fonte Pagadora <span className="text-red-500">*</span>
              </label>
              <AutocompleteInput
                required
                value={form.payor}
                onValueChange={v => setForm(f => ({ ...f, payor: v }))}
                onSelect={nome => setForm(f => ({ ...f, payor: nome }))}
                suggestions={sugestoesFonte}
                renderSuggestion={nome => <span className="font-medium text-gray-800 dark:text-gray-100 truncate">{nome}</span>}
                keyOf={nome => nome}
                emptyLabel="Nenhuma fonte pagadora encontrada — será salva como digitada."
                placeholder="Unimed"
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">
                Tabela Associada
              </label>
              <AutocompleteInput
                value={form.table}
                onValueChange={v => setForm(f => ({ ...f, table: v }))}
                onSelect={tabela => setForm(f => ({ ...f, table: tabela }))}
                suggestions={sugestoesTabela}
                renderSuggestion={tabela => <span className="font-medium text-gray-800 dark:text-gray-100 truncate">{tabela}</span>}
                keyOf={tabela => tabela}
                emptyLabel="Nenhuma tabela associada encontrada — será salva como digitada."
                placeholder="CBHPM 2022"
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">
                TUSS
              </label>
              <AutocompleteInput
                value={form.tus}
                onValueChange={v => {
                  setForm(f => ({ ...f, tus: v, exameId: null }));
                  setAplicarATodos(false);
                }}
                onSelect={exame => {
                  setForm(f => ({ ...f, tus: exame.tuss, exameId: exame.id }));
                  setAplicarATodos(false);
                }}
                suggestions={sugestoesTuss}
                renderSuggestion={exame => (
                  <>
                    <span className="font-medium text-gray-800 dark:text-gray-100 truncate">{exame.name}</span>
                    <span className="font-mono text-xs text-gray-500 dark:text-gray-400 shrink-0">{exame.tuss}</span>
                  </>
                )}
                keyOf={exame => exame.id}
                emptyLabel="Nenhum exame encontrado — TUSS será salvo como digitado."
                placeholder="40304361"
                className={inputCls}
              />
              {!form.tus.trim() && exameVinculado && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Sem TUSS — vinculado ao exame <span className="font-medium">{exameVinculado.name}</span>.
                </p>
              )}
            </div>
            {form.tus.trim() && exameVinculado && !aplicarATodos && (
              <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
                Vale só para <span className="font-medium">{exameVinculado.name}</span>
                {analise.linhaGeralSubstituida && (
                  <>
                    {' '}— substitui, só para ele, a linha geral do TUSS ({formatBRL(analise.linhaGeralSubstituida.price)})
                  </>
                )}
                .
              </p>
            )}
            {tussCompartilhado && (
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-900/40 px-4 py-3 text-sm text-gray-700 dark:text-gray-200 space-y-2">
                <label className="flex items-center gap-2 font-medium cursor-pointer">
                  <input type="checkbox" checked={aplicarATodos} onChange={e => setAplicarATodos(e.target.checked)} />
                  Aplicar a todos os {examesDoTussAtual.length} exames do TUSS {form.tus.trim()}
                </label>
                {aplicarATodos && (
                  <ul className="max-h-32 overflow-y-auto pl-6 list-disc text-xs text-gray-500 dark:text-gray-400">
                    {examesDoTussAtual.map(e => (
                      <li key={e.id}>{e.name}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {analise.duplicada && (
              <p className="flex items-start gap-2 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  Já existe esta linha ({formatBRL(analise.duplicada.price)}). Edite a existente em vez de criar outra.
                </span>
              </p>
            )}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">
                Valor Cobrado
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-gray-400 font-medium pointer-events-none">
                  R$
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price}
                  onChange={e => setForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))}
                  className={`${inputCls} pl-8 tabular-nums`}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-slate-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between gap-3 rounded-b-2xl">
            {formError && <p className="text-sm text-red-500 dark:text-red-400">{formError}</p>}
            <div className="flex items-center gap-3 ml-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/60 active:scale-[.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-md shadow-blue-500/25 active:scale-[.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-blue-500 disabled:hover:to-blue-600"
              >
                <Save className="w-4 h-4" /> {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PayorFormModal;
