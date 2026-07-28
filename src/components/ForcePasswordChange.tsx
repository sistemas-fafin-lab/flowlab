import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, LogOut, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

/**
 * Tela obrigatória de troca da senha temporária.
 *
 * Contas criadas pelo modal "Novo Usuário" nascem com uma senha aleatória que vai
 * só no e-mail de boas-vindas, e com `must_change_password: true` no user_metadata
 * (api/_lib/createUser.ts). O App usa essa flag como porteiro: enquanto ela estiver
 * de pé, nada do sistema é montado.
 *
 * A troca limpa a flag na mesma chamada de updateUser. Isso dispara USER_UPDATED,
 * o AuthContext atualiza o `user` e o porteiro no App.tsx deixa passar sozinho —
 * por isso aqui não há navegação nenhuma.
 *
 * Vale registrar o limite: user_metadata é gravável pelo próprio dono, então isto é
 * um controle de fluxo, não uma barreira de segurança. Serve para a pessoa não
 * continuar usando a senha que trafegou por e-mail, não para conter quem age de
 * má-fé com a própria conta.
 */
const ForcePasswordChange: React.FC = () => {
  const { userProfile, signOut } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass =
    'w-full px-4 py-3 pr-12 border border-slate-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 hover:border-slate-400 dark:hover:border-gray-500 bg-white dark:bg-gray-900/50 text-slate-800 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-400';
  const labelClass =
    'block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1.5';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
      data: { must_change_password: false },
    });

    if (updateError) {
      const msg = updateError.message || '';
      setError(
        /should be different|same as the old/i.test(msg)
          ? 'A nova senha precisa ser diferente da temporária.'
          : /at least|weak|short/i.test(msg)
            ? 'Senha muito curta ou fraca. Escolha outra.'
            : 'Não foi possível atualizar a senha. Tente novamente.',
      );
      setLoading(false);
      return;
    }

    // Sucesso: o USER_UPDATED derruba esta tela. Mantemos o loading para não
    // piscar o formulário habilitado no intervalo.
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-gradient-to-r from-blue-200/50 to-cyan-200/50 dark:from-blue-900/30 dark:to-cyan-900/30 rounded-full blur-3xl animate-blob"></div>
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-gradient-to-r from-indigo-200/50 to-blue-200/50 dark:from-indigo-900/30 dark:to-blue-900/30 rounded-full blur-3xl animate-blob animation-delay-2000"></div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(30,58,138,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(30,58,138,0.03)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(59,130,246,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.05)_1px,transparent_1px)] bg-[size:64px_64px]"></div>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="max-w-md w-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-2xl rounded-3xl shadow-2xl shadow-slate-900/10 dark:shadow-black/30 p-8 relative z-10 border border-slate-200/50 dark:border-gray-600/50"
      >
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30 mb-4">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold mb-1.5">
            <span className="bg-gradient-to-r from-blue-900 via-blue-700 to-indigo-800 dark:from-white dark:via-gray-100 dark:to-white bg-clip-text text-transparent">
              Defina sua senha
            </span>
          </h1>
          <p className="text-slate-500 dark:text-gray-400 text-sm leading-relaxed">
            {userProfile?.name ? `Olá, ${userProfile.name.split(' ')[0]}. ` : ''}
            Você entrou com a senha temporária que enviamos por e-mail. Escolha uma
            senha só sua para continuar.
          </p>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-sm flex items-center gap-2"
          >
            <span className="flex-shrink-0 w-5 h-5 bg-red-100 dark:bg-red-800 rounded-full flex items-center justify-center text-red-500 dark:text-red-300 font-bold text-xs">
              !
            </span>
            {error}
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="fpc-new" className={labelClass}>Nova senha</label>
            <div className="relative">
              <input
                id="fpc-new"
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                autoFocus
                className={inputClass}
                placeholder="Mínimo 6 caracteres"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-400 hover:text-slate-600 dark:hover:text-gray-200 transition-colors p-1"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="fpc-confirm" className={labelClass}>Confirmar nova senha</label>
            <div className="relative">
              <input
                id="fpc-confirm"
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className={inputClass}
                placeholder="Repita a senha"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-400 hover:text-slate-600 dark:hover:text-gray-200 transition-colors p-1"
                aria-label={showConfirm ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

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
                <span>Salvar e entrar</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => signOut()}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default ForcePasswordChange;
