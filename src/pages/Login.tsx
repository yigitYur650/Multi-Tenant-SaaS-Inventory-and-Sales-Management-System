import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, LogIn, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useTranslation } from 'react-i18next';

export const Login: React.FC = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      if (data.session) {
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || t('auth.login.error'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      setResetSent(true);
    } catch (err: any) {
      setError(err.message || t('auth.forgot.error'));
    } finally {
      setIsLoading(false);
    }
  };

  if (showForgot) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-900 relative overflow-hidden text-slate-100 font-sans">
        <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-blue-600/20 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="w-full max-w-md p-8 relative z-10">
          <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[32px] p-8 shadow-2xl">
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-black text-white mb-2 tracking-tight">{t('auth.forgot.title')}</h2>
              <p className="text-slate-400 text-sm font-medium">{t('auth.forgot.subtitle')}</p>
            </div>

            {resetSent ? (
              <div className="space-y-6 text-center">
                <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-sm font-bold">
                  {t('auth.forgot.success')}
                </div>
                <button 
                  onClick={() => setShowForgot(false)}
                  className="w-full py-4 bg-white text-slate-900 font-black rounded-2xl hover:bg-slate-100 transition-all"
                >
                  {t('auth.forgot.backToLogin')}
                </button>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-6">
                {error && (
                  <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-400 text-sm">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p className="font-bold">{error}</p>
                  </div>
                )}
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={20} />
                  <input
                    type="email" required value={resetEmail} onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 text-white placeholder-slate-500 text-sm rounded-2xl pl-11 pr-4 py-4 outline-none focus:border-blue-500/50 transition-all font-bold"
                    placeholder={t('auth.forgot.emailPlaceholder') || t('auth.login.emailPlaceholder')}
                  />
                </div>
                <button
                  type="submit" disabled={isLoading}
                  className="w-full bg-white text-slate-900 font-black py-4 rounded-2xl shadow-xl hover:shadow-white/10 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                   {isLoading ? t('auth.forgot.sending') : t('auth.forgot.sendButton')}
                </button>
                <button 
                  type="button" onClick={() => setShowForgot(false)}
                  className="w-full text-sm text-slate-400 font-bold hover:text-white transition-colors"
                >
                  {t('auth.login.backToLogin') || t('auth.forgot.backToLogin')}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-900 relative overflow-hidden text-slate-100 font-sans">
      {/* Arka plan efektleri */}
      <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-blue-600/30 blur-[120px] rounded-full pointer-events-none mix-blend-screen"></div>
      <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] bg-indigo-600/20 blur-[100px] rounded-full pointer-events-none mix-blend-screen"></div>

      {/* Glass Panel */}
      <div className="w-full max-w-md p-8 relative z-10">
        <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[32px] shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] p-8">
          
          <div className="mb-10 text-center">
            <div className="w-16 h-16 mx-auto bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-500/40 border border-white/20">
               <span className="font-bold text-3xl tracking-tight text-white">S</span>
            </div>
            <h1 className="text-3xl font-black text-white mb-2 tracking-tight">{t('auth.login.title')}</h1>
            <p className="text-slate-400 text-sm font-medium">{t('auth.login.subtitle')}</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-400 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="font-bold">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-blue-400 transition-colors">
                  <Mail size={20} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 text-white placeholder-slate-500 text-sm rounded-2xl pl-11 pr-4 py-4 outline-none focus:border-blue-500/50 focus:bg-blue-500/5 transition-all w-full font-bold"
                  placeholder={t('auth.login.emailPlaceholder')}
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-blue-400 transition-colors">
                    <Lock size={20} />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 text-white placeholder-slate-500 text-sm rounded-2xl pl-11 pr-4 py-4 outline-none focus:border-blue-500/50 focus:bg-blue-500/5 transition-all w-full font-bold"
                    placeholder={t('auth.login.passwordPlaceholder')}
                    required
                  />
                </div>
                <div className="flex justify-end px-1">
                   <button 
                     type="button" onClick={() => setShowForgot(true)}
                     className="text-xs font-bold text-slate-400 hover:text-white transition-colors"
                   >
                     {t('auth.login.forgotPassword')}
                   </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-white text-slate-900 font-black py-4 rounded-2xl shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:shadow-[0_0_25px_rgba(255,255,255,0.4)] hover:scale-[1.01] transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70 disabled:pointer-events-none"
            >
              {isLoading ? (
                <div className="w-5 h-5 rounded-full border-2 border-slate-400 border-t-slate-900 animate-spin"></div>
              ) : (
                <>
                  <LogIn size={20} />
                  {t('auth.login.button')}
                </>
              )}
            </button>
          </form>

          <div className="mt-10 text-center text-sm text-slate-400 font-medium">
            {t('auth.login.noAccount')}{' '}
            <Link to="/register" className="text-white font-black hover:text-blue-400 transition-colors">
              {t('auth.login.registerNow')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
