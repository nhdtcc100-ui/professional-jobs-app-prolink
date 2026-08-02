import React from 'react';
import { Plus } from 'lucide-react';
import { GlassCard, GlassButton } from '../../ui';

interface GroupCreateFormProps {
  createForm: any;
  setCreateForm: (form: any) => void;
  categories: string[];
  handleCreate: (e: React.FormEvent) => void;
  creating: boolean;
}

export const GroupCreateForm: React.FC<GroupCreateFormProps> = ({
  createForm,
  setCreateForm,
  categories,
  handleCreate,
  creating
}) => {
  return (
    <GlassCard className="rounded-2xl p-6">
      <h3 className="font-black text-slate-800 text-lg mb-6">إنشاء مجموعة احترافية جديدة</h3>
      <form onSubmit={handleCreate} className="space-y-4">
        <div>
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">اسم المجموعة *</label>
          <input 
            className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-400" 
            value={createForm.name} 
            onChange={e => setCreateForm({...createForm, name: e.target.value})} 
            placeholder="مثال: مهندسو البرمجيات العراق" 
          />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">الوصف</label>
          <textarea 
            className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-400 resize-none" 
            rows={3} 
            value={createForm.description} 
            onChange={e => setCreateForm({...createForm, description: e.target.value})} 
            placeholder="ما هدف هذه المجموعة؟" 
          />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">التصنيف</label>
          <select 
            className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none" 
            value={createForm.category} 
            onChange={e => setCreateForm({...createForm, category: e.target.value})}
          >
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl">
          <input 
            type="checkbox" 
            id="private" 
            checked={createForm.is_private} 
            onChange={e => setCreateForm({...createForm, is_private: e.target.checked})} 
            className="w-4 h-4 accent-blue-600" 
          />
          <div>
            <label htmlFor="private" className="font-bold text-sm text-slate-700">مجموعة خاصة</label>
            <p className="text-xs text-slate-400">يتطلب الانضمام موافقة المالك</p>
          </div>
        </div>
        <GlassButton className="w-full py-3" icon={Plus} disabled={creating}>
          {creating ? 'جاري الإنشاء...' : 'إنشاء المجموعة'}
        </GlassButton>
      </form>
    </GlassCard>
  );
};
