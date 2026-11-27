import React, { useEffect, useMemo, useState } from 'react';
import { BadgePercent, Loader2, Save } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import {
  useParametrosTabelaColaborador,
  type ParametrosTabelaColaboradorGravados,
} from '../../hooks/useParametrosTabelaColaborador';
import { hasPermission } from '../../utils/permissions';
import {
  fatorTabelaColaborador,
  validarParametrosTabelaColaborador,
  type CampoParametros,
  type ConfiguracaoTabelaColaborador,
} from '../../modules/gerador-orcamento/domain/tabelaColaborador';
import Notification from '../Notification';

// Aba "Tabela Colaborador" do Controle de Custos: parâmetros da regra do Valor
// colaborador (.scratch/tabela-colaborador/spec.md → "Parâmetros da regra").
// Quem gerencia o Controle de Custos edita; quem só visualiza vê.

interface Formulario {
  parcelaA: string;
  parcelaB: string;
  /** Em %, como a tela mostra; o banco guarda a fração. */
  limitePercentual: string;
  rotuloParcelaA: string;
  rotuloParcelaB: string;
}

const NUMERO = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 });

function escreverNumero(valor: number): string {
  return NUMERO.format(valor);
}

// "2,5" ou "2.5" → 2,5. Vazio ou inválido → NaN (a validação recusa).
function lerNumero(texto: string): number {
  const limpo = texto.trim();
  if (!limpo) return Number.NaN;
  const normalizado = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
  return /^-?\d+(\.\d+)?$/.test(normalizado) ? Number(normalizado) : Number.NaN;
}

function paraFormulario(p: ConfiguracaoTabelaColaborador): Formulario {
  return {
    parcelaA: escreverNumero(p.parcelaA),
    parcelaB: escreverNumero(p.parcelaB),
    // 0,9 × 100 em ponto flutuante dá 90,00000000000001; arredonda para o que se vê.
    limitePercentual: escreverNumero(Math.round(p.limitePoucaVantagem * 100 * 10000) / 10000),
    rotuloParcelaA: p.rotuloParcelaA,
    rotuloParcelaB: p.rotuloParcelaB,
  };
}

function deFormulario(f: Formulario): ConfiguracaoTabelaColaborador {
  return {
    parcelaA: lerNumero(f.parcelaA),
    parcelaB: lerNumero(f.parcelaB),
    // 33,3 / 100 dá 0,33299999999999996; arredonda para não gravar o resíduo.
    limitePoucaVantagem: Math.round((lerNumero(f.limitePercentual) / 100) * 1e6) / 1e6,
    rotuloParcelaA: f.rotuloParcelaA,
    rotuloParcelaB: f.rotuloParcelaB,
  };
}

