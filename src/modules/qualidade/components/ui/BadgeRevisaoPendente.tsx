interface BadgeRevisaoPendenteProps {
  revisaoPendente: boolean | null | undefined;
}

/** Pílula roxa reaproveitada nas colunas de status de Ocorrências, Cortesias e IHQ. */
export function BadgeRevisaoPendente({ revisaoPendente }: BadgeRevisaoPendenteProps) {
  if (!revisaoPendente) return null;
  return (
    <span className="ml-2 rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
      revisão pendente
    </span>
  );
}
