import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, Save, Target } from 'lucide-react';
import { useTheme } from '../../../../hooks/useTheme';
import { formatCurrency } from '../../../../utils/paymentUtils';
import { dayKey } from '../../../../utils/datas';
import { corDoSlot, slotsDeCor } from '../../domain/coresCategorias';
import { consumoDoAno, realizadoPorCategoria, statusConsumo } from '../../domain/orcamento';
import { formatarValorCampo, parseValorBR } from '../../domain/valores';
import { useCanManageGastosTI } from '../../hooks/useCanManageGastosTI';
import { useCategoriasTI } from '../../hooks/useCategoriasTI';
import { useDespesasTI } from '../../hooks/useDespesasTI';
import { useLancamentosIntervaloTI } from '../../hooks/useLancamentosIntervaloTI';
import { useOrcamentosTI } from '../../hooks/useOrcamentosTI';
import GastosTIShell from '../GastosTIShell';
import MedidorConsumo from '../ui/MedidorConsumo';
import { VIDRO } from '../ui/Widget';

/** Orçamento anual por categoria (RF23): um valor por categoria e ano, dividido igualmente pelos 12 meses (RN13). */
const OrcamentoPage: React.FC = () => {
  const podeGerenciar = useCanManageGastosTI();
  const { theme } = useTheme();
  const hoje = dayKey(new Date());
  const [ano, setAno] = useState(() => Number(hoje.slice(0, 4)));
  const { categorias } = useCategoriasTI();
  const { despesas } = useDespesasTI();
  const { orcamentos, loading, error, salvarAno } = useOrcamentosTI();
  const { lancamentos } = useLancamentosIntervaloTI(`${ano}-01-01`, `${ano}-12-01`);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'erro' | 'sucesso'; texto: string } | null>(null);

  const doAno = useMemo(() => new Map(orcamentos.filter((o) => o.ano === ano).map((o) => [o.categoriaId, o.valorAnual])), [orcamentos, ano]);
  const anoAnterior = useMemo(() => new Map(orcamentos.filter((o) => o.ano === ano - 1).map((o) => [o.categoriaId, o.valorAnual])), [orcamentos, ano]);
  const slots = useMemo(() => slotsDeCor(categorias), [categorias]);
  const realizado = useMemo(() => realizadoPorCategoria(lancamentos, despesas, ano), [lancamentos, despesas, ano]);

  // Ativas + inativas que têm orçamento ou gasto no ano (não somem da conta).
  const linhas = useMemo(
    () => categorias.filter((c) => c.ativo || doAno.has(c.id) || (realizado.get(c.id) ?? 0) > 0),
    [categorias, doAno, realizado],
  );

  // Trocar de ano (ou recarregar depois de salvar) volta os campos para o que está gravado.
  useEffect(() => {
    setValores(Object.fromEntries(categorias.map((c) => [c.id, doAno.has(c.id) ? formatarValorCampo(doAno.get(c.id)) : ''])));
  }, [categorias, doAno]);

  // A mensagem só some ao trocar de ano: o recarregamento depois de salvar não pode apagar o "salvo".
  useEffect(() => {
    setMensagem(null);
  }, [ano]);

  const valorDigitado = (id: string): number | null => {
    const t = (valores[id] ?? '').trim();
    return t ? parseValorBR(t) : null;
  };
  const invalidos = linhas.filter((c) => (valores[c.id] ?? '').trim() && valorDigitado(c.id) === null).map((c) => c.id);
  const alterado = linhas.some((c) => (doAno.has(c.id) ? doAno.get(c.id) : null) !== valorDigitado(c.id));

  const totalOrcado = linhas.reduce((s, c) => s + (valorDigitado(c.id) ?? 0), 0);
  const totalRealizado = linhas.reduce((s, c) => s + (realizado.get(c.id) ?? 0), 0);
  const consumoTotal = consumoDoAno(orcamentos, realizado, ano, hoje);

  const copiarAnoAnterior = () => {
    setValores((atual) => ({
      ...atual,
      ...Object.fromEntries(linhas.filter((c) => anoAnterior.has(c.id)).map((c) => [c.id, formatarValorCampo(anoAnterior.get(c.id))])),
    }));
    setMensagem(null);
  };

  const salvar = async () => {
    if (invalidos.length > 0) {
      setMensagem({ tipo: 'erro', texto: 'Há valores inválidos (destacados). Use o formato 12.000,00 ou deixe vazio para "sem orçamento".' });
      return;
    }
    setSalvando(true);
    const erro = await salvarAno(
      ano,
      linhas.map((c) => ({ categoriaId: c.id, valorAnual: valorDigitado(c.id) })),
    );
    setSalvando(false);
    setMensagem(erro ? { tipo: 'erro', texto: erro } : { tipo: 'sucesso', texto: `Orçamento de ${ano} salvo.` });
  };

  return (
    <GastosTIShell
      subtitulo="Orçamento anual por categoria"
      acoes={
        podeGerenciar && (
          <>
            {anoAnterior.size > 0 && (
              <button
                type="button"
                onClick={copiarAnoAnterior}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700 transition-colors"
              >
                <Copy className="w-4 h-4" /> Copiar de {ano - 1}
              </button>
            )}
            <button
              type="button"
              onClick={salvar}
              disabled={!alterado || salvando}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-violet-500/25 transition-colors"
            >
              <Save className="w-4 h-4" /> {salvando ? 'Salvando...' : `Salvar ${ano}`}
            </button>
          </>
        )
      }
    >
      <div className={`${VIDRO} rounded-3xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in-up`} style={{ animationDelay: '0.15s' }}>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setAno((a) => a - 1)} aria-label="Ano anterior" className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="min-w-[64px] text-center text-lg font-bold text-slate-900 dark:text-white">{ano}</span>
          <button type="button" onClick={() => setAno((a) => a + 1)} aria-label="Próximo ano" className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <div className="sm:w-80">
          {consumoTotal.percentual !== null && consumoTotal.status !== 'sem_orcamento' ? (
            <>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                Pago {formatCurrency(consumoTotal.realizado)} de {formatCurrency(consumoTotal.orcado ?? 0)} no ano
              </p>
              <MedidorConsumo percentual={consumoTotal.percentual} status={consumoTotal.status} ritmo={consumoTotal.ritmo} />
            </>
          ) : (
            <p className="inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
              <Target className="w-4 h-4" /> {ano} ainda sem orçamento cadastrado
            </p>
          )}
        </div>
      </div>

      {mensagem && (
        <p
          role={mensagem.tipo === 'erro' ? 'alert' : 'status'}
          className={`text-sm rounded-2xl px-4 py-3 ${
            mensagem.tipo === 'erro'
              ? 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20'
              : 'text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-900/20'
          }`}
        >
          {mensagem.texto}
        </p>
      )}

      <div className={`${VIDRO} rounded-3xl overflow-hidden animate-fade-in-up`} style={{ animationDelay: '0.2s' }}>
        {loading && orcamentos.length === 0 ? (
          <div className="p-4 space-y-2" aria-busy="true">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-11 rounded-xl bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <p className="p-6 text-sm text-red-700 dark:text-red-300">{error}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/80 dark:bg-slate-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  <th scope="col" className="px-4 py-2.5 text-left font-semibold">Categoria</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">Orçamento anual (R$)</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">Por mês</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">Pago em {ano}</th>
                  <th scope="col" className="px-4 py-2.5 text-left font-semibold w-56">Consumo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-700/50 text-slate-700 dark:text-slate-200">
                {linhas.map((c) => {
                  const orcado = valorDigitado(c.id);
                  const gasto = realizado.get(c.id) ?? 0;
                  const percentual = orcado === null ? null : orcado > 0 ? (gasto / orcado) * 100 : gasto > 0 ? Infinity : 0;
                  const status = statusConsumo(percentual);
                  const invalido = invalidos.includes(c.id);
                  return (
                    <tr key={c.id} className={c.ativo ? '' : 'opacity-70'}>
                      <td className="px-4 py-2">
                        <span className="inline-flex items-center gap-2">
                          <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: corDoSlot(slots.get(c.id), theme) }} />
                          {c.nome}
                          {!c.ativo && <span className="text-[11px] text-slate-400">(inativa)</span>}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {podeGerenciar ? (
                          <input
                            type="text"
                            inputMode="decimal"
                            aria-label={`Orçamento anual de ${c.nome}`}
                            value={valores[c.id] ?? ''}
                            onChange={(e) => setValores((v) => ({ ...v, [c.id]: e.target.value }))}
                            onBlur={() => {
                              const v = valorDigitado(c.id);
                              if (v !== null) setValores((atual) => ({ ...atual, [c.id]: formatarValorCampo(v) }));
                            }}
                            placeholder="sem orçamento"
                            className={`w-36 text-right tabular-nums border bg-white/80 dark:bg-gray-900 text-sm rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500/30 ${
                              invalido ? 'border-red-300 dark:border-red-700' : 'border-gray-200 dark:border-gray-600'
                            }`}
                          />
                        ) : (
                          <span className="tabular-nums">{orcado === null ? '—' : formatCurrency(orcado)}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-500 dark:text-slate-400">{orcado === null ? '—' : formatCurrency(orcado / 12)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{gasto ? formatCurrency(gasto) : '—'}</td>
                      <td className="px-4 py-2">
                        {status === 'sem_orcamento' || percentual === null ? (
                          <span className="text-xs text-slate-400">{gasto > 0 ? 'gasto sem orçamento' : '—'}</span>
                        ) : (
                          <MedidorConsumo percentual={percentual} status={status} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t border-slate-200/70 dark:border-slate-700/50 text-sm font-semibold text-slate-900 dark:text-white">
                <tr>
                  <td className="px-4 py-2.5">Total</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(totalOrcado)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(totalOrcado / 12)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(totalRealizado)}</td>
                  <td className="px-4 py-2.5" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Deixe vazio para "sem orçamento"; zero é um orçamento válido. O valor anual é dividido igualmente pelos 12 meses no
        dashboard. "Pago" considera o mês da cobrança (competência), como o resto do módulo.
      </p>
    </GastosTIShell>
  );
};

export default OrcamentoPage;
