import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/database.types';
import { AppServices, getServices } from '../services/ServiceFactory';
interface ServiceProviderProps {
  children: ReactNode;
  supabaseClient: SupabaseClient<Database>;
}

const ServiceContext = createContext<AppServices | null>(null);

export const ServiceProvider: React.FC<ServiceProviderProps> = ({ children, supabaseClient }) => {
  const services = useMemo(() => {
    return getServices(supabaseClient);
  }, [supabaseClient]);

  return (
    <ServiceContext.Provider value={services}>
      {children}
    </ServiceContext.Provider>
  );
};

export const useServices = (): AppServices => {
  const context = useContext(ServiceContext);
  if (!context) {
    throw new Error('useServices must be used within a ServiceProvider');
  }
  return context;
};
