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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated gradient mesh background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Animated orbs */}
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-gradient-to-r from-blue-200/50 to-cyan-200/50 rounded-full blur-3xl animate-blob"></div>
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-gradient-to-r from-indigo-200/50 to-blue-200/50 rounded-full blur-3xl animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-slate-200/30 to-blue-200/30 rounded-full blur-3xl animate-pulse-soft"></div>
        
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(30,58,138,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(30,58,138,0.03)_1px,transparent_1px)] bg-[size:64px_64px]"></div>
      </div>

      <div className="max-w-md w-full bg-white/80 backdrop-blur-2xl rounded-3xl shadow-2xl shadow-slate-900/10 p-8 animate-scale-in relative z-10 border border-slate-200/50">
        {/* Subtle glow effect behind card */}
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-slate-500/10 rounded-3xl blur-xl -z-10"></div>
        
        <div className="text-center mb-8">
          {/* Modern logo container with rotating border */}
          <div className="relative inline-flex items-center justify-center mb-6">
            {/* Outer rotating ring */}
            <div className="absolute w-28 h-28 rounded-full border-2 border-transparent animate-spin-slow" style={{ background: 'linear-gradient(white, white) padding-box, linear-gradient(to right, #1e3a8a, #3b82f6, #1e40af) border-box', animationDuration: '8s' }}></div>
            
            {/* Logo background with glassmorphism */}
            <div className="relative w-24 h-24 rounded-full bg-white backdrop-blur-md border border-slate-200 flex items-center justify-center shadow-lg shadow-blue-900/10">
              <img
                src="/LOGO.png"
                alt="Logo"
                className="w-16 h-16 object-contain hover:scale-110 transition-all duration-500 ease-out"
              />
            </div>
          </div>
          
          <h1 className="text-3xl font-bold mb-1">
            <span className="bg-gradient-to-r from-blue-900 via-blue-700 to-indigo-800 bg-clip-text text-transparent">
              Flow LAB
            </span>
          </h1>
          <p className="text-slate-500 text-sm transition-all duration-300">
            {isSignUp ? 'Criar nova conta' : 'Faça login para continuar'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm animate-shake flex items-center gap-2">
            <span className="flex-shrink-0 w-5 h-5 bg-red-100 rounded-full flex items-center justify-center text-red-500 font-bold text-xs">!</span>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 hover:border-slate-300 bg-white/70 backdrop-blur-sm text-slate-800 placeholder:text-slate-400"
              placeholder="seu@email.com"
            />
          </div>

          {isSignUp && (
            <div className="animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1.5">
                Nome Completo
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 hover:border-slate-300 bg-white/70 backdrop-blur-sm text-slate-800 placeholder:text-slate-400"
                placeholder="Seu nome completo"
              />
            </div>
          )}

          <div className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
              Senha
            </label>
            <div className="relative group">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 pr-11 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 hover:border-slate-300 bg-white/70 backdrop-blur-sm text-slate-800 placeholder:text-slate-400"
                placeholder="••••••••"
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {isSignUp && (
            <div className="animate-fade-in-up" style={{ animationDelay: '0.25s' }}>
              <label htmlFor="department" className="block text-sm font-medium text-slate-700 mb-1.5">
                Departamento
              </label>
              <select
                id="department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                required
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 hover:border-slate-300 bg-white/70 backdrop-blur-sm text-slate-800 cursor-pointer"
              >
                <option value="" className="text-slate-400">Selecione um departamento</option>
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
            className="relative w-full py-3.5 px-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center font-semibold overflow-hidden group animate-fade-in-up shadow-lg shadow-blue-900/20 hover:shadow-xl hover:shadow-blue-900/30"
            style={{ animationDelay: '0.3s' }}
          >
            {/* Button gradient background */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-900 via-blue-700 to-indigo-800 transition-all duration-300 group-hover:scale-105"></div>
            
            {/* Shimmer effect on hover */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.15)_50%,transparent_75%)] bg-[length:250%_250%] animate-shimmer"></div>
            
            {/* Button content */}
            <span className="relative z-10 flex items-center text-white group-hover:text-blue-900 transition-colors duration-300">
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white group-hover:border-blue-900 border-t-transparent group-hover:border-t-transparent mr-2 transition-colors duration-300"></div>
                  {isSignUp ? 'Criando conta...' : 'Entrando...'}
                </>
              ) : (
                <>
                  {isSignUp ? <UserPlus className="w-4 h-4 mr-2" /> : <LogIn className="w-4 h-4 mr-2" />}
                  {isSignUp ? 'Criar Conta' : 'Entrar'}
                </>
              )}
            </span>
          </button>
          
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setName('');
              setError(null);
            }}
            className="text-blue-700 hover:text-blue-900 text-sm font-medium transition-colors hover:underline underline-offset-4"
          >
            {isSignUp 
              ? 'Já tem uma conta? Faça login' 
              : 'Não tem uma conta? Cadastre-se'
            }
          </button>
          {!isSignUp && !isForgotPassword && (
            <div className="mt-3 text-center">
              <button
                onClick={() => {
                  setIsForgotPassword(true);
                  setName('');
                  setError(null);
                }}
                className="text-slate-500 hover:text-blue-700 text-sm transition-colors"
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
            className="space-y-4 mt-4 animate-fade-in-up"
          >
            <p className="text-sm text-slate-600">Digite seu email para redefinir a senha.</p>
            <input
              id="emailres"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 hover:border-slate-300 bg-white/70 backdrop-blur-sm text-slate-800 placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={loading}
              className="relative w-full py-3 px-4 rounded-xl transition-all duration-300 font-semibold overflow-hidden group shadow-lg shadow-blue-900/20"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-900 via-blue-700 to-indigo-800"></div>
              <span className="relative z-10 text-white">{loading ? 'Enviando...' : 'Enviar instruções'}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsForgotPassword(false)}
              className="text-slate-500 hover:text-slate-700 text-sm transition-colors"
            >
              Voltar ao login
            </button>
          </form>
        )}
        </div>

        {isSignUp && (
          <div className="mt-5 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl text-slate-700 text-xs animate-fade-in-up">
            <strong className="text-blue-800">Nota:</strong> Após criar sua conta, você poderá acessar o nosso sistema de Compras e Estoque.
          </div>
        )}        
      </div>
    </div>
  );
};

export default Auth;