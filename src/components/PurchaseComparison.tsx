import React from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useInventory } from '../hooks/useInventory';

const PurchaseComparison: React.FC = () => {
  const { movements } = useInventory();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getMonthYear = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  };

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  const currentKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  const previousKey = `${previousYear}-${String(previousMonth + 1).padStart(2, '0')}`;

  const dataByProduct: Record<string, { name: string; current: number; previous: number }> = {};

  movements.forEach(mov => {
    if (mov.type !== 'in') return;
    const key = getMonthYear(mov.date);
    if (!dataByProduct[mov.productId]) {
      dataByProduct[mov.productId] = {
        name: mov.productName,
        current: 0,
        previous: 0
      };
    }
    if (key === currentKey) {
      dataByProduct[mov.productId].current += mov.totalValue;
    } else if (key === previousKey) {
      dataByProduct[mov.productId].previous += mov.totalValue;
    }
  });

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text('Comparativo de Compras - Mês Atual vs Mês Anterior', 14, 16);

    const rows = Object.values(dataByProduct).map(item => ([
      item.name,
      formatCurrency(item.previous),
      formatCurrency(item.current),
      formatCurrency(item.current - item.previous)
    ]));

    autoTable(doc, {
      startY: 20,
      head: [['Produto', 'Mês Anterior', 'Mês Atual', 'Diferença']],
      body: rows,
    });

    doc.save('comparativo-compras.pdf');
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">
          Comparativo de Compras (Mês Atual vs Anterior)
        </h3>
        <button
          onClick={exportToPDF}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Exportar PDF
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-left">
          <thead className="bg-gray-100 text-gray-600">
            <tr>
              <th className="px-4 py-2">Produto</th>
              <th className="px-4 py-2">Mês Anterior</th>
              <th className="px-4 py-2">Mês Atual</th>
              <th className="px-4 py-2">Diferença</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(dataByProduct).map((item, idx) => (
              <tr key={idx} className="border-b">
                <td className="px-4 py-2 text-gray-800">{item.name}</td>
                <td className="px-4 py-2">{formatCurrency(item.previous)}</td>
                <td className="px-4 py-2">{formatCurrency(item.current)}</td>
                <td className={`px-4 py-2 font-medium ${item.current - item.previous >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(item.current - item.previous)}
                </td>
              </tr>
            ))}
            {Object.keys(dataByProduct).length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-4 text-gray-500">Sem dados de compras nos dois meses.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PurchaseComparison;
