import React, { useState, useEffect } from 'react';
import { Users, Edit, Shield, Plus, X, Save, UserCog, User, ShieldCheck, DollarSign, Settings, Check, Trash2, Lock, Search, SlidersHorizontal } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { supabase } from '../lib/supabase';
import { UserProfile, UserRole, Department, CustomRole } from '../types';
import { DEPARTMENTS, getRoleForDepartment, getRoleLabel, getDepartmentLabel, ALL_PERMISSION_KEYS, hasPermission } from '../utils/permissions';
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

const GROUP_COLORS: Record<string, {
  dot: string;
  activePill: string;
  activeText: string;
  groupHeader: string;
  groupBg: string;
}> = {
  'Dashboard':      { dot: 'bg-purple-500',  activePill: 'bg-purple-100 dark:bg-purple-900/40 border-purple-300 dark:border-purple-700',  activeText: 'text-purple-700 dark:text-purple-300',  groupHeader: 'text-purple-600 dark:text-purple-400',  groupBg: 'border-l-2 border-purple-300 dark:border-purple-700 pl-3' },
  'Produtos':       { dot: 'bg-blue-500',    activePill: 'bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700',      activeText: 'text-blue-700 dark:text-blue-300',      groupHeader: 'text-blue-600 dark:text-blue-400',      groupBg: 'border-l-2 border-blue-300 dark:border-blue-700 pl-3' },
  'Movimentações':  { dot: 'bg-cyan-500',    activePill: 'bg-cyan-100 dark:bg-cyan-900/40 border-cyan-300 dark:border-cyan-700',      activeText: 'text-cyan-700 dark:text-cyan-300',      groupHeader: 'text-cyan-600 dark:text-cyan-400',      groupBg: 'border-l-2 border-cyan-300 dark:border-cyan-700 pl-3' },
  'Solicitações':   { dot: 'bg-emerald-500', activePill: 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700', activeText: 'text-emerald-700 dark:text-emerald-300', groupHeader: 'text-emerald-600 dark:text-emerald-400', groupBg: 'border-l-2 border-emerald-300 dark:border-emerald-700 pl-3' },
  'Monitoramento':  { dot: 'bg-orange-500',  activePill: 'bg-orange-100 dark:bg-orange-900/40 border-orange-300 dark:border-orange-700',  activeText: 'text-orange-700 dark:text-orange-300',  groupHeader: 'text-orange-600 dark:text-orange-400',  groupBg: 'border-l-2 border-orange-300 dark:border-orange-700 pl-3' },
  'Administração':  { dot: 'bg-rose-500',    activePill: 'bg-rose-100 dark:bg-rose-900/40 border-rose-300 dark:border-rose-700',      activeText: 'text-rose-700 dark:text-rose-300',      groupHeader: 'text-rose-600 dark:text-rose-400',      groupBg: 'border-l-2 border-rose-300 dark:border-rose-700 pl-3' },
  'Tecnologia':     { dot: 'bg-violet-500',  activePill: 'bg-violet-100 dark:bg-violet-900/40 border-violet-300 dark:border-violet-700',  activeText: 'text-violet-700 dark:text-violet-300',  groupHeader: 'text-violet-600 dark:text-violet-400',  groupBg: 'border-l-2 border-violet-300 dark:border-violet-700 pl-3' },
};

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

  // ─── Tab management ─────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');

  // ─── Search & filter ────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDept, setFilterDept] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<string>('all');

  // ─── Custom roles state ─────────────────────────────────────────────────────
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [isSavingRole, setIsSavingRole] = useState(false);
  const [roleFormData, setRoleFormData] = useState({
    name: '',
    description: '',
    permissions: [] as string[],
  });

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    customRoleId: '' as string,
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
    fetchCustomRoles();
  }, []);

  const fetchCustomRoles = async () => {
    setLoadingRoles(true);
    try {
      const { data, error } = await supabase
        .from('custom_roles')
        .select('*')
        .order('is_system', { ascending: false })
        .order('name', { ascending: true });

      if (error) throw error;

      const roles: CustomRole[] = (data || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        permissions: r.permissions || [],
        isSystem: r.is_system,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));

      setCustomRoles(roles);
    } catch (error) {
      console.error('Erro ao carregar cargos:', error);
    } finally {
      setLoadingRoles(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*, custom_roles(id, name, permissions)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedUsers: UserProfile[] = data.map((user: any) => {
        const customRole = user.custom_roles;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          department: user.department,
          createdAt: user.created_at,
          updatedAt: user.updated_at,
          customRoleId: user.custom_role_id,
          permissions: customRole?.permissions || [],
          roleName: customRole?.name,
        };
      });

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
      customRoleId: user.customRoleId || '',
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
            custom_role_id: formData.customRoleId || null,
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
      customRoleId: '',
      department: 'AREA_TECNICA',
      approvalLevel: 'none',
      customMaxAmount: '',
      canApprove: false,
    });
    setEditingUser(null);
    setShowAddForm(false);
  };

  const handleDepartmentChange = (department: Department) => {
    setFormData(prev => ({
      ...prev,
      department
    }));
  };

  // ─── Roles CRUD helpers ─────────────────────────────────────────────────────
  const handleEditRole = (role: CustomRole) => {
    setRoleFormData({
      name: role.name,
      description: role.description || '',
      permissions: [...role.permissions],
    });
    setEditingRole(role);
    setShowRoleForm(true);
  };

  const handleCancelRole = () => {
    setRoleFormData({ name: '', description: '', permissions: [] });
    setEditingRole(null);
    setShowRoleForm(false);
  };

  const togglePermission = (key: string) => {
    setRoleFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter(p => p !== key)
        : [...prev.permissions, key],
    }));
  };

  const toggleAllPermissions = () => {
    const allKeys = ALL_PERMISSION_KEYS.map(p => p.key);
    setRoleFormData(prev => ({
      ...prev,
      permissions: prev.permissions.length === allKeys.length ? [] : allKeys,
    }));
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleFormData.name.trim()) return;
    setIsSavingRole(true);

    try {
      if (editingRole) {
        const { error } = await supabase
          .from('custom_roles')
          .update({
            name: roleFormData.name.trim(),
            description: roleFormData.description.trim() || null,
            permissions: roleFormData.permissions,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingRole.id);

        if (error) throw error;
        showSuccess('Cargo atualizado com sucesso!');
      } else {
        const { error } = await supabase
          .from('custom_roles')
          .insert({
            name: roleFormData.name.trim(),
            description: roleFormData.description.trim() || null,
            permissions: roleFormData.permissions,
            is_system: false,
          });

        if (error) throw error;
        showSuccess('Cargo criado com sucesso!');
      }

      await fetchCustomRoles();
      handleCancelRole();
    } catch (error: any) {
      console.error('Erro ao salvar cargo:', error);
      showError(error?.message?.includes('unique') ? 'Já existe um cargo com este nome.' : 'Erro ao salvar cargo.');
    } finally {
      setIsSavingRole(false);
    }
  };

  const handleDeleteRole = async (role: CustomRole) => {
    if (role.isSystem) return;
    if (!window.confirm(`Deseja realmente excluir o cargo "${role.name}"? Usuários vinculados ficarão sem cargo.`)) return;

    try {
      const { error } = await supabase
        .from('custom_roles')
        .delete()
        .eq('id', role.id);

      if (error) throw error;
      showSuccess('Cargo excluído com sucesso!');
      await fetchCustomRoles();
      await fetchUsers();
    } catch (error) {
      console.error('Erro ao excluir cargo:', error);
      showError('Erro ao excluir cargo.');
    }
  };

  // Get selected role's permission info for the user edit form
  const getSelectedRolePermissions = (): string[] => {
    const role = customRoles.find(r => r.id === formData.customRoleId);
    return role?.permissions || [];
  };

  // ─── Derived: filtered users ────────────────────────────────────────────────
  const filteredUsers = users.filter(user => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      user.name.toLowerCase().includes(q) ||
      user.email.toLowerCase().includes(q) ||
      getDepartmentLabel(user.department).toLowerCase().includes(q) ||
      (user.roleName || '').toLowerCase().includes(q);
    const matchesDept = filterDept === 'all' || user.department === filterDept;
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    return matchesSearch && matchesDept && matchesRole;
  });

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
          <p className="text-gray-500 dark:text-gray-400">Gerencie perfis, cargos e permissões do sistema</p>
        </div>
        {hasPermission(userProfile?.permissions || [], 'canManageUsers') && activeTab === 'users' && (
          <button
            onClick={() => setShowLevelConfig(!showLevelConfig)}
            className="flex items-center px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl hover:from-purple-600 hover:to-indigo-600 transition-all duration-200 shadow-md"
          >
            <Settings className="w-4 h-4 mr-2" />
            Configurar Alçadas
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit animate-fade-in-up">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
            activeTab === 'users'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Users className="w-4 h-4" />
          Usuários
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
            activeTab === 'roles'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Shield className="w-4 h-4" />
          Cargos e Permissões
        </button>
      </div>

      {/* Approval Level Configuration Panel */}
      {activeTab === 'users' && showLevelConfig && (
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
      {activeTab === 'users' && showAddForm && (
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

<div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Cargo *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                {customRoles.map(role => {
                  const isSelected = formData.customRoleId === role.id;
                  const coveragePct = Math.round((role.permissions.length / ALL_PERMISSION_KEYS.length) * 100);
                  const activeGroups = [...new Set(ALL_PERMISSION_KEYS.filter(p => role.permissions.includes(p.key)).map(p => p.group))];
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, customRoleId: role.id }))}
                      className={`relative group text-left rounded-xl border-2 p-3 transition-all duration-150 ${
                        isSelected
                          ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20 shadow-md shadow-blue-500/10'
                          : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/30 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className={`text-sm font-semibold leading-tight ${
                          isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-800 dark:text-gray-200'
                        }`}>{role.name}</span>
                        {isSelected && (
                          <span className="flex-shrink-0 w-4 h-4 rounded-full bg-blue-500 dark:bg-blue-400 flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 text-white" />
                          </span>
                        )}
                        {role.isSystem && !isSelected && (
                          <Lock className="flex-shrink-0 w-3 h-3 text-gray-400 dark:text-gray-500" />
                        )}
                      </div>
                      <div className="flex gap-1 flex-wrap mb-2">
                        {activeGroups.map(g => (
                          <span key={g} className={`w-2 h-2 rounded-full ${GROUP_COLORS[g]?.dot || 'bg-gray-400'}`} title={g} />
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                          <div
                            className={`h-1 rounded-full transition-all duration-300 ${
                              isSelected ? 'bg-gradient-to-r from-blue-400 to-indigo-400' : 'bg-gradient-to-r from-gray-300 to-gray-400 dark:from-gray-500 dark:to-gray-600'
                            }`}
                            style={{ width: `${coveragePct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums whitespace-nowrap">{coveragePct}%</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              {customRoles.length === 0 && (
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Nenhum cargo cadastrado. Crie cargos na aba "Cargos e Permissões".</p>
              )}
            </div>

            {/* Approval Limits Section */}
            {hasPermission(getSelectedRolePermissions(), 'canApproveRequests') && (
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
                <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">Permissões do Cargo Selecionado:</h4>
                <div className="text-xs text-blue-700 dark:text-blue-300">
                  {formData.customRoleId ? (
                    <div className="flex flex-wrap gap-1.5">
                      {getSelectedRolePermissions().map(perm => {
                        const info = ALL_PERMISSION_KEYS.find(p => p.key === perm);
                        return (
                          <span key={perm} className="px-2 py-0.5 bg-blue-100 dark:bg-blue-800/50 rounded-md">
                            {info?.label || perm}
                          </span>
                        );
                      })}
                      {getSelectedRolePermissions().length === 0 && (
                        <p className="text-gray-500">Nenhuma permissão atribuída a este cargo.</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-500">Selecione um cargo para ver as permissões.</p>
                  )}
                  {formData.canApprove && formData.approvalLevel !== 'none' && (
                    <p className="text-green-700 dark:text-green-300 font-medium mt-2">
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

      {/* Search & Filters */}
      {activeTab === 'users' && (
        <div className="flex flex-col sm:flex-row gap-3 animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome, e-mail, departamento ou cargo…"
              className="w-full pl-10 pr-10 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-all duration-200 shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter chips row */}
          <div className="flex items-center gap-2 flex-wrap">
            <SlidersHorizontal className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />

            {/* Role filter */}
            {(
              [['all', 'Todos'], ['admin', 'Admin'], ['operator', 'Operador'], ['requester', 'Solicitante']] as [string, string][]
            ).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setFilterRole(val)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all duration-150 whitespace-nowrap ${
                  filterRole === val
                    ? val === 'all'
                      ? 'bg-gray-800 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-800 dark:border-gray-100 shadow-sm'
                      : val === 'admin'
                      ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700'
                      : val === 'operator'
                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                      : 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                {label}
              </button>
            ))}

            {/* Dept filter */}
            <select
              value={filterDept}
              onChange={e => setFilterDept(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-150 cursor-pointer"
            >
              <option value="all">Todos os departamentos</option>
              {DEPARTMENTS.map(dept => (
                <option key={dept} value={dept}>{getDepartmentLabel(dept)}</option>
              ))}
            </select>

            {/* Active count badge */}
            <span className="ml-1 text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
              {filteredUsers.length} de {users.length}
            </span>
          </div>
        </div>
      )}

      {/* Users List */}
      {activeTab === 'users' && (
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
              {filteredUsers.map((user) => {
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
                      {user.roleName || getRoleLabel(user.role)}
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

        {filteredUsers.length === 0 && (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              {users.length === 0 ? 'Nenhum usuário encontrado' : 'Nenhum resultado para os filtros aplicados'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              {users.length === 0
                ? 'Os usuários aparecerão aqui conforme se cadastrarem no sistema.'
                : 'Tente ajustar a busca ou os filtros acima.'}
            </p>
            {(searchQuery || filterDept !== 'all' || filterRole !== 'all') && (
              <button
                onClick={() => { setSearchQuery(''); setFilterDept('all'); setFilterRole('all'); }}
                className="mt-4 px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all duration-200"
              >
                Limpar filtros
              </button>
            )}
          </div>
        )}
      </div>
      )}

      {/* ─── Aba: Cargos e Permissões ─────────────────────────────────────── */}
      {activeTab === 'roles' && (
        <div className="space-y-6 animate-fade-in-up">
          {/* Role Form */}
          {showRoleForm ? (
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 animate-scale-in">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                  {editingRole ? 'Editar Cargo' : 'Novo Cargo'}
                </h3>
                <button
                  onClick={handleCancelRole}
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all duration-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveRole} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Nome do Cargo *
                    </label>
                    <input
                      type="text"
                      value={roleFormData.name}
                      onChange={(e) => setRoleFormData(prev => ({ ...prev, name: e.target.value }))}
                      required
                      disabled={editingRole?.isSystem}
                      className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 dark:bg-gray-700/50 text-gray-800 dark:text-gray-100 disabled:opacity-50"
                      placeholder="Ex: Analista Financeiro"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Descrição
                    </label>
                    <input
                      type="text"
                      value={roleFormData.description}
                      onChange={(e) => setRoleFormData(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 dark:bg-gray-700/50 text-gray-800 dark:text-gray-100"
                      placeholder="Descrição das responsabilidades"
                    />
                  </div>
                </div>

                {/* Permissions Grid */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Permissões</span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                        {roleFormData.permissions.length} / {ALL_PERMISSION_KEYS.length}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={toggleAllPermissions}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-150"
                    >
                      {roleFormData.permissions.length === ALL_PERMISSION_KEYS.length ? '✕  Desmarcar todos' : '✓  Marcar todos'}
                    </button>
                  </div>

                  <div className="space-y-3">
                    {Object.entries(
                      ALL_PERMISSION_KEYS.reduce((groups, perm) => {
                        (groups[perm.group] = groups[perm.group] || []).push(perm);
                        return groups;
                      }, {} as Record<string, typeof ALL_PERMISSION_KEYS>)
                    ).map(([group, perms]) => {
                      const style = GROUP_COLORS[group] || GROUP_COLORS['Administração'];
                      const activeCount = perms.filter(p => roleFormData.permissions.includes(p.key)).length;
                      return (
                        <div key={group} className="rounded-2xl bg-gray-50/80 dark:bg-gray-700/20 p-4 border border-gray-100 dark:border-gray-700/50">
                          <div className={`flex items-center justify-between mb-3 ${style.groupBg}`}>
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                              <h4 className={`text-xs font-bold uppercase tracking-wider ${style.groupHeader}`}>{group}</h4>
                            </div>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              activeCount > 0
                                ? `${style.activePill} ${style.activeText}`
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
                            }`}>
                              {activeCount}/{perms.length}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {perms.map(perm => {
                              const isActive = roleFormData.permissions.includes(perm.key);
                              return (
                                <button
                                  key={perm.key}
                                  type="button"
                                  onClick={() => togglePermission(perm.key)}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 select-none ${
                                    isActive
                                      ? `${style.activePill} ${style.activeText} shadow-sm`
                                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
                                  }`}
                                >
                                  {isActive && <Check className="w-3 h-3 flex-shrink-0" />}
                                  {perm.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleCancelRole}
                    className="px-4 py-2.5 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200 font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingRole}
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 disabled:opacity-50 transition-all duration-200 flex items-center font-medium shadow-md shadow-blue-500/25"
                  >
                    {isSavingRole ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        {editingRole ? 'Atualizar Cargo' : 'Criar Cargo'}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="flex justify-end">
              <button
                onClick={() => { setEditingRole(null); setRoleFormData({ name: '', description: '', permissions: [] }); setShowRoleForm(true); }}
                className="flex items-center px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 shadow-md shadow-blue-500/25 font-medium"
              >
                <Plus className="w-4 h-4 mr-2" />
                Novo Cargo
              </button>
            </div>
          )}

          {/* Roles List */}
          {loadingRoles ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {customRoles.map(role => {
                const coveragePct = Math.round((role.permissions.length / ALL_PERMISSION_KEYS.length) * 100);
                const groupCounts = Object.entries(
                  ALL_PERMISSION_KEYS.reduce((acc, perm) => {
                    if (role.permissions.includes(perm.key)) acc[perm.group] = (acc[perm.group] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                );
                const userCount = users.filter(u => u.customRoleId === role.id).length;
                return (
                  <div
                    key={role.id}
                    className="group bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-lg hover:border-gray-200 dark:hover:border-gray-600 transition-all duration-200"
                  >
                    {/* Accent top stripe */}
                    <div className={`h-1 ${
                      role.isSystem
                        ? 'bg-gradient-to-r from-amber-400 via-orange-400 to-amber-400'
                        : 'bg-gradient-to-r from-blue-400 via-indigo-400 to-blue-400'
                    }`} />

                    <div className="p-5">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center shadow-md ${
                            role.isSystem
                              ? 'bg-gradient-to-br from-amber-500 to-orange-500 shadow-amber-500/25'
                              : 'bg-gradient-to-br from-blue-500 to-indigo-500 shadow-blue-500/25'
                          }`}>
                            {role.isSystem ? <Lock className="w-4 h-4 text-white" /> : <Shield className="w-4 h-4 text-white" />}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{role.name}</h4>
                            {role.isSystem
                              ? <span className="text-[10px] font-bold text-amber-500 dark:text-amber-400 uppercase tracking-widest">Sistema</span>
                              : <span className="text-[10px] text-gray-400 dark:text-gray-500">{userCount} usuário{userCount !== 1 ? 's' : ''}</span>
                            }
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                          <button
                            onClick={() => handleEditRole(role)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all duration-150"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {!role.isSystem && (
                            <button
                              onClick={() => handleDeleteRole(role)}
                              className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all duration-150"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Description */}
                      {role.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2 leading-relaxed">{role.description}</p>
                      )}

                      {/* Group coverage dots */}
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {groupCounts.length > 0 ? groupCounts.map(([grp, count]) => {
                          const style = GROUP_COLORS[grp];
                          const total = ALL_PERMISSION_KEYS.filter(p => p.group === grp).length;
                          return (
                            <span
                              key={grp}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                style ? `${style.activePill} ${style.activeText}` : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
                              }`}
                              title={grp}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${style?.dot || 'bg-gray-400'}`} />
                              {grp} {count}/{total}
                            </span>
                          );
                        }) : (
                          <span className="text-xs text-gray-400">Sem permissões</span>
                        )}
                      </div>

                      {/* Progress bar */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">{role.permissions.length} de {ALL_PERMISSION_KEYS.length} permissões</span>
                          <span className={`text-[10px] font-bold ${
                            coveragePct === 100 ? 'text-emerald-500' : coveragePct > 50 ? 'text-blue-500' : 'text-gray-400'
                          }`}>{coveragePct}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full transition-all duration-500 ${
                              role.isSystem
                                ? 'bg-gradient-to-r from-amber-400 to-orange-400'
                                : 'bg-gradient-to-r from-blue-400 to-indigo-400'
                            }`}
                            style={{ width: `${coveragePct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {customRoles.length === 0 && (
                <div className="col-span-full p-12 text-center">
                  <Shield className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Nenhum cargo cadastrado</h3>
                  <p className="text-gray-500 dark:text-gray-400">Crie cargos personalizados para gerenciar permissões.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UserManagement;