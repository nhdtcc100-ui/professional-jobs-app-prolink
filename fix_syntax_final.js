const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

const badPart = "appUser.bio || 'لا توجد نبذة تعريفية مضافة لهذا الحساب.'}\n---\nتم ال";

const badIdx = content.indexOf(badPart);
if (badIdx === -1) {
  console.log("Could not find the bad part!");
  process.exit(1);
}

// Find where the next valid part starts: <div className="grid grid-cols-1
const nextValidIdx = content.indexOf('<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">', badIdx);

if (nextValidIdx === -1) {
  console.log("Could not find the next valid part!");
  process.exit(1);
}

const goodReplacement = `appUser.bio || 'لا توجد نبذة تعريفية مضافة لهذا الحساب.'}
---
تم التقديم عبر برو لينك\`;

    try {
      const { error } = await supabase.from('messages').insert([{
        sender_id: appUser.id,
        receiver_id: job.employerId || job.employer_id,
        content: cvMessage
      }]);
      if (error) throw error;
      addToast('تم إرسال طلب التقديم بنجاح إلى صاحب العمل ✅');
    } catch (e) {
      addToast('فشل التقديم: ' + e.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 mb-8">
        <h3 className="font-black text-lg text-slate-800 mb-4">نشر توجيه مهني جديد</h3>
        <div className="space-y-4">
          <input className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-100 outline-none transition-all" placeholder="المسمى الوظيفي" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <input className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-100 outline-none transition-all" placeholder="الشركة / الجهة" value={formData.company} onChange={e => setFormData({ ...formData, company: e.target.value })} />
            <input className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-100 outline-none transition-all" placeholder="الموقع" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} />
          </div>
          <textarea className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-100 outline-none transition-all resize-none h-24" placeholder="التفاصيل الوظيفية (يفضل إضافة الراتب)" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
          <GlassButton onClick={handlePostJob} disabled={isPosting} className="w-full py-3" icon={Briefcase}>
            {isPosting ? 'جاري النشر...' : 'نشر التوجيه'}
          </GlassButton>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-black text-lg text-slate-800 mb-4">المهام المتاحة</h3>
        {jobs.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-[2.5rem] border border-slate-100">
            <Briefcase size={48} className="mx-auto text-slate-200 mb-4" />
            <p className="text-slate-400 font-bold">لا توجد مهام مطروحة حالياً</p>
          </div>
        ) : jobs.map(j => (
          <GlassCard key={j.id} className="rounded-2xl p-6 hover:shadow-lg transition-all group">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="font-black text-lg text-slate-800">{j.title}</h4>
                <p className="text-blue-600 font-bold text-sm mt-1">{j.company}</p>
              </div>
              <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded-lg font-bold flex items-center gap-1"><MapPin size={10} /> {j.location}</span>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed mb-6">{j.description}</p>
            <div className="flex justify-between items-center border-t border-slate-50 pt-4">
              <span className="text-[10px] text-slate-400 font-bold">تم النشر: {j.postedAt ? new Date(j.postedAt).toLocaleDateString('ar') : ''}</span>
              <GlassButton onClick={() => handleApply(j)} className="px-6 py-2 text-xs" icon={Send}>
                تقديم رسمي
              </GlassButton>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

function NetworkView({ users, onUserClick, onSyncSignal, getStatus, getIsOutgoing }: any) {
  return (
    `;

// The slice
const newContent = content.substring(0, badIdx) + goodReplacement + content.substring(nextValidIdx);

fs.writeFileSync('src/App.tsx', newContent, 'utf8');
console.log('Successfully fixed App.tsx syntax!');
