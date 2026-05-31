import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '../lib/db';
import { Cloud, CloudLightning, CloudOff, RefreshCw, AlertCircle, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function GlobalSyncIndicator() {
  const { t } = useTranslation();
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [errorCount, setErrorCount] = useState<number>(0);
  const [isHovered, setIsHovered] = useState<boolean>(false);

  // Update counts from Dexie sync_queue
  const updateCounts = useCallback(async () => {
    try {
      const items = await db.sync_queue.toArray();
      const pending = items.filter(item => item.status === 'PENDING' || item.status === 'SYNCING').length;
      const errors = items.filter(item => item.status === 'ERROR').length;
      setPendingCount(pending);
      setErrorCount(errors);
    } catch (err) {
      console.error('Error fetching sync queue counts:', err);
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    // Fast interval to poll Dexie queue status (every 1000ms)
    updateCounts();
    const intervalId = setInterval(updateCounts, 1000);

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
      clearInterval(intervalId);
    };
  }, [updateCounts]);

  // Compute sync state
  // Red: Errors found in queue
  // Yellow: Offline or there are pending items waiting to sync
  // Green: Online and queue is completely empty
  const status = useMemo(() => {
    if (errorCount > 0) return 'error';
    if (!isOnline || pendingCount > 0) return 'pending';
    return 'synced';
  }, [isOnline, pendingCount, errorCount]);

  const config = useMemo(() => {
    switch (status) {
      case 'error':
        return {
          color: 'bg-rose-500 border-rose-500/20 text-rose-400 shadow-rose-500/20',
          pulseColor: 'bg-rose-400',
          icon: <CloudLightning size={16} />,
          text: t('layout.sync.error', { count: errorCount }),
          tooltip: t('layout.sync.tooltip_error')
        };
      case 'pending':
        return {
          color: 'bg-amber-500 border-amber-500/20 text-amber-400 shadow-amber-500/20',
          pulseColor: 'bg-amber-400',
          icon: isOnline ? <RefreshCw size={16} className="animate-spin" /> : <CloudOff size={16} />,
          text: t('layout.sync.pending', { count: pendingCount }),
          tooltip: t('layout.sync.tooltip_pending')
        };
      case 'synced':
      default:
        return {
          color: 'bg-emerald-500 border-emerald-500/20 text-emerald-400 shadow-emerald-500/20',
          pulseColor: 'bg-emerald-400',
          icon: <Cloud size={16} />,
          text: t('layout.sync.synced'),
          tooltip: t('layout.sync.tooltip_synced')
        };
    }
  }, [status, pendingCount, errorCount, isOnline, t]);

  return (
    <div 
      className="relative pointer-events-auto"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Visual Indicator Capsule */}
      <motion.div
        layout
        className={`flex items-center gap-2.5 px-4 py-2 bg-white/80 backdrop-blur-md border rounded-2xl shadow-lg cursor-help transition-all duration-300 ${config.color}`}
      >
        {/* Pulsing indicator light */}
        <div className="relative flex h-2 w-2">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.pulseColor}`}></span>
          <span className={`relative inline-flex rounded-full h-2 w-2 ${config.pulseColor}`}></span>
        </div>
        
        <span className="text-[11px] font-bold uppercase tracking-wider hidden md:block">
          {config.text}
        </span>
        <span className="shrink-0">{config.icon}</span>
      </motion.div>

      {/* Premium Animated Tooltip Detail Panel */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 mt-3 w-64 bg-slate-950/95 backdrop-blur-xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-2xl p-4 z-50 text-slate-200"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-400">
                {t('menu.inventory')} / Sync Status
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <p className="text-slate-300 font-medium leading-relaxed">
                {config.tooltip}
              </p>
              
              <div className="border-t border-white/10 pt-2.5 mt-2.5 space-y-1.5 font-semibold text-slate-400">
                <div className="flex justify-between">
                  <span>Network:</span>
                  <span className={isOnline ? 'text-emerald-400' : 'text-rose-400'}>
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Pending Items:</span>
                  <span className={pendingCount > 0 ? 'text-amber-400' : 'text-slate-200'}>
                    {pendingCount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Sync Errors:</span>
                  <span className={errorCount > 0 ? 'text-rose-400' : 'text-slate-200'}>
                    {errorCount}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
