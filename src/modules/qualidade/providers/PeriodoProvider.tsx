import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

interface Periodo {
  inicio: string;
  fim: string;
}

interface PeriodoContextValue {
  periodo: Periodo;
  definirPeriodo: (periodo: Periodo) => void;
}

const PeriodoContext = createContext<PeriodoContextValue | undefined>(undefined);

const CHAVE_STORAGE = 'flowlab.periodo';

function lerPeriodoInicial(): Periodo {
  if (typeof window === 'undefined') return { inicio: '', fim: '' };
  try {
    const salvo = window.localStorage.getItem(CHAVE_STORAGE);
    if (salvo) {
      const { inicio, fim } = JSON.parse(salvo) as Partial<Periodo>;
      if (typeof inicio === 'string' && typeof fim === 'string') return { inicio, fim };
    }
  } catch {
    // localStorage indisponível ou conteúdo inválido — cai no período vazio.
  }
  return { inicio: '', fim: '' };
}

/**
 * Período (mês/ano) compartilhado entre todas as telas — trocar de aba
 * (worklist ↔ indicadores ↔ cotas, ou entre módulos) preserva o período já
 * selecionado, em vez de resetar a cada navegação (P4 continua valendo:
 * cada tela ainda recebe o período como parâmetro explícito, só a origem
 * do valor passou a ser compartilhada).
 */
export function PeriodoProvider({ children }: { children: ReactNode }) {
  const [periodo, setPeriodo] = useState<Periodo>(lerPeriodoInicial);

  const valor = useMemo<PeriodoContextValue>(
    () => ({
      periodo,
      definirPeriodo: (novo) => {
        setPeriodo(novo);
        window.localStorage.setItem(CHAVE_STORAGE, JSON.stringify(novo));
      },
    }),
    [periodo],
  );

  return <PeriodoContext.Provider value={valor}>{children}</PeriodoContext.Provider>;
}

export function usePeriodoCompartilhado(): PeriodoContextValue {
  const contexto = useContext(PeriodoContext);
  if (!contexto) throw new Error('usePeriodoCompartilhado precisa estar dentro de <PeriodoProvider>');
  return contexto;
}
