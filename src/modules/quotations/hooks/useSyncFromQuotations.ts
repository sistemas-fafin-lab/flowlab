import { useEffect } from 'react';
import { Quotation } from '../types';

// Ressincroniza um item local (selectedQuotation, approvalQuotation) com a
// versão mais recente vinda de `quotations` depois de qualquer ação que
// dispare um refresh — evita que o drawer/modal fiquem mostrando dados
// obsoletos até o usuário reabri-los manualmente.
export const useSyncFromQuotations = (
  quotations: Quotation[],
  id: string | undefined,
  setItem: (quotation: Quotation) => void
) => {
  useEffect(() => {
    if (!id) return;
    const updated = quotations.find(q => q.id === id);
    if (updated) setItem(updated);
  }, [quotations, id, setItem]);
};
