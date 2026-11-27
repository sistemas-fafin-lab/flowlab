import React, { useEffect, useMemo, useRef } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Info } from 'lucide-react';
import { useTheme } from '../../../hooks/useTheme';
import { useAgingGlosa } from '../hooks/useGlosasRecursos';
import type { AgingGlosa, FaixaAgingGlosa, SaldoGlosaOperadora } from '../types';
import { formatCompetencia, formatCurrency, plural } from '../utils/formato';
import { Painel, Vazio } from './PainelGlosa';

// Dashboard de glosa → Aging da glosa em recurso e Saldo de glosa por operadora
// (.scratch/glosas-recursos-calendario-pendencias/issues/07), lado a lado, no
// padrão do Aging da carteira e do Saldo por operadora do Contas a Receber.
// Os números vêm prontos do servidor: o aging (recursoGlosa.ts →
// agingDaGlosaEmRecurso) por endpoint próprio, o saldo (glosaRecuperada.ts →
// saldoDeGlosaPorOperadora) com o dashboard. Os dois seguem o período do
// cabeçalho (mês do lote de faturamento original) e o convênio.

// A mesma paleta categórica do Aging da carteira: cada cor é uma operadora;
// "Outras" em cinza neutro, fora da paleta.
const CORES_OPERADORAS = ['#3b82f6', '#8b5cf6', '#14b8a6', '#f59e0b', '#ec4899', '#06b6d4', '#84cc16'];
const COR_OUTRAS = '#94a3b8'; // slate-400
const COR_SALDO = '#3b82f6'; // blue-500, a do card Glosa em disputa

const ROTULOS_FAIXA: Record<FaixaAgingGlosa, string> = {
  'a-vencer': 'A vencer',
  'd1-30': '1–30 dias',
  'd31-60': '31–60 dias',
  'd61-90': '61–90 dias',
  'd90-mais': '+90 dias',
};

/** Cabe em ~130px do eixo numa linha só; o nome completo continua no tooltip. */
const TAMANHO_MAX_ROTULO = 19;

const eixoMoeda = (valor: number): string =>
  Math.abs(valor) >= 1000 ? `${Math.round(valor / 1000)}k` : String(valor);

const encurtar = (nome: string): string =>
  nome.length > TAMANHO_MAX_ROTULO ? `${nome.slice(0, TAMANHO_MAX_ROTULO - 1)}…` : nome;

/** Uma linha do gráfico empilhado: a faixa e o valor de cada operadora nela (chave `op<i>`). */
type LinhaFaixa = { faixa: string } & Record<string, string | number>;

function linhasPorFaixa(operadoras: AgingGlosa['operadoras']): LinhaFaixa[] {
  return (Object.entries(ROTULOS_FAIXA) as [FaixaAgingGlosa, string][]).map(([faixa, rotulo]) => {
    const linha: LinhaFaixa = { faixa: rotulo };
    operadoras.forEach((o, i) => {
      linha[`op${i}`] = o.faixas[faixa];
    });
    return linha;
  });
}

/** Nota acima do gráfico com o que não tem faixa, para o total bater. */
function NotaForaDasFaixas({ fora }: { fora: AgingGlosa['foraDasFaixas'] }) {
  if (fora.valor <= 0) return null;
  const partes = [
    fora.semEnvio > 0 ? `${formatCurrency(fora.semEnvio)} sem data de envio` : null,
    fora.semRegra > 0 ? `${formatCurrency(fora.semRegra)} de convênio sem regra de Análise ou de Pagamento` : null,
  ].filter(Boolean);
  return (
    <p className="flex items-start gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mb-2">
      <Info className="w-3.5 h-3.5 mt-px flex-shrink-0" aria-hidden />
      <span>
        <span className="font-medium text-slate-700 dark:text-slate-200">Fora das faixas: {formatCurrency(fora.valor)}</span>
        {' '}({plural(fora.quantidade, 'requisição', 'requisições')}{partes.length > 0 ? `: ${partes.join(' e ')}` : ''}).
      </span>
    </p>
  );
}

interface Props {
  fontePagadoraId: number | null;
  /** Muda a cada sincronização ou edição concluída: recarrega o aging. */
  versao: number;
  /** Do dashboard: a glosa em disputa do período, as 10 maiores. */
  saldoPorOperadora: SaldoGlosaOperadora[];
  /** YYYY-MM do período (o mês do lote de faturamento original). */
  competencia: string;
}

