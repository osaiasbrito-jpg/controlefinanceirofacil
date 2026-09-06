import React, { useState } from 'react';
import {
  ShieldCheck,
  TrendingUp,
  CreditCard,
  Layers,
  BarChart3,
  Lock,
  Mail,
  User,
  Phone,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  KeyRound,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginView: React.FC = () => {
  const {
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
    loading,
    error,
    clearError,
    gatewaySettings,
  } = useAuth();

  const [activeMode, setActiveMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formFeedback, setFormFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleModeChange = (mode: 'login' | 'register' | 'forgot') => {
    setActiveMode(mode);
    setFormFeedback(null);
    clearError();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setFormFeedback({ type: 'error', message: 'Por favor, preencha o e-mail e a senha.' });
      return;
    }

    setSubmitting(true);
    setFormFeedback(null);
    try {
      await signInWithEmail(email, password);
    } catch (err: any) {
      setFormFeedback({
        type: 'error',
        message: err.message || 'E-mail ou senha incorretos. Verifique suas credenciais.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !name) {
      setFormFeedback({ type: 'error', message: 'Por favor, preencha nome, e-mail e senha.' });
      return;
    }

    if (password.length < 6) {
      setFormFeedback({ type: 'error', message: 'A senha deve ter pelo menos 6 caracteres.' });
      return;
    }

    setSubmitting(true);
    setFormFeedback(null);
    try {
      await signUpWithEmail(email, password, name, phone);
      setFormFeedback({
        type: 'success',
        message: 'Conta criada com sucesso! Seus 30 dias de teste grátis foram ativados.',
      });
    } catch (err: any) {
      setFormFeedback({
        type: 'error',
        message: err.message || 'Erro ao criar conta. Tente novamente ou use outro e-mail.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setFormFeedback({ type: 'error', message: 'Informe seu e-mail para receber as instruções de recuperação.' });
      return;
    }

    setSubmitting(true);
    setFormFeedback(null);
    try {
      await resetPassword(email);
      setFormFeedback({
        type: 'success',
        message: 'E-mail de redefinição enviado! Verifique sua caixa de entrada e spam.',
      });
    } catch (err: any) {
      setFormFeedback({
        type: 'error',
        message: 'Não foi possível enviar o e-mail de recuperação. Verifique o endereço.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950/5 flex items-center justify-center p-3 sm:p-6 lg:p-8">
      <div className="max-w-4xl w-full bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[640px]">
        {/* Left Side: Brand, Highlights & 30-Day Free Trial Notice */}
        <div className="lg:col-span-5 bg-linear-to-br from-emerald-900 via-slate-900 to-slate-950 p-6 sm:p-8 text-white flex flex-col justify-between relative overflow-hidden">
          {/* Subtle Ambient Glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div>
            {/* Logo */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 bg-emerald-500 rounded-2xl flex items-center justify-center text-slate-950 font-black text-2xl shadow-lg shadow-emerald-950/50">
                M
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-white text-base tracking-tight leading-tight">
                  Meu Controle
                </span>
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                  Financeiro
                </span>
              </div>
            </div>

            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mb-2 leading-tight">
              Gestão financeira completa, simples e sem complicações.
            </h1>
            <p className="text-slate-300 text-xs leading-relaxed mb-6">
              Controle seu salário, rendas extras, parcelamentos futuros, cartões de crédito e relatórios com total clareza.
            </p>

            {/* Trial Guarantee Card */}
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl mb-6">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs mb-1">
                <Clock className="w-4 h-4" />
                <span>30 Dias de Teste Grátis</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-snug">
                Cadastre-se com seu Gmail/e-mail e aproveite acesso total para testar sem restrições durante 30 dias.
              </p>
            </div>

            {/* Feature Highlights */}
            <div className="space-y-3 text-xs text-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-3.5 h-3.5" />
                </div>
                <span className="text-[11px]">Salário base e receitas extras automáticos</span>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <CreditCard className="w-3.5 h-3.5" />
                </div>
                <span className="text-[11px]">Gestão de limites e faturas por cartão</span>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Layers className="w-3.5 h-3.5" />
                </div>
                <span className="text-[11px]">Distribuição inteligente de compras parceladas</span>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <BarChart3 className="w-3.5 h-3.5" />
                </div>
                <span className="text-[11px]">Gráficos visuais e relatórios de fluxo de caixa</span>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-white/10 flex items-center gap-2 text-[10px] text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Dados isolados na nuvem e protegidos por criptografia.</span>
          </div>
        </div>

        {/* Right Side: Interactive Login / Register / Request Form */}
        <div className="lg:col-span-7 p-6 sm:p-8 lg:p-10 flex flex-col justify-between bg-white">
          <div>
            {/* Top Navigation Tabs */}
            <div className="flex items-center p-1 bg-slate-100 rounded-2xl mb-6">
              <button
                type="button"
                onClick={() => handleModeChange('login')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                  activeMode === 'login'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Entrar com Senha
              </button>

              <button
                type="button"
                onClick={() => handleModeChange('register')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                  activeMode === 'register'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Criar Conta & Testar
              </button>
            </div>

            {/* Error / Feedback Banner */}
            {(formFeedback || error) && (
              <div
                className={`mb-5 p-3.5 rounded-2xl text-xs flex items-start gap-2.5 ${
                  formFeedback?.type === 'success'
                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                    : 'bg-rose-50 text-rose-900 border border-rose-200'
                }`}
              >
                {formFeedback?.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <span className="font-medium">{formFeedback?.message || error}</span>
              </div>
            )}

            {/* MODE: LOGIN */}
            {activeMode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">
                    Acesse sua conta
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Digite seu e-mail do Gmail ou cadastrado e sua senha de acesso.
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      E-mail (Gmail)
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="seuemail@gmail.com"
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        Senha
                      </label>
                      <button
                        type="button"
                        onClick={() => handleModeChange('forgot')}
                        className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700"
                      >
                        Esqueceu a senha?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Sua senha secreta"
                        className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || submitting}
                  className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Entrar no Sistema</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* MODE: REGISTER & REQUEST ACCESS */}
            {activeMode === 'register' && (
              <form onSubmit={handleRegister} className="space-y-3.5">
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">
                    Criar conta & Solicitar Acesso
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Preencha seus dados para receber 30 dias de acesso gratuito para testar.
                  </p>
                </div>

                <div className="space-y-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Nome Completo
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ex: João da Silva"
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      E-mail do Gmail
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="seuemail@gmail.com"
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Definir Senha (mínimo 6 caracteres)
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Crie sua senha segura"
                        className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Telefone / WhatsApp (Opcional)
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="(11) 99999-9999"
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || submitting}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-emerald-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Criar Conta e Iniciar 30 Dias Grátis</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* MODE: FORGOT PASSWORD */}
            {activeMode === 'forgot' && (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">
                    Recuperar senha
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Digite seu e-mail cadastrado e enviaremos um link para criar uma nova senha.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    E-mail Cadastrado
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seuemail@gmail.com"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleModeChange('login')}
                    className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                  >
                    Voltar ao Login
                  </button>

                  <button
                    type="submit"
                    disabled={loading || submitting}
                    className="flex-2 py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl"
                  >
                    {submitting ? 'Enviando...' : 'Enviar Link de Redefinição'}
                  </button>
                </div>
              </form>
            )}

            {/* Divider */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-[10px] font-bold text-slate-400 uppercase">ou conecte-se com</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            {/* Alternative One-Click Logins */}
            <div className="w-full">
              {/* Google Sign In Button */}
              <button
                type="button"
                onClick={() => signInWithGoogle()}
                disabled={loading}
                className="w-full py-3 px-4 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 shadow-xs flex items-center justify-center gap-3 transition-all hover:shadow-md cursor-pointer disabled:opacity-50"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.97 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>Entrar com Conta do Google (Gmail)</span>
              </button>
            </div>
          </div>

          <div className="mt-6 pt-3 border-t border-slate-100 text-center">
            <p className="text-[10px] text-slate-400">
              Taxa de liberação definitiva por tempo indeterminado:{' '}
              <strong className="text-slate-700">R$ {gatewaySettings.lifetimePrice.toFixed(2)}</strong> (apenas após o teste de 30 dias ou quando desejar).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
