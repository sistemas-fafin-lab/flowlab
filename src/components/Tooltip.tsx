import React from 'react';

/**
 * Tooltip leve via CSS (group-hover + transition-delay), sem JS/estado.
 *
 * Substitui o `title` nativo do navegador porque o delay dele (~700ms-1s) é
 * controlado pelo SO/navegador e não dá para configurar — aqui o atraso é só o
 * `delay-150` do Tailwind (150ms).
 */

interface TooltipProps {
  label: string | null | undefined;
  children: React.ReactNode;
  className?: string;
}

const Tooltip: React.FC<TooltipProps> = ({ label, children, className }) => {
  if (!label) return <>{children}</>;

  return (
    <span className={`relative inline-flex group ${className ?? ''}`}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 bottom-full z-20 mb-1.5 w-max max-w-xs -translate-x-1/2 rounded-md bg-gray-900 dark:bg-gray-700 px-2 py-1 text-xs text-white opacity-0 invisible transition-opacity duration-150 delay-150 group-hover:opacity-100 group-hover:visible"
      >
        {label}
      </span>
    </span>
  );
};

export default Tooltip;
