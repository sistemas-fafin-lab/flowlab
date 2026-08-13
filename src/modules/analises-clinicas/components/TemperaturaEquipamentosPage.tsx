import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Thermometer,
  Plus,
  Pencil,
  Trash2,
  X,
  RefreshCw,
  Power,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Gauge,
  History,
  MessageSquare,
  Loader2,
} from 'lucide-react';
import { useTemperaturas } from '../hooks/useTemperaturas';
import { useAuth } from '../../../hooks/useAuth';
import { hasPermission } from '../../../utils/permissions';
import { useDialog } from '../../../hooks/useDialog';
import ConfirmDialog from '../../../components/ConfirmDialog';
import type { AcEquipamento, AcTemperatura, EquipamentoTipo } from '../types';
import { TIPOS_EQUIPAMENTO } from '../types';
import { rotuloStatus } from '../domain/status';

const tipoLabel = (t: EquipamentoTipo) => rotuloStatus(TIPOS_EQUIPAMENTO, t);

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

// No histórico as leituras podem ser antigas — ali o ano importa.
const fmtDateTimeFull = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const fmtTemp = (t: number) => `${t.toFixed(1).replace('.', ',')} °C`;

// Valor para <input type="datetime-local"> no fuso local: 'YYYY-MM-DDTHH:MM'.
const toDatetimeLocal = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500';

// Situação do equipamento pela última leitura vs. a faixa. "limite" = dentro da
// faixa, mas a menos de MARGEM_LIMITE do span de qualquer borda (zona de atenção).
type Situacao = 'normal' | 'limite' | 'fora' | 'sem';
const MARGEM_LIMITE = 0.1; // 10% do intervalo [min,max] junto às bordas

const classificar = (eq: AcEquipamento, ultima?: AcTemperatura): Situacao => {
  if (!ultima) return 'sem';
  const t = ultima.temperatura;
  if (t < eq.temp_min || t > eq.temp_max) return 'fora';
  const margem = (eq.temp_max - eq.temp_min) * MARGEM_LIMITE;
  if (t <= eq.temp_min + margem || t >= eq.temp_max - margem) return 'limite';
  return 'normal';
};

const COR_SITUACAO: Record<'normal' | 'limite' | 'fora', string> = {
  normal: '#059669', // emerald-600
  limite: '#d97706', // amber-600
  fora: '#dc2626', // red-600
};

