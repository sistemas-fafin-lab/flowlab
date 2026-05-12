import { useState, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface IndirectCostItem {
  id: string;
  label: string;
  value: number;
}

export interface Exam {
  id: string;
  code: string;
  name: string;
  location: string;
  direct: number;
  indirect: number;
  indirectItems: IndirectCostItem[];
}

export interface Payor {
  id: string;
  payor: string;
  table: string;
  tus: string;
  examId: string;
  price: number;
}

export interface UseCostControlReturn {
  exams: Exam[];
  payors: Payor[];
  loading: boolean;
  addExam: (data: Omit<Exam, 'id'>) => void;
  updateExam: (id: string, data: Partial<Omit<Exam, 'id'>>) => void;
  deleteExam: (id: string) => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════════════════════

export const formatBRL = (v: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export const formatPct = (v: number): string =>
  `${v.toFixed(1).replace('.', ',')}%`;

// ═══════════════════════════════════════════════════════════════════════════════
// SEED DATA
// ═══════════════════════════════════════════════════════════════════════════════

const seedIndirect = (total: number): IndirectCostItem[] => [
  { id: 'i1', label: 'Rateio de pessoal',                  value: +(total * 0.45).toFixed(2) },
  { id: 'i2', label: 'Depreciação de equipamentos',         value: +(total * 0.25).toFixed(2) },
  { id: 'i3', label: 'Insumos auxiliares (agulhas, tubos)', value: +(total * 0.18).toFixed(2) },
  { id: 'i4', label: 'Rateio de espaço/energia',            value: +(total * 0.12).toFixed(2) },
];

export const SEED_EXAMS: Exam[] = [
  { id: 'e1',  code: 'HMG-001', name: 'Hemograma Completo',         location: 'Hematologia',   direct: 4.20,  indirect: 3.80,  indirectItems: seedIndirect(3.80)  },
  { id: 'e2',  code: 'GLI-014', name: 'Glicose em Jejum',           location: 'Bioquímica',    direct: 1.90,  indirect: 2.10,  indirectItems: seedIndirect(2.10)  },
  { id: 'e3',  code: 'COL-022', name: 'Colesterol Total',           location: 'Bioquímica',    direct: 2.40,  indirect: 2.60,  indirectItems: seedIndirect(2.60)  },
  { id: 'e4',  code: 'TSH-031', name: 'TSH Ultrassensível',         location: 'Hormônios',     direct: 6.10,  indirect: 5.90,  indirectItems: seedIndirect(5.90)  },
  { id: 'e5',  code: 'CIT-050', name: 'Citologia Cervico-Vaginal',  location: 'Anatomia Pat.', direct: 11.20, indirect: 9.30,  indirectItems: seedIndirect(9.30)  },
  { id: 'e6',  code: 'PRT-077', name: 'Proteínas Totais e Frações', location: 'Bioquímica',    direct: 3.10,  indirect: 4.40,  indirectItems: seedIndirect(4.40)  },
  { id: 'e7',  code: 'URI-088', name: 'Urina Tipo I (EAS)',         location: 'Uroanálise',    direct: 1.40,  indirect: 1.80,  indirectItems: seedIndirect(1.80)  },
  { id: 'e8',  code: 'BHC-101', name: 'Beta-HCG Quantitativo',     location: 'Hormônios',     direct: 7.80,  indirect: 6.20,  indirectItems: seedIndirect(6.20)  },
  { id: 'e9',  code: 'VIT-115', name: 'Vitamina D 25-OH',          location: 'Imunologia',    direct: 14.50, indirect: 8.60,  indirectItems: seedIndirect(8.60)  },
  { id: 'e10', code: 'FER-122', name: 'Ferritina',                  location: 'Imunologia',    direct: 5.40,  indirect: 4.10,  indirectItems: seedIndirect(4.10)  },
  { id: 'e11', code: 'PCR-130', name: 'Proteína C Reativa',         location: 'Bioquímica',    direct: 4.80,  indirect: 4.20,  indirectItems: seedIndirect(4.20)  },
  { id: 'e12', code: 'HBA-141', name: 'Hemoglobina Glicada',        location: 'Bioquímica',    direct: 6.20,  indirect: 4.80,  indirectItems: seedIndirect(4.80)  },
];

export const SEED_PAYORS: Payor[] = [
  { id: 'p1',  payor: 'Unimed',         table: 'Unimed Coop.',  tus: '40304361',   examId: 'e1',  price: 9.20  },
  { id: 'p2',  payor: 'Unimed',         table: 'Unimed Coop.',  tus: '40301630',   examId: 'e2',  price: 4.80  },
  { id: 'p3',  payor: 'Unimed',         table: 'Unimed Coop.',  tus: '40301516',   examId: 'e6',  price: 5.40  },
  { id: 'p4',  payor: 'Bradesco Saúde', table: 'AMB 90',        tus: '40304361',   examId: 'e1',  price: 12.50 },
  { id: 'p5',  payor: 'Bradesco Saúde', table: 'AMB 90',        tus: '40307336',   examId: 'e4',  price: 22.00 },
  { id: 'p6',  payor: 'Saldo de Caixa', table: 'Particular',    tus: '—',          examId: 'e9',  price: 95.00 },
  { id: 'p7',  payor: 'Saldo de Caixa', table: 'Particular',    tus: '—',          examId: 'e5',  price: 65.00 },
  { id: 'p8',  payor: 'Saldo de Caixa', table: 'Particular',    tus: '—',          examId: 'e8',  price: 48.00 },
  { id: 'p9',  payor: 'SUS',            table: 'Tabela SUS',    tus: '0202010317', examId: 'e1',  price: 3.20  },
  { id: 'p10', payor: 'SUS',            table: 'Tabela SUS',    tus: '0202010317', examId: 'e6',  price: 1.80  },
  { id: 'p11', payor: 'SulAmérica',     table: 'CBHPM',         tus: '40307336',   examId: 'e4',  price: 18.40 },
  { id: 'p12', payor: 'SulAmérica',     table: 'CBHPM',         tus: '40310019',   examId: 'e9',  price: 38.00 },
  { id: 'p13', payor: 'Hapvida',        table: 'Hapvida 2024',  tus: '40304361',   examId: 'e1',  price: 8.10  },
  { id: 'p14', payor: 'Hapvida',        table: 'Hapvida 2024',  tus: '40301516',   examId: 'e6',  price: 4.10  },
  { id: 'p15', payor: 'Hapvida',        table: 'Hapvida 2024',  tus: '40310353',   examId: 'e7',  price: 4.40  },
  { id: 'p16', payor: 'Saldo de Caixa', table: 'Particular',    tus: '—',          examId: 'e12', price: 38.00 },
];

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export const useCostControl = (): UseCostControlReturn => {
  const [exams, setExams] = useState<Exam[]>(SEED_EXAMS);
  const [payors] = useState<Payor[]>(SEED_PAYORS);

  const addExam = useCallback((data: Omit<Exam, 'id'>) => {
    setExams(prev => [{ ...data, id: `e${Date.now()}` }, ...prev]);
  }, []);

  const updateExam = useCallback((id: string, data: Partial<Omit<Exam, 'id'>>) => {
    setExams(prev => prev.map(e => (e.id === id ? { ...e, ...data } : e)));
  }, []);

  const deleteExam = useCallback((id: string) => {
    setExams(prev => prev.filter(e => e.id !== id));
  }, []);

  return { exams, payors, loading: false, addExam, updateExam, deleteExam };
};
