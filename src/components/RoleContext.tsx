import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

type Role = 'PATRON' | 'CALISAN';

interface RoleContextProps {
  role: Role;
  loading: boolean;
  setRole: (role: Role) => void;
  isAdmin: boolean;
}

const RoleContext = createContext<RoleContextProps | null>(null);

export const RoleProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { profile, loading: authLoading } = useAuth();
  const [role, setInternalRole] = useState<Role>('CALISAN');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Auth loading bittiyse Rol hesaplamasını yap ve Role loading'i de bitir
    if (!authLoading) {
      try {
        console.log("Role Init: Syncing with profile...", !!profile);
        if (profile) {
          const calculatedRole: Role = profile.role === 3 ? 'PATRON' : 'CALISAN';
          setInternalRole(calculatedRole);
          console.log("Role Init: Calculated role as", calculatedRole);
        } else {
          setInternalRole('CALISAN');
        }
      } catch (err) {
        console.error("Role Init Error:", err);
        setInternalRole('CALISAN');
      } finally {
        setLoading(false);
      }
    }
  }, [profile, authLoading]);

  const setRole = (r: Role) => {
    console.warn("Rol seçimi veritabanından kilitlendi, sadece yetkilerle değiştirilebilir.");
  };

  return (
    <RoleContext.Provider value={{ role, loading, setRole, isAdmin: role === 'PATRON' }}>
      {children}
    </RoleContext.Provider>
  );
};

export const useRole = () => {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within a RoleProvider");
  return ctx;
};
