import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { Save } from 'lucide-react';
import { hasPermission } from '../utils/permissions';
import Notification from './Notification';

const RequestPeriodConfig: React.FC = () => {
  const { user, userProfile } = useAuth();
  const { notification, showSuccess, showError, hideNotification } = useNotification();
  
  // Período geral (para todos os usuários exceto Área Técnica)
  const [generalStartDay, setGeneralStartDay] = useState<number | ''>('');
  const [generalEndDay, setGeneralEndDay] = useState<number | ''>('');
  
  // Período específico para Área Técnica
  const [techStartDay, setTechStartDay] = useState<number | ''>('');
  const [techEndDay, setTechEndDay] = useState<number | ''>('');
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchPeriods = async () => {
      // Buscar período geral
      const { data: generalData, error: generalError } = await supabase
        .from('request_periods')
        .select('*')
        .eq('department', 'general')
        .maybeSingle();
      
      if (generalError && generalError.code !== 'PGRST116') {
        console.error('Erro ao carregar período geral:', generalError.message);
      }
      
      if (generalData) {
        setGeneralStartDay(generalData.start_day);
        setGeneralEndDay(generalData.end_day);
      }

      // Buscar período da Área Técnica
      const { data: techData, error: techError } = await supabase
        .from('request_periods')
        .select('*')
        .eq('department', 'Área técnica')
        .maybeSingle();
      
      if (techError && techError.code !== 'PGRST116') {
        console.error('Erro ao carregar período da Área Técnica:', techError.message);
      }
      
      if (techData) {
        setTechStartDay(techData.start_day);
        setTechEndDay(techData.end_day);
      }
    };

    fetchPeriods();
  }, []);
  
  if (!userProfile || !hasPermission(userProfile.role, 'canConfigureRequestPeriods')) {
    return <div className="text-red-600 p-4">Acesso restrito.</div>;
  }

 const handleGeneralSubmit = async () => {
  if (!generalStartDay || !generalEndDay) return;
  setLoading(true);

  try {
    const { error } = await supabase
      .from('request_periods')
      .upsert({
        start_day: generalStartDay,
        end_day: generalEndDay,
        department: 'general',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'department'
      });

    if (error) {
      showError('Erro ao salvar período geral.');
    } else {
      showSuccess('Período geral salvo com sucesso!');
    }
  } catch (error) {
    showError('Erro ao salvar período geral.');
  }

  setLoading(false);
};

const handleTechSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!techStartDay || !techEndDay) return;
  setLoading(true);

  try {
    const { error } = await supabase
      .from('request_periods')
      .upsert({
        start_day: techStartDay,
        end_day: techEndDay,
        department: 'Área técnica',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'department'
      });

    if (error) {
      showError('Erro ao salvar período da Área Técnica.');
    } else {
      showSuccess('Período da Área Técnica salvo com sucesso!');
    }
  } catch (error) {
    showError('Erro ao salvar período da Área Técnica.');
  }

  setLoading(false);
};

  return (
    <div className="max-w-4xl mx-auto bg-white shadow-md p-6 rounded-lg mt-6">
      <Notification
        type={notification.type}
        title={notification.title}
        message={notification.message}
        isVisible={notification.isVisible}
        onClose={hideNotification}
      />
      
      <h2 className="text-2xl font-semibold mb-6">Configurar Períodos de Solicitações</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Período Geral */}
        <div className="bg-gray-50 p-6 rounded-lg">
          <h3 className="text-lg font-medium mb-4 text-gray-800">Período Geral</h3>
          <p className="text-sm text-gray-600 mb-4">
            Aplicado a todos os usuários, exceto usuários da Área Técnica
          </p>
          
          {generalStartDay && generalEndDay && (
            <div className="text-sm text-gray-600 mb-4 bg-blue-50 p-3 rounded border-l-4 border-blue-400">
              Período atual: <strong>dia {generalStartDay} ao dia {generalEndDay}</strong>
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dia de Início
              </label>
              <input
                type="number"
                value={generalStartDay}
                onChange={(e) => setGeneralStartDay(Number(e.target.value))}
                min={1}
                max={31}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dia Final
              </label>
              <input
                type="number"
                value={generalEndDay}
                onChange={(e) => setGeneralEndDay(Number(e.target.value))}
                min={1}
                max={31}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <button
              onClick={handleGeneralSubmit}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg flex items-center justify-center transition-colors"
            >
              {loading ? (
                <span className="animate-spin h-4 w-4 mr-2 border-t-2 border-white rounded-full"></span>
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Salvar Período Geral
            </button>
          </div>
        </div>

        {/* Período Área Técnica */}
        <div className="bg-green-50 p-6 rounded-lg">
          <h3 className="text-lg font-medium mb-4 text-gray-800">Período - Área Técnica</h3>
          <p className="text-sm text-gray-600 mb-4">
            Aplicado exclusivamente aos usuários do departamento "Área Técnica"
          </p>
          
          {techStartDay && techEndDay && (
            <div className="text-sm text-gray-600 mb-4 bg-green-100 p-3 rounded border-l-4 border-green-400">
              Período atual: <strong>dia {techStartDay} ao dia {techEndDay}</strong>
            </div>
          )}
          
          <form onSubmit={handleTechSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dia de Início
              </label>
              <input
                type="number"
                value={techStartDay}
                onChange={(e) => setTechStartDay(Number(e.target.value))}
                min={1}
                max={31}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dia Final
              </label>
              <input
                type="number"
                value={techEndDay}
                onChange={(e) => setTechEndDay(Number(e.target.value))}
                min={1}
                max={31}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 py-2 rounded-lg flex items-center justify-center transition-colors"
            >
              {loading ? (
                <span className="animate-spin h-4 w-4 mr-2 border-t-2 border-white rounded-full"></span>
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Salvar Período Área Técnica
            </button>
          </form>
        </div>
      </div>
      
      <div className="mt-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded">
        <div className="flex">
          <div className="ml-3">
            <p className="text-sm text-yellow-700">
              <strong>Importante:</strong> Os usuários da Área Técnica seguirão exclusivamente o período configurado na seção "Período - Área Técnica". 
              Todos os outros usuários seguirão o "Período Geral".
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RequestPeriodConfig;