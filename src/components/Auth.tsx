import React, { useState } from 'react';
import { LogIn, UserPlus, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { DEPARTMENTS } from "../utils/permissions";

const Auth: React.FC = () => {
  const { signIn, signUp, resetPassword } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [department, setDepartment] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isForgotPassword, setIsForgotPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = isSignUp 
        ? await signUp(email, password, name, department)
        : await signIn(email, password);

      if (error) {
        // Provide more user-friendly error messages
        let userFriendlyMessage = error.message;
        
        if (error.message.includes('Invalid login credentials')) {
          userFriendlyMessage = isSignUp 
            ? 'Falha ao criar conta. Verifique se o email é válido e a senha tem pelo menos 6 caracteres.'
            : 'Email ou senha incorretos. Verifique suas credenciais e tente novamente. Se você não tem uma conta, clique em "Cadastre-se".';
        } else if (error.message.includes('Email not confirmed')) {
          userFriendlyMessage = 'Por favor, confirme seu email antes de fazer login.';
        } else if (error.message.includes('Password should be at least')) {
          userFriendlyMessage = 'A senha deve ter pelo menos 6 caracteres.';
        } else if (error.message.includes('Invalid email')) {
          userFriendlyMessage = 'Por favor, insira um endereço de email válido.';
        } else if (error.message.includes('User already registered')) {
          userFriendlyMessage = 'Este email já está cadastrado. Tente fazer login ou use outro email.';
        }
        
        setError(userFriendlyMessage);
      }
    } catch (err) {
      setError('Ocorreu um erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
<div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
    <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
              <div className="text-center mb-8">
                <img
              src="/LOGO.png"
              alt="Logo"
              className="w-16 h-16 object-contain mx-auto mb-4"
            />
            <h1 className="text-2xl font-bold text-gray-900">Flow LAB</h1>
            <p className="text-gray-600 mt-2"> {isSignUp ? 'Criar nova conta' : 'Faça login para continuar'} </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="seu@email.com"
            />
          </div>

          {isSignUp && (
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Nome Completo
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Seu nome completo"
              />
            </div>
          )}

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Senha
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

            {isSignUp && (
            <div>
              <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-1">
                Departamento
              </label>
              <select
                id="department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Selecione um departamento</option>
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                {isSignUp ? 'Criando conta...' : 'Entrando...'}
              </>
            ) : (
              <>
                {isSignUp ? <UserPlus className="w-4 h-4 mr-2" /> : <LogIn className="w-4 h-4 mr-2" />}
                {isSignUp ? 'Criar Conta' : 'Entrar'}
              </>
            )}
          </button>
          
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setName('');
              setError(null);
            }}
            className="text-blue-600 hover:text-blue-700 text-sm"
          >
            {isSignUp 
              ? 'Já tem uma conta? Faça login' 
              : 'Não tem uma conta? Cadastre-se'
            }
          </button>
          {!isSignUp && !isForgotPassword && (
            <div className="mt-2 text-center">
              <button
                onClick={() => {
                  setIsForgotPassword(true);
                  setName('');
                  setError(null);
                }}
                className="text-blue-500 hover:text-blue-700 text-sm"
              >
                Esqueci minha senha
              </button>
            </div>
          )}
          
          {isForgotPassword && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setLoading(true);
              setError(null);
              const { error } = await resetPassword(email);
              if (error) setError('Erro ao enviar email de recuperação.');
              else alert('Instruções de redefinição enviadas para seu email.');
              setLoading(false);
              setIsForgotPassword(false);
            }}
            className="space-y-4 mt-4"
          >
            <p className="text-sm text-gray-600">Digite seu email para redefinir a senha.</p>
            <input
              id="emailres"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Enviar instruções
            </button>
          </form>
        )}
        </div>

        {isSignUp && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-xs">
            <strong>Nota:</strong> Após criar sua conta, você poderá acessar o nosso sistema de Compras e Estoque.
          </div>
        )}        
      </div>
    </div>
  );
};

export default Auth;