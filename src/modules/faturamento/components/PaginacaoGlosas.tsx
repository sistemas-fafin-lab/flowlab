import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Paginação das listas da tela Glosas e Recursos (lotes de recurso, recursos
// fora de lote e glosas recentes).

const BOTAO = 'inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';

interface Props {
  pagina: number;
  qtdPaginas: number;
  loading: boolean;
  onPagina: (pagina: number) => void;
}

const PaginacaoGlosas: React.FC<Props> = ({ pagina, qtdPaginas, loading, onPagina }) => (
  <div className="flex items-center gap-2">
    <span className="text-sm text-gray-500 dark:text-gray-400">
      Página {pagina} de {Math.max(qtdPaginas, 1)}
    </span>
    <button onClick={() => onPagina(Math.max(1, pagina - 1))} disabled={pagina <= 1 || loading} className={BOTAO}>
      <ChevronLeft size={16} />
      Anterior
    </button>
    <button onClick={() => onPagina(pagina + 1)} disabled={pagina >= qtdPaginas || loading} className={BOTAO}>
      Próxima
      <ChevronRight size={16} />
    </button>
  </div>
);

export default PaginacaoGlosas;
