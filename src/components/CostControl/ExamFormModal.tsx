import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Pencil, Plus, X, Save, Link2 } from 'lucide-react';
import { Exam, IndirectCostItem, formatBRL } from '../../hooks/useCostControl';
import { useCobrancasTestesAplis, type CobrancaAplis, type TesteAplis } from '../../hooks/useCobrancasTestesAplis';
import AutocompleteInput from './AutocompleteInput';
import { casaTermo } from './domain/busca';
import { nomesVinculoAplis } from './domain/vinculoAplis';
import CampoMoeda from './CampoMoeda';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface FormState {
  code: string;
  tuss: string;
  name: string;
  location: string;
  direct: number;
  indirect: number;
  indirectItems: IndirectCostItem[];
  aplisIdExameTipo: number | null;
  aplisIdTeste: number | null;
}

interface ExamFormModalProps {
  open: boolean;
  exam: Exam | null;
  onClose: () => void;
  onSave: (data: Omit<Exam, 'id'>) => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const EMPTY_FORM: FormState = {
  code: '', tuss: '', name: '', location: '', direct: 0, indirect: 0, indirectItems: [],
  aplisIdExameTipo: null, aplisIdTeste: null,
};

const BotaoLimpar: React.FC<{ onClick: () => void; title: string }> = ({ onClick, title }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
  >
    <X className="w-4 h-4" />
  </button>
);

// Texto vazio mostra a lista toda (são poucas cobranças/testes); com texto, filtra por nome.
const filtrarPorNome = <T extends { nome: string }>(itens: T[], texto: string): T[] =>
  texto.trim() ? itens.filter(i => casaTermo(i.nome, texto)) : itens;

const ExamFormModal: React.FC<ExamFormModalProps> = ({ open, exam, onClose, onSave }) => {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  // Texto digitado nos autocompletes do apLIS. O vínculo é o id em `form`: texto
  // que não veio de uma sugestão não liga nada (ver handleSubmit).
  const [cobrancaTexto, setCobrancaTexto] = useState('');
  const [testeTexto, setTesteTexto] = useState('');
  const [erroVinculo, setErroVinculo] = useState<string | null>(null);
  // Depois que a usuária mexe no vínculo, a lista do apLIS chegando não pode
  // trocar o texto dela pelos nomes salvos.
  const mexeuNoVinculoRef = useRef(false);
  const { cobrancas, loading: carregandoAplis, error: erroAplis } = useCobrancasTestesAplis(open);

  const cobrancaEscolhida = useMemo(
    () => cobrancas.find(c => c.id === form.aplisIdExameTipo) ?? null,
    [cobrancas, form.aplisIdExameTipo]
  );
  // Inativas não são oferecidas, mas um vínculo antigo com uma delas continua aparecendo pelo nome.
  const sugestoesCobranca = useMemo(
    () => filtrarPorNome(cobrancas.filter(c => !c.inativa), cobrancaTexto),
    [cobrancas, cobrancaTexto]
  );
  const sugestoesTeste = useMemo(
    () => filtrarPorNome(cobrancaEscolhida?.testes ?? [], testeTexto),
    [cobrancaEscolhida, testeTexto]
  );

  useEffect(() => {
    if (open) {
      setForm(
        exam
          ? {
              code: exam.code,
              tuss: exam.tuss,
              name: exam.name,
              location: exam.location,
              direct: exam.direct,
              indirect: exam.indirect,
              indirectItems: exam.indirectItems ?? [],
              aplisIdExameTipo: exam.aplisIdExameTipo,
              aplisIdTeste: exam.aplisIdTeste,
            }
          : EMPTY_FORM
      );
      setErroVinculo(null);
      mexeuNoVinculoRef.current = false;
    }
  }, [open, exam]);

  // Preenche os textos com os nomes do apLIS ao abrir e quando a lista chega.
  useEffect(() => {
    if (!open || mexeuNoVinculoRef.current) return;
    const nomes = nomesVinculoAplis(cobrancas, exam?.aplisIdExameTipo ?? null, exam?.aplisIdTeste ?? null);
    setCobrancaTexto(nomes.cobranca);
    setTesteTexto(nomes.teste);
  }, [open, exam, cobrancas]);

  if (!open) return null;

  const total = (Number(form.direct) || 0) + (Number(form.indirect) || 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cobrancaTexto.trim() && form.aplisIdExameTipo === null) {
      setErroVinculo('Escolha a cobrança na lista, ou apague o texto para deixar o exame sem vínculo.');
      return;
    }
    if (testeTexto.trim() && form.aplisIdTeste === null) {
      setErroVinculo('Escolha o teste na lista, ou apague o texto para ligar à cobrança sem teste.');
      return;
    }
    setErroVinculo(null);
    onSave(form);
  };

  const mudarTextoCobranca = (texto: string) => {
    mexeuNoVinculoRef.current = true;
    setCobrancaTexto(texto);
    setTesteTexto('');
    setForm(f => ({ ...f, aplisIdExameTipo: null, aplisIdTeste: null }));
  };

  const escolherCobranca = (cobranca: CobrancaAplis) => {
    mexeuNoVinculoRef.current = true;
    setCobrancaTexto(cobranca.nome);
    setTesteTexto('');
    setForm(f => ({ ...f, aplisIdExameTipo: cobranca.id, aplisIdTeste: null }));
    setErroVinculo(null);
  };

  const mudarTextoTeste = (texto: string) => {
    mexeuNoVinculoRef.current = true;
    setTesteTexto(texto);
    setForm(f => ({ ...f, aplisIdTeste: null }));
  };

