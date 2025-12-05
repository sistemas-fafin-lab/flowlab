import React, { useState, useEffect } from 'react';
import { Users, Edit, Shield, Plus, X, Save } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { supabase } from '../lib/supabase';
import { UserProfile, UserRole, Department } from '../types';
import { DEPARTMENTS, getRoleForDepartment, getRoleLabel, getDepartmentLabel } from '../utils/permissions';
import Notification from './Notification';

const UserManagement: React.FC = () => {
  const { userProfile } = useAuth();
  const { notification, showSuccess, showError, hideNotification } = useNotification();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'requester' as UserRole,
    department: 'Área técnica' as Department
  });

  useEffect(() => {
    fetchUsers();
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

  const handleEdit = (user: UserProfile) => {
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department
    });
    setEditingUser(user);
    setShowAddForm(true);
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
        showSuccess('Usuário atualizado com sucesso!');
      } else {
        // For new users, we would need to handle auth.users creation
        // This is typically done through Supabase Auth API
        showError('Criação de novos usuários deve ser feita através do sistema de autenticação.');
        return;
      }

      await fetchUsers();
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
      department: 'Área técnica'
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent"></div>
          <span className="mt-3 text-gray-500 font-medium">Carregando usuários...</span>
        </div>
      </div>
    );
  }

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
      <div className="flex justify-between items-center animate-fade-in-up">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">Gerenciamento de Usuários</h2>
          <p className="text-gray-500">Gerencie perfis e permissões dos usuários do sistema</p>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 animate-scale-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">
              {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
            </h3>
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-xl transition-all duration-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome Completo *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50"
                placeholder="Nome do usuário"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                required
                disabled={!!editingUser} // Não permitir editar email de usuários existentes
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 transition-all duration-200 hover:border-gray-300 bg-gray-50/50"
                placeholder="email@empresa.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Departamento *
              </label>
              <select
                value={formData.department}
                onChange={(e) => handleDepartmentChange(e.target.value as Department)}
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50 cursor-pointer"
              >
                {DEPARTMENTS.map(dept => (
                  <option key={dept} value={dept}>{getDepartmentLabel(dept)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Perfil de Acesso *
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as UserRole }))}
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50 cursor-pointer"
              >
                <option value="requester">Solicitante</option>
                <option value="operator">Operador</option>
                <option value="admin">Administrador</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Sugestão baseada no departamento: {getRoleLabel(getRoleForDepartment(formData.department))}
              </p>
            </div>

            <div className="md:col-span-2">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-100">
                <h4 className="text-sm font-medium text-blue-800 mb-2">Permissões do Perfil Selecionado:</h4>
                <div className="text-xs text-blue-700">
                  {formData.role === 'admin' && (
                    <p>• Acesso completo a todos os módulos do sistema</p>
                  )}
                  {formData.role === 'operator' && (
                    <p>• Acesso a produtos, movimentações, solicitações, fornecedores e cotações (exceto dashboard)</p>
                  )}
                  {formData.role === 'requester' && (
                    <p>• Acesso apenas para criar e visualizar solicitações do seu departamento</p>
                  )}
                </div>
              </div>
            </div>

            <div className="md:col-span-2 flex justify-end space-x-3">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2.5 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all duration-200 font-medium"
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
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-gray-50 to-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Usuário
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Departamento
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Perfil
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Criado em
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-blue-50/50 transition-colors duration-150">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center mr-3 shadow-md shadow-blue-500/25">
                        <Shield className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{user.name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-700 font-medium">{getDepartmentLabel(user.department)}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                      user.role === 'admin' ? 'bg-gradient-to-r from-red-100 to-rose-100 text-red-800' :
                      user.role === 'operator' ? 'bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800' :
                      'bg-gradient-to-r from-green-100 to-emerald-100 text-green-800'
                    }`}>
                      {getRoleLabel(user.role)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleEdit(user)}
                      className="text-blue-600 hover:text-blue-800 flex items-center px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-all duration-200"
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum usuário encontrado</h3>
            <p className="text-gray-500">Os usuários aparecerão aqui conforme se cadastrarem no sistema.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManagement;