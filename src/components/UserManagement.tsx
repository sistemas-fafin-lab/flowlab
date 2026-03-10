import React, { useState, useEffect } from 'react';
import { Users, Edit, Shield, Plus, X, Save, UserCog, User, ShieldCheck, DollarSign, Settings, Check } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { supabase } from '../lib/supabase';
import { UserProfile, UserRole, Department } from '../types';
import { DEPARTMENTS, getRoleForDepartment, getRoleLabel, getDepartmentLabel } from '../utils/permissions';
import Notification from './Notification';

// Type for approval level configuration from database
interface ApprovalLevelConfig {
  id: string;
  level: string;
  label: string;
  maxAmount: number;
  description: string;
  color: string;
  displayOrder: number;
  isActive: boolean;
}

interface UserApprovalLimit {
  userId: string;
  approvalLevel: string;
  customMaxAmount: number | null;
  effectiveMaxAmount: number;
  canApprove: boolean;
}

const UserManagement: React.FC = () => {
  const { userProfile } = useAuth();
  const { notification, showSuccess, showError, hideNotification } = useNotification();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userApprovalLimits, setUserApprovalLimits] = useState<Record<string, UserApprovalLimit>>({});
  const [approvalLevels, setApprovalLevels] = useState<ApprovalLevelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showLevelConfig, setShowLevelConfig] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingLevels, setIsSavingLevels] = useState(false);
  const topRef = React.useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'requester' as UserRole,
    department: 'AREA_TECNICA' as Department,
    approvalLevel: 'none',
    customMaxAmount: '' as string | number,
    canApprove: false,
  });

  // State for editing approval level configs
  const [editingLevels, setEditingLevels] = useState<ApprovalLevelConfig[]>([]);

  useEffect(() => {
    fetchUsers();
    fetchApprovalLimits();
    fetchApprovalLevelConfig();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedUsers: UserProfile[] = data.map(user => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        department: user.department,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }));

      setUsers(formattedUsers);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      showError('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const fetchApprovalLimits = async () => {
    try {
      // Try to use the view first, fallback to direct table
      let data, error;
      
      const viewResult = await supabase
        .from('user_approval_limits_with_details')
        .select('*');
      
      if (viewResult.error) {
        // Fallback to direct table query
        const tableResult = await supabase
          .from('user_approval_limits')
          .select('user_id, approval_level, custom_max_amount, can_approve');
        
        data = tableResult.data;
        error = tableResult.error;
      } else {
        data = viewResult.data;
        error = viewResult.error;
      }

      if (error) {
        console.log('Approval limits not available yet:', error.message);
        return;
      }

      const limitsMap: Record<string, UserApprovalLimit> = {};
      (data || []).forEach((limit: any) => {
        limitsMap[limit.user_id] = {
          userId: limit.user_id,
          approvalLevel: limit.approval_level,
          customMaxAmount: limit.custom_max_amount,
          effectiveMaxAmount: limit.effective_max_amount || limit.custom_max_amount || 0,
          canApprove: limit.can_approve,
        };
      });

      setUserApprovalLimits(limitsMap);
    } catch (error) {
      console.error('Erro ao carregar alçadas:', error);
    }
  };

  const fetchApprovalLevelConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('approval_level_config')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) {
        console.log('Approval level config not available yet:', error.message);
        return;
      }

      const levels: ApprovalLevelConfig[] = (data || []).map((level: any) => ({
        id: level.id,
        level: level.level,
        label: level.label,
        maxAmount: parseFloat(level.max_amount),
        description: level.description,
        color: level.color,
        displayOrder: level.display_order,
        isActive: level.is_active,
      }));

      setApprovalLevels(levels);
      setEditingLevels(levels);
    } catch (error) {
      console.error('Erro ao carregar configuração de alçadas:', error);
    }
  };

  const handleSaveLevelConfig = async () => {
    setIsSavingLevels(true);
    try {
      for (const level of editingLevels) {
        const { error } = await supabase
          .from('approval_level_config')
          .update({
            label: level.label,
            max_amount: level.maxAmount,
            description: level.description,
          })
          .eq('id', level.id);

        if (error) throw error;
      }

      await fetchApprovalLevelConfig();
      await fetchApprovalLimits();
      showSuccess('Configuração de alçadas atualizada com sucesso!');
      setShowLevelConfig(false);
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      showError('Erro ao salvar configuração de alçadas');
    } finally {
      setIsSavingLevels(false);
    }
  };

  const handleEdit = (user: UserProfile) => {
    const userLimit = userApprovalLimits[user.id];
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      approvalLevel: userLimit?.approvalLevel || 'none',
      customMaxAmount: userLimit?.customMaxAmount || '',
      canApprove: userLimit?.canApprove || false,
    });
    setEditingUser(user);
    setShowAddForm(true);
    
    // Scroll suave para o topo onde o formulário é exibido
    setTimeout(() => {
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (editingUser) {
        // Update existing user
        const { error } = await supabase
          .from('user_profiles')
          .update({
            name: formData.name,
            role: formData.role,
            department: formData.department,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingUser.id);

        if (error) throw error;

        // Update approval limits (upsert)
        // custom_max_amount is optional - if not set, uses the level's default
        const customAmount = formData.customMaxAmount 
          ? parseFloat(String(formData.customMaxAmount)) 
          : null;
          
        const { error: approvalError } = await supabase
          .from('user_approval_limits')
          .upsert({
            user_id: editingUser.id,
            approval_level: formData.approvalLevel,
            custom_max_amount: customAmount,
            can_approve: formData.canApprove,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          });

        if (approvalError) {
          console.error('Erro ao salvar alçada:', approvalError);
          // Don't fail the whole operation, just log
        }

        showSuccess('Usuário atualizado com sucesso!');
      } else {
        // For new users, we would need to handle auth.users creation
        // This is typically done through Supabase Auth API
        showError('Criação de novos usuários deve ser feita através do sistema de autenticação.');
        return;
      }

      await fetchUsers();
      await fetchApprovalLimits();
      handleCancel();
    } catch (error) {
      console.error('Erro ao salvar usuário:', error);
      showError('Erro ao salvar usuário. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: '',
      email: '',
      role: 'requester',
      department: 'AREA_TECNICA',
      approvalLevel: 'none',
      customMaxAmount: '',
      canApprove: false,
    });
    setEditingUser(null);
    setShowAddForm(false);
  };

  const handleDepartmentChange = (department: Department) => {
    const suggestedRole = getRoleForDepartment(department);
    setFormData(prev => ({
      ...prev,
      department
    }));
  };

  // Auto-suggest approval level based on role
  const handleRoleChange = (role: UserRole) => {
    let suggestedLevel = 'none';
    let canApprove = false;
    
    if (role === 'admin') {
      suggestedLevel = 'level_4';
      canApprove = true;
    } else if (role === 'operator') {
      suggestedLevel = 'level_1';
      canApprove = true;
    }
    
    setFormData(prev => ({
      ...prev,
      role,
      approvalLevel: suggestedLevel,
      customMaxAmount: '',
      canApprove,
    }));
  };

  // Get approval level label with current configured value
  const getApprovalLevelLabel = (levelValue: string): string => {
    const level = approvalLevels.find(l => l.level === levelValue);
    if (!level) return levelValue;
    if (level.level === 'none') return level.label;
    if (level.level === 'level_4') return `${level.label} (Ilimitado)`;
    return `${level.label} (até R$ ${level.maxAmount.toLocaleString('pt-BR')})`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent"></div>
          <span className="mt-3 text-gray-500 dark:text-gray-400 font-medium">Carregando usuários...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" ref={topRef}>
      <Notification
        type={notification.type}
        title={notification.title}
        message={notification.message}
        isVisible={notification.isVisible}
        onClose={hideNotification}
      />

      {/* Header */}
      <div className="flex justify-between items-center animate-fade-in-up">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">Gerenciamento de Usuários</h2>
          <p className="text-gray-500 dark:text-gray-400">Gerencie perfis e permissões dos usuários do sistema</p>
        </div>
        {userProfile?.role === 'admin' && (
          <button
            onClick={() => setShowLevelConfig(!showLevelConfig)}
            className="flex items-center px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl hover:from-purple-600 hover:to-indigo-600 transition-all duration-200 shadow-md"
          >
            <Settings className="w-4 h-4 mr-2" />
            Configurar Alçadas
          </button>
        )}
      </div>

      {/* Approval Level Configuration Panel */}
      {showLevelConfig && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-purple-100 dark:border-purple-900/50 p-6 animate-scale-in">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center">
                <DollarSign className="w-5 h-5 mr-2 text-purple-600 dark:text-purple-400" />
                Configuração de Alçadas
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Defina o valor máximo de aprovação para cada nível
              </p>
            </div>
            <button
              onClick={() => {
                setEditingLevels(approvalLevels);
                setShowLevelConfig(false);
              }}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all duration-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            {editingLevels
              .filter(level => level.level !== 'none')
              .map((level, index) => (
              <div key={level.id} className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {level.level === 'level_4' ? 'Nível 4 (Ilimitado)' : `Nível ${level.level.split('_')[1]}`}
                  </label>
                  <input
                    type="text"
                    value={level.label}
                    onChange={(e) => {
                      const updated = [...editingLevels];
                      updated[index + 1] = { ...level, label: e.target.value };
                      setEditingLevels(updated);
                    }}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700/50 text-gray-800 dark:text-gray-100 text-sm"
                    placeholder="Nome do nível"
                  />
                </div>
                <div className="w-48">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Valor Máximo (R$)
                  </label>
                  {level.level === 'level_4' ? (
                    <input
                      type="text"
                      value="Ilimitado"
                      disabled
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400 text-sm"
                    />
                  ) : (
                    <input
                      type="number"
                      value={level.maxAmount}
                      onChange={(e) => {
                        const updated = [...editingLevels];
                        const levelIndex = editingLevels.findIndex(l => l.id === level.id);
                        updated[levelIndex] = { ...level, maxAmount: parseFloat(e.target.value) || 0 };
                        setEditingLevels(updated);
                      }}
                      min="0"
                      step="100"
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700/50 text-gray-800 dark:text-gray-100 text-sm"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end mt-6 gap-3">
            <button
              type="button"
              onClick={() => {
                setEditingLevels(approvalLevels);
                setShowLevelConfig(false);
              }}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveLevelConfig}
              disabled={isSavingLevels}
              className="px-6 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl hover:from-purple-600 hover:to-indigo-600 disabled:opacity-50 transition-all duration-200 flex items-center shadow-md"
            >
              {isSavingLevels ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                  Salvando...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Salvar Configuração
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 animate-scale-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
            </h3>
            <button
              onClick={handleCancel}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all duration-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nome Completo *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-500 bg-gray-50/50 dark:bg-gray-700/50 text-gray-800 dark:text-gray-100"
                placeholder="Nome do usuário"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                required
                disabled={!!editingUser} // Não permitir editar email de usuários existentes
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-gray-600 transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-500 bg-gray-50/50 dark:bg-gray-700/50 text-gray-800 dark:text-gray-100"
                placeholder="email@empresa.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Departamento *
              </label>
              <select
                value={formData.department}
                onChange={(e) => handleDepartmentChange(e.target.value as Department)}
                required
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-500 bg-gray-50/50 dark:bg-gray-700/50 text-gray-800 dark:text-gray-100 cursor-pointer"
              >
                {DEPARTMENTS.map(dept => (
                  <option key={dept} value={dept}>{getDepartmentLabel(dept)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Perfil de Acesso *
              </label>
              <select
                value={formData.role}
                onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                required
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-500 bg-gray-50/50 dark:bg-gray-700/50 text-gray-800 dark:text-gray-100 cursor-pointer"
              >
                <option value="requester">Solicitante</option>
                <option value="operator">Operador</option>
                <option value="admin">Administrador</option>
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Sugestão baseada no departamento: {getRoleLabel(getRoleForDepartment(formData.department))}
              </p>
            </div>

            {/* Approval Limits Section - Only show for admin/operator roles */}
            {(formData.role === 'admin' || formData.role === 'operator') && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <DollarSign className="w-4 h-4 inline mr-1" />
                    Alçada de Aprovação
                  </label>
                  <select
                    value={formData.approvalLevel}
                    onChange={(e) => setFormData(prev => ({ ...prev, approvalLevel: e.target.value, customMaxAmount: '' }))}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-500 bg-gray-50/50 dark:bg-gray-700/50 text-gray-800 dark:text-gray-100 cursor-pointer"
                  >
                    {approvalLevels.map(level => (
                      <option key={level.level} value={level.level}>
                        {getApprovalLevelLabel(level.level)}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Valor padrão do nível: R$ {(approvalLevels.find(l => l.level === formData.approvalLevel)?.maxAmount || 0).toLocaleString('pt-BR')}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Valor Personalizado (opcional)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">R$</span>
                    <input
                      type="number"
                      value={formData.customMaxAmount}
                      onChange={(e) => setFormData(prev => ({ ...prev, customMaxAmount: e.target.value }))}
                      min="0"
                      step="100"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-500 bg-gray-50/50 dark:bg-gray-700/50 text-gray-800 dark:text-gray-100"
                      placeholder="Deixe vazio para usar valor do nível"
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Defina um valor específico para este usuário (sobrescreve o valor do nível)
                  </p>
                </div>

                <div className="flex items-center">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.canApprove}
                      onChange={(e) => setFormData(prev => ({ ...prev, canApprove: e.target.checked }))}
                      className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                      Pode aprovar cotações
                    </span>
                  </label>
                </div>
              </>
            )}

            <div className="md:col-span-2">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">Permissões do Perfil Selecionado:</h4>
                <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                  {formData.role === 'admin' && (
                    <>
                      <p>• Acesso completo a todos os módulos do sistema</p>
                      <p>• Pode configurar alçadas de outros usuários</p>
                    </>
                  )}
                  {formData.role === 'operator' && (
                    <p>• Acesso a produtos, movimentações, solicitações, fornecedores e cotações (exceto dashboard)</p>
                  )}
                  {formData.role === 'requester' && (
                    <p>• Acesso apenas para criar e visualizar solicitações do seu departamento</p>
                  )}
                  {formData.canApprove && formData.approvalLevel !== 'none' && (
                    <p className="text-green-700 dark:text-green-300 font-medium">
                      • Alçada de aprovação: {formData.customMaxAmount 
                        ? `R$ ${parseFloat(String(formData.customMaxAmount)).toLocaleString('pt-BR')} (personalizado)`
                        : getApprovalLevelLabel(formData.approvalLevel)
                      }
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="md:col-span-2 flex justify-end space-x-3">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2.5 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200 font-medium"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center font-medium shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/30"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {editingUser ? 'Atualizar' : 'Criar'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users List */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-700 dark:to-slate-700">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Usuário
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Departamento
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Perfil
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Alçada
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Criado em
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
              {users.map((user) => {
                // Ícone e cor baseados no perfil do usuário
                const getRoleIcon = (role: UserRole) => {
                  switch (role) {
                    case 'admin':
                      return <ShieldCheck className="w-5 h-5 text-white" />;
                    case 'operator':
                      return <UserCog className="w-5 h-5 text-white" />;
                    default:
                      return <User className="w-5 h-5 text-white" />;
                  }
                };
                
                const getRoleGradient = (role: UserRole) => {
                  switch (role) {
                    case 'admin':
                      return 'bg-gradient-to-br from-red-500 to-rose-500 shadow-red-500/25';
                    case 'operator':
                      return 'bg-gradient-to-br from-blue-500 to-indigo-500 shadow-blue-500/25';
                    default:
                      return 'bg-gradient-to-br from-green-500 to-emerald-500 shadow-green-500/25';
                  }
                };

                // Get approval limit info
                const userLimit = userApprovalLimits[user.id];
                const levelConfig = approvalLevels.find(l => l.level === userLimit?.approvalLevel);
                const effectiveAmount = userLimit?.customMaxAmount || levelConfig?.maxAmount || 0;
                
                return (
                <tr key={user.id} className="hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-colors duration-150">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mr-3 shadow-md ${getRoleGradient(user.role)}`}>
                        {getRoleIcon(user.role)}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.name}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">{getDepartmentLabel(user.department)}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                      user.role === 'admin' ? 'bg-gradient-to-r from-red-100 to-rose-100 dark:from-red-900/50 dark:to-rose-900/50 text-red-800 dark:text-red-200' :
                      user.role === 'operator' ? 'bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/50 dark:to-indigo-900/50 text-blue-800 dark:text-blue-200' :
                      'bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/50 dark:to-emerald-900/50 text-green-800 dark:text-green-200'
                    }`}>
                      {getRoleLabel(user.role)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {userLimit?.canApprove ? (
                      <div className="flex flex-col">
                        <div className="flex items-center">
                          <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400 mr-1" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {userLimit?.approvalLevel === 'level_4' 
                              ? 'Ilimitado' 
                              : `Até R$ ${effectiveAmount.toLocaleString('pt-BR')}`
                            }
                          </span>
                        </div>
                        {userLimit?.customMaxAmount && (
                          <span className="text-xs text-purple-600 dark:text-purple-400 ml-5">(personalizado)</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400 dark:text-gray-500">Sem alçada</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleEdit(user)}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center px-3 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all duration-200"
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Editar
                    </button>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Nenhum usuário encontrado</h3>
            <p className="text-gray-500 dark:text-gray-400">Os usuários aparecerão aqui conforme se cadastrarem no sistema.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManagement;