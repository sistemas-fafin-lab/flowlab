import React from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type LabelProps } from 'recharts';
import { RefreshCw, TrendingUp } from 'lucide-react';
import { useTheme } from '../../../hooks/useTheme';
import { formatarDuracao } from '../../../utils/itDashboard';
import type { PontoDia, PontoSemana } from '../domain/tendencias';
import { GlassCard, SectionHeader } from './ui';

// Paleta categórica validada (skill de dataviz, slots 1–4 na ordem documentada), claro e escuro.
// Aqua e amarelo ficam abaixo de 3:1 no fundo claro: por isso as linhas do 3º gráfico levam
// rótulo visível na ponta, além da legenda. Texto nunca usa a cor da série.
const PALETA = {
  claro: { entregas: '#2a78d6', tempo: '#eb6834', atrasados: '#1baf7a', fila: '#eda100', superficie: '#ffffff' },
  escuro: { entregas: '#3987e5', tempo: '#d95926', atrasados: '#199e70', fila: '#c98500', superficie: '#111827' },
};
const FONTE = 'Inter, system-ui, -apple-system, sans-serif';
const HORA = 3600000;
const DIA_MS = 24 * HORA;

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

interface LinhaDica { nome: string; cor: string; valor: string }

/** Tooltip no mesmo estilo do painel de chamados (ITRequestsDashboard). */
const Dica: React.FC<{ isDark: boolean; titulo: string; linhas: LinhaDica[]; nota?: string }> = ({ isDark, titulo, linhas, nota }) => (
  <div
    style={{
      background: isDark ? '#0f172a' : '#ffffff',
      border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
      borderRadius: 12,
      padding: '10px 14px',
      boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.6)' : '0 8px 32px rgba(0,0,0,0.1)',
      fontFamily: FONTE,
      fontSize: 12,
      color: isDark ? '#f1f5f9' : '#1e293b',
    }}
  >
    <p style={{ color: isDark ? '#94a3b8' : '#64748b', fontWeight: 600, marginBottom: 6 }}>{titulo}</p>
    {linhas.map((l) => (
      <p key={l.nome} style={{ margin: '2px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: l.cor }} />
        {l.nome}: <strong>{l.valor}</strong>
      </p>
    ))}
    {nota && <p style={{ marginTop: 4, color: isDark ? '#94a3b8' : '#64748b' }}>{nota}</p>}
  </div>
);

/** Título e resumo em cima; o gráfico; a legenda ou nota embaixo (assim os eixos dos três ficam alinhados). */
const Painel: React.FC<React.PropsWithChildren<{ titulo: string; resumo: React.ReactNode; rodape?: React.ReactNode }>> = ({ titulo, resumo, rodape, children }) => (
  <section className="flex flex-col min-w-0">
    <h5 className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{titulo}</h5>
    <p className="mt-0.5 min-h-[2rem] text-xs text-slate-500 dark:text-slate-400">{resumo}</p>
    <div className="mt-2">{children}</div>
    {rodape && <div className="mt-1.5">{rodape}</div>}
  </section>
);

const Vazio: React.FC<{ texto: string }> = ({ texto }) => (
  <div className="h-[190px] flex items-center justify-center px-4 text-center text-[13px] text-slate-400 dark:text-slate-500">{texto}</div>
);

/** O último índice com valor da série (a foto de hoje só existe depois das 18h). */
function ultimoComValor(dias: PontoDia[], chave: 'atrasados' | 'naFila'): number {
  for (let i = dias.length - 1; i >= 0; i -= 1) if (dias[i][chave] != null) return i;
  return -1;
}

export interface TendenciasCardProps {
  semanas: PontoSemana[] | null;
  dias: PontoDia[] | null;
  erro: string | null;
}

/** D42: entregas e tempo de resolução por semana (das datas de resolução) e atrasados e fila por dia (das fotos das 18h). */
export const TendenciasCard: React.FC<TendenciasCardProps> = ({ semanas, dias, erro }) => {
  const { isDark } = useTheme();
  const cores = isDark ? PALETA.escuro : PALETA.claro;
  const eixo = { fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b', fontFamily: FONTE };
  const grade = isDark ? 'rgba(51,65,85,0.5)' : 'rgba(226,232,240,0.9)';
  const tinta = isDark ? '#cbd5e1' : '#475569';
  const cursorBarra = { fill: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(148,163,184,0.14)' };
  const pontoAtivo = (cor: string) => ({ r: 5, fill: cor, stroke: cores.superficie, strokeWidth: 2 });

  const cabecalho = (
    <SectionHeader
      icon={TrendingUp}
      tone="from-blue-500 to-cyan-600 shadow-blue-500/25"
      title="Tendências"
      subtitle="Como a equipe vem andando nas últimas semanas"
    />
  );

  if (erro) {
    return (
      <GlassCard>
        {cabecalho}
        <p className="px-4 py-6 text-center text-[13px] text-slate-500 dark:text-slate-400">Não consegui ler o histórico agora. {erro}</p>
      </GlassCard>
    );
  }
  if (!semanas || !dias) {
    return (
      <GlassCard>
        {cabecalho}
        <div className="flex items-center justify-center gap-2 py-8 text-[13px] text-slate-400 dark:text-slate-500">
          <RefreshCw className="w-4 h-4 animate-spin" /> Lendo o histórico…
        </div>
      </GlassCard>
    );
  }

  // ── Entregas e tempo médio, por semana ──
  const atual = semanas[semanas.length - 1];
  const anteriores = semanas.slice(0, -1);
  const mediaEntregas = anteriores.length ? Math.round(anteriores.reduce((s, p) => s + p.entregas, 0) / anteriores.length) : 0;
  const semEntregas = semanas.every((p) => p.entregas === 0);
  const resolvidosAntes = anteriores.reduce((s, p) => s + p.resolvidos, 0);
  const tempoAntes = resolvidosAntes
    ? anteriores.reduce((s, p) => s + (p.tempoMedioMs ?? 0) * p.resolvidos, 0) / resolvidosAntes
    : null;
  const semChamados = semanas.every((p) => p.tempoMedioMs == null);
  const maiorTempo = Math.max(0, ...semanas.map((p) => p.tempoMedioMs ?? 0));
  const emDias = maiorTempo >= 72 * HORA;
  const unidade = emDias ? DIA_MS : HORA;
  const dadosTempo = semanas.map((p) => ({ ...p, tempo: p.tempoMedioMs == null ? null : p.tempoMedioMs / unidade }));
  const tituloSemana = (p: PontoSemana) => `Semana de ${p.rotulo}${p.atual ? ' (até hoje)' : ''}`;

  // ── Atrasados e fila, por dia útil ──
  const comFoto = dias.filter((d) => d.atrasados != null);
  const ultimaFoto = comFoto[comFoto.length - 1];
  const fimAtrasados = ultimoComValor(dias, 'atrasados');
  const fimFila = ultimoComValor(dias, 'naFila');
  const maiorDia = Math.max(1, ...comFoto.map((d) => Math.max(d.atrasados ?? 0, d.naFila ?? 0)));
  // Rótulos na ponta das linhas: se as duas terminam perto, a de cima sobe e a de baixo desce.
  const vA = fimAtrasados >= 0 ? dias[fimAtrasados].atrasados ?? 0 : 0;
  const vF = fimFila >= 0 ? dias[fimFila].naFila ?? 0 : 0;
  const perto = Math.abs(vA - vF) <= Math.max(1, maiorDia * 0.12);
  const deslocA = perto ? (vA >= vF ? -7 : 7) : 0;
  const deslocF = perto ? -deslocA : 0;
  const rotuloPonta = (nome: string, fim: number, desloc: number) => (props: LabelProps) => {
    if (props.index !== fim || props.value == null) return null;
    return (
      <text x={Number(props.x) + 8} y={Number(props.y) + desloc} dominantBaseline="central" fontSize={11} fontWeight={600} fontFamily={FONTE} fill={tinta}>
        {nome} {props.value}
      </text>
    );
  };

  return (
    <GlassCard>
      {cabecalho}
      <div className="grid gap-x-8 gap-y-7 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
        {/* 1. Entregas por semana */}
        <Painel
          titulo="Entregas por semana"
          resumo={semEntregas
            ? 'Cards do Kanban concluídos'
            : `${atual.entregas} nesta semana, até hoje · média de ${mediaEntregas} nas ${anteriores.length} anteriores`}
          rodape={!semEntregas && <p className="text-[11px] text-slate-400 dark:text-slate-500">A última barra, mais apagada, é a semana atual, ainda em andamento.</p>}
        >
          {semEntregas ? (
            <Vazio texto={`Nenhum card concluído nas últimas ${semanas.length} semanas.`} />
          ) : (
            <div className="h-[190px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={semanas} margin={{ top: 8, right: 4, left: -24, bottom: 0 }} barCategoryGap="28%">
                  <CartesianGrid stroke={grade} vertical={false} />
                  <XAxis dataKey="rotulo" tick={eixo} axisLine={{ stroke: grade }} tickLine={false} minTickGap={6} />
                  <YAxis tick={eixo} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    isAnimationActive={false}
                    cursor={cursorBarra}
                    wrapperStyle={{ outline: 'none' }}
                    content={({ active, payload }) => {
                      const p = payload?.[0]?.payload as PontoSemana | undefined;
                      if (!active || !p) return null;
                      return <Dica isDark={isDark} titulo={tituloSemana(p)} linhas={[{ nome: 'Entregas', cor: cores.entregas, valor: String(p.entregas) }]} />;
                    }}
                  />
                  <Bar dataKey="entregas" name="Entregas" fill={cores.entregas} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false}>
                    {semanas.map((p) => <Cell key={p.semana} fillOpacity={p.atual ? 0.5 : 1} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Painel>

        {/* 2. Tempo médio de resolução dos chamados */}
        <Painel
          titulo="Tempo médio de resolução"
          resumo={semChamados
            ? 'Chamados de usuário, da abertura à resolução'
            : `${atual.tempoMedioMs == null ? 'Nenhum chamado resolvido nesta semana' : `Nesta semana: ${formatarDuracao(atual.tempoMedioMs)}`}${tempoAntes == null ? '' : ` · nas ${anteriores.length} anteriores: ${formatarDuracao(tempoAntes)}`}`}
        >
          {semChamados ? (
            <Vazio texto={`Nenhum chamado resolvido nas últimas ${semanas.length} semanas.`} />
          ) : (
            <div className="h-[190px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dadosTempo} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke={grade} vertical={false} />
                  <XAxis dataKey="rotulo" tick={eixo} axisLine={{ stroke: grade }} tickLine={false} minTickGap={6} />
                  <YAxis
                    tick={eixo}
                    axisLine={false}
                    tickLine={false}
                    domain={[0, 'auto']}
                    tickFormatter={(v: number) => `${Math.round(v * 10) / 10}${emDias ? 'd' : 'h'}`}
                  />
                  <Tooltip
                    isAnimationActive={false}
                    cursor={{ stroke: grade, strokeWidth: 1 }}
                    wrapperStyle={{ outline: 'none' }}
                    content={({ active, payload }) => {
                      const p = payload?.[0]?.payload as PontoSemana | undefined;
                      if (!active || !p) return null;
                      return (
                        <Dica
                          isDark={isDark}
                          titulo={tituloSemana(p)}
                          linhas={[{ nome: 'Tempo médio', cor: cores.tempo, valor: p.tempoMedioMs == null ? 'sem chamados resolvidos' : formatarDuracao(p.tempoMedioMs) }]}
                          nota={p.resolvidos ? `${plural(p.resolvidos, 'chamado resolvido', 'chamados resolvidos')}` : undefined}
                        />
                      );
                    }}
                  />
                  <Line
                    type="linear"
                    dataKey="tempo"
                    name="Tempo médio"
                    stroke={cores.tempo}
                    strokeWidth={2}
                    dot={{ r: 4, fill: cores.tempo, stroke: cores.superficie, strokeWidth: 2 }}
                    activeDot={pontoAtivo(cores.tempo)}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Painel>

        {/* 3. Atrasados e chamados na fila, das fotos diárias */}
        <Painel
          titulo="Atrasados e chamados na fila"
          resumo={ultimaFoto
            ? `Em ${ultimaFoto.rotulo}: ${plural(ultimaFoto.atrasados ?? 0, 'card atrasado', 'cards atrasados')} e ${plural(ultimaFoto.naFila ?? 0, 'chamado na fila', 'chamados na fila')}`
            : `Por dia útil, nos últimos ${dias.length} dias úteis`}
          rodape={comFoto.length >= 2 && (
            <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
              {[{ nome: 'Atrasados', cor: cores.atrasados }, { nome: 'Na fila', cor: cores.fila }].map((s) => (
                <span key={s.nome} className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.cor }} />
                  {s.nome}
                </span>
              ))}
            </div>
          )}
        >
          {comFoto.length < 2 ? (
            <Vazio texto="O histórico começa a aparecer no segundo dia: a EVA grava uma foto do painel todo dia útil às 18h." />
          ) : (
            <div className="h-[190px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dias} margin={{ top: 12, right: 78, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke={grade} vertical={false} />
                  <XAxis dataKey="rotulo" tick={eixo} axisLine={{ stroke: grade }} tickLine={false} minTickGap={18} />
                  <YAxis tick={eixo} axisLine={false} tickLine={false} allowDecimals={false} domain={[0, 'auto']} />
                  <Tooltip
                    isAnimationActive={false}
                    cursor={{ stroke: grade, strokeWidth: 1 }}
                    wrapperStyle={{ outline: 'none' }}
                    content={({ active, payload }) => {
                      const p = payload?.[0]?.payload as PontoDia | undefined;
                      if (!active || !p) return null;
                      return p.atrasados == null
                        ? <Dica isDark={isDark} titulo={p.rotulo} linhas={[]} nota="Sem foto neste dia." />
                        : (
                          <Dica
                            isDark={isDark}
                            titulo={p.rotulo}
                            linhas={[
                              { nome: 'Atrasados', cor: cores.atrasados, valor: String(p.atrasados) },
                              { nome: 'Na fila', cor: cores.fila, valor: String(p.naFila ?? 0) },
                            ]}
                          />
                        );
                    }}
                  />
                  <Line type="linear" dataKey="atrasados" name="Atrasados" stroke={cores.atrasados} strokeWidth={2} dot={false} activeDot={pontoAtivo(cores.atrasados)} connectNulls isAnimationActive={false}>
                    <LabelList dataKey="atrasados" content={rotuloPonta('Atrasados', fimAtrasados, deslocA)} />
                  </Line>
                  <Line type="linear" dataKey="naFila" name="Na fila" stroke={cores.fila} strokeWidth={2} dot={false} activeDot={pontoAtivo(cores.fila)} connectNulls isAnimationActive={false}>
                    <LabelList dataKey="naFila" content={rotuloPonta('Na fila', fimFila, deslocF)} />
                  </Line>
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Painel>
      </div>

      {/* Os mesmos números em tabela, para leitor de tela (o sr-only fica numa div; ver ITRequestsDashboard). */}
      <div className="sr-only">
        <table>
          <caption>Entregas e tempo médio de resolução por semana</caption>
          <thead>
            <tr>
              <th scope="col">Semana de</th>
              <th scope="col">Entregas</th>
              <th scope="col">Chamados resolvidos</th>
              <th scope="col">Tempo médio</th>
            </tr>
          </thead>
          <tbody>
            {semanas.map((p) => (
              <tr key={p.semana}>
                <th scope="row">{p.rotulo}{p.atual ? ' (até hoje)' : ''}</th>
                <td>{p.entregas}</td>
                <td>{p.resolvidos}</td>
                <td>{p.tempoMedioMs == null ? '—' : formatarDuracao(p.tempoMedioMs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table>
          <caption>Cards atrasados e chamados na fila por dia útil</caption>
          <thead>
            <tr>
              <th scope="col">Dia</th>
              <th scope="col">Atrasados</th>
              <th scope="col">Na fila</th>
            </tr>
          </thead>
          <tbody>
            {comFoto.map((d) => (
              <tr key={d.dia}>
                <th scope="row">{d.rotulo}</th>
                <td>{d.atrasados}</td>
                <td>{d.naFila}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
};
