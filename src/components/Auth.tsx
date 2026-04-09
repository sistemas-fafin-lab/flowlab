import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, UserPlus, Eye, EyeOff, Sun, Moon, Package, History, FileText, Building2, Calculator, Receipt, LayoutDashboard, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { DEPARTMENTS } from "../utils/permissions";

const MODULES = [
  { icon: LayoutDashboard, title: 'Dashboard', description: 'Visão geral com indicadores, gráficos e métricas em tempo real do seu negócio.' },
  { icon: Package, title: 'Estoque', description: 'Controle completo de produtos, lotes, validades e movimentações de inventário.' },
  { icon: FileText, title: 'Solicitações', description: 'Hub centralizado para compras, pagamentos e manutenções com fluxo de aprovação.' },
  { icon: Building2, title: 'Fornecedores', description: 'Cadastro e gestão de fornecedores com histórico de negociações e avaliações.' },
  { icon: Calculator, title: 'Cotações', description: 'Compare propostas de fornecedores lado a lado e aprove com agilidade.' },
  { icon: Receipt, title: 'Faturamento', description: 'Emissão de notas, contas a receber, glosas e acompanhamento financeiro.' },
  { icon: History, title: 'Movimentações', description: 'Rastreio de entradas, saídas e transferências de estoque em tempo real.' },
];

const formVariants = {
  enter: { x: 20, opacity: 0 },
  center: { x: 0, opacity: 1 },
  exit: { x: -20, opacity: 0 },
};

const springTransition = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 30,
};