  const escolherTeste = (teste: TesteAplis) => {
    mexeuNoVinculoRef.current = true;
    setTesteTexto(teste.nome);
    setForm(f => ({ ...f, aplisIdTeste: teste.id }));
    setErroVinculo(null);
  };

  const inputCls =
    'w-full px-3 py-2.5 text-sm rounded-xl bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition-all';

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/25">
              {exam ? <Pencil className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {exam ? 'Editar exame' : 'Novo exame'}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Cadastre custo direto e composição do custo indireto.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-5">
            {/* Base fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">
                  Código
                </label>
                <input
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                  placeholder="HMG-001"
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">
                  TUSS
                </label>
                <input
                  value={form.tuss}
                  onChange={e => setForm(f => ({ ...f, tuss: e.target.value }))}
                  placeholder="40304361"
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">
                  Nome do exame <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Hemograma Completo"
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">
                  Local de realização
                </label>
                <input
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="Hematologia"
                  className={inputCls}
                />
              </div>
            </div>

            {/* Direct & indirect costs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Custos Diretos
                </h3>
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-slate-50/60 dark:bg-gray-900/30 p-4 space-y-1.5">
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">
                    Materiais diretos
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Reagentes, descartáveis e insumos consumidos especificamente neste exame.
                  </p>
                  <CampoMoeda value={form.direct} onChange={valor => setForm(f => ({ ...f, direct: valor }))} className={inputCls} />
                </div>
              </div>

              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Custos Indiretos
                </h3>
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-slate-50/60 dark:bg-gray-900/30 p-4 space-y-1.5">
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">
                    Valor estimado
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Rateio de pessoal, depreciação de equipamentos e demais custos indiretos, em um único valor.
                  </p>
                  <CampoMoeda value={form.indirect} onChange={valor => setForm(f => ({ ...f, indirect: valor }))} className={inputCls} />
                </div>
              </div>
            </div>

            {/* Vínculo com o apLIS */}
            <div>
              <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                <Link2 className="w-3.5 h-3.5" /> Vínculo com o apLIS
              </h3>
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-slate-50/60 dark:bg-gray-900/30 p-4 space-y-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Diz a outros sistemas qual TUSS usar para esta cobrança/teste do apLIS. Sem vínculo, nenhum TUSS é
                  enviado por este exame.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">
                      Cobrança no apLIS
                    </label>
                    <div className="relative">
                      <AutocompleteInput
                        value={cobrancaTexto}
                        onValueChange={mudarTextoCobranca}
                        onSelect={escolherCobranca}
                        suggestions={sugestoesCobranca}
                        renderSuggestion={c => <span className="text-gray-800 dark:text-gray-100">{c.nome}</span>}
                        keyOf={c => String(c.id)}
                        emptyLabel={carregandoAplis ? 'Carregando cobranças…' : 'Nenhuma cobrança encontrada'}
                        placeholder="Sem vínculo"
                        showAllWhenEmpty
                        className={`${inputCls} pr-9`}
                      />
                      {cobrancaTexto && <BotaoLimpar onClick={() => mudarTextoCobranca('')} title="Remover vínculo" />}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">
                      Teste no apLIS
                    </label>
                    {cobrancaEscolhida && cobrancaEscolhida.testes.length > 0 ? (
                      <div className="relative">
                        <AutocompleteInput
                          value={testeTexto}
                          onValueChange={mudarTextoTeste}
                          onSelect={escolherTeste}
                          suggestions={sugestoesTeste}
                          renderSuggestion={t => <span className="text-gray-800 dark:text-gray-100">{t.nome}</span>}
                          keyOf={t => String(t.id)}
                          emptyLabel="Nenhum teste encontrado"
                          placeholder="Sem teste (vale para a cobrança)"
                          showAllWhenEmpty
                          className={`${inputCls} pr-9`}
                        />
                        {testeTexto && <BotaoLimpar onClick={() => mudarTextoTeste('')} title="Remover teste" />}
                      </div>
                    ) : form.aplisIdTeste !== null ? (
                      // Teste salvo que a lista não oferece (inativo, ou a lista não
                      // carregou): mostra e deixa remover.
                      <div className="relative px-3 py-2.5 pr-9 text-sm rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200">
                        {testeTexto}
                        <BotaoLimpar onClick={() => mudarTextoTeste('')} title="Remover teste" />
                      </div>
                    ) : (
                      <p className="px-3 py-2.5 text-sm rounded-xl border border-dashed border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500">
                        {form.aplisIdExameTipo === null ? 'Escolha a cobrança primeiro' : 'Esta cobrança não tem testes'}
                      </p>
                    )}
                  </div>
                </div>
                {erroAplis && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">{erroAplis}</p>
                )}
                {erroVinculo && (
                  <p className="text-xs text-red-600 dark:text-red-400">{erroVinculo}</p>
                )}
              </div>
            </div>

            {/* Total summary card */}
            <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-5 text-white shadow-lg shadow-blue-500/30">
              <div className="text-[11px] font-bold uppercase tracking-wider text-blue-100">
                Custo Total (Direto + Indireto)
              </div>
              <div className="mt-1 text-3xl font-bold tabular-nums">{formatBRL(total)}</div>
              <div className="mt-2 flex items-center gap-4 text-xs text-blue-50">
                <span>Direto: <strong className="tabular-nums">{formatBRL(form.direct)}</strong></span>
                <span className="opacity-50">·</span>
                <span>Indireto: <strong className="tabular-nums">{formatBRL(form.indirect)}</strong></span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-slate-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 flex items-center justify-end gap-3 rounded-b-2xl">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/60 active:scale-[.98] transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-md shadow-blue-500/25 active:scale-[.98] transition-all"
            >
              <Save className="w-4 h-4" /> Salvar exame
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ExamFormModal;