const AgingGlosaBloco: React.FC<Props> = ({ fontePagadoraId, versao, saldoPorOperadora, competencia }) => {
  const { isDark } = useTheme();
  const { dados: aging, loading, error, refetch } = useAgingGlosa(competencia, fontePagadoraId);

  const versaoVista = useRef(versao);
  useEffect(() => {
    if (versaoVista.current === versao) return;
    versaoVista.current = versao;
    void refetch();
  }, [versao, refetch]);

  const linhas = useMemo(() => (aging ? linhasPorFaixa(aging.operadoras) : []), [aging]);

  const axisTick = { fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' };
  const gridColor = isDark ? 'rgba(51,65,85,0.4)' : 'rgba(226,232,240,0.8)';
  const cursorBarra = { fill: isDark ? 'rgba(51,65,85,0.35)' : 'rgba(226,232,240,0.6)' };
  const tooltipStyle: React.CSSProperties = {
    background: isDark ? '#0f172a' : '#ffffff',
    border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
    borderRadius: 12,
    fontSize: 12,
  };
  const tooltipItem: React.CSSProperties = { color: isDark ? '#e2e8f0' : '#334155' };
  const tooltipLabel: React.CSSProperties = { color: isDark ? '#94a3b8' : '#64748b', fontWeight: 600 };

  const corDaSerie = (o: AgingGlosa['operadoras'][number], i: number) =>
    o.outras ? COR_OUTRAS : CORES_OPERADORAS[i % CORES_OPERADORAS.length];

  const conteudoAging = () => {
    if (!aging) {
      return loading || !error ? (
        <div className="h-72 rounded-lg bg-gray-100 dark:bg-gray-700/40 animate-pulse" />
      ) : (
        <p className="h-72 flex items-center justify-center text-center text-sm text-red-600 dark:text-red-400">
          <span>
            {error}{' '}
            <button type="button" onClick={() => void refetch()} className="underline font-medium">
              Tentar novamente
            </button>
          </span>
        </p>
      );
    }
    if (aging.operadoras.length === 0) {
      return (
        <>
          <NotaForaDasFaixas fora={aging.foraDasFaixas} />
          <Vazio icon={<BarChart3 className="w-6 h-6" />} texto="Nenhum recurso em aberto com data de pagamento prevista." />
        </>
      );
    }
    return (
      <>
        <NotaForaDasFaixas fora={aging.foraDasFaixas} />
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={linhas} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="faixa" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={eixoMoeda} />
              <Tooltip
                cursor={cursorBarra}
                contentStyle={tooltipStyle}
                itemStyle={tooltipItem}
                labelStyle={tooltipLabel}
                formatter={(valor: number, nome: string) => [formatCurrency(valor), nome]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {aging.operadoras.map((o, i) => (
                <Bar
                  key={`op${i}`}
                  dataKey={`op${i}`}
                  name={o.nome}
                  stackId="aging"
                  fill={corDaSerie(o, i)}
                  radius={i === aging.operadoras.length - 1 ? [6, 6, 0, 0] : undefined}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </>
    );
  };

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-4 transition-opacity ${loading && aging ? 'opacity-60' : ''}`}>
      <Painel
        titulo="Aging da glosa em recurso"
        sub={`Recursado − recebido de glosa dos recursos sem resultado final, por dias desde o pagamento previsto e operadora — lotes de ${formatCompetencia(competencia)}`}
      >
        {conteudoAging()}
      </Painel>

      <Painel
        titulo="Saldo de glosa por operadora"
        sub={`10 maiores saldos de glosa em disputa (sem recurso, 1º e 2º recurso, pela glosa fixada) — lotes de ${formatCompetencia(competencia)}`}
      >
        {saldoPorOperadora.length > 0 ? (
          // 24px por barra (mín. 224px): com altura fixa o Recharts pulava rótulos do eixo.
          <div style={{ height: Math.max(224, saldoPorOperadora.length * 24 + 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={saldoPorOperadora} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} tickFormatter={eixoMoeda} />
                <YAxis
                  type="category"
                  dataKey="nome"
                  tick={axisTick}
                  axisLine={false}
                  tickLine={false}
                  width={130}
                  interval={0}
                  tickFormatter={encurtar}
                />
                <Tooltip
                  cursor={cursorBarra}
                  contentStyle={tooltipStyle}
                  itemStyle={tooltipItem}
                  labelStyle={tooltipLabel}
                  formatter={(valor: number, _nome: string, item: { payload?: SaldoGlosaOperadora }) => [
                    `${formatCurrency(valor)} · ${plural(item.payload?.quantidade ?? 0, 'requisição', 'requisições')}`,
                    'Em disputa',
                  ]}
                />
                <Bar dataKey="valor" fill={COR_SALDO} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Vazio icon={<BarChart3 className="w-6 h-6" />} texto="Nenhuma glosa em disputa no período." />
        )}
      </Painel>
    </div>
  );
};

export default AgingGlosaBloco;
