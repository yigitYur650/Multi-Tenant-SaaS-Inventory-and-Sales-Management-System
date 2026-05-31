import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './i18n'; // Çoklu dil konfigürasyonu
import { ServiceProvider } from './components/ServiceProvider';
import { supabase } from './lib/supabaseClient';

import { RefreshProvider } from './components/RefreshContext';
import { ToastProvider } from './context/ToastContext';

import { BrowserRouter } from 'react-router-dom';
import { RoleProvider } from './components/RoleContext';
import { AuthProvider } from './context/AuthContext';
import { MasterDataProvider } from './context/MasterDataContext';

const isSandbox = import.meta.env.VITE_APP_MODE === 'sandbox';
const supabaseClient = isSandbox ? (null as any) : supabase;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <MasterDataProvider>
      <RoleProvider>
        <BrowserRouter>
          <ServiceProvider supabaseClient={supabaseClient}>
            <RefreshProvider>
              <ToastProvider>
                <App />
              </ToastProvider>
            </RefreshProvider>
          </ServiceProvider>
        </BrowserRouter>
      </RoleProvider>
    </MasterDataProvider>
  </AuthProvider>,
);
