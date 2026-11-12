import React, { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw, X } from 'lucide-react';
import type { MetaMensal } from '../types';
import { useMetaSugerida } from '../hooks/useMetaSugerida';
import type { CandidataMeta, OrigemCandidata } from '../utils/metaSugerida';
import { formatCompetencia, formatCurrency } from '../utils/formato';

// Modal "Definir meta" do card Meta mensal (issue 43; Meta sugerida, issue 02): as três
// candidatas do mês corrente calculadas dos Elegíveis do apLIS — 90/10, média de 2 e de 3
// meses —, com a 90/10 pré-selecionada, e a opção de digitar outro valor. Abre a qualquer
// momento do mês; sem `podeEditar` fica só leitura ("Ver sugestões"). Nada é salvo sem
// clicar em Salvar, e com o apLIS fora do ar continua dando para digitar a meta.

interface Props {
  aberto: boolean;
  meta: MetaMensal;
  /** Gate de escrita (RLS de `metas_faturamento`); sem ele o modal só mostra as opções. */
  podeEditar: boolean;
  onFechar: () => void;
  onSalvar: (valor: number) => Promise<string | null>;
}

type Escolha = OrigemCandidata | 'manual';

const ROTULOS: Record<OrigemCandidata, string> = {
  '90_10': '90/10',
  media_2: 'Média de 2 meses',
  media_3: 'Média de 3 meses',
};

const DESCRICOES: Record<OrigemCandidata, string> = {
  '90_10': '90% do mês anterior + 10% do retrasado',
  media_2: 'Média simples dos 2 meses anteriores',
  media_3: 'Média simples dos 3 meses anteriores',
};

/** 'YYYY-MM-DD' → 'DD/MM'. */
const formatDiaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

