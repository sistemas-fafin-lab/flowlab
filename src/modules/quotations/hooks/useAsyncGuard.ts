import { useCallback, useEffect, useRef, useState } from 'react';

// Guarda contra duplo clique em ações async: o estado de "ocupado" só
// reflete o React depois que o setState é processado, então dois cliques na
// mesma tarefa ainda veriam isBusy=false. O ref é atualizado na hora.
export const useAsyncGuard = () => {
  const busyRef = useRef(false);
  const [isBusy, setIsBusy] = useState(false);

  const begin = useCallback((): boolean => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setIsBusy(true);
    return true;
  }, []);

  const reset = useCallback(() => {
    busyRef.current = false;
    setIsBusy(false);
  }, []);

  // Se o componente desmontar no meio do processamento (ex. modal fechado
  // por fora), o ref não pode ficar preso em true.
  useEffect(() => {
    return () => {
      busyRef.current = false;
    };
  }, []);

  return { isBusy, begin, reset };
};
