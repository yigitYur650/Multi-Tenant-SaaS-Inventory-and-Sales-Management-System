import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

interface RefreshContextProps {
  refreshKey: number;
  triggerRefresh: () => void;
}

const RefreshContext = createContext<RefreshContextProps | null>(null);

export const RefreshProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [refreshKey, setRefreshKey] = useState(0);

  const triggerRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  useEffect(() => {
    const handleSyncComplete = () => {
      console.log("Sync completed! Triggering UI refresh...");
      triggerRefresh();
    };
    window.addEventListener('sync_complete', handleSyncComplete);
    return () => window.removeEventListener('sync_complete', handleSyncComplete);
  }, []);

  return (
    <RefreshContext.Provider value={{ refreshKey, triggerRefresh }}>
      {children}
    </RefreshContext.Provider>
  );
};

export const useRefresh = () => {
  const ctx = useContext(RefreshContext);
  if (!ctx) throw new Error("useRefresh must be used within a RefreshProvider");
  return ctx;
};
