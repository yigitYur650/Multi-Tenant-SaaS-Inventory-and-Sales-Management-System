import React, { useState, useEffect } from 'react';
import { PageTransition } from '../components/PageTransition';
import { useTranslation } from 'react-i18next';
import { ShieldAlert, RefreshCw, Trash2, HelpCircle, CheckCircle2, Layers, Eye } from 'lucide-react';
import { db } from '../lib/db';
import { syncService } from '../services/SyncService';
import { useToast } from '../context/ToastContext';
import { useRole } from '../components/RoleContext';

export function AdminReviewQueue() {
  const { t } = useTranslation();
  const { isAdmin } = useRole();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  const goApiUrl = import.meta.env.VITE_GO_API_URL || (import.meta as any).env?.VITE_GO_API_URL;

  const fetchFailedSyncs = async () => {
    setLoading(true);
    try {
      if (goApiUrl) {
        const response = await fetch(`${goApiUrl}/api/v1/sync/dlq`);
        if (response.ok) {
          const data = await response.json();
          setItems(data || []);
        } else {
          throw new Error('Could not fetch DLQ from server');
        }
      } else {
        const data = await db.failed_syncs.toArray();
        setItems(data || []);
      }
    } catch (err: any) {
      console.error(err);
      addToast(t('reviewQueue.toasts.fetchError'), 'error');
      // Fallback to local Dexie even if Go fails
      const data = await db.failed_syncs.toArray();
      setItems(data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchFailedSyncs();
    }
  }, [isAdmin]);

  const handleRetry = async (item: any) => {
    try {
      if (goApiUrl && typeof item.id === 'number') {
        const response = await fetch(`${goApiUrl}/api/v1/sync/dlq/${item.id}/retry`, {
          method: 'POST'
        });
        if (!response.ok) {
          throw new Error('Retry request failed');
        }
      } else {
        // Local retry: move back to sync_queue
        await db.sync_queue.add({
          table: item.table,
          action: item.action,
          payload: item.payload,
          request_id: item.payload?.request_id || window.crypto.randomUUID(),
          status: 'PENDING',
          created_at: new Date().toISOString()
        });
        // Delete from local failed_syncs
        await db.failed_syncs.delete(item.id);
        // Force queue processing
        syncService.processQueue();
      }
      
      addToast(t('reviewQueue.toasts.retrySuccess'), 'success');
      setSelectedItem(null);
      fetchFailedSyncs();
    } catch (err: any) {
      addToast(t('reviewQueue.toasts.retryError'), 'error');
    }
  };

  const handleDismiss = async (item: any) => {
    if (!confirm(t('reviewQueue.confirmDismiss'))) return;
    try {
      if (goApiUrl && typeof item.id === 'number') {
        const response = await fetch(`${goApiUrl}/api/v1/sync/dlq/${item.id}`, {
          method: 'DELETE'
        });
        if (!response.ok) {
          throw new Error('Dismiss request failed');
        }
      } else {
        await db.failed_syncs.delete(item.id);
      }
      
      addToast(t('reviewQueue.toasts.dismissSuccess'), 'success');
      setSelectedItem(null);
      fetchFailedSyncs();
    } catch (err: any) {
      addToast(t('reviewQueue.toasts.dismissError'), 'error');
    }
  };

  if (!isAdmin) {
    return (
      <PageTransition className="flex items-center justify-center p-8">
        <div className="text-center bg-white p-8 rounded-3xl shadow-xl flex flex-col items-center max-w-sm border border-slate-100">
           <ShieldAlert size={64} className="text-rose-500 mb-4" />
           <h2 className="text-xl font-bold text-slate-800">{t('admin.unauthorized.title')}</h2>
           <p className="text-sm text-slate-500 mt-2">{t('admin.unauthorized.message')}</p>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition className="pb-8">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
            <ShieldAlert size={28} className="text-amber-500" />
            {t('reviewQueue.title')}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{t('reviewQueue.subtitle')}</p>
        </div>
        <button 
          onClick={fetchFailedSyncs}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          {t('reviewQueue.refresh')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Queue List */}
        <div className="lg:col-span-8 bg-white border border-slate-100 rounded-[32px] overflow-hidden shadow-xl shadow-slate-200/50 flex flex-col">
          <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
            <h4 className="font-black text-slate-800 tracking-tight">{t('reviewQueue.list.title')}</h4>
            <span className="text-xs bg-white px-3 py-1 rounded-full border border-slate-200 font-semibold text-slate-500">
              {items.length} {t('reviewQueue.list.itemCount')}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 bg-slate-50/50">
                  <th className="px-6 py-4">{t('reviewQueue.list.headerTable')}</th>
                  <th className="px-6 py-4">{t('reviewQueue.list.headerAction')}</th>
                  <th className="px-6 py-4">{t('reviewQueue.list.headerError')}</th>
                  <th className="px-6 py-4 text-right">{t('reviewQueue.list.headerActionBtn')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  [...Array(3)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={4} className="px-6 py-6 text-center text-slate-400">
                        <div className="h-4 bg-slate-200 rounded w-1/4 mx-auto mb-2"></div>
                        <div className="h-3 bg-slate-100 rounded w-1/2 mx-auto"></div>
                      </td>
                    </tr>
                  ))
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-20 text-center text-slate-500 italic">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <CheckCircle2 size={48} className="text-emerald-500" />
                        <span>{t('reviewQueue.list.empty')}</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const isSelected = selectedItem?.id === item.id;
                    return (
                      <tr 
                        key={item.id} 
                        onClick={() => setSelectedItem(item)}
                        className={`hover:bg-slate-50 transition-colors cursor-pointer ${isSelected ? 'bg-slate-50' : ''}`}
                      >
                        <td className="px-6 py-4 font-bold text-slate-800">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                            item.table === 'sales' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50' :
                            item.table === 'product_variants' ? 'bg-amber-50 text-amber-700 border border-amber-200/50' :
                            'bg-blue-50 text-blue-700 border border-blue-200/50'
                          }`}>
                            {item.table}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-slate-600 uppercase font-bold">
                          {item.action || item.payload?.action || 'INSERT'}
                        </td>
                        <td className="px-6 py-4 text-xs text-rose-600 font-medium max-w-xs truncate" title={item.error_message}>
                          {item.error_message}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors">
                            <Eye size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Item Detail Side-Panel */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-xl shadow-slate-200/50 flex flex-col h-full min-h-[400px]">
            <h3 className="font-black text-slate-800 mb-4 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Layers size={18} className="text-blue-500" />
              {t('reviewQueue.detail.title')}
            </h3>

            {selectedItem ? (
              <div className="flex-1 flex flex-col justify-between h-full space-y-6">
                <div className="space-y-4 overflow-y-auto max-h-[350px] pr-2 custom-scrollbar">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                      {t('reviewQueue.detail.correlationId')}
                    </label>
                    <div className="p-2 bg-slate-50 rounded-xl font-mono text-[10px] text-slate-600 border border-slate-100 select-all break-all">
                      {selectedItem.correlation_id || 'N/A'}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                      {t('reviewQueue.detail.errorMessage')}
                    </label>
                    <div className="p-3 bg-rose-550/10 rounded-xl border border-rose-100 text-xs font-semibold text-rose-600 bg-rose-50">
                      {selectedItem.error_message}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                      {t('reviewQueue.detail.payload')}
                    </label>
                    <pre className="p-3 bg-slate-50 rounded-xl font-mono text-[10px] text-blue-600 border border-slate-100 overflow-x-auto max-h-48 whitespace-pre-wrap select-all">
                      {JSON.stringify(selectedItem.payload, null, 2)}
                    </pre>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => handleDismiss(selectedItem)}
                    className="w-full flex items-center justify-center gap-2 p-3 bg-slate-50 border border-slate-200 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 text-slate-600 rounded-xl text-xs font-black transition-all active:scale-95"
                  >
                    <Trash2 size={14} />
                    {t('reviewQueue.detail.discard')}
                  </button>
                  <button 
                    onClick={() => handleRetry(selectedItem)}
                    className="w-full flex items-center justify-center gap-2 p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                  >
                    <RefreshCw size={14} />
                    {t('reviewQueue.detail.retry')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-center py-20">
                <HelpCircle size={40} className="text-slate-350 mb-3" />
                <p className="text-sm font-semibold">{t('reviewQueue.detail.selectHint')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
