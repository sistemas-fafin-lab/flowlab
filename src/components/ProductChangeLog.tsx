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
      <div className="animate-fade-in-up">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">Histórico de Alterações</h2>
        <p className="text-gray-500">Registro de todas as modificações realizadas nos produtos</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Buscar</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Produto, usuário ou motivo..."
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Data</label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50"
            />
          </div>

          <div className="flex items-end space-x-2">
            <button
              onClick={clearFilters}
              className="px-4 py-2.5 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all duration-200 font-medium"
            >
              Limpar Filtros
            </button>
            <div className="flex items-center text-sm text-gray-500">
              <Filter className="w-4 h-4 mr-2" />
              <span className="font-medium text-gray-700">{filteredLogs.length}</span>&nbsp;registro(s)
            </div>
          </div>
        </div>
      </div>

      {/* Change Logs */}
      <div className="space-y-4">
        {filteredLogs.map((log, index) => (
          <div 
            key={log.id} 
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-lg hover:border-blue-100 transition-all duration-300 animate-fade-in-up"
            style={{ animationDelay: `${Math.min(index * 0.05, 0.25)}s` }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center mr-3 shadow-md shadow-blue-500/25">
                  <History className="w-6 h-6 text-white" />
                </div>
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
              <div className="flex items-center p-3 bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl">
                <User className="w-4 h-4 text-blue-500 mr-2" />
                <div>
                  <p className="text-sm text-gray-500">Alterado por</p>
                  <p className="font-medium text-gray-800">{log.changedBy}</p>
                </div>
              </div>

              <div className="flex items-center p-3 bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl">
                <FileText className="w-4 h-4 text-blue-500 mr-2" />
                <div>
                  <p className="text-sm text-gray-500">Motivo</p>
                  <p className="font-medium text-gray-800">{log.changeReason}</p>
                </div>
              </div>
            </div>

            {/* Field Changes */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Campos Alterados:</h4>
              <div className="space-y-2">
                {log.fieldChanges.map((change, index) => (
                  <div key={index} className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl p-3 border border-gray-100">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">{change.field}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">Valor Anterior</p>
                        <p className="text-sm text-red-600 bg-red-50 px-3 py-1.5 rounded-lg">
                          {change.oldValue}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Novo Valor</p>
                        <p className="text-sm text-green-600 bg-green-50 px-3 py-1.5 rounded-lg">
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