function formatarAlteracao(p: ParametrosTabelaColaboradorGravados): string {
  const quando = new Date(p.alteradoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  // Sem autor: linha criada pela migration ou alterada direto no banco.
  return p.alteradoPor ? `${quando} por ${p.alteradoPor}` : quando;
}

const inputCls =
  'w-full px-3 py-2.5 text-sm rounded-xl bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition-all disabled:bg-gray-50 disabled:text-gray-600 dark:disabled:bg-gray-900 dark:disabled:text-gray-300 disabled:cursor-not-allowed';
const labelCls = 'block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5';

const MensagemErro: React.FC<{ texto?: string }> = ({ texto }) =>
  texto ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{texto}</p> : null;

const CampoPercentual: React.FC<{
  value: string;
  onChange: (texto: string) => void;
  disabled: boolean;
  invalido: boolean;
  ariaLabel: string;
}> = ({ value, onChange, disabled, invalido, ariaLabel }) => (
  <div className="relative">
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      aria-label={ariaLabel}
      aria-invalid={invalido}
      value={value}
      disabled={disabled}
      onChange={e => onChange(e.target.value.replace(/[^\d.,-]/g, ''))}
      className={`${inputCls} pr-8 tabular-nums ${invalido ? 'border-red-400 dark:border-red-500' : ''}`}
    />
    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-gray-400 pointer-events-none">
      %
    </span>
  </div>
);

const TabelaColaboradorScreen: React.FC = () => {
  const { userProfile } = useAuth();
  const podeGerenciar = hasPermission(userProfile?.permissions || [], 'canManageControleCustos');
  const { parametros, carregando, erro, salvar } = useParametrosTabelaColaborador();
  const { notification, showSuccess, showError, hideNotification } = useNotification();

  const [form, setForm] = useState<Formulario | null>(null);
  const [tentouSalvar, setTentouSalvar] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (parametros) setForm(paraFormulario(parametros));
  }, [parametros]);

  const config = useMemo(() => (form ? deFormulario(form) : null), [form]);
  const erros = useMemo(() => (config ? validarParametrosTabelaColaborador(config) : {}), [config]);
  const temErro = Object.keys(erros).length > 0;
  const alterado = !!form && !!parametros && JSON.stringify(form) !== JSON.stringify(paraFormulario(parametros));
  // Erro aparece enquanto se digita no campo já mexido, e em todos depois de tentar salvar.
  const original = parametros ? paraFormulario(parametros) : null;
  const mostrarErro = (campo: CampoParametros, campos: (keyof Formulario)[]) =>
    tentouSalvar || campos.some(c => form && original && form[c] !== original[c]) ? erros[campo] : undefined;

  const fator =
    config && !erros.parcelaA && !erros.parcelaB && !erros.fator ? fatorTabelaColaborador(config) : null;

  if (carregando) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando parâmetros…
      </div>
    );
  }
  if (erro || !form || !parametros) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        Não foi possível carregar os parâmetros da Tabela Colaborador{erro ? `: ${erro}` : '.'}
      </p>
    );
  }

  const definir = (campo: keyof Formulario) => (texto: string) => setForm(f => (f ? { ...f, [campo]: texto } : f));

  const aoSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setTentouSalvar(true);
    if (!config || temErro) {
      showError('Parâmetros inválidos', 'Corrija os campos marcados antes de salvar.');
      return;
    }
    setSalvando(true);
    try {
      await salvar(config);
      setTentouSalvar(false);
      showSuccess('Parâmetros salvos', 'Os valores colaborador mudam na próxima consulta.');
    } catch (err) {
      showError('Não foi possível salvar', err instanceof Error ? err.message : undefined);
    } finally {
      setSalvando(false);
    }
  };

  const desabilitado = !podeGerenciar || salvando;

  return (
    <form onSubmit={aoSalvar} className="max-w-3xl space-y-5">
      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/25">
            <BadgePercent className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Parâmetros da Tabela Colaborador</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Valor colaborador = custo ÷ fator, com fator = (100 − {form.rotuloParcelaA || 'parcela A'} −{' '}
              {form.rotuloParcelaB || 'parcela B'}) ÷ 100. O exame vai para “consultar a gestão” quando o valor
              colaborador chega ao limite de pouca vantagem do preço Particular.
            </p>
            {!podeGerenciar && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Somente leitura: só quem gerencia o Controle de Custos altera os parâmetros.
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {(['A', 'B'] as const).map(letra => {
            const valor = `parcela${letra}` as const;
            const rotulo = `rotuloParcela${letra}` as const;
            return (
              <div key={letra} className="rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
                <div>
                  <label className={labelCls} htmlFor={`rotulo-parcela-${letra}`}>
                    Nome da parcela {letra}
                  </label>
                  <input
                    id={`rotulo-parcela-${letra}`}
                    value={form[rotulo]}
                    disabled={desabilitado}
                    onChange={e => definir(rotulo)(e.target.value)}
                    className={`${inputCls} ${mostrarErro(rotulo, [rotulo]) ? 'border-red-400 dark:border-red-500' : ''}`}
                  />
                  <MensagemErro texto={mostrarErro(rotulo, [rotulo])} />
                </div>
                <div>
                  <span className={labelCls}>{form[rotulo] || `Parcela ${letra}`}</span>
                  <CampoPercentual
                    ariaLabel={`Percentual da parcela ${letra}`}
                    value={form[valor]}
                    onChange={definir(valor)}
                    disabled={desabilitado}
                    invalido={!!mostrarErro(valor, [valor])}
                  />
                  <MensagemErro texto={mostrarErro(valor, [valor])} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 rounded-xl bg-blue-50/60 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/40 px-4 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Fator resultante</span>
            <span className="text-lg font-semibold tabular-nums text-blue-700 dark:text-blue-300">
              {fator === null ? '—' : escreverNumero(fator)}
            </span>
          </div>
          <MensagemErro texto={mostrarErro('fator', ['parcelaA', 'parcelaB'])} />
        </div>

        <div className="mt-4 sm:max-w-xs">
          <label className={labelCls} htmlFor="limite-pouca-vantagem">
            Limite de pouca vantagem (% do preço Particular)
          </label>
          <CampoPercentual
            ariaLabel="Limite de pouca vantagem"
            value={form.limitePercentual}
            onChange={definir('limitePercentual')}
            disabled={desabilitado}
            invalido={!!mostrarErro('limitePoucaVantagem', ['limitePercentual'])}
          />
          <MensagemErro texto={mostrarErro('limitePoucaVantagem', ['limitePercentual'])} />
        </div>

        <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">Última alteração: {formatarAlteracao(parametros)}</p>
          {podeGerenciar && (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!alterado || salvando}
                onClick={() => {
                  setForm(paraFormulario(parametros));
                  setTentouSalvar(false);
                }}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Descartar
              </button>
              <button
                type="submit"
                disabled={!alterado || salvando}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-md shadow-blue-500/25 active:scale-[.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar
              </button>
            </div>
          )}
        </div>
      </div>

      <Notification
        type={notification.type}
        title={notification.title}
        message={notification.message}
        isVisible={notification.isVisible}
        onClose={hideNotification}
      />
    </form>
  );
};

export default TabelaColaboradorScreen;
