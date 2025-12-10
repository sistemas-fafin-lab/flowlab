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
    <div className="space-y-6">
      <Notification
        type={notification.type}
        title={notification.title}
        message={notification.message}
        isVisible={notification.isVisible}
        onClose={hideNotification}
      />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 animate-fade-in-up">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">Configurar Períodos de Solicitações</h2>
          <p className="text-gray-500">Defina os períodos permitidos para solicitações de materiais</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Período Geral */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-fade-in-up hover:shadow-lg hover:border-blue-100 transition-all duration-300" style={{ animationDelay: '0.1s' }}>
          <div className="px-6 py-4 bg-gradient-to-r from-blue-500 to-indigo-500">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Período Geral</h3>
                <p className="text-sm text-white/70">Para todos os departamentos</p>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            <p className="text-sm text-gray-600 mb-4">
              Aplicado a todos os usuários, exceto usuários dos departamentos: Área Técnica, Biologia Molecular, Qualidade e Transporte
            </p>
            
            {generalStartDay && generalEndDay && (
              <div className="text-sm text-blue-700 mb-4 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-200 flex items-center">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center mr-3 shadow-sm shadow-blue-500/25">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <span className="text-xs text-blue-600 font-medium uppercase tracking-wider">Período atual</span>
                  <p className="font-semibold">Dia {generalStartDay} ao dia {generalEndDay}</p>
                </div>
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                  Dia de Início
                </label>
                <input
                  type="number"
                  value={generalStartDay}
                  onChange={(e) => setGeneralStartDay(Number(e.target.value))}
                  min={1}
                  max={31}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50"
                />
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                  Dia Final
                </label>
                <input
                  type="number"
                  value={generalEndDay}
                  onChange={(e) => setGeneralEndDay(Number(e.target.value))}
                  min={1}
                  max={31}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50"
                />
              </div>
              
              <button
                onClick={handleGeneralSubmit}
                disabled={loading}
                className="w-full px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/30 flex items-center justify-center"
              >
                {loading ? (
                  <span className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full"></span>
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Salvar Período Geral
              </button>
            </div>
          </div>
        </div>

        {/* Período Área Técnica */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-fade-in-up hover:shadow-lg hover:border-emerald-100 transition-all duration-300" style={{ animationDelay: '0.15s' }}>
          <div className="px-6 py-4 bg-gradient-to-r from-emerald-500 to-teal-500">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Período - Insumos Técnicos</h3>
                <p className="text-sm text-white/70">Exclusivo para insumos técnicos</p>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            <p className="text-sm text-gray-600 mb-4">
              Aplicado exclusivamente aos usuários dos departamentos: Área Técnica, Biologia Molecular, Qualidade e Transporte
            </p>
            
            {techStartDay && techEndDay && (
              <div className="text-sm text-emerald-700 mb-4 bg-gradient-to-r from-emerald-50 to-teal-50 p-4 rounded-xl border border-emerald-200 flex items-center">
                <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center mr-3 shadow-sm shadow-emerald-500/25">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <span className="text-xs text-emerald-600 font-medium uppercase tracking-wider">Período atual</span>
                  <p className="font-semibold">Dia {techStartDay} ao dia {techEndDay}</p>
                </div>
              </div>
            )}
            
            <form onSubmit={handleTechSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                  Dia de Início
                </label>
                <input
                  type="number"
                  value={techStartDay}
                  onChange={(e) => setTechStartDay(Number(e.target.value))}
                  min={1}
                  max={31}
                  required
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50"
                />
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                  Dia Final
                </label>
                <input
                  type="number"
                  value={techEndDay}
                  onChange={(e) => setTechEndDay(Number(e.target.value))}
                  min={1}
                  max={31}
                  required
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50"
                />
              </div>
              
              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-md shadow-emerald-500/25 hover:shadow-lg hover:shadow-emerald-500/30 flex items-center justify-center"
              >
                {loading ? (
                  <span className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full"></span>
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Salvar Período Insumos Técnicos
              </button>
            </form>
          </div>
        </div>
      </div>
      
      {/* Aviso Importante */}
      <div className="bg-white rounded-2xl shadow-sm border border-amber-200 overflow-hidden animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
        <div className="flex items-start p-5">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center mr-4 shadow-md shadow-amber-500/25 flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-amber-800 mb-1">Importante</h4>
            <p className="text-sm text-amber-700">
              Os usuários dos departamentos Área Técnica, Biologia Molecular, Qualidade e Transporte seguirão exclusivamente o período configurado na seção "Período - Insumos Técnicos". 
              Todos os outros usuários seguirão o "Período Geral".
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RequestPeriodConfig;