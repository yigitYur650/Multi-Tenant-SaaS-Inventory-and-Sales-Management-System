import React, { useState, useEffect } from 'react';
import { useServices } from './ServiceProvider';
import { useMasterData } from '../context/MasterDataContext';
import { useAuth } from '../context/AuthContext';
import { 
  Plus, 
  Trash2, 
  RotateCcw, 
  Edit2, 
  Trash, 
  FolderPlus, 
  X, 
  AlertCircle, 
  ChevronRight,
  Archive
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

export function CategoryManager() {
  const { t } = useTranslation();
  const { categoryService } = useServices();
  const { categories, refreshMasterData } = useMasterData();
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'active' | 'trash'>('active');
  const [deletedCategories, setDeletedCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [notif, setNotif] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);

  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newParentId, setNewParentId] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'trash') {
      fetchDeleted();
    }
  }, [activeTab]);

  const fetchDeleted = async () => {
    try {
      setLoading(true);
      const data = await categoryService.getDeletedCategories();
      setDeletedCategories(data);
    } catch (err) {
      showNotif(t('categoryManager.messages.fetchError'), "error");
    } finally {
      setLoading(false);
    }
  };

  const showNotif = (msg: string, type: 'success' | 'error' = 'success') => {
    setNotif({ msg, type });
    setTimeout(() => setNotif(null), 3000);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    
    try {
      setLoading(true);
      await categoryService.createCategory({
        name: newName.trim(),
        parent_id: newParentId || null,
        shop_id: profile?.shop_id || ''
      } as any);
      setNewName('');
      setNewParentId('');
      setIsAdding(false);
      await refreshMasterData();
      showNotif(t('categoryManager.messages.addSuccess'));
    } catch (err) {
      showNotif(t('categoryManager.messages.addError'), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: string, name: string) => {
    try {
      setLoading(true);
      await categoryService.updateCategory(id, { name } as any);
      setEditingId(null);
      await refreshMasterData();
      showNotif(t('categoryManager.messages.updateSuccess'));
    } catch (err) {
      showNotif(t('categoryManager.messages.updateError'), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSoftDelete = async (id: string) => {
    if (!confirm(t('categoryManager.confirmTrash'))) return;
    try {
      setLoading(true);
      await categoryService.softDeleteCategory(id);
      await refreshMasterData();
      showNotif(t('categoryManager.messages.deleteSuccess'));
    } catch (err: any) {
      showNotif(t('categoryManager.messages.deleteError'), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (id: string) => {
    try {
      setLoading(true);
      await categoryService.restoreCategory(id);
      await fetchDeleted();
      await refreshMasterData();
      showNotif(t('categoryManager.messages.restoreSuccess'));
    } catch (err) {
      showNotif(t('categoryManager.messages.restoreError'), "error");
    } finally {
      setLoading(false);
    }
  };

  const handlePermanentDelete = async (id: string) => {
    if (!confirm(t('categoryManager.confirmPermanent'))) return;
    try {
      setLoading(true);
      await categoryService.forceDeleteCategory(id);
      await fetchDeleted();
      showNotif(t('categoryManager.messages.forceDeleteSuccess'));
    } catch (err) {
      showNotif(t('categoryManager.messages.forceDeleteError'), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      <AnimatePresence>
        {notif && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`flex items-center gap-3 p-4 rounded-2xl border ${
              notif.type === 'error' 
                ? 'bg-rose-50 border-rose-100 text-rose-600' 
                : 'bg-emerald-50 border-emerald-100 text-emerald-600'
            } shadow-lg shadow-black/5 mx-auto w-full`}
          >
            {notif.type === 'error' ? <AlertCircle size={18} /> : <AlertCircle size={18} className="rotate-180" />}
            <p className="text-sm font-bold">{notif.msg}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex p-1.5 bg-slate-100 rounded-2xl w-full">
        <button 
          onClick={() => setActiveTab('active')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'active' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <FolderPlus size={18} />
          {t('categoryManager.tabs.active')}
        </button>
        <button 
          onClick={() => setActiveTab('trash')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'trash' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Archive size={18} />
          {t('categoryManager.tabs.trash')}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        {activeTab === 'active' ? (
          <div className="space-y-6">
            {!isAdding ? (
              <button 
                onClick={() => setIsAdding(true)}
                className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/30 transition-all font-bold text-sm"
              >
                <Plus size={20} /> {t('categoryManager.addCategory')}
              </button>
            ) : (
              <motion.form 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onSubmit={handleAdd} 
                className="bg-white border border-slate-200 p-6 rounded-3xl shadow-xl shadow-slate-100 space-y-4"
              >
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">{t('categoryManager.formTitle')}</h3>
                  <button type="button" onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">{t('categoryManager.nameLabel')}</label>
                    <input 
                      autoFocus
                      required
                      type="text" 
                      value={newName} 
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder={t('categoryManager.namePlaceholder')}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500 text-slate-800 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">{t('categoryManager.parentLabel')}</label>
                    <select 
                      value={newParentId} 
                      onChange={(e) => setNewParentId(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500 text-slate-700 font-semibold"
                    >
                      <option value="">{t('categoryManager.makeParent')}</option>
                      {categories.filter(c => !c.parent_id).map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <button 
                    disabled={loading}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm transition-all shadow-lg shadow-indigo-100"
                  >
                    {loading ? t('categoryManager.creating') : t('categoryManager.createButton')}
                  </button>
                </div>
              </motion.form>
            )}

            <div className="space-y-3">
              {categories.length === 0 ? (
                <div className="text-center py-10 text-slate-400 italic">{t('categoryManager.noCategoryFound')}</div>
              ) : (
                categories.map((cat: any) => (
                  <CategoryItem 
                    key={cat.id} 
                    category={cat} 
                    onEdit={() => setEditingId(cat.id)}
                    isEditing={editingId === cat.id}
                    onUpdate={handleUpdate}
                    onDelete={handleSoftDelete}
                    onCancelEdit={() => setEditingId(null)}
                    allCategories={categories}
                    t={t}
                  />
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-20 text-slate-300">{t('categoryManager.loading')}</div>
            ) : deletedCategories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-300 italic text-center">
                <Trash2 size={48} className="mb-4 opacity-20" />
                {t('categoryManager.trashEmpty')}
              </div>
            ) : (
              deletedCategories.map((cat: any) => (
                <div key={cat.id} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl group">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-700">{cat.name}</span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-tight">
                      {cat.is_deleted ? t('categoryManager.tabs.trash') : ''}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleRestore(cat.id)}
                      className="p-2.5 bg-emerald-100 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all"
                      title={t('categoryManager.restore')}
                    >
                      <RotateCcw size={16} />
                    </button>
                    <button 
                      onClick={() => handlePermanentDelete(cat.id)}
                      className="p-2.5 bg-rose-100 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all"
                      title={t('categoryManager.permanentDelete')}
                    >
                      <Trash size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryItem({ category, onEdit, isEditing, onUpdate, onDelete, onCancelEdit, allCategories, t }: any) {
  const [editName, setEditName] = useState(category.name);
  const parent = category.parent_id ? allCategories.find((c: any) => c.id === category.parent_id) : null;

  return (
    <div className={`p-4 rounded-3xl border transition-all ${isEditing ? 'border-indigo-400 bg-indigo-50/30' : 'border-slate-100 bg-white hover:border-slate-200 shadow-sm'}`}>
      {isEditing ? (
        <div className="flex items-center gap-3">
          <input 
            autoFocus
            type="text" 
            value={editName} 
            onChange={(e) => setEditName(e.target.value)}
            className="flex-1 px-4 py-2 rounded-xl border-none ring-2 ring-indigo-500 font-bold text-slate-700"
          />
          <button onClick={() => onUpdate(category.id, editName)} className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100"><Plus size={16} /></button>
          <button onClick={onCancelEdit} className="p-2.5 bg-slate-200 text-slate-500 rounded-xl"><X size={16} /></button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${parent ? 'bg-orange-50 text-orange-500' : 'bg-indigo-50 text-indigo-500'}`}>
              {parent ? <ChevronRight size={18} /> : <FolderPlus size={18} />}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-black text-slate-800 uppercase tracking-tight">{category.name}</span>
              {parent && <span className="text-[10px] text-slate-400 italic">{t('categoryManager.under')} {parent.name}</span>}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={onEdit} className="p-2 text-slate-300 hover:text-indigo-600 transition-colors"><Edit2 size={16} /></button>
            <button onClick={() => onDelete(category.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={16} /></button>
          </div>
        </div>
      )}
    </div>
  );
}
