import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { StatusConsumo } from '../../domain/orcamento';
import BarraAnimada from './BarraAnimada';
import Dica from './Flutuante';

/** Cores de status fixas da paleta da skill dataviz (nunca usadas como cor de série). */
const PREENCHIMENTO: Record<Exclude<StatusConsumo, 'sem_orcamento'>, string> = {
  ok: '#2a78d6',
  atencao: '#fab219',
  estourado: '#d03b3b',
};

const ROTULO: Record<Exclude<StatusConsumo, 'sem_orcamento'>, { texto: string; icone: typeof CheckCircle2; classe: string }> = {
  ok: { texto: 'dentro do orçamento', icone: CheckCircle2, classe: 'text-slate-500 dark:text-slate-400' },
  atencao: { texto: 'perto do limite', icone: AlertTriangle, classe: 'text-amber-700 dark:text-amber-300' },
  estourado: { texto: 'acima do orçamento', icone: AlertCircle, classe: 'text-red-700 dark:text-red-300' },
};

interface MedidorConsumoProps {
  percentual: number;
  status: Exclude<StatusConsumo, 'sem_orcamento'>;
  /** % do ano decorrido: marca onde o consumo "deveria" estar. */
  ritmo?: number;
  compacto?: boolean;
  /** false quando o percentual já aparece em destaque ao lado (o tile de KPI): a linha fica só com o status. */
  mostrarPercentual?: boolean;
}

/**
 * Medidor (dataviz): uma razão contra um limite. O preenchimento carrega a
 * severidade (azul → amarelo → vermelho), o trilho é um tom claro, e o status
 * vem sempre com ícone e texto — nunca só a cor.
 */
const MedidorConsumo: React.FC<MedidorConsumoProps> = ({ percentual, status, ritmo, compacto = false, mostrarPercentual = true }) => {
  const { texto, icone: Icone, classe } = ROTULO[status];
  const largura = Number.isFinite(percentual) ? Math.min(100, Math.max(0, percentual)) : 100;
  const rotuloPct = Number.isFinite(percentual) ? `${percentual.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%` : 'sem limite';
  const temRitmo = ritmo !== undefined && ritmo > 0 && ritmo < 100;
  const ritmoTexto = temRitmo ? `${(ritmo as number).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%` : '';
  return (
    <div>
      <Dica
        bloco
        conteudo={
          <>
            <p className="font-semibold text-white">
              {rotuloPct} do orçamento usado
            </p>
            {temRitmo && <p className="text-slate-300">O traço marca o ritmo do ano: {ritmoTexto} dos meses já passaram.</p>}
          </>
        }
      >
        <div
          className="relative h-2 rounded-full bg-blue-100 dark:bg-slate-700/70"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(largura)}
          aria-label={`Consumo do orçamento: ${rotuloPct}, ${texto}${temRitmo ? `; ritmo do ano ${ritmoTexto}` : ''}`}
        >
          <div className="absolute inset-0 overflow-hidden rounded-full">
            <BarraAnimada largura={largura} cor={PREENCHIMENTO[status]} className="rounded-full" />
          </div>
          {temRitmo && (
            <span aria-hidden="true" className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-slate-500 dark:bg-slate-300" style={{ left: `${ritmo}%` }} />
          )}
        </div>
      </Dica>
      {!compacto && (
        <p className={`mt-1 inline-flex items-center gap-1 text-xs ${classe}`}>
          <Icone className="w-3.5 h-3.5" aria-hidden="true" />
          {mostrarPercentual && <span className="font-semibold">{rotuloPct}</span>} {texto}
        </p>
      )}
    </div>
  );
};

export default MedidorConsumo;
