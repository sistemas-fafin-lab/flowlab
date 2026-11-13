import { Bot } from 'lucide-react';

/** Valor de it_requests.origem para os chamados abertos pela integração do LAB-BRAIN. Mesmo valor em api/_lib/labBrainChamados.ts. */
export const ORIGEM_LAB_BRAIN = 'lab-brain';

interface Props {
  origem?: string | null;
}

/**
 * Selo "via LAB-BRAIN": avisa o TI que o texto do chamado foi escrito por um
 * agente, e não pela pessoa. Chamados abertos pela tela (origem nula) não têm selo.
 */
export default function OrigemChamadoBadge({ origem }: Props) {
  if (origem !== ORIGEM_LAB_BRAIN) return null;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full
        bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200
        dark:bg-indigo-900/30 dark:text-indigo-300 dark:ring-indigo-700/60"
      title="Chamado aberto pelo LAB-BRAIN em nome do solicitante. O texto foi escrito pelo agente."
    >
      <Bot className="w-3 h-3" aria-hidden="true" />
      via LAB-BRAIN
    </span>
  );
}
