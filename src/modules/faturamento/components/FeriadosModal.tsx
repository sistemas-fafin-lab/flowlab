import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, Pencil, Trash2, X } from 'lucide-react';
import Select from '../../../components/Select';
import { removerFeriado, salvarFeriado } from '../hooks/useCalendarioEnvios';
import type { DadosFeriadoEnvio, FeriadoEnvio } from '../types';
import { formatData, formatDataHora } from '../utils/formato';

// Calendário de envios → "Feriados": os feriados nacionais e do DF que o servidor
// desconta ao contar dias úteis. Mudar um feriado muda a grade, o "Amanhã" e as
// janelas de dias úteis assim que o calendário relê. Só aberto por quem tem
// canManageCalendarioEnvios; a RLS recusa a escrita de qualquer forma.

interface Props {
  feriados: FeriadoEnvio[];
  /** 'YYYY-MM-DD': o ano aberto primeiro. */
  hoje: string;
  onFechar: () => void;
  /** Um feriado foi gravado ou removido: o calendário relê. */
  onAlterado: () => void;
}

const CAMPO = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white';
const ROTULO = 'block text-xs font-medium text-gray-500 dark:text-gray-400';

const OPCOES_ABRANGENCIA = [
  { value: 'nacional', label: 'Nacional' },
  { value: 'DF', label: 'DF' },
];

const NOME_SEMANA = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' });

/** Formulário limpo, mantendo a data: costuma-se cadastrar vários feriados seguidos. */
const vazio = (data: string): DadosFeriadoEnvio => ({ id: null, data, descricao: '', abrangencia: 'nacional' });

const FeriadosModal: React.FC<Props> = ({ feriados, hoje, onFechar, onAlterado }) => {
  const [ano, setAno] = useState(() => Number(hoje.slice(0, 4)));
  const [form, setForm] = useState<DadosFeriadoEnvio>(() => vazio(hoje));
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !gravando) onFechar();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onFechar, gravando]);

  const doAno = useMemo(() => feriados.filter((f) => f.data.startsWith(String(ano))), [feriados, ano]);

  const gravar = async (acao: () => Promise<unknown>) => {
    setGravando(true);
    setErro(null);
    try {
      await acao();
      setForm(vazio(form.data));
      onAlterado();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível gravar o feriado.');
    } finally {
      setGravando(false);
    }
  };

  const salvar = () => {
    if (!form.descricao.trim()) {
      setErro('Informe a descrição do feriado.');
      return;
    }
    void gravar(() => salvarFeriado(form));
  };

  const remover = (f: FeriadoEnvio) => {
    if (!window.confirm(`Remover o feriado de ${formatData(f.data)} (${f.descricao})? O dia volta a contar como dia útil.`)) return;
    void gravar(() => removerFeriado(f.id));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Feriados</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Nacionais e do DF. Não contam como dia útil no calendário nem nas janelas de dias úteis.
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            disabled={gravando}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4 flex-1 overflow-y-auto">
          {erro && (
            <div className="p-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              salvar();
            }}
            className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-[9.5rem_minmax(0,1fr)_8rem] gap-2 items-end"
          >
            <label className={ROTULO}>
              Data
              <input
                type="date"
                value={form.data}
                onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
                required
                className={`mt-1 ${CAMPO}`}
              />
            </label>
            <label className={ROTULO}>
              Descrição
              <input
                type="text"
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                placeholder="Ex.: Aniversário de Brasília"
                className={`mt-1 ${CAMPO}`}
              />
            </label>
            <div className={ROTULO}>
              Abrangência
              <Select
                value={form.abrangencia}
                onChange={(v) => setForm((f) => ({ ...f, abrangencia: v as DadosFeriadoEnvio['abrangencia'] }))}
                options={OPCOES_ABRANGENCIA}
                controlClass={`mt-1 ${CAMPO}`}
                ariaLabel="Abrangência"
              />
            </div>
            <div className="sm:col-span-3 flex justify-end gap-2">
              {form.id && (
                <button
                  type="button"
                  onClick={() => setForm(vazio(form.data))}
                  disabled={gravando}
                  className="px-4 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Cancelar edição
                </button>
              )}
              <button
                type="submit"
                disabled={gravando}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {gravando && <Loader2 className="w-4 h-4 animate-spin" />}
                {form.id ? 'Salvar feriado' : 'Adicionar feriado'}
              </button>
            </div>
          </form>

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{ano}</h3>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setAno((a) => a - 1)}
                aria-label="Ano anterior"
                className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setAno((a) => a + 1)}
                aria-label="Próximo ano"
                className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {doAno.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum feriado cadastrado em {ano}.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {doAno.map((f) => (
                <li key={f.id} className={`py-2.5 flex items-center gap-3 ${form.id === f.id ? 'bg-blue-50/60 dark:bg-blue-900/10 -mx-2 px-2 rounded-lg' : ''}`}>
                  <span className="w-28 shrink-0 text-sm tabular-nums text-gray-900 dark:text-gray-100">
                    {formatData(f.data)}
                    <span className="ml-1 text-xs text-gray-400">{NOME_SEMANA.format(new Date(`${f.data}T00:00:00Z`))}</span>
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{f.descricao}</p>
                    {f.alteradoPorNome && (
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">
                        {f.alteradoPorNome} em {formatDataHora(f.alteradoEm)}
                      </p>
                    )}
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-[11px] text-gray-600 dark:text-gray-300">
                    {f.abrangencia === 'DF' ? 'DF' : 'Nacional'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setForm({ id: f.id, data: f.data, descricao: f.descricao, abrangencia: f.abrangencia })}
                    disabled={gravando}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    aria-label={`Editar ${f.descricao}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remover(f)}
                    disabled={gravando}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    aria-label={`Remover ${f.descricao}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeriadosModal;
