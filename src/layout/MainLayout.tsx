import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Package, ShoppingCart, BarChart2, LogOut, Shield, ShieldAlert, Wifi, WifiOff, User, Key } from 'lucide-react';
import { useRole } from '../components/RoleContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { PasswordUpdateModal } from '../components/PasswordUpdateModal';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { GlobalSyncIndicator } from '../components/GlobalSyncIndicator';
import { storageQuotaMonitor } from '../services/StorageQuotaMonitor';
import { useToast } from '../context/ToastContext';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { role, isAdmin } = useRole();
  const { profile, signOut, isRecovering, setRecovering } = useAuth();
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  useEffect(() => {
    const checkConnection = async () => {
      if (import.meta.env.VITE_APP_MODE === 'sandbox') {
        setIsConnected(false); 
        return;
      }
      
      try {
        const { error } = await supabase.from('shops').select('id').limit(1);
        if (error) throw error;
        setIsConnected(true);
      } catch (err) {
        setIsConnected(false);
      }
    };
    
    checkConnection();
  }, []);

  const { t } = useTranslation();
  const { addToast } = useToast();

  useEffect(() => {
    const unsubscribe = storageQuotaMonitor.start((estimate) => {
      addToast(
        t('layout.storage.warning_message', { percentage: estimate.percentage.toFixed(1) }),
        'warning'
      );
    });
    return () => {
      unsubscribe();
    };
  }, [addToast, t]);

  useEffect(() => {
    const handleRollback = (e: Event) => {
      const customEvent = e as CustomEvent;
      const msg = customEvent.detail?.message || 'Transaction failed and rolled back.';
      addToast(msg, 'error');
    };
    window.addEventListener('sync_rollback', handleRollback);
    return () => {
      window.removeEventListener('sync_rollback', handleRollback);
    };
  }, [addToast]);

  const menuItems = [
    { icon: LayoutDashboard, label: t('menu.dashboard'), path: '/' },
    { icon: Package, label: t('menu.inventory'), path: '/inventory' },
    { icon: ShoppingCart, label: t('menu.sales'), path: '/sales' },
    { icon: BarChart2, label: t('menu.reports'), path: '/reports' },
    ...(isAdmin ? [
      { icon: Shield, label: t('menu.admin'), path: '/admin' },
      { icon: ShieldAlert, label: t('menu.reviewQueue'), path: '/admin/review-queue' }
    ] : []),
  ];

  return (
    <div className="flex h-screen w-full bg-slate-900 overflow-hidden text-slate-100 font-sans">
      {/* Sidebar - Apple/Premium Feel */}
      <aside className="w-64 flex flex-col bg-slate-900/40 backdrop-blur-3xl border-r border-white/10 shadow-[8px_0_30px_rgb(0,0,0,0.15)] z-20 relative">
        <div className="absolute top-0 left-0 w-full h-32 bg-blue-500/10 blur-[50px] -z-10 rounded-full mix-blend-screen pointer-events-none"></div>
        
        <div className="p-8 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/40 border border-white/10">
              S
            </div>
            <span className="font-bold text-xl tracking-tight text-white/95">SaaS ERP</span>
          </div>
          
          <div className="flex items-center" title={isConnected ? t('layout.connection.success') : isConnected === false ? t('layout.connection.error') : t('layout.connection.connecting')}>
            {isConnected === true && <Wifi size={18} className="text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]" />}
            {isConnected === false && <WifiOff size={18} className="text-rose-400 drop-shadow-[0_0_8px_rgba(251,113,133,0.8)]" />}
            {isConnected === null && <div className="w-4 h-4 rounded-full border-2 border-slate-400 border-t-white animate-spin"></div>}
          </div>
        </div>

        {profile && (
          <div className="px-5 mb-4 mt-2">
            <div className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                <User size={16} />
              </div>
              <div className="flex-1 truncate">
                <span className="text-sm font-semibold text-slate-200 truncate block">{profile.full_name}</span>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">{t(`roles.${role}`)}</span>
              </div>
            </div>
          </div>
        )}
        
        <div className="flex-1 px-5 py-2 space-y-2 overflow-y-auto custom-scrollbar text-sm">
          {menuItems.map((item, idx) => {
            // Dinamik Renk Belirleme (Contextual Theming)
            const getColors = (isActive: boolean) => {
              if (!isActive) return {
                bg: 'hover:bg-white/5',
                text: 'text-slate-400 hover:text-slate-100',
                icon: 'group-hover:text-slate-200',
                border: 'border-transparent',
                accent: ''
              };

              // Sayfa bazlı renk şemaları
              switch (item.path) {
                case '/': // Dashboard
                  return {
                    bg: 'bg-blue-500/10',
                    text: 'text-blue-400',
                    icon: 'text-blue-400',
                    border: 'border-blue-500/20',
                    accent: 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]'
                  };
                case '/inventory':
                  return {
                    bg: 'bg-amber-500/10',
                    text: 'text-amber-400',
                    icon: 'text-amber-400',
                    border: 'border-amber-500/20',
                    accent: 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]'
                  };
                case '/sales':
                  return {
                    bg: 'bg-emerald-500/10',
                    text: 'text-emerald-400',
                    icon: 'text-emerald-400',
                    border: 'border-emerald-500/20',
                    accent: 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]'
                  };
                case '/reports':
                  return {
                    bg: 'bg-purple-500/10',
                    text: 'text-purple-400',
                    icon: 'text-purple-400',
                    border: 'border-purple-500/20',
                    accent: 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.8)]'
                  };
                case '/admin':
                  return {
                    bg: 'bg-teal-500/10',
                    text: 'text-teal-400',
                    icon: 'text-teal-400',
                    border: 'border-teal-500/20',
                    accent: 'bg-teal-500 shadow-[0_0_10px_rgba(20,184,166,0.8)]'
                  };
                case '/admin/review-queue':
                  return {
                    bg: 'bg-orange-500/10',
                    text: 'text-orange-400',
                    icon: 'text-orange-400',
                    border: 'border-orange-500/20',
                    accent: 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)]'
                  };
                default:
                  return {
                    bg: 'bg-white/10',
                    text: 'text-white',
                    icon: 'text-blue-400',
                    border: 'border-white/10',
                    accent: 'bg-blue-500'
                  }
              }
            };

            return (
              <NavLink
                key={idx}
                to={item.path}
                className={({ isActive }) => {
                  const colors = getColors(isActive);
                  return `w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 group relative overflow-hidden border ${colors.bg} ${colors.text} ${colors.border}`;
                }}
              >
                {({ isActive }) => {
                  const colors = getColors(isActive);
                  return (
                    <>
                      {isActive && <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full transition-all duration-500 ${colors.accent}`}></div>}
                      <item.icon size={20} className={`transition-colors duration-300 ${colors.icon}`} />
                      <span className="font-semibold tracking-tight">{item.label}</span>
                    </>
                  );
                }}
              </NavLink>
            );
          })}
        </div>

        <div className="p-5 border-t border-white/5 space-y-1">
           <button 
             onClick={() => setIsPasswordModalOpen(true)}
             className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors border border-transparent text-sm"
           >
              <Key size={18} />
              <span className="font-medium">{t('menu.change_password')}</span>
           </button>
           <button 
             onClick={signOut}
             className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors border border-transparent text-sm"
           >
              <LogOut size={18} />
              <span className="font-medium">{t('menu.signout')}</span>
           </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col bg-slate-50/95 text-slate-800 h-screen overflow-y-auto relative z-10 custom-scrollbar shadow-[-10px_0_30px_rgb(0,0,0,0.2)]">
        <header className="absolute top-6 right-8 z-50 pointer-events-none flex items-center gap-4">
          <div className="pointer-events-auto">
            <GlobalSyncIndicator />
          </div>
          <div className="pointer-events-auto">
            <LanguageSwitcher />
          </div>
          {profile && (
            <div className="bg-white/80 backdrop-blur-md border border-slate-200/60 shadow-lg px-6 py-3 rounded-2xl flex items-center gap-3 transform transition-all duration-500 hover:scale-105 pointer-events-auto">
              <span className="text-xl">👋</span>
              <div>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{t('common.welcome')}</p>
                <p className="text-sm font-bold text-slate-800">{profile.full_name}</p>
              </div>
            </div>
          )}
        </header>

        <div className="p-8 pt-24 pb-20 min-h-full">
          {children}
        </div>
      </main>

      {/* Şifre Güncelleme Modalları */}
      <PasswordUpdateModal 
        isOpen={isPasswordModalOpen} 
        onClose={() => setIsPasswordModalOpen(false)} 
      />

      <PasswordUpdateModal 
        isOpen={isRecovering} 
        onClose={() => setRecovering(false)} 
        isForced={true}
      />
    </div>
  );
}
