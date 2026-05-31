import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2, AlertCircle } from 'lucide-react';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, loading, signOut } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-slate-900 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
        <p className="text-slate-400 font-medium animate-pulse">Sistem yükleniyor...</p>
      </div>
    );
  }

  if (!user) {
    // Giriş yapılmamışsa, yönlendirme yapılır ve çalışılan URL 'state' olarak iletilebilir
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Fallback UI: Kullanıcı auth ama profil veya dükkan verisi (shop_id) gelmedi! (Infinite loop yerine bu)
  if (!profile || !profile.shop_id) {
    return (
      <div className="min-h-screen w-full bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800/80 backdrop-blur-xl border border-rose-500/30 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center mb-6">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-xl font-bold text-white mb-3">Dükkan Bilgisi Bulunamadı</h2>
          <p className="text-slate-300 text-sm mb-8 leading-relaxed">
            Hesabınız bir dükkana bağlı görünmüyor veya profil verileriniz çekilemedi. İşlem yapabilmek için lütfen yöneticinizle görüşün.
          </p>
          <button 
            onClick={async () => {
              await signOut();
            }}
            className="w-full py-4 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 font-semibold transition-all border border-rose-500/50 focus:ring-2 focus:ring-rose-500 outline-none"
          >
            Çıkış Yap
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
