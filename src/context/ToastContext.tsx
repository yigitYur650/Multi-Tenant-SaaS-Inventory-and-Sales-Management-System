import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'warning' | 'error' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextData {
  addToast: (message: string, type?: ToastType, duration?: number) => string;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextData | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastType = 'info', duration = 5000) => {
    const id = window.crypto.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2, 9);
    
    setToasts((prev) => {
      // Prevent showing the exact same message multiple times concurrently (e.g. storage warning flooding)
      if (prev.some(t => t.message === message && t.type === type)) {
        return prev;
      }
      return [...prev, { id, message, type, duration }];
    });

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  }, [removeToast]);

  const value = useMemo(() => ({ addToast, removeToast }), [addToast, removeToast]);

  // Toast icons mapping
  const iconMap = {
    success: <CheckCircle className="w-5 h-5 text-emerald-400 drop-shadow-[0_0_4px_rgba(52,211,153,0.4)]" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-400 drop-shadow-[0_0_4px_rgba(245,158,11,0.4)]" />,
    error: <XCircle className="w-5 h-5 text-rose-400 drop-shadow-[0_0_4px_rgba(251,113,133,0.4)]" />,
    info: <Info className="w-5 h-5 text-blue-400 drop-shadow-[0_0_4px_rgba(59,130,246,0.4)]" />
  };

  // Toast border colors mapping
  const borderMap = {
    success: 'border-emerald-500/30 bg-slate-950/80',
    warning: 'border-amber-500/30 bg-slate-950/80',
    error: 'border-rose-500/30 bg-slate-950/80',
    info: 'border-blue-500/30 bg-slate-950/80'
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      
      {/* Toast Overlay Container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none w-full max-w-sm">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 30, scale: 0.9, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -20, scale: 0.85, filter: 'blur(4px)', transition: { duration: 0.2 } }}
              layout
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border backdrop-blur-xl shadow-2xl transition-all duration-300 text-slate-100 ${borderMap[toast.type]}`}
            >
              <div className="shrink-0 mt-0.5">{iconMap[toast.type]}</div>
              <div className="flex-1 text-sm font-medium leading-relaxed tracking-wide">
                {toast.message}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="shrink-0 text-slate-400 hover:text-slate-200 transition-colors p-0.5 rounded-lg hover:bg-white/5 active:scale-90"
              >
                <X size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
