// flowlab-main não tem um QueryClientProvider global (não usa @tanstack/react-query
// em nenhum outro módulo hoje) — as telas de Qualidade precisam dele (useQuery/
// useMutation, portados verbatim da Fase 1). Escopado só nas rotas de Qualidade,
// não no app inteiro, para não impor a dependência a nenhum outro módulo
// (fase-2-integrar-flowlab-main, design.md D8).
//
// PeriodoProvider é o estado de "período atual" compartilhado entre as telas
// deste módulo (worklist ↔ indicadores ↔ cotas) — específico do módulo, também
// namespaced aqui, não no app inteiro (design.md D7).

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { PeriodoProvider } from './PeriodoProvider';

export function QualidadeProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <PeriodoProvider>{children}</PeriodoProvider>
    </QueryClientProvider>
  );
}
