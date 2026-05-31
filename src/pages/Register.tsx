import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, UserPlus, Building2, User, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useTranslation } from 'react-i18next';

export const Register: React.FC = () => {
  const { t } = useTranslation();
  const [fullName, setFullName] = useState('');
  const [shopName, setShopName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // 1. Supabase Auth ile Kullanıcı Oluștur
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;

      if (authData.user) {
        // 2. RPC ile Shop ve Profile oluștur. (SECURITY DEFINER bypasses RLS)
        // NOT: Bu RPC fonksiyonunun Supabase'de tanımlanmıș olması gerekmektedir.
        const { error: rpcError } = await (supabase.rpc as any)('register_tenant', {
          p_shop_name: shopName,
          p_full_name: fullName
        });

        if (rpcError) {
          // Eger rpc cökerse, gercek bir senaryoda auth tablosundaki kullanicinin silinmesi tavsiye edilir,
          // ancak ögrenme projesi boyutunda error'u basip geciyoruz.
          throw new Error('Mağaza ve profil oluşturulamadı: ' + rpcError.message);
        }

        // Başarılı, anasayfaya yönlendir
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || t('auth.register.error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-900 relative overflow-hidden text-slate-100">
      {/* Arka plan efektleri */}
      <div className="absolute top-1/4 right-1/4 w-[600px] h-[600px] bg-rose-600/20 blur-[120px] rounded-full pointer-events-none mix-blend-screen"></div>
      <div className="absolute bottom-1/4 left-1/4 w-[500px] h-[500px] bg-purple-600/20 blur-[100px] rounded-full pointer-events-none mix-blend-screen"></div>

      {/* Glass Panel */}
      <div className="w-full max-w-md p-8 relative z-10">
        <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-3xl shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] p-8">
          
          <div className="mb-10 text-center">
             <div className="w-16 h-16 mx-auto bg-gradient-to-tr from-purple-600 to-rose-500 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-purple-500/40 border border-white/20">
               <span className="font-bold text-3xl tracking-tight text-white">S</span>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">{t('auth.register.title')}</h1>
            <p className="text-slate-400 text-sm">{t('auth.register.subtitle')}</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-5">
            {error && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-400 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <div className="space-y-4">
              
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-purple-400 transition-colors">
                  <User size={20} />
                </div>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 text-white placeholder-slate-500 text-sm rounded-2xl pl-11 pr-4 py-3.5 outline-none focus:border-purple-500/50 focus:bg-purple-500/5 transition-all"
                  placeholder={t('auth.register.fullNamePlaceholder')}
                  required
                />
              </div>

              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-purple-400 transition-colors">
                  <Building2 size={20} />
                </div>
                <input
                  type="text"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 text-white placeholder-slate-500 text-sm rounded-2xl pl-11 pr-4 py-3.5 outline-none focus:border-purple-500/50 focus:bg-purple-500/5 transition-all"
                  placeholder={t('auth.register.shopNamePlaceholder')}
                  required
                />
              </div>

              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-purple-400 transition-colors">
                  <Mail size={20} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 text-white placeholder-slate-500 text-sm rounded-2xl pl-11 pr-4 py-3.5 outline-none focus:border-purple-500/50 focus:bg-purple-500/5 transition-all"
                  placeholder={t('auth.register.emailPlaceholder')}
                  required
                />
              </div>

              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-purple-400 transition-colors">
                  <Lock size={20} />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 text-white placeholder-slate-500 text-sm rounded-2xl pl-11 pr-4 py-3.5 outline-none focus:border-purple-500/50 focus:bg-purple-500/5 transition-all"
                  placeholder={t('auth.register.passwordPlaceholder')}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-white text-slate-900 font-semibold py-3.5 rounded-2xl shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:shadow-[0_0_25px_rgba(255,255,255,0.4)] hover:scale-[1.02] transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70 disabled:pointer-events-none mt-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 rounded-full border-2 border-purple-400 border-t-slate-900 animate-spin"></div>
              ) : (
                <>
                  <UserPlus size={20} />
                  {t('auth.register.button')}
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-slate-400">
            {t('auth.register.hasAccount')}{' '}
            <Link to="/login" className="text-white font-medium hover:underline decoration-purple-500 underline-offset-4">
              {t('auth.register.loginNow')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
