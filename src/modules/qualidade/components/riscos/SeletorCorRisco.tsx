import { useEffect, useRef, useState } from 'react';
import { PALETA_COR_RISCO_DEFAULT, corDoRisco } from './rotulos.js';

interface SeletorCorRiscoProps {
  riscoId: string;
  cor: string | null;
  canManage: boolean;
  onMudar: (cor: string) => void;
}

/**
 * Bolinha clicável na coluna "Cor" da tabela de riscos — abre um popover com
 * `<input type="color">` nativo (zero dependência nova) + swatches da paleta
 * default pra clique rápido. Sem `canManage`, renderiza só a bolinha estática
 * (mesmo padrão de leitura-only do resto do módulo).
 */
export function SeletorCorRisco({ riscoId, cor, canManage, onMudar }: SeletorCorRiscoProps) {
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const corAtual = cor ?? corDoRisco({ id: riscoId, cor: null }).light;

  useEffect(() => {
    if (!aberto) return;
    function aoClicarFora(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, [aberto]);

  if (!canManage) {
    return <span className="inline-block h-4 w-4 rounded-full ring-1 ring-black/10 dark:ring-white/10" style={{ backgroundColor: corAtual }} aria-hidden />;
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        aria-label="Escolher cor do risco"
        onClick={(e) => {
          e.stopPropagation();
          setAberto((atual) => !atual);
        }}
        className="h-4 w-4 rounded-full ring-1 ring-black/10 transition-transform hover:scale-110 dark:ring-white/10"
        style={{ backgroundColor: corAtual }}
      />

      {aberto && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="glass-surface absolute left-0 top-full z-30 mt-1 w-44 rounded-xl p-3"
        >
          <input
            type="color"
            aria-label="Cor customizada"
            value={corAtual}
            onChange={(e) => onMudar(e.target.value)}
            className="h-8 w-full cursor-pointer rounded-lg border-0 bg-transparent p-0"
          />
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {PALETA_COR_RISCO_DEFAULT.map((par) => (
              <button
                key={par.light}
                type="button"
                aria-label={`Usar cor ${par.light}`}
                onClick={() => {
                  onMudar(par.light);
                  setAberto(false);
                }}
                className="h-5 w-5 rounded-full ring-1 ring-black/10 hover:scale-110 dark:ring-white/10"
                style={{ backgroundColor: par.light }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
