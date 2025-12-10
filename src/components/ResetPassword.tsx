import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';

const ResetPassword: React.FC = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Configurar sessão automaticamente ao entrar na página
  useEffect(() => {
    async function loadSession() {
      try {
        const hashParams = new URLSearchParams(window.location.hash.replace('#', '?'));
        const access_token = hashParams.get("access_token");
        const refresh_token = hashParams.get("refresh_token");

        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (error) console.error("Erro ao restaurar sessão:", error);
        }
      } catch (err) {
        console.error("Erro ao processar tokens:", err);
      }
    }

    loadSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    if (newPassword.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setError('Erro ao redefinir a senha. O link pode ter expirado.');
    } else {
      setSuccess(true);
      setTimeout(() => navigate('/'), 2500);
    }

    setLoading(false);
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
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Lock className="w-7 h-7 text-white" />
              </div>
            </div>
          </div>
          
          <h1 className="text-3xl font-bold mb-1">
            <span className="bg-gradient-to-r from-blue-900 via-blue-700 to-indigo-800 bg-clip-text text-transparent">
              Redefinir Senha
            </span>
          </h1>
          <p className="text-slate-500 text-sm">
            Digite sua nova senha abaixo
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm animate-shake flex items-center gap-2">
            <span className="flex-shrink-0 w-5 h-5 bg-red-100 rounded-full flex items-center justify-center text-red-500 font-bold text-xs">!</span>
            {error}
          </div>
        )}

        {success ? (
          <div className="text-center py-8 animate-fade-in-up">
            <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-500/30">
              <CheckCircle className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-slate-800 mb-2">Senha Redefinida!</h3>
            <p className="text-slate-500">Redirecionando para o login...</p>
            <div className="mt-4 flex justify-center">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Nova senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 pr-12 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 hover:border-slate-300 bg-white/70 backdrop-blur-sm text-slate-800 placeholder:text-slate-400"
                  placeholder="Mínimo 6 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Confirmar nova senha
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 pr-12 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 hover:border-slate-300 bg-white/70 backdrop-blur-sm text-slate-800 placeholder:text-slate-400"
                  placeholder="Repita a senha"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 group"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    <span>Redefinir Senha</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Link para voltar ao login */}
        {!success && (
          <div className="mt-6 text-center animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            <button
              onClick={() => navigate('/')}
              className="text-sm text-slate-500 hover:text-blue-600 transition-colors"
            >
              ← Voltar para o login
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
