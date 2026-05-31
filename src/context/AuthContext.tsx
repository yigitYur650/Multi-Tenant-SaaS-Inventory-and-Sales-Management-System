import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

export interface Profile {
  id: string;
  full_name: string;
  role: number;
  shop_id: string;
  shops?: {
    name: string;
    currency_code: string;
    timezone: string;
    locale: string;
    [key: string]: any;
  };
}

interface AuthContextProps {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isRecovering: boolean;
  setRecovering: (val: boolean) => void;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRecovering, setIsRecovering] = useState<boolean>(false);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*, shops(*)')
      .eq('id', userId)
      .single();

    if (error) {
      console.error("❌ Profile Fetch Error:", error);
      throw error;
    }

    if (data) {
      const profileData = data as Profile;
      setProfile(profileData);
      if (profileData.shop_id) {
        localStorage.setItem('active_shop_id', profileData.shop_id);
      }
    }
  };

  useEffect(() => {
    let mounted = true;

    const handleSession = async (session: Session | null) => {
      try {
        if (!mounted) return;
        setLoading(true);

        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
          if (mounted) localStorage.clear();
        }
      } catch (error) {
        console.error("AUTH HATA:", error);
        if (mounted) {
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {

      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovering(true);
      }

      handleSession(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleRefreshProfile = async () => {
    if (!user) return;
    try {
      setLoading(true);
      await fetchProfile(user.id);
    } catch (e) {
      console.error("Refresh Profile Error:", e);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      signOut,
      refreshProfile: handleRefreshProfile,
      isRecovering,
      setRecovering: setIsRecovering
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
