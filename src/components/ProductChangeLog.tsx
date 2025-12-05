import React, { useState, useEffect } from 'react';
import { History, User, Calendar, Clock, FileText, Filter } from 'lucide-react';
import { useInventory } from '../hooks/useInventory';
import { ProductChangeLog } from '../types';

const ProductChangeLogComponent: React.FC = () => {
  const { changeLogs } = useInventory();
  const [filteredLogs, setFilteredLogs] = useState<ProductChangeLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    filterLogs();
  }, [changeLogs, searchTerm, dateFilter]);

  const filterLogs = () => {
    let filtered = changeLogs;

    if (searchTerm) {
      filtered = filtered.filter(log => 
        log.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.changedBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.changeReason.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (dateFilter) {
      filtered = filtered.filter(log => log.changeDate === dateFilter);
    }

    setFilteredLogs(filtered);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setDateFilter('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Histórico de Alterações</h2>
        <p className="text-gray-600">Registro de todas as modificações realizadas nos produtos</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Buscar</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Produto, usuário ou motivo..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Data</label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-end space-x-2">
            <button
              onClick={clearFilters}
              className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Limpar Filtros
            </button>
            <div className="flex items-center text-sm text-gray-600">
              <Filter className="w-4 h-4 mr-2" />
              {filteredLogs.length} registro(s)
            </div>
          </div>
        </div>
      </div>

      {/* Change Logs */}
      <div className="space-y-4">
        {filteredLogs.map((log) => (
          <div key={log.id} className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <History className="w-6 h-6 text-blue-600 mr-3" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">{log.productName}</h3>
                  <p className="text-sm text-gray-500">Alteração registrada</p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center text-sm text-gray-600 mb-1">
                  <Calendar className="w-4 h-4 mr-1" />
                  {log.changeDate}
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <Clock className="w-4 h-4 mr-1" />
                  {log.changeTime}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="flex items-center">
                <User className="w-4 h-4 text-gray-400 mr-2" />
                <div>
                  <p className="text-sm text-gray-600">Alterado por</p>
                  <p className="font-medium text-gray-800">{log.changedBy}</p>
                </div>
              </div>

              <div className="flex items-center">
                <FileText className="w-4 h-4 text-gray-400 mr-2" />
                <div>
                  <p className="text-sm text-gray-600">Motivo</p>
                  <p className="font-medium text-gray-800">{log.changeReason}</p>
                </div>
              </div>
            </div>

            {/* Field Changes */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Campos Alterados:</h4>
              <div className="space-y-2">
                {log.fieldChanges.map((change, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">{change.field}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">Valor Anterior</p>
                        <p className="text-sm text-red-600 bg-red-50 px-2 py-1 rounded">
                          {change.oldValue}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Novo Valor</p>
                        <p className="text-sm text-green-600 bg-green-50 px-2 py-1 rounded">
                          {change.newValue}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredLogs.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center border border-gray-100">
          <History className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum registro encontrado</h3>
          <p className="text-gray-500">
            {changeLogs.length === 0 
              ? 'Ainda não há registros de alterações de produtos.'
              : 'Nenhum registro corresponde aos filtros aplicados.'
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default ProductChangeLogComponent;