// Mini gráfico de linha (sparkline) das leituras recentes — SVG inline, sem lib.
// `readings` em ordem cronológica (antigo → novo); `cor` define a cor da linha.
const Sparkline: React.FC<{ readings: AcTemperatura[]; cor: string }> = ({ readings, cor }) => {
  if (readings.length < 2) return null;
  const W = 112;
  const H = 48;
  const P = 5; // padding interno
  const temps = readings.map((r) => r.temperatura);
  const min = Math.min(...temps);
  const max = Math.max(...temps);
  const span = max - min || 1; // evita divisão por zero (série constante)
  const stepX = (W - P * 2) / (readings.length - 1);
  const pts = temps.map((t, i): [number, number] => {
    const x = P + i * stepX;
    const y = P + (H - P * 2) * (1 - (t - min) / span);
    return [x, y];
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [lastX, lastY] = pts[pts.length - 1];
  const area = `${line} L${lastX.toFixed(1)},${H} L${pts[0][0].toFixed(1)},${H} Z`;
  const gid = `spark-${readings[0].equipamento_id}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={cor} stopOpacity="0.18" />
          <stop offset="100%" stopColor={cor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path
        d={line}
        fill="none"
        stroke={cor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lastX} cy={lastY} r="2.5" fill={cor} />
    </svg>
  );
};

// Gráfico do histórico: série + faixa aceitável sombreada. O viewBox é esticado
// até a largura do modal (preserveAspectRatio="none"), então tudo que precisa
// manter a forma — traço e pontos — usa vector-effect e ponta arredondada; um
// <circle> viraria elipse nessa deformação.
const HistoricoChart: React.FC<{
  readings: AcTemperatura[];
  equipamento: AcEquipamento;
  cor: string;
}> = ({ readings, equipamento, cor }) => {
  const [hover, setHover] = useState<number | null>(null);
  const W = 600;
  const H = 150;
  const PX = 14;
  const PY = 18;
  const temps = readings.map((r) => r.temperatura);
  // A escala sempre engloba a faixa aceitável, senão a banda sai do desenho.
  const lo0 = Math.min(...temps, equipamento.temp_min);
  const hi0 = Math.max(...temps, equipamento.temp_max);
  const folga = (hi0 - lo0) * 0.12 || 1; // série constante e dentro da faixa
  const lo = lo0 - folga;
  const hi = hi0 + folga;
  const y = (t: number) => PY + (H - PY * 2) * (1 - (t - lo) / (hi - lo));
  const x = (i: number) => PX + ((W - PX * 2) * i) / (readings.length - 1);
  const pts = readings.map((r, i): [number, number] => [x(i), y(r.temperatura)]);
  const line = pts.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ');
  const yMax = y(equipamento.temp_max);
  const yMin = y(equipamento.temp_min);
  const chip =
    'absolute right-2 -translate-y-1/2 px-1 rounded text-[10px] font-medium tabular-nums text-emerald-600 dark:text-emerald-400 bg-white/85 dark:bg-gray-800/85';

  // Ponto mais próximo do cursor no eixo X — o mouse não precisa acertar o ponto.
  const aoMover = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let melhor = 0;
    for (let i = 1; i < pts.length; i++) {
      if (Math.abs(pts[i][0] - px) < Math.abs(pts[melhor][0] - px)) melhor = i;
    }
    setHover(melhor);
  };

  const alvo = hover !== null ? readings[hover] : null;
  const hx = hover !== null ? (pts[hover][0] / W) * 100 : 0;
  const hy = hover !== null ? (pts[hover][1] / H) * 100 : 0;

  return (
    <div className="relative">
      <div
        onMouseMove={aoMover}
        onMouseLeave={() => setHover(null)}
        className="relative h-36 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/40 overflow-hidden cursor-crosshair"
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <rect x="0" y={yMax} width={W} height={Math.max(yMin - yMax, 0)} fill="#10b981" fillOpacity="0.1" />
          {[yMax, yMin].map((yy) => (
            <path
              key={yy}
              d={`M0,${yy} L${W},${yy}`}
              stroke="#10b981"
              strokeOpacity="0.5"
              strokeWidth="1"
              strokeDasharray="5 5"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {hover !== null && (
            <path
              d={`M${pts[hover][0].toFixed(1)},0 L${pts[hover][0].toFixed(1)},${H}`}
              stroke="currentColor"
              className="text-gray-400"
              strokeOpacity="0.5"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          )}
          <path
            d={line}
            fill="none"
            stroke={cor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          {/* Ponto = segmento de comprimento zero com ponta redonda: fica circular
              mesmo com o eixo X esticado. */}
          {pts.map(([px, py], i) => (
            <path
              key={readings[i].id}
              d={`M${px.toFixed(1)},${py.toFixed(1)} L${px.toFixed(1)},${py.toFixed(1)}`}
              stroke={readings[i].fora_faixa ? COR_SITUACAO.fora : cor}
              strokeWidth="6"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {hover !== null && (
            <path
              d={`M${pts[hover][0].toFixed(1)},${pts[hover][1].toFixed(1)} L${pts[hover][0].toFixed(1)},${pts[hover][1].toFixed(1)}`}
              stroke={readings[hover].fora_faixa ? COR_SITUACAO.fora : cor}
              strokeWidth="12"
              strokeOpacity="0.3"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        <span className={chip} style={{ top: `${(yMax / H) * 100}%` }}>
          {fmtTemp(equipamento.temp_max)}
        </span>
        <span className={chip} style={{ top: `${(yMin / H) * 100}%` }}>
          {fmtTemp(equipamento.temp_min)}
        </span>
      </div>
      <div className="flex justify-between px-1 pt-1 text-[10px] text-gray-400">
        <span>{fmtDateTime(readings[0].registrado_em)}</span>
        <span>{fmtDateTime(readings[readings.length - 1].registrado_em)}</span>
      </div>

      {/* Balão fora da caixa do gráfico, que tem overflow-hidden pelos cantos
          arredondados. Nas bordas ele ancora pela lateral em vez do centro,
          senão sairia da largura do modal. */}
      {alvo && (
        <div
          className="absolute z-10 pointer-events-none px-2.5 py-1.5 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 max-w-[15rem]"
          style={{
            left: `${hx}%`,
            top: `${hy}%`,
            transform: `translate(${hx < 20 ? '0' : hx > 80 ? '-100%' : '-50%'}, ${
              hy > 40 ? 'calc(-100% - 10px)' : '10px'
            })`,
          }}
        >
          <p
            className={`text-sm font-bold tabular-nums ${
              alvo.fora_faixa ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-gray-100'
            }`}
          >
            {fmtTemp(alvo.temperatura)}
            {alvo.fora_faixa && <span className="ml-1.5 text-[10px] font-medium">fora da faixa</span>}
          </p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
            {fmtDateTimeFull(alvo.registrado_em)}
          </p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{alvo.registrado_por}</p>
          {alvo.observacao?.trim() && (
            <p className="mt-1 pt-1 border-t border-gray-100 dark:border-gray-700 text-[10px] text-gray-600 dark:text-gray-300 break-words">
              {alvo.observacao}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Modal de equipamento (criar/editar) ────────────────────────────────────────
const EquipamentoModal: React.FC<{
  equipamento: AcEquipamento | null;
  onClose: () => void;
  onSave: (input: {
    nome: string;
    tipo: EquipamentoTipo;
    localizacao: string;
    tempMin: number;
    tempMax: number;
    ativo: boolean;
  }) => Promise<string | null>;
}> = ({ equipamento, onClose, onSave }) => {
  const [nome, setNome] = useState(equipamento?.nome ?? '');
  const [tipo, setTipo] = useState<EquipamentoTipo>(equipamento?.tipo ?? 'geladeira');
  const [localizacao, setLocalizacao] = useState(equipamento?.localizacao ?? '');
  const [tempMin, setTempMin] = useState<string>(equipamento ? String(equipamento.temp_min) : '2');
  const [tempMax, setTempMax] = useState<string>(equipamento ? String(equipamento.temp_max) : '8');
  const [ativo, setAtivo] = useState(equipamento?.ativo ?? true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleSave = async () => {
    setErro(null);
    if (!nome.trim()) {
      setErro('Informe o nome do equipamento.');
      return;
    }
    const min = Number(tempMin.replace(',', '.'));
    const max = Number(tempMax.replace(',', '.'));
    if (Number.isNaN(min) || Number.isNaN(max)) {
      setErro('Informe a faixa de temperatura (mín e máx).');
      return;
    }
    if (min >= max) {
      setErro('A temperatura mínima deve ser menor que a máxima.');
      return;
    }
    setSaving(true);
    const msg = await onSave({ nome: nome.trim(), tipo, localizacao: localizacao.trim(), tempMin: min, tempMax: max, ativo });
    setSaving(false);
    if (msg) setErro(msg);
    else onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 dark:text-gray-100">
            {equipamento ? 'Editar equipamento' : 'Novo equipamento'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {erro && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
              {erro}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Geladeira de reagentes 1" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as EquipamentoTipo)} className={inputCls}>
              {TIPOS_EQUIPAMENTO.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Localização</label>
            <input value={localizacao} onChange={(e) => setLocalizacao(e.target.value)} placeholder="Sala de bioquímica (opcional)" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Temp. mínima (°C)</label>
              <input type="number" step="0.1" value={tempMin} onChange={(e) => setTempMin(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Temp. máxima (°C)</label>
              <input type="number" step="0.1" value={tempMax} onChange={(e) => setTempMax(e.target.value)} className={inputCls} />
            </div>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={ativo}
              onChange={(e) => setAtivo(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Equipamento ativo
            <span className="text-xs text-gray-400">(inativo sai da contagem de alertas)</span>
          </label>
          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            Uma leitura fora da faixa [mín, máx] entra como alerta no painel.
          </p>
        </div>
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 rounded-b-2xl flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100">
            Cancelar
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="px-5 py-2 text-sm font-semibold text-white rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 shadow-lg shadow-blue-500/25 hover:scale-[1.02] transition-all disabled:opacity-60 inline-flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Modal de leitura (registrar + histórico recente) ──────────────────────────
const LeituraModal: React.FC<{
  equipamento: AcEquipamento;
  registradoPor: string;
  onClose: () => void;
  onDone: () => void;
  registrarTemperatura: ReturnType<typeof useTemperaturas>['registrarTemperatura'];
  fetchTemperaturas: ReturnType<typeof useTemperaturas>['fetchTemperaturas'];
}> = ({ equipamento, registradoPor, onClose, onDone, registrarTemperatura, fetchTemperaturas }) => {
  const [temperatura, setTemperatura] = useState('');
  const [porNome, setPorNome] = useState(registradoPor);
  const [dataHora, setDataHora] = useState(() => toDatetimeLocal(new Date()));
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [historico, setHistorico] = useState<AcTemperatura[]>([]);
  const [loadingHist, setLoadingHist] = useState(true);

  const recarregar = useCallback(async () => {
    setLoadingHist(true);
    try {
      setHistorico(await fetchTemperaturas(equipamento.id, 5));
    } catch {
      /* silencioso: o histórico é acessório */
    } finally {
      setLoadingHist(false);
    }
  }, [equipamento.id, fetchTemperaturas]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const valorNum = Number(temperatura.replace(',', '.'));
  const previewFora = temperatura !== '' && !Number.isNaN(valorNum) && (valorNum < equipamento.temp_min || valorNum > equipamento.temp_max);

  // 1º passo: valida e leva à tela de confirmação (não grava ainda).
  const irParaConfirmacao = () => {
    setErro(null);
    if (temperatura === '' || Number.isNaN(valorNum)) {
      setErro('Informe a temperatura lida.');
      return;
    }
    if (!porNome.trim()) {
      setErro('Informe quem registrou.');
      return;
    }
    if (!dataHora) {
      setErro('Informe a data e hora da leitura.');
      return;
    }
    const quando = new Date(dataHora);
    if (Number.isNaN(quando.getTime())) {
      setErro('Data e hora inválidas.');
      return;
    }
    if (quando.getTime() > Date.now() + 60_000) {
      // tolerância de 1 min para diferenças de relógio
      setErro('A data e hora não podem estar no futuro.');
      return;
    }
    setConfirmando(true);
  };

  // 2º passo: grava de fato, após o usuário confirmar os valores.
  const handleConfirmar = async () => {
    setSalvando(true);
    const msg = await registrarTemperatura({
      equipamentoId: equipamento.id,
      temperatura: valorNum,
      registradoPor: porNome.trim(),
      observacao: observacao.trim(),
      registradoEm: new Date(dataHora).toISOString(),
    });
    setSalvando(false);
    if (msg) {
      setErro(msg);
      setConfirmando(false); // volta a editar para corrigir
      return;
    }
    setTemperatura('');
    setObservacao('');
    setDataHora(toDatetimeLocal(new Date()));
    setConfirmando(false);
    onDone();
    await recarregar();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full flex flex-col max-h-[88vh]">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-gray-100">Registrar leitura</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {equipamento.nome} · faixa {fmtTemp(equipamento.temp_min)} a {fmtTemp(equipamento.temp_max)}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto space-y-4">
          {erro && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">{erro}</div>
          )}
          {confirmando ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-300">Confira os dados antes de registrar:</p>
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <span className="text-gray-500 dark:text-gray-400">Equipamento</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200 text-right">{equipamento.nome}</span>
                </div>
                <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <span className="text-gray-500 dark:text-gray-400">Temperatura</span>
                  <span className={`font-bold text-right ${previewFora ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-gray-200'}`}>
                    {fmtTemp(valorNum)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <span className="text-gray-500 dark:text-gray-400">Registrado por</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200 text-right">{porNome.trim()}</span>
                </div>
                <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <span className="text-gray-500 dark:text-gray-400">Data e hora</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200 text-right">{fmtDateTime(dataHora)}</span>
                </div>
                {observacao.trim() && (
                  <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <span className="text-gray-500 dark:text-gray-400">Observação</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200 text-right">{observacao.trim()}</span>
                  </div>
                )}
              </div>
              {previewFora && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    Este valor está <strong>fora da faixa</strong> de {fmtTemp(equipamento.temp_min)} a{' '}
                    {fmtTemp(equipamento.temp_max)}. Confirme que a leitura está correta.
                  </span>
                </div>
              )}
            </div>
          ) : (
          <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Temperatura (°C)</label>
              <input
                type="number"
                step="0.1"
                value={temperatura}
                onChange={(e) => setTemperatura(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    irParaConfirmacao();
                  }
                }}
                autoFocus
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Registrado por</label>
              <input value={porNome} onChange={(e) => setPorNome(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data e hora da leitura</label>
            <input
              type="datetime-local"
              value={dataHora}
              max={toDatetimeLocal(new Date())}
              onChange={(e) => setDataHora(e.target.value)}
              className={`${inputCls} [color-scheme:light] dark:[color-scheme:dark]`}
            />
          </div>
          {previewFora && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              Fora da faixa aceitável — a leitura entrará como alerta.
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Observação</label>
            <input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Opcional (ex.: porta aberta, degelo)" className={inputCls} />
          </div>

          <div className="pt-2">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Últimas leituras</h4>
            </div>
            {loadingHist ? (
              <p className="text-sm text-gray-400">Carregando…</p>
            ) : historico.length === 0 ? (
              <p className="text-sm text-gray-400">Nenhuma leitura ainda.</p>
            ) : (
              <ul className="space-y-1.5">
                {historico.map((t) => (
                  <li key={t.id} className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900/50 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <span className={`font-semibold ${t.fora_faixa ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-gray-200'}`}>
                          {fmtTemp(t.temperatura)}
                        </span>
                        {t.fora_faixa && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                            Fora
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-gray-400">
                        {fmtDateTime(t.registrado_em)} · {t.registrado_por}
                      </span>
                    </div>
                    {t.observacao?.trim() && (
                      <p className="mt-1 flex items-start gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                        <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        <span className="break-words">{t.observacao}</span>
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          </>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 rounded-b-2xl flex justify-end gap-2">
          {confirmando ? (
            <>
              <button
                onClick={() => setConfirmando(false)}
                disabled={salvando}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-60"
              >
                Voltar
              </button>
              <button
                onClick={() => void handleConfirmar()}
                disabled={salvando}
                className="px-5 py-2 text-sm font-semibold text-white rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 shadow-lg shadow-blue-500/25 hover:scale-[1.02] transition-all disabled:opacity-60 inline-flex items-center gap-2"
              >
                {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
                {salvando ? 'Registrando…' : 'Confirmar registro'}
              </button>
            </>
          ) : (
            <>
              <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100">
                Fechar
              </button>
              <button
                onClick={irParaConfirmacao}
                className="px-5 py-2 text-sm font-semibold text-white rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 shadow-lg shadow-blue-500/25 hover:scale-[1.02] transition-all"
              >
                Registrar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Modal de histórico (somente leitura) ──────────────────────────────────────
const PAGINA_HISTORICO = 50;

const HistoricoModal: React.FC<{
  equipamento: AcEquipamento;
  onClose: () => void;
  fetchTemperaturas: ReturnType<typeof useTemperaturas>['fetchTemperaturas'];
}> = ({ equipamento, onClose, fetchTemperaturas }) => {
  const [leituras, setLeituras] = useState<AcTemperatura[]>([]);
  const [limite, setLimite] = useState(PAGINA_HISTORICO);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [soFora, setSoFora] = useState(false);

  useEffect(() => {
    // `vivo` descarta a resposta de um limite antigo que chegue fora de ordem.
    let vivo = true;
    setCarregando(true);
    setErro(null);
    void (async () => {
      try {
        const dados = await fetchTemperaturas(equipamento.id, limite);
        if (vivo) setLeituras(dados);
      } catch (e) {
        if (vivo) setErro(e instanceof Error ? e.message : 'Não foi possível carregar o histórico.');
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [equipamento.id, limite, fetchTemperaturas]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [onClose]);

  const visiveis = soFora ? leituras.filter((l) => l.fora_faixa) : leituras;
  const nFora = leituras.filter((l) => l.fora_faixa).length;
  // Estatísticas da janela carregada — não do histórico inteiro.
  const temps = leituras.map((l) => l.temperatura);
  const minLido = temps.length ? Math.min(...temps) : null;
  const maxLido = temps.length ? Math.max(...temps) : null;
  const media = temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : null;
  // A lista vem do mais novo para o mais antigo; o gráfico precisa do inverso.
  const serie = [...leituras].reverse();
  const podeCarregarMais = leituras.length >= limite;
  // A cor do gráfico segue a situação da leitura mais recente (leituras[0]).
  const situacaoAtual = classificar(equipamento, leituras[0]);
  const corSerie = COR_SITUACAO[situacaoAtual === 'sem' ? 'normal' : situacaoAtual];

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-bold text-gray-900 dark:text-gray-100 truncate">{equipamento.nome}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {tipoLabel(equipamento.tipo)} · faixa {fmtTemp(equipamento.temp_min)} a {fmtTemp(equipamento.temp_max)}
              {equipamento.localizacao ? ` · ${equipamento.localizacao}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 flex-shrink-0">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Só a lista rola: o resumo e o gráfico ficam fixos e o modal não muda
            de altura conforme chegam mais leituras. */}
        <div className="px-6 py-5 flex-1 min-h-0 flex flex-col gap-4 overflow-hidden">
          {erro && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
              {erro}
            </div>
          )}

          {carregando && leituras.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent" />
            </div>
          ) : leituras.length === 0 ? (
            <div className="py-12 text-center">
              <Clock className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma leitura registrada para este equipamento.</p>
            </div>
          ) : (
            <>
              {/* Resumo da janela carregada */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-shrink-0">
                {[
                  { label: 'Leituras', valor: String(leituras.length), tom: 'text-gray-900 dark:text-gray-100' },
                  {
                    label: 'Fora da faixa',
                    valor: String(nFora),
                    tom: nFora > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100',
                  },
                  { label: 'Média', valor: media !== null ? fmtTemp(media) : '—', tom: 'text-gray-900 dark:text-gray-100' },
                  {
                    label: 'Mín / Máx',
                    valor: minLido !== null && maxLido !== null ? `${fmtTemp(minLido)} / ${fmtTemp(maxLido)}` : '—',
                    tom: 'text-gray-900 dark:text-gray-100',
                  },
                ].map((s) => (
                  <div key={s.label} className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-900/50">
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">{s.label}</p>
                    <p className={`text-sm font-bold tabular-nums truncate ${s.tom}`}>{s.valor}</p>
                  </div>
                ))}
              </div>

              {serie.length >= 2 && (
                <HistoricoChart readings={serie} equipamento={equipamento} cor={corSerie} />
              )}

              <div className="flex-1 min-h-0 flex flex-col">
                <div className="flex items-center justify-between gap-2 mb-2 flex-shrink-0">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Leituras <span className="font-normal text-gray-400">(mais recentes primeiro)</span>
                  </h4>
                  {nFora > 0 && (
                    <label className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={soFora}
                        onChange={(e) => setSoFora(e.target.checked)}
                        className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      Só fora da faixa
                    </label>
                  )}
                </div>

                {visiveis.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">Nenhuma leitura fora da faixa nesta janela.</p>
                ) : (
                  <ul className="flex-1 min-h-0 max-h-72 overflow-y-auto space-y-1.5 pr-1">
                    {visiveis.map((t) => (
                      <li
                        key={t.id}
                        className={`px-3 py-2.5 rounded-xl border ${
                          t.fora_faixa
                            ? 'border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10'
                            : 'border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/40'
                        }`}
                      >
                        {/* temperatura · observação · quando/quem — a observação
                            ocupa a folga do meio e quebra linha quando é longa. */}
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-2 flex-shrink-0">
                            <span
                              className={`text-base font-bold tabular-nums ${
                                t.fora_faixa ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-gray-200'
                              }`}
                            >
                              {fmtTemp(t.temperatura)}
                            </span>
                            {t.fora_faixa && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                <XCircle className="w-3 h-3" />
                                Fora
                              </span>
                            )}
                          </span>
                          {t.observacao?.trim() && (
                            <span
                              title={t.observacao ?? undefined}
                              className="flex-1 min-w-0 flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300"
                            >
                              <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                              {/* Uma linha só; o texto inteiro fica no title, que o
                                  navegador mostra no hover. Tooltip próprio seria
                                  recortado pelo overflow da lista. */}
                              <span className="truncate">{t.observacao}</span>
                            </span>
                          )}
                          <span className="text-xs text-gray-400 text-right flex-shrink-0">
                            {fmtDateTimeFull(t.registrado_em)}
                            <span className="block text-gray-400">{t.registrado_por}</span>
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {podeCarregarMais && (
                  <button
                    onClick={() => setLimite((v) => v + PAGINA_HISTORICO)}
                    disabled={carregando}
                    className="mt-3 flex-shrink-0 w-full px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-60"
                  >
                    {carregando ? 'Carregando…' : 'Carregar mais'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Indicador do header (pill) com a lista da situação no hover/clique ────────
const StatusPill: React.FC<{
  tone: 'normal' | 'limite' | 'fora';
  count: number;
  label: string;
  items: { id: string; nome: string; detalhe: string }[];
}> = ({ tone, count, label, items }) => {
  const [open, setOpen] = useState(false); // clique fixa o popover
  const [hover, setHover] = useState(false); // hover mostra o popover
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const temLista = items.length > 0;
  const mostrar = (open || hover) && temLista;

  const estilo = {
    normal: {
      pill: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800',
      Icon: CheckCircle2,
    },
    limite: {
      pill: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800',
      Icon: AlertTriangle,
    },
    fora: {
      pill: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800',
      Icon: XCircle,
    },
  }[tone];
  const Icon = estilo.Icon;

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        onClick={() => temLista && setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-semibold ${estilo.pill} ${temLista ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <Icon className="w-4 h-4" />
        {count} {label}
      </button>
      {mostrar && (
        <div className="absolute right-0 top-full mt-1.5 z-20 w-60 max-h-64 overflow-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl p-1.5">
          {items.map((it) => (
            <div
              key={it.id}
              className="px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2 hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <span className="text-sm text-gray-700 dark:text-gray-200 truncate">{it.nome}</span>
              <span className="text-xs font-medium text-gray-400 flex-shrink-0">{it.detalhe}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Página ───────────────────────────────────────────────────────────────────
const TemperaturaEquipamentosPage: React.FC = () => {
  const {
    equipamentos,
    loading,
    error,
    refetch,
    createEquipamento,
    updateEquipamento,
    deleteEquipamento,
    registrarTemperatura,
    fetchTemperaturas,
    fetchLeiturasRecentes,
  } = useTemperaturas();

  const { user, userProfile } = useAuth();
  const registradoPor = userProfile?.name || user?.email || 'Sistema';
  // Escrita (cadastrar/editar/excluir equipamento e registrar leitura) exige gestão;
  // canViewTemperatura sozinho dá só leitura. As permissões vivem em userProfile.
  const canManage = hasPermission(userProfile?.permissions || [], 'canManageColetas');

  const { confirmDialog, showConfirmDialog, hideConfirmDialog, handleConfirmDialogConfirm } = useDialog();

  const [series, setSeries] = useState<Record<string, AcTemperatura[]>>({});
  const [equipModal, setEquipModal] = useState<{ open: boolean; equipamento: AcEquipamento | null }>({
    open: false,
    equipamento: null,
  });
  const [leituraEquip, setLeituraEquip] = useState<AcEquipamento | null>(null);
  const [historicoEquip, setHistoricoEquip] = useState<AcEquipamento | null>(null);

  const recarregarSeries = useCallback(async () => {
    try {
      setSeries(await fetchLeiturasRecentes());
    } catch {
      /* o painel de status é acessório; ignora falha */
    }
  }, [fetchLeiturasRecentes]);

  useEffect(() => {
    void recarregarSeries();
  }, [recarregarSeries]);

  const ultimaDe = (id: string): AcTemperatura | undefined => {
    const s = series[id];
    return s && s.length ? s[s.length - 1] : undefined;
  };

  // Agrupa os equipamentos ATIVOS (com leitura) por situação, para os indicadores.
  const grupos: Record<'normal' | 'limite' | 'fora', { id: string; nome: string; detalhe: string }[]> = {
    normal: [],
    limite: [],
    fora: [],
  };
  for (const eq of equipamentos) {
    if (!eq.ativo) continue; // inativos ficam fora da contagem
    const u = ultimaDe(eq.id);
    const s = classificar(eq, u);
    if (s === 'sem') continue; // sem leitura não entra em nenhum indicador
    grupos[s].push({ id: eq.id, nome: eq.nome, detalhe: u ? fmtTemp(u.temperatura) : '' });
  }
  const nNormal = grupos.normal.length;
  const nLimite = grupos.limite.length;
  const nFora = grupos.fora.length;

  const bannerTone: 'fora' | 'limite' | 'normal' | 'neutro' =
    nFora > 0 ? 'fora' : nLimite > 0 ? 'limite' : nNormal > 0 ? 'normal' : 'neutro';
  const bannerIconClass = {
    fora: 'bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/25',
    limite: 'bg-gradient-to-br from-amber-500 to-orange-500 shadow-amber-500/25',
    normal: 'bg-gradient-to-br from-emerald-500 to-green-600 shadow-emerald-500/25',
    neutro: 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/25',
  }[bannerTone];
  const tituloResumo =
    equipamentos.length === 0
      ? 'Nenhum equipamento cadastrado'
      : nFora > 0
        ? `${nFora} ${nFora > 1 ? 'equipamentos' : 'equipamento'} fora da faixa`
        : nLimite > 0
          ? `${nLimite} ${nLimite > 1 ? 'equipamentos' : 'equipamento'} no limite`
          : nNormal > 0
            ? 'Todos os equipamentos normais'
            : 'Aguardando leituras';

  const handleDelete = (eq: AcEquipamento) => {
    showConfirmDialog(
      'Excluir equipamento',
      <span>
        Excluir <strong className="text-gray-900 dark:text-gray-100">"{eq.nome}"</strong>? Todas as leituras dele
        também serão removidas.
      </span>,
      async () => {
        const msg = await deleteEquipamento(eq.id);
        if (msg) window.alert(`Não foi possível excluir: ${msg}`);
      },
      { type: 'danger', confirmText: 'Excluir' },
    );
  };

  return (
    <div className="max-w-6xl mx-auto pt-4 sm:pt-6">
      {/* Header — banner de status */}
      <div className="mb-6 rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0 ${bannerIconClass}`}>
              <Thermometer className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 truncate">{tituloResumo}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone="normal" count={nNormal} label="normais" items={grupos.normal} />
            <StatusPill tone="limite" count={nLimite} label="no limite" items={grupos.limite} />
            <StatusPill tone="fora" count={nFora} label="fora" items={grupos.fora} />
            <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1 hidden sm:block" />
            <button
              onClick={() => {
                void refetch();
                void recarregarSeries();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
            {canManage && (
              <button
                onClick={() => setEquipModal({ open: true, equipamento: null })}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-indigo-500 shadow-lg shadow-blue-500/25 hover:scale-[1.02] transition-all"
              >
                <Plus className="w-4 h-4" />
                Novo equipamento
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : equipamentos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
            <Thermometer className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Nenhum equipamento cadastrado</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {canManage
              ? 'Cadastre uma geladeira ou freezer para começar a monitorar a temperatura.'
              : 'Ainda não há equipamentos para exibir.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {equipamentos.map((eq) => {
            const serie = series[eq.id] ?? [];
            const ultima = serie.length ? serie[serie.length - 1] : undefined;
            const situacao = classificar(eq, ultima);
            return (
              <div
                key={eq.id}
                onClick={() => setHistoricoEquip(eq)}
                className={`p-5 rounded-2xl border bg-white dark:bg-gray-800 flex flex-col transition-all cursor-pointer hover:shadow-lg hover:-translate-y-0.5 ${
                  eq.ativo && situacao === 'fora'
                    ? 'border-red-300 dark:border-red-800'
                    : eq.ativo && situacao === 'limite'
                      ? 'border-amber-300 dark:border-amber-800'
                      : 'border-gray-100 dark:border-gray-700'
                } ${!eq.ativo ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Thermometer className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{eq.nome}</h3>
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                      eq.ativo
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                    }`}
                  >
                    {eq.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    {tipoLabel(eq.tipo)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Gauge className="w-3.5 h-3.5" />
                    {fmtTemp(eq.temp_min)} a {fmtTemp(eq.temp_max)}
                  </span>
                </div>
                {eq.localizacao && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 truncate">{eq.localizacao}</p>
                )}

                {/* Última leitura + tendência */}
                <div className="mb-4 flex-1">
                  {ultima ? (
                    <div className="flex items-end justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-2xl font-bold ${
                              situacao === 'fora'
                                ? 'text-red-600 dark:text-red-400'
                                : situacao === 'limite'
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-gray-900 dark:text-gray-100'
                            }`}
                          >
                            {fmtTemp(ultima.temperatura)}
                          </span>
                          {situacao === 'fora' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                              <XCircle className="w-3 h-3" />
                              Fora da faixa
                            </span>
                          ) : situacao === 'limite' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                              <AlertTriangle className="w-3 h-3" />
                              No limite
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                              <CheckCircle2 className="w-3 h-3" />
                              OK
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {fmtDateTime(ultima.registrado_em)} · {ultima.registrado_por}
                        </p>
                      </div>
                      {serie.length >= 2 && (
                        <div className="w-28 h-12 flex-shrink-0">
                          <Sparkline readings={serie} cor={COR_SITUACAO[situacao === 'sem' ? 'normal' : situacao]} />
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">Sem leitura registrada</span>
                  )}
                </div>

                {/* O card inteiro abre o histórico; os botões daqui param a propagação
                    para não abrirem o modal junto com a própria ação. */}
                <div className="flex items-end justify-between gap-2" onClick={(e) => e.stopPropagation()}>
                  {/* Os dois botões de texto empilhados; `items-stretch` iguala a
                      largura pelo mais largo ("Registrar leitura"). */}
                  <div className="flex flex-col items-stretch gap-2 min-w-0">
                    <button
                      onClick={() => setHistoricoEquip(eq)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    >
                      <History className="w-4 h-4 flex-shrink-0" />
                      Histórico
                    </button>
                    {canManage && (
                      <button
                        onClick={() => setLeituraEquip(eq)}
                        disabled={!eq.ativo}
                        title={!eq.ativo ? 'Equipamento inativo — reative para registrar leituras' : undefined}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-50 dark:disabled:hover:bg-blue-900/20"
                      >
                        <Thermometer className="w-4 h-4 flex-shrink-0" />
                        Registrar leitura
                      </button>
                    )}
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => setEquipModal({ open: true, equipamento: eq })}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title="Editar equipamento"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => void updateEquipamento(eq.id, { ativo: !eq.ativo })}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title={eq.ativo ? 'Desativar' : 'Ativar'}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(eq)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Excluir equipamento"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {equipModal.open && (
        <EquipamentoModal
          equipamento={equipModal.equipamento}
          onClose={() => setEquipModal({ open: false, equipamento: null })}
          onSave={(input) =>
            equipModal.equipamento ? updateEquipamento(equipModal.equipamento.id, input) : createEquipamento(input)
          }
        />
      )}

      {historicoEquip && (
        <HistoricoModal
          equipamento={historicoEquip}
          onClose={() => setHistoricoEquip(null)}
          fetchTemperaturas={fetchTemperaturas}
        />
      )}

      {leituraEquip && (
        <LeituraModal
          equipamento={leituraEquip}
          registradoPor={registradoPor}
          onClose={() => setLeituraEquip(null)}
          onDone={() => void recarregarSeries()}
          registrarTemperatura={registrarTemperatura}
          fetchTemperaturas={fetchTemperaturas}
        />
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        type={confirmDialog.type}
        onConfirm={handleConfirmDialogConfirm}
        onCancel={hideConfirmDialog}
      />
    </div>
  );
};

export default TemperaturaEquipamentosPage;