const Auth: React.FC = () => {
  const { signIn, signUp, resetPassword } = useAuth();
  const [formView, setFormView] = useState<'login' | 'register' | 'forgot'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [department, setDepartment] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => document.documentElement.classList.contains('dark'));
  const [activeSlide, setActiveSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');

  const goToSlide = useCallback((index: number, direction?: 'left' | 'right') => {
    setSlideDirection(direction || (index > activeSlide ? 'right' : 'left'));
    setActiveSlide(index);
  }, [activeSlide]);

  const nextSlide = useCallback(() => {
    goToSlide((activeSlide + 1) % MODULES.length, 'right');
  }, [activeSlide, goToSlide]);

  const prevSlide = useCallback(() => {
    goToSlide((activeSlide - 1 + MODULES.length) % MODULES.length, 'left');
  }, [activeSlide, goToSlide]);

  useEffect(() => {
    if (!isAutoPlaying) return;
    const timer = setInterval(nextSlide, 4500);
    return () => clearInterval(timer);
  }, [isAutoPlaying, nextSlide]);

  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    document.documentElement.classList.toggle('dark', newMode);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (formView === 'forgot') {
        const { error } = await resetPassword(email);
        if (error) {
          setError('Erro ao enviar email de recuperação.');
        } else {
          alert('Instruções de redefinição enviadas para seu email.');
          setFormView('login');
        }
      } else {
        const { error } = formView === 'register'
          ? await signUp(email, password, name, department)
          : await signIn(email, password);

        if (error) {
          let userFriendlyMessage = error.message;

          if (error.message.includes('Invalid login credentials')) {
            userFriendlyMessage = formView === 'register'
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
      }
    } catch (err) {
      setError('Ocorreu um erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex w-full">
      {/* ====== LADO ESQUERDO — Branding / Visual (hidden no mobile) ====== */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950 flex-col items-center justify-center p-10">
        {/* Animated orbs */}
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-gradient-to-r from-blue-200/50 to-cyan-200/50 dark:from-blue-500/20 dark:to-cyan-500/20 rounded-full blur-3xl animate-blob"></div>
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-gradient-to-r from-indigo-200/50 to-blue-200/50 dark:from-indigo-500/20 dark:to-blue-500/20 rounded-full blur-3xl animate-blob animation-delay-2000"></div>
        <div className="absolute top-2/3 left-1/4 w-72 h-72 bg-gradient-to-r from-cyan-200/30 to-blue-300/30 dark:from-cyan-500/15 dark:to-blue-500/15 rounded-full blur-3xl animate-blob animation-delay-4000"></div>

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px]"></div>

        {/* ── Main branding card (expanded) ── */}
        <div className="relative z-10 flex flex-col items-center gap-6 w-full max-w-lg px-12 py-14 bg-white/10 dark:bg-white/5 backdrop-blur-xl rounded-3xl border border-white/20 dark:border-white/10 shadow-2xl animate-fade-in">
          {/* Glow behind main card */}
          <div className="absolute -inset-2 bg-gradient-to-r from-blue-500/20 via-indigo-500/15 to-cyan-500/20 rounded-3xl blur-2xl -z-10 animate-pulse-soft"></div>

          {/* Logo com borda rotativa */}
          <div className="relative inline-flex items-center justify-center">
            <div
              className="absolute w-32 h-32 rounded-full border-2 border-transparent animate-spin-slow"
              style={{
                background: 'linear-gradient(rgba(255,255,255,0.1), rgba(255,255,255,0.1)) padding-box, linear-gradient(to right, #1e3a8a, #3b82f6, #1e40af) border-box',
                animationDuration: '8s',
              }}
            />
            <div className="relative w-28 h-28 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-lg shadow-blue-900/20">
              <img
                src="/LOGO BRANCA.png"
                alt="Logo Flow LAB"
                className="w-20 h-20 object-contain hover:scale-110 transition-all duration-500 ease-out"
              />
            </div>
          </div>

          <div className="text-center space-y-3">
            <h2 className="text-4xl font-bold text-white tracking-tight">Flow LAB</h2>
            <p className="text-blue-200/80 text-base max-w-sm leading-relaxed">
              Plataforma integrada de gestão para compras, estoque, faturamento e operações.
            </p>
          </div>

          {/* Divider line */}
          <div className="w-24 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"></div>

          {/* Module count badge */}
          <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full border border-white/15">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse-soft"></div>
            <span className="text-blue-100/90 text-xs font-medium">{MODULES.length} módulos integrados</span>
          </div>
        </div>

        {/* ── Module carousel ── */}
        <div
          className="relative z-10 w-full max-w-lg mt-8"
          onMouseEnter={() => setIsAutoPlaying(false)}
          onMouseLeave={() => setIsAutoPlaying(true)}
        >
          {/* Carousel viewport */}
          <div className="relative overflow-hidden rounded-2xl" style={{ minHeight: '140px' }}>
            {MODULES.map((mod, index) => {
              const Icon = mod.icon;
              const isActive = index === activeSlide;
              return (
                <div
                  key={mod.title}
                  className={`absolute inset-0 flex items-stretch transition-all duration-500 ease-out ${
                    isActive
                      ? 'opacity-100 translate-x-0 scale-100'
                      : slideDirection === 'right'
                        ? 'opacity-0 translate-x-8 scale-95 pointer-events-none'
                        : 'opacity-0 -translate-x-8 scale-95 pointer-events-none'
                  }`}
                >
                  <div className="w-full p-6 bg-white/[0.08] dark:bg-white/[0.04] backdrop-blur-lg rounded-2xl border border-white/15 dark:border-white/10 shadow-lg card-interactive cursor-default group">
                    <div className="flex items-start gap-5">
                      <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400/30 to-indigo-400/30 border border-white/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                        <Icon className="w-6 h-6 text-blue-200" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold text-base mb-1.5 group-hover:text-blue-200 transition-colors duration-300">{mod.title}</h3>
                        <p className="text-blue-200/70 text-sm leading-relaxed">{mod.description}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between mt-5">
            <button
              onClick={prevSlide}
              className="p-2 rounded-xl bg-white/10 border border-white/15 text-white/70 hover:bg-white/20 hover:text-white transition-all duration-200 hover:scale-105 active:scale-95"
              aria-label="Módulo anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Dot indicators */}
            <div className="flex gap-2">
              {MODULES.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToSlide(index)}
                  className={`rounded-full transition-all duration-300 ${
                    index === activeSlide
                      ? 'w-6 h-2 bg-blue-400'
                      : 'w-2 h-2 bg-white/30 hover:bg-white/50'
                  }`}
                  aria-label={`Ir para módulo ${index + 1}`}
                />
              ))}
            </div>

            <button
              onClick={nextSlide}
              className="p-2 rounded-xl bg-white/10 border border-white/15 text-white/70 hover:bg-white/20 hover:text-white transition-all duration-200 hover:scale-105 active:scale-95"
              aria-label="Próximo módulo"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ====== LADO DIREITO — Formulário ====== */}
      <div className="w-full lg:w-[55%] bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 flex items-center justify-center p-4 sm:p-8 relative overflow-hidden transition-colors duration-300">
        {/* Background orbs visíveis apenas no mobile (onde o lado esquerdo está oculto) */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none lg:hidden">
          <div className="absolute top-1/4 -left-20 w-96 h-96 bg-gradient-to-r from-blue-200/50 to-cyan-200/50 dark:from-blue-900/30 dark:to-cyan-900/30 rounded-full blur-3xl animate-blob"></div>
          <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-gradient-to-r from-indigo-200/50 to-blue-200/50 dark:from-indigo-900/30 dark:to-blue-900/30 rounded-full blur-3xl animate-blob animation-delay-2000"></div>
        </div>

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(30,58,138,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(30,58,138,0.03)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(59,130,246,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.05)_1px,transparent_1px)] bg-[size:64px_64px]"></div>

        {/* Card do formulário com Glassmorphism */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-2xl rounded-3xl shadow-2xl shadow-slate-800/[0.15] dark:shadow-black/40 pt-12 px-8 pb-8 border border-slate-200/50 dark:border-gray-600/50 w-full max-w-md relative z-10"
        >
          {/* Subtle glow effect behind card */}
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/[0.15] via-indigo-500/[0.12] to-slate-500/[0.08] dark:from-blue-500/10 dark:via-indigo-500/10 dark:to-slate-500/10 rounded-3xl blur-xl -z-10"></div>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="absolute top-4 right-4 p-2 rounded-xl bg-slate-100/80 dark:bg-gray-700/80 hover:bg-slate-200 dark:hover:bg-gray-600 transition-all duration-200 text-slate-600 dark:text-gray-300 z-20"
            aria-label="Alternar tema"
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Mobile logo — always visible on mobile */}
          <div className="text-center mb-6 lg:hidden">
            <div className="relative inline-flex items-center justify-center mb-4">
              <div
                className="absolute w-28 h-28 rounded-full border-2 border-transparent animate-spin-slow"
                style={{
                  background: 'linear-gradient(white, white) padding-box, linear-gradient(to right, #1e3a8a, #3b82f6, #1e40af) border-box',
                  animationDuration: '8s',
                }}
              />
              <div className="relative w-24 h-24 rounded-full bg-white dark:bg-gray-700 backdrop-blur-md border border-slate-200 dark:border-gray-600 flex items-center justify-center shadow-lg shadow-blue-900/10 dark:shadow-black/20">
                <img
                  src={isDarkMode ? "/LOGO BRANCA.png" : "/LOGO.png"}
                  alt="Logo"
                  className="w-16 h-16 object-contain hover:scale-110 transition-all duration-500 ease-out dark:brightness-110"
                />
              </div>
            </div>
          </div>

          {/* ── Animated form area ── */}
          <AnimatePresence mode="wait" initial={false}>
            {/* ════════ LOGIN ════════ */}
            {formView === 'login' && (
              <motion.div
                key="login"
                variants={formVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={springTransition}
              >
                <div className="text-center mb-8">
                  <h1 className="text-3xl font-bold mb-1">
                    <span className="bg-gradient-to-r from-blue-900 via-blue-700 to-indigo-800 dark:from-white dark:via-gray-100 dark:to-white bg-clip-text text-transparent">
                      Bem-vindo
                    </span>
                  </h1>
                  <p className="text-slate-500 dark:text-gray-300 text-sm">
                    Faça login para continuar no Flow LAB
                  </p>
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-sm flex items-center gap-2"
                    >
                      <span className="flex-shrink-0 w-5 h-5 bg-red-100 dark:bg-red-800 rounded-full flex items-center justify-center text-red-500 dark:text-red-300 font-bold text-xs">!</span>
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label htmlFor="login-email" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1.5">
                      Email
                    </label>
                    <input
                      type="email"
                      id="login-email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full px-4 py-3 border border-slate-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 hover:border-slate-400 dark:hover:border-gray-500 bg-white dark:bg-gray-900/50 backdrop-blur-sm text-slate-800 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-400"
                      placeholder="seu@email.com"
                    />
                  </div>

                  <div>
                    <label htmlFor="login-password" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1.5">
                      Senha
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        id="login-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full px-4 py-3 pr-11 border border-slate-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 hover:border-slate-400 dark:hover:border-gray-500 bg-white dark:bg-gray-900/50 backdrop-blur-sm text-slate-800 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-400"
                        placeholder="••••••••"
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-gray-400 hover:text-slate-600 dark:hover:text-gray-200 transition-colors p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-xl shadow-md shadow-blue-500/25 dark:shadow-blue-500/15 hover:from-blue-600 hover:to-blue-700 hover:shadow-lg hover:shadow-blue-500/30 dark:hover:shadow-blue-500/20 transition-all duration-200 hover-lift disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                        Entrando...
                      </>
                    ) : (
                      <>
                        <LogIn className="w-4 h-4 mr-2" />
                        Entrar
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-8 text-center space-y-4">
                  <button
                    onClick={() => { setFormView('register'); setError(null); }}
                    className="text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 text-sm font-medium transition-colors hover:underline underline-offset-4"
                  >
                    Não tem uma conta? Cadastre-se
                  </button>
                  <div className="text-center">
                    <button
                      onClick={() => { setFormView('forgot'); setError(null); }}
                      className="text-slate-500 dark:text-gray-300 hover:text-blue-700 dark:hover:text-blue-400 text-sm transition-colors"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ════════ REGISTER ════════ */}
            {formView === 'register' && (
              <motion.div
                key="register"
                variants={formVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={springTransition}
              >
                <div className="text-center mb-8">
                  <h1 className="text-3xl font-bold mb-1">
                    <span className="bg-gradient-to-r from-blue-900 via-blue-700 to-indigo-800 dark:from-white dark:via-gray-100 dark:to-white bg-clip-text text-transparent">
                      Criar Conta
                    </span>
                  </h1>
                  <p className="text-slate-500 dark:text-gray-300 text-sm">
                    Preencha os dados para se cadastrar
                  </p>
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-sm flex items-center gap-2"
                    >
                      <span className="flex-shrink-0 w-5 h-5 bg-red-100 dark:bg-red-800 rounded-full flex items-center justify-center text-red-500 dark:text-red-300 font-bold text-xs">!</span>
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label htmlFor="reg-email" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1.5">
                      Email
                    </label>
                    <input
                      type="email"
                      id="reg-email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full px-4 py-3 border border-slate-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 hover:border-slate-400 dark:hover:border-gray-500 bg-white dark:bg-gray-900/50 backdrop-blur-sm text-slate-800 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-400"
                      placeholder="seu@email.com"
                    />
                  </div>

                  <div>
                    <label htmlFor="reg-name" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1.5">
                      Nome Completo
                    </label>
                    <input
                      type="text"
                      id="reg-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="w-full px-4 py-3 border border-slate-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 hover:border-slate-400 dark:hover:border-gray-500 bg-white dark:bg-gray-900/50 backdrop-blur-sm text-slate-800 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-400"
                      placeholder="Seu nome completo"
                    />
                  </div>

                  <div>
                    <label htmlFor="reg-password" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1.5">
                      Senha
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        id="reg-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full px-4 py-3 pr-11 border border-slate-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 hover:border-slate-400 dark:hover:border-gray-500 bg-white dark:bg-gray-900/50 backdrop-blur-sm text-slate-800 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-400"
                        placeholder="••••••••"
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-gray-400 hover:text-slate-600 dark:hover:text-gray-200 transition-colors p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="reg-department" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1.5">
                      Departamento
                    </label>
                    <select
                      id="reg-department"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      required
                      className="w-full px-4 py-3 border border-slate-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 hover:border-slate-400 dark:hover:border-gray-500 bg-white dark:bg-gray-900/50 backdrop-blur-sm text-slate-800 dark:text-gray-100 cursor-pointer"
                    >
                      <option value="" className="text-slate-400 dark:text-gray-400">Selecione um departamento</option>
                      {DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-xl shadow-md shadow-blue-500/25 dark:shadow-blue-500/15 hover:from-blue-600 hover:to-blue-700 hover:shadow-lg hover:shadow-blue-500/30 dark:hover:shadow-blue-500/20 transition-all duration-200 hover-lift disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                        Criando conta...
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Criar Conta
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-8 text-center">
                  <button
                    onClick={() => { setFormView('login'); setName(''); setError(null); }}
                    className="text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 text-sm font-medium transition-colors hover:underline underline-offset-4"
                  >
                    Já tem uma conta? Faça login
                  </button>
                </div>

                <div className="mt-5 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border border-blue-200 dark:border-blue-800 rounded-xl text-slate-700 dark:text-gray-300 text-xs">
                  <strong className="text-blue-800 dark:text-blue-400">Nota:</strong> Após criar sua conta, você poderá acessar o nosso sistema de Compras e Estoque.
                </div>
              </motion.div>
            )}

            {/* ════════ FORGOT PASSWORD ════════ */}
            {formView === 'forgot' && (
              <motion.div
                key="forgot"
                variants={formVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={springTransition}
              >
                <div className="text-center mb-8">
                  <h1 className="text-3xl font-bold mb-1">
                    <span className="bg-gradient-to-r from-blue-900 via-blue-700 to-indigo-800 dark:from-white dark:via-gray-100 dark:to-white bg-clip-text text-transparent">
                      Recuperar Senha
                    </span>
                  </h1>
                  <p className="text-slate-500 dark:text-gray-300 text-sm">
                    Digite seu email para redefinir a senha
                  </p>
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-sm flex items-center gap-2"
                    >
                      <span className="flex-shrink-0 w-5 h-5 bg-red-100 dark:bg-red-800 rounded-full flex items-center justify-center text-red-500 dark:text-red-300 font-bold text-xs">!</span>
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label htmlFor="forgot-email" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1.5">
                      Email
                    </label>
                    <input
                      type="email"
                      id="forgot-email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full px-4 py-3 border border-slate-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 hover:border-slate-400 dark:hover:border-gray-500 bg-white dark:bg-gray-900/50 backdrop-blur-sm text-slate-800 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-400"
                      placeholder="seu@email.com"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-xl shadow-md shadow-blue-500/25 dark:shadow-blue-500/15 hover:from-blue-600 hover:to-blue-700 hover:shadow-lg hover:shadow-blue-500/30 dark:hover:shadow-blue-500/20 transition-all duration-200 hover-lift disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                        Enviando...
                      </>
                    ) : (
                      'Enviar instruções'
                    )}
                  </button>
                </form>

                <div className="mt-8 text-center">
                  <button
                    onClick={() => { setFormView('login'); setError(null); }}
                    className="text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 text-sm font-medium transition-colors hover:underline underline-offset-4"
                  >
                    Voltar ao login
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;