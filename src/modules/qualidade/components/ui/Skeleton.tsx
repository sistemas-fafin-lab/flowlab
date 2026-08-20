export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton animate-pulse rounded-lg bg-slate-200 dark:bg-white/5 ${className}`} />;
}