const MetaMensalModal: React.FC<Props> = ({ aberto, meta, podeEditar, onFechar, onSalvar }) => {
  const { sugestao, loading, erro: erroSugestao, recarregar } = useMetaSugerida(meta.competencia, aberto);
  const [escolha, setEscolha] = useState<Escolha>('90_10');
  const [valorManual, setValorManual] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Reabre sempre com a 90/10 escolhida e o campo manual com a meta salva (ou vazio).
  useEffect(() => {
    setEscolha('90_10');
    setValorManual(meta.valorMeta !== null ? String(meta.valorMeta) : '');
    setErro(null);
  }, [aberto, meta.valorMeta]);

  const candidatas = sugestao?.candidatas ?? [];
  // Opção escolhida indisponível (apLIS fora do ar ou mês sem dado): cai na primeira
  // candidata com valor e, sem nenhuma, em "outro valor".
  const disponivel = (origem: Escolha) => candidatas.some((c) => c.origem === origem && c.valor !== null);
  const escolhaEfetiva: Escolha =
    escolha === 'manual' || loading || disponivel(escolha)
      ? escolha
      : candidatas.find((c) => c.valor !== null)?.origem ?? 'manual';
  const candidataEscolhida = candidatas.find((c) => c.origem === escolhaEfetiva);

  const fechar = () => {
    setErro(null);
    onFechar();
  };

  const submeter = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!podeEditar) return;

    let numero: number;
    if (escolhaEfetiva === 'manual') {
      numero = Number(valorManual.replace(',', '.'));
      if (valorManual.trim() === '' || !Number.isFinite(numero) || numero < 0) {
        setErro('Informe um valor válido para a meta.');
        return;
      }
    } else {
      const valor = candidataEscolhida?.valor ?? null;
      if (valor === null) {
        setErro('Esta opção está indisponível. Escolha outra ou digite o valor.');
        return;
      }
      numero = valor;
    }

    setErro(null);
    setSalvando(true);
    const erroRetornado = await onSalvar(numero);
    setSalvando(false);

    if (erroRetornado) setErro(erroRetornado);
    else fechar();
  };

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {podeEditar ? 'Meta mensal' : 'Sugestões de meta'}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatCompetencia(meta.competencia)}
              {meta.valorMeta !== null && ` · meta salva: ${formatCurrency(meta.valorMeta)}`}
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

        <form onSubmit={submeter} className="px-6 py-4 space-y-3 overflow-y-auto">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-300">Sugestões pelos Elegíveis do apLIS</p>
            {sugestao?.dadoAte && (
              <span className="text-[11px] text-gray-400 dark:text-gray-500">dados até {formatDiaMes(sugestao.dadoAte)}</span>
            )}
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-gray-500 dark:text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Calculando as sugestões…
            </div>
          ) : erroSugestao ? (
            <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/20 text-sm text-amber-800 dark:text-amber-300 space-y-2">
              <p className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  {erroSugestao}
                  {podeEditar && ' Você ainda pode digitar a meta abaixo.'}
                </span>
              </p>
              <button
                type="button"
                onClick={recarregar}
                className="px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-800 text-xs font-medium hover:bg-amber-100 dark:hover:bg-amber-900/40 flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Tentar novamente
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {candidatas.map((candidata) => (
                <OpcaoCandidata
                  key={candidata.origem}
                  candidata={candidata}
                  elegiveis={sugestao?.elegiveis ?? {}}
                  selecionada={escolhaEfetiva === candidata.origem}
                  podeEditar={podeEditar}
                  onEscolher={() => setEscolha(candidata.origem)}
                />
              ))}
            </div>
          )}

          {podeEditar && (
            <label
              className={`block p-3 rounded-xl border cursor-pointer ${
                escolhaEfetiva === 'manual'
                  ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-600'
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-100">
                <input
                  type="radio"
                  name="escolha-meta"
                  checked={escolhaEfetiva === 'manual'}
                  onChange={() => setEscolha('manual')}
                />
                Outro valor (R$)
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={valorManual}
                onFocus={() => setEscolha('manual')}
                onChange={(e) => {
                  setEscolha('manual');
                  setValorManual(e.target.value);
                }}
                placeholder="Ex.: 500000"
                className="mt-2 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 tabular-nums"
              />
            </label>
          )}

          {erro && (
            <div className="p-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={fechar}
              className="px-4 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              {podeEditar ? 'Cancelar' : 'Fechar'}
            </button>
            {podeEditar && (
              <button
                type="submit"
                disabled={salvando || (loading && escolhaEfetiva !== 'manual')}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
                Salvar
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

interface OpcaoProps {
  candidata: CandidataMeta;
  elegiveis: Record<string, number>;
  selecionada: boolean;
  podeEditar: boolean;
  onEscolher: () => void;
}

/** Uma candidata: valor, fórmula e os Elegíveis de cada mês usado. */
const OpcaoCandidata: React.FC<OpcaoProps> = ({ candidata, elegiveis, selecionada, podeEditar, onEscolher }) => {
  const { valor } = candidata;
  const indisponivel = valor === null;
  return (
    <label
      className={`block p-3 rounded-xl border ${
        selecionada && podeEditar
          ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-900/20'
          : 'border-gray-200 dark:border-gray-600'
      } ${indisponivel || !podeEditar ? 'cursor-default' : 'cursor-pointer'} ${indisponivel ? 'opacity-60' : ''}`}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="flex items-start gap-2">
          {podeEditar && (
            <input
              type="radio"
              name="escolha-meta"
              className="mt-1"
              checked={selecionada}
              disabled={indisponivel}
              onChange={onEscolher}
            />
          )}
          <span>
            <span className="block text-sm font-medium text-gray-800 dark:text-gray-100">{ROTULOS[candidata.origem]}</span>
            <span className="block text-[11px] text-gray-500 dark:text-gray-400">{DESCRICOES[candidata.origem]}</span>
          </span>
        </span>
        <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100 whitespace-nowrap">
          {valor === null ? 'Indisponível' : formatCurrency(valor)}
        </span>
      </span>
      <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400 tabular-nums">
        {candidata.meses.map((mes) => (
          <span key={mes}>
            {formatCompetencia(mes)}:{' '}
            {elegiveis[mes] !== undefined ? formatCurrency(elegiveis[mes]) : <em>sem dado</em>}
          </span>
        ))}
      </span>
    </label>
  );
};

export default MetaMensalModal;
