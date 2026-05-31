import React, { useState, useEffect } from 'react';
import { PageTransition } from '../components/PageTransition';
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { 
  Plus, Trash2, ShieldAlert, User as UserIcon, Mail, Lock, 
  UserPlus, Users, ArrowUpRight, ArrowDownRight, History, 
  Activity, Calendar, ChevronRight, Save, Info 
} from 'lucide-react';
import { useRole } from '../components/RoleContext';
import { useMasterData } from '../context/MasterDataContext';
import { SkeletonRow } from '../components/Skeleton';
import { createClient } from '@supabase/supabase-js';
import { SlideOver } from '../components/SlideOver';
import { useTranslation } from 'react-i18next';

export function AdminDashboard() {
  const { t } = useTranslation();
  const { isAdmin } = useRole();
  const { profile } = useAuth();
  const { categories, colors, sizes, loading, refreshMasterData } = useMasterData();

  const [newCat, setNewCat] = useState('');
  const [newColor, setNewColor] = useState('');
  const [newSize, setNewSize] = useState('');

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCat.trim() || !profile?.shop_id) return;
    
    const { error } = await supabase.from('categories').insert({
      name: newCat.trim(),
      shop_id: profile.shop_id
    } as any);
    
    if (error) alert(t('admin.masterData.categories.errorAdd') + ": " + error.message);
    else { setNewCat(''); await refreshMasterData(); }
  };

  const handleAddColor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColor.trim() || !profile?.shop_id) return;
    
    const { error } = await supabase.from('colors').insert({
      name: newColor.trim(),
      shop_id: profile.shop_id
    } as any);
    
    if (error) alert(t('admin.masterData.colors.errorAdd') + ": " + error.message);
    else { setNewColor(''); await refreshMasterData(); }
  };

  const handleAddSize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSize.trim() || !profile?.shop_id) return;
    
    const { error } = await supabase.from('sizes').insert({
      name: newSize.trim(),
      shop_id: profile.shop_id
    } as any);

    if (error) alert(t('admin.masterData.sizes.errorAdd') + ": " + error.message);
    else { setNewSize(''); await refreshMasterData(); }
  };

  const handleDelete = async (tableName: 'categories' | 'colors' | 'sizes', id: string) => {
    const { error } = await supabase.from(tableName).delete().eq('id', id);
    if (error) alert(t('admin.masterData.common.errorDelete') + ": " + error.message);
    else await refreshMasterData();
  };

  if (!isAdmin) {
    return (
      <PageTransition className="flex items-center justify-center p-8">
        <div className="text-center bg-white p-8 rounded-3xl shadow-xl flex flex-col items-center max-w-sm">
           <ShieldAlert size={64} className="text-rose-500 mb-4" />
           <h2 className="text-xl font-bold text-slate-800">{t('admin.unauthorized.title')}</h2>
           <p className="text-sm text-slate-500 mt-2">{t('admin.unauthorized.message')}</p>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition className="pb-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t('admin.title')}</h1>
        <p className="text-sm text-slate-500 mt-1">{t('admin.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         {/* Kategoriler */}
         <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-6 flex flex-col">
            <h3 className="font-bold text-slate-800 mb-4 border-b pb-2">{t('admin.masterData.categories.title')}</h3>
            <form onSubmit={handleAddCategory} className="flex gap-2 mb-4">
               <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder={t('admin.masterData.categories.placeholder')} className="flex-1 bg-slate-50 border px-3 py-2 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500"/>
               <button type="submit" className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700"><Plus size={18}/></button>
            </form>
            <div className="flex-1 overflow-y-auto space-y-2">
               {loading ? (
                 <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                 </>
               ) : categories.map((c: any) => (
                 <div key={c.id} className="flex justify-between items-center text-sm p-2 bg-slate-50 rounded-lg">
                   <span>{c.name}</span>
                   <button onClick={() => handleDelete('categories', c.id)} className="text-slate-400 hover:text-rose-500"><Trash2 size={14}/></button>
                 </div>
               ))}
            </div>
         </div>

         {/* Renkler */}
         <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-6 flex flex-col">
            <h3 className="font-bold text-slate-800 mb-4 border-b pb-2">{t('admin.masterData.colors.title')}</h3>
            <form onSubmit={handleAddColor} className="flex gap-2 mb-4">
               <input value={newColor} onChange={(e) => setNewColor(e.target.value)} placeholder={t('admin.masterData.colors.placeholder')} className="flex-1 bg-slate-50 border px-3 py-2 rounded-lg text-sm outline-none focus:ring-1 focus:ring-emerald-500"/>
               <button type="submit" className="bg-emerald-600 text-white p-2 rounded-lg hover:bg-emerald-700"><Plus size={18}/></button>
            </form>
            <div className="flex-1 overflow-y-auto space-y-2">
               {loading ? (
                 <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                 </>
               ) : colors.map((c: any) => (
                 <div key={c.id} className="flex justify-between items-center text-sm p-2 bg-slate-50 rounded-lg">
                   <span>{c.name}</span>
                   <button onClick={() => handleDelete('colors', c.id)} className="text-slate-400 hover:text-rose-500"><Trash2 size={14}/></button>
                 </div>
               ))}
            </div>
         </div>

         {/* Bedenler */}
         <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-6 flex flex-col">
            <h3 className="font-bold text-slate-800 mb-4 border-b pb-2">{t('admin.masterData.sizes.title')}</h3>
            <form onSubmit={handleAddSize} className="flex gap-2 mb-4">
               <input value={newSize} onChange={(e) => setNewSize(e.target.value)} placeholder={t('admin.masterData.sizes.placeholder')} className="flex-1 bg-slate-50 border px-3 py-2 rounded-lg text-sm outline-none focus:ring-1 focus:ring-purple-500"/>
               <button type="submit" className="bg-purple-600 text-white p-2 rounded-lg hover:bg-purple-700"><Plus size={18}/></button>
            </form>
            <div className="flex-1 overflow-y-auto space-y-2">
               {loading ? (
                 <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                 </>
               ) : sizes.map((c: any) => (
                 <div key={c.id} className="flex justify-between items-center text-sm p-2 bg-slate-50 rounded-lg">
                   <span>{c.name}</span>
                   <button onClick={() => handleDelete('sizes', c.id)} className="text-slate-400 hover:text-rose-500"><Trash2 size={14}/></button>
                 </div>
               ))}
            </div>
         </div>
      </div>

      {/* Personel Yönetimi Bölümü */}
      <div className="mt-12">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-slate-900 text-white rounded-2xl">
             <Users size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">{t('admin.staff.title')}</h2>
            <p className="text-xs text-slate-500 font-medium">{t('admin.staff.subtitle')}</p>
          </div>
        </div>
        
        <StaffManagement shopId={profile?.shop_id || ''} />
      </div>
    </PageTransition>
  );
}

// Personel Yönetimi Alt Bileşeni
function StaffManagement({ shopId }: { shopId: string }) {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('1'); // 1: Çalışan, 2: Müdür
  const [fullName, setFullName] = useState('');

  // Detail State
  const [selectedStaff, setSelectedStaff] = useState<any | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [staffAudit, setStaffAudit] = useState<any[]>([]);
  const [fetchingAudit, setFetchingAudit] = useState(false);
  const [updatingRole, setUpdatingRole] = useState(false);
  const [newRole, setNewRole] = useState<string>('1');

  const fetchStaff = async () => {
    try {
      setFetching(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('shop_id', shopId)
        .neq('id', currentUser?.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setStaffList(data || []);
    } catch (err) {
      console.error("Staff fetch error:", err);
    } finally {
      setFetching(false);
    }
  };

  const fetchStaffAudit = async (staffEmail: string) => {
    if (!staffEmail) return;
    try {
      setFetchingAudit(true);
      const { data, error } = await supabase
        .from('stock_movements')
        .select(`
          *,
          product_variants (
            sku,
            products (name)
          )
        `)
        .eq('user_email', staffEmail)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      setStaffAudit(data || []);
    } catch (err) {
      console.error("Staff audit fetch error:", err);
    } finally {
      setFetchingAudit(false);
    }
  };

  const updateStaffRole = async () => {
    if (!selectedStaff || !newRole) return;
    try {
      setUpdatingRole(true);
      const { error } = await supabase
        .from('profiles')
        // @ts-ignore - Supabase generated types sometimes infer 'never' for updates
        .update({ role: parseInt(newRole) })
        .eq('id', selectedStaff.id);
      
      if (error) throw error;
      
      alert(t('admin.staff.detail.updateSuccess'));
      setSelectedStaff({ ...selectedStaff, role: parseInt(newRole) });
      fetchStaff();
    } catch (err) {
      alert(t('admin.staff.detail.updateError'));
    } finally {
      setUpdatingRole(false);
    }
  };

  useEffect(() => {
    if (shopId) fetchStaff();
  }, [shopId, currentUser?.id]);

  const handleOpenDetail = (staff: any) => {
    setSelectedStaff(staff);
    setNewRole(staff.role.toString());
    setIsDetailOpen(true);
    fetchStaffAudit(staff.email);
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return alert(t('admin.staff.addForm.errorPassword'));
    
    setLoading(true);
    try {
      // 1. Ghost Auth Client Oluştur (PersistSession FALSE)
      const ghostClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      });

      // 2. Auth signUp
      const { data: authData, error: authError } = await ghostClient.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error(t('admin.staff.addForm.errorCreate'));

      // 3. Profil Oluştur (Orijinal supabase instance ile)
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          shop_id: shopId,
          role: parseInt(role),
          full_name: fullName.trim() || email.split('@')[0],
          email: email
        } as any);

      if (profileError) throw profileError;

      alert(t('admin.staff.addForm.success'));
      setEmail(''); setPassword(''); setFullName('');
      fetchStaff();
    } catch (err: any) {
      console.error("Staff creation error:", err);
      alert(t('admin.staff.detail.updateError') + ": " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteStaff = async (id: string) => {
    if (!confirm(t('admin.staff.detail.deleteConfirm'))) return;
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (error) throw error;
      fetchStaff();
    } catch (err) {
      alert(t('admin.staff.detail.deleteError'));
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Sol: Form */}
      <div className="lg:col-span-4 bg-white border border-slate-100 rounded-[32px] p-8 shadow-xl shadow-slate-200/50 h-fit">
         <h4 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
            <UserPlus size={20} className="text-indigo-600" /> {t('admin.staff.addForm.title')}
         </h4>
         
         <form onSubmit={handleCreateStaff} className="space-y-5">
            <div>
               <label className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1 block">{t('admin.staff.addForm.fullName')}</label>
               <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                  <input 
                    required type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold text-sm"
                    placeholder={t('admin.staff.addForm.fullNamePlaceholder')}
                  />
               </div>
            </div>

            <div>
               <label className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1 block">{t('admin.staff.addForm.email')}</label>
               <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                  <input 
                    required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold text-sm"
                    placeholder={t('admin.staff.addForm.emailPlaceholder')}
                  />
               </div>
            </div>

            <div>
               <label className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1 block">{t('admin.staff.addForm.password')}</label>
               <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                  <input 
                    required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold text-sm"
                    placeholder={t('admin.staff.addForm.passwordPlaceholder')}
                  />
               </div>
            </div>

            <div>
               <label className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1 block">{t('admin.staff.addForm.role')}</label>
               <select 
                 value={role} onChange={(e) => setRole(e.target.value)}
                 className="w-full px-5 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold text-sm appearance-none"
               >
                 <option value="1">{t('admin.staff.addForm.role1')}</option>
                 <option value="2">{t('admin.staff.addForm.role2')}</option>
               </select>
            </div>

            <button 
              type="submit" disabled={loading}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-sm shadow-xl shadow-slate-200 hover:bg-indigo-600 transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? t('admin.staff.addForm.submitting') : t('admin.staff.addForm.submit')}
            </button>
         </form>
      </div>

      {/* Sağ: Liste */}
      <div className="lg:col-span-8 bg-white border border-slate-100 rounded-[32px] overflow-hidden shadow-xl shadow-slate-200/50 flex flex-col">
         <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
            <h4 className="font-black text-slate-800 tracking-tight">{t('admin.staff.list.title')}</h4>
            <span className="text-[10px] bg-white px-2 py-1 rounded-lg border font-bold text-slate-400">{staffList.length} {t('admin.staff.list.userCount')}</span>
         </div>
         
         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-50">
                     <th className="px-8 py-5">{t('admin.staff.list.headerName')}</th>
                     <th className="px-8 py-5">{t('admin.staff.list.headerRole')}</th>
                     <th className="px-8 py-5 text-right">{t('admin.staff.list.headerAction')}</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                  {fetching ? (
                     [...Array(3)].map((_, i) => (
                        <tr key={i}><td colSpan={3} className="px-8 py-4"><SkeletonRow /></td></tr>
                     ))
                  ) : staffList.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-8 py-20 text-center text-slate-300 italic font-medium">{t('admin.staff.list.empty')}</td>
                    </tr>
                  ) : staffList.map((s: any) => (
                     <tr 
                       key={s.id} 
                       onClick={() => handleOpenDetail(s)}
                       className="hover:bg-indigo-50/50 transition-colors group cursor-pointer"
                     >
                        <td className="px-8 py-5">
                           <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                 {s.full_name?.charAt(0) || '?'}
                              </div>
                              <div>
                                 <div className="font-bold text-slate-800 text-sm">{s.full_name}</div>
                                 <div className="text-[10px] text-slate-400 font-medium">{s.email || 'E-posta belirtilmemiş'}</div>
                              </div>
                           </div>
                        </td>
                        <td className="px-8 py-5">
                           <span className={`px-2 py-1 rounded-md text-[9px] font-black tracking-tighter ${s.role === 2 ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                              {s.role === 2 ? t('admin.staff.list.role2') : t('admin.staff.list.role1')}
                           </span>
                        </td>
                        <td className="px-8 py-5 text-right">
                           <ChevronRight size={18} className="inline text-slate-300 group-hover:text-indigo-600 translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>

      {/* Personel Detay Paneli */}
      <SlideOver
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title={t('admin.staff.detail.title')}
      >
        {selectedStaff && (
          <div className="space-y-8 pb-12">
            {/* Header / Profile Info */}
            <div className="flex items-center gap-5 p-6 bg-slate-50 rounded-[24px] border border-slate-100">
               <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-indigo-100">
                  {selectedStaff.full_name?.charAt(0)}
               </div>
               <div className="flex-1">
                  <h3 className="text-xl font-black text-slate-800 leading-tight">{selectedStaff.full_name}</h3>
                  <p className="text-sm text-slate-400 font-medium">{selectedStaff.email}</p>
                  <div className="mt-2 flex gap-2">
                     <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        {t('admin.staff.detail.shopId')}: {shopId.slice(0, 8)}
                     </span>
                  </div>
               </div>
            </div>

            {/* Role Management */}
            <div className="space-y-4">
               <div className="flex items-center gap-2 px-2">
                  <ShieldAlert size={18} className="text-indigo-600" />
                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">{t('admin.staff.detail.roleManagement')}</h4>
               </div>
               <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-sm flex flex-col sm:flex-row gap-4 items-end">
                  <div className="flex-1 w-full space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase ml-2">{t('admin.staff.detail.roleLabel')}</label>
                     <select 
                       value={newRole}
                       onChange={(e) => setNewRole(e.target.value)}
                       className="w-full px-5 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold text-sm"
                     >
                       <option value="1">{t('admin.staff.addForm.role1')}</option>
                       <option value="2">{t('admin.staff.addForm.role2')}</option>
                       <option value="3">{t('admin.staff.addForm.role3')}</option>
                     </select>
                  </div>
                  <button 
                    onClick={updateStaffRole}
                    disabled={updatingRole}
                    className="whitespace-nowrap px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm hover:shadow-lg hover:shadow-indigo-100 transition-all active:scale-95 flex items-center gap-2 "
                  >
                    {updatingRole ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={18} />}
                    {t('admin.staff.detail.updateButton')}
                  </button>
               </div>
            </div>

            {/* Audit Trail */}
            <div className="space-y-4">
               <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-2">
                    <History size={18} className="text-indigo-600" />
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">{t('admin.staff.detail.auditTitle')}</h4>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded">{t('admin.staff.detail.auditLimit')}</span>
               </div>
               
               <div className="bg-white border border-slate-100 rounded-[24px] overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse">
                     <thead>
                        <tr className="bg-slate-50/50 text-[9px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-50">
                           <th className="px-6 py-4">{t('admin.staff.detail.auditTable.product')}</th>
                           <th className="px-6 py-4 text-center">{t('admin.staff.detail.auditTable.type')}</th>
                           <th className="px-6 py-4 text-center">{t('admin.staff.detail.auditTable.quantity')}</th>
                           <th className="px-6 py-4 text-right">{t('admin.staff.detail.auditTable.date')}</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50">
                        {fetchingAudit ? (
                           [...Array(3)].map((_, i) => (
                              <tr key={i}><td colSpan={4} className="px-6 py-4"><SkeletonRow /></td></tr>
                           ))
                        ) : staffAudit.length === 0 ? (
                           <tr>
                              <td colSpan={4} className="px-6 py-12 text-center text-slate-300 italic text-xs font-medium">{t('admin.staff.detail.auditTable.empty')}</td>
                           </tr>
                        ) : staffAudit.map((m: any) => (
                           <tr key={m.id} className="text-xs">
                              <td className="px-6 py-4 font-bold text-slate-700">
                                 {m.product_variants?.products?.name || 'Bilinmeyen Ürün'}
                              </td>
                              <td className="px-6 py-4">
                                 <div className="flex justify-center">
                                    <span className={`flex items-center gap-1 px-2 py-1 rounded-lg font-black text-[9px] ${m.type === 'IN' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                       {m.type === 'IN' ? <ArrowDownRight size={10} /> : <ArrowUpRight size={10} />}
                                       {m.type === 'IN' ? t('admin.staff.detail.auditTable.typeIn') : t('admin.staff.detail.auditTable.typeOut')}
                                    </span>
                                 </div>
                              </td>
                              <td className="px-6 py-4 text-center font-mono font-bold text-slate-600">
                                 {m.quantity}
                              </td>
                              <td className="px-6 py-4 text-right text-slate-400 font-medium">
                                 {new Date(m.created_at).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })}
                              </td>
                           </tr>
                        ))}
                        {/* Satış Geçmişi Placeholder (Gelecek Özellik) */}
                        <tr className="bg-slate-50/20">
                           <td colSpan={4} className="px-6 py-3 text-center border-t border-dashed border-slate-200">
                              <div className="flex items-center justify-center gap-2 text-[9px] font-black text-slate-300 uppercase tracking-widest">
                                 <Activity size={12} /> {t('admin.staff.detail.auditTable.integrationSoon')}
                              </div>
                           </td>
                        </tr>
                     </tbody>
                  </table>
               </div>
            </div>

            {/* Danger Zone */}
            <div className="pt-8 border-t border-slate-100">
               <button 
                 onClick={() => {
                   deleteStaff(selectedStaff.id);
                   setIsDetailOpen(false);
                 }}
                 className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl bg-rose-50 text-rose-500 font-black text-xs hover:bg-rose-100 transition-all border border-rose-100/50"
               >
                 <Trash2 size={16} /> {t('admin.staff.detail.deleteButton')}
               </button>
            </div>
          </div>
        )}
      </SlideOver>
    </div>
  );
}
