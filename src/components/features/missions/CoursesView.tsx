import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, Clock, DollarSign, Users, CheckCircle, 
  ArrowLeft, Tag, Loader2, Plus, AlignLeft, XCircle,
  Send, Image as ImageIcon, Edit3, Trash2, Download, ChevronRight
} from 'lucide-react';
import { Course } from '../../../types';
import { courseService } from '../../../lib/services/courseService';
import { useAppContext } from '../../../contexts/AppContext';

interface CoursesViewProps {
  appUser: any;
  addToast: (m: string, t?: any) => void;
  onPostCourse: () => void;
  onEditCourse?: (course: Course) => void;
}

const LEVEL_COLORS: Record<string, string> = {
  'مبتدئ': 'bg-emerald-50 text-emerald-600 border-emerald-100',
  'متوسط': 'bg-amber-50 text-amber-600 border-amber-100',
  'متقدم': 'bg-red-50 text-red-600 border-red-100',
};

export function CoursesView({ appUser, addToast, onPostCourse, onEditCourse }: CoursesViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'explore' | 'my-courses' | 'requests'>('explore');
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [registrations, setRegistrations] = useState<Record<string, { status: string }>>({});
  const [registering, setRegistering] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [providerRequests, setProviderRequests] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCourses = React.useMemo(() => {
    return courses.filter(course => {
      return course.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
             course.providerName.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [courses, searchQuery]);

  const fetchInitialData = async () => {
    if (!appUser?.id) return;
    setLoading(true);
    try {
      const [coursesRes, regsRes] = await Promise.all([
        courseService.fetchCourses(),
        courseService.getMyRegistrations(appUser.id)
      ]);

      if (coursesRes.data) {
        setCourses(coursesRes.data.map((c: any) => ({
          ...c,
          providerName: c.profiles?.name || c.profiles?.full_name || 'مدرب محترف',
          providerAvatar: c.profiles?.avatar_url || c.profiles?.avatar,
        })));
      }

      if (regsRes.data) {
        const map: Record<string, { status: string }> = {};
        regsRes.data.forEach((r: any) => { map[r.course_id] = { status: r.status }; });
        setRegistrations(map);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, [appUser?.id]);

  useEffect(() => {
    if (activeSubTab === 'requests') fetchProviderRequests();
  }, [activeSubTab]);

  const handleRegister = async (course: Course) => {
    if (!appUser) { addToast('يرجى تسجيل الدخول أولاً', 'error'); return; }
    if (!course.is_active) { addToast('هذه الدورة مغلقة حالياً', 'error'); return; }
    if (registrations[course.id]) { addToast('أنت مسجل في هذه الدورة مسبقاً'); return; }

    setRegistering(course.id);
    try {
      const { error } = await courseService.registerForCourse(course.id, appUser.id);
      if (error) throw new Error(error.message);
      setRegistrations(prev => ({ ...prev, [course.id]: { status: 'pending' } }));
      addToast(`✅ تم التسجيل في "${course.title}" بنجاح!`);
      setSelectedCourse(null);
    } catch (e: any) {
      addToast(e.message || 'فشل التسجيل', 'error');
    } finally {
      setRegistering(null);
    }
  };

  const handleActionRequest = async (regId: string, status: 'approved' | 'rejected') => {
    try {
      const { error } = await courseService.updateRegistrationStatus(regId, status);
      if (error) throw error;
      addToast(status === 'approved' ? '✅ تم قبول الطالب' : '❌ تم رفض الطلب');
      fetchProviderRequests();
    } catch (e: any) {
      addToast(e.message, 'error');
    }
  };

  const handleDeleteCourse = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الدورة؟')) return;
    try {
      const { error } = await courseService.deleteCourse(id);
      if (error) throw error;
      addToast('تم حذف الدورة بنجاح');
      fetchCourses();
    } catch (e: any) {
      addToast(e.message, 'error');
    }
  };

  const exportRequests = (status: string) => {
    const apps = providerRequests.filter(r => r.status === status);
    if (apps.length === 0) {
      addToast('لا توجد بيانات للتصدير في هذه الفئة', 'error');
      return;
    }

    const headers = ['الرقم', 'اسم الطالب', 'اسم الدورة التدريبية', 'البريد الإلكتروني', 'حالة الطلب', 'تاريخ التسجيل'];
    
    let tableHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <style>
          table { border-collapse: collapse; width: 100%; direction: rtl; font-family: 'Segoe UI', sans-serif; }
          th { background-color: #312e81; color: #ffffff; font-weight: bold; padding: 12px; border: 1px solid #cbd5e1; }
          td { padding: 10px; border: 1px solid #cbd5e1; text-align: center; }
          .status-approved { color: #16a34a; font-weight: bold; }
          .status-rejected { color: #dc2626; font-weight: bold; }
          .status-pending { color: #d97706; font-weight: bold; }
        </style>
      </head>
      <body>
        <h2>سجل المتدربين لدورة - ${status === 'approved' ? 'المقبولين' : status === 'rejected' ? 'المرفوضين' : 'قيد الانتظار'}</h2>
        <table>
          <thead>
            <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
          </thead>
          <tbody>
    `;

    apps.forEach((r, idx) => {
      const statusText = r.status === 'approved' ? 'مقبول' : r.status === 'rejected' ? 'مرفوض' : 'انتظار';
      const statusClass = r.status === 'approved' ? 'status-approved' : r.status === 'rejected' ? 'status-rejected' : 'status-pending';

      tableHtml += `
        <tr>
          <td>${idx + 1}</td>
          <td><b>${r.profiles?.full_name || '-'}</b></td>
          <td><b>${r.courses?.title || '-'}</b></td>
          <td>${r.profiles?.email || '-'}</td>
          <td class="${statusClass}">${statusText}</td>
          <td>${new Date(r.created_at).toLocaleDateString('ar-EG')}</td>
        </tr>
      `;
    });

    tableHtml += `</tbody></table></body></html>`;

    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
    link.href = url;
    link.download = `Elevate_Iraq_Courses_${status}_${date}.xls`;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
    addToast('✅ تم تصدير الإكسل بنجاح');
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <Loader2 size={32} className="animate-spin text-blue-500" />
      <p className="text-slate-400 text-sm font-bold">جاري تحميل الدورات...</p>
    </div>
  );

  return (
    <div className="space-y-6" dir="rtl">
      {/* شريط التنقل الفرعي (Sub-Navigation) */}
      <div className="bg-white p-3 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-xl dark:shadow-none flex flex-col md:flex-row items-center justify-between gap-4 sticky top-0 z-20 transition-colors">
        <div className="flex gap-1.5 bg-slate-50 p-1.5 rounded-3xl w-full md:w-fit border border-slate-100 dark:border-slate-700/50 shadow-inner">
          {(['explore', 'my-courses', 'requests'] as const).map((tab) => (
            <button 
              key={tab}
              onClick={() => setActiveSubTab(tab)} 
              className={`flex-none px-8 py-2.5 rounded-2xl text-[10px] font-black transition-all active:scale-95 ${activeSubTab === tab ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800'}`}
            >
              {tab === 'explore' ? 'الاستكشاف' : tab === 'my-courses' ? 'دوراتي' : 'الطلبات'}
            </button>
          ))}
        </div>
        {appUser && activeSubTab === 'explore' && (
          <button onClick={onPostCourse} className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-2xl text-[11px] font-black hover:bg-blue-700 hover:shadow-lg transition-all border border-transparent shadow-lg shadow-blue-500/10">
            <Plus size={14} /> نشر دورة جديدة
          </button>
        )}
      </div>

      {/* 3. منطقة المحتوى (Content Area) */}
      <div className="min-h-[400px]">
        {activeSubTab === 'explore' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1 relative">
                <input 
                  type="text" 
                  placeholder="ابحث عن دورة أو مدرب..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-6 py-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-[1.5rem] text-xs font-bold focus:ring-2 focus:ring-blue-500/20 dark:text-white outline-none shadow-sm"
                />
                <BookOpen size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-500" />
              </div>
            </div>

            {filteredCourses.length === 0 ? (
              <div className="py-24 text-center bg-white/50 dark:bg-slate-800/50 rounded-[2.5rem] border-2 border-dashed border-slate-100 dark:border-slate-700 shadow-sm">
                <BookOpen size={32} className="mx-auto text-slate-200 dark:text-slate-600 mb-3" />
                <p className="text-slate-400 dark:text-slate-500 font-bold">لا توجد نتائج تطابق بحثك</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-24">
                {filteredCourses.map((course, i) => {
                  const reg = registrations[course.id];
                  const isActive = course.is_active !== false;
                  return (
                    <motion.div 
                      key={course.id} 
                      initial={{ opacity: 0, y: 16 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      transition={{ delay: i * 0.04 }} 
                      onClick={() => setSelectedCourse(course)} 
                      className={`group bg-white dark:bg-slate-800 border rounded-[2rem] overflow-hidden cursor-pointer transition-all duration-500 active:scale-[0.98] flex flex-col h-full shadow-sm hover:shadow-2xl hover:shadow-indigo-100/50 dark:hover:shadow-none ${isActive ? 'border-slate-100 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-800' : 'opacity-75'}`}
                    >
                      <div className="relative h-44 shrink-0 overflow-hidden">
                        <img 
                          src={course.image_url || 'https://images.unsplash.com/photo-1557683316-973673baf926?w=800&q=80'} 
                          alt="" 
                          className={`w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110 ${!isActive ? 'grayscale' : ''}`} 
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent opacity-60" />
                        
                        <div className="absolute top-4 right-4 flex flex-col gap-2">
                          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider backdrop-blur-md border shadow-sm ${isActive ? 'bg-emerald-500 text-white border-emerald-400/30' : 'bg-slate-700 text-white border-slate-600/30'}`}>
                            {isActive ? <CheckCircle size={10} /> : <XCircle size={10} />}
                            {isActive ? 'مفتوح' : 'مغلق'}
                          </div>
                          <div className={`flex items-center justify-center px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider backdrop-blur-md border shadow-sm ${LEVEL_COLORS[course.level || 'مبتدئ']}`}>
                            {course.level || 'مبتدئ'}
                          </div>
                        </div>

                        <div className="absolute bottom-4 right-4">
                          <div className="flex items-center gap-2">
                             <div className="w-8 h-8 rounded-lg border-2 border-white/50 overflow-hidden shadow-lg backdrop-blur-sm">
                               <img src={course.providerAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(course.providerName)}&background=indigo&color=fff`} className="w-full h-full object-cover" alt="" />
                             </div>
                             <span className="text-[10px] font-black text-white drop-shadow-md">{course.providerName}</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-6 flex flex-col flex-1">
                        <div className="flex-1">
                          <h4 className="font-black text-slate-800 dark:text-white text-base leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2 mb-3">
                            {course.title}
                          </h4>
                          
                          <div className="flex items-center gap-4 mb-4">
                            <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                              <Clock size={12} className="text-indigo-400" />
                              <span className="text-[10px] font-bold">{course.duration || 'غير محدد'}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                              <Users size={12} className="text-indigo-400" />
                              <span className="text-[10px] font-bold">متدربين</span>
                            </div>
                          </div>

                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed line-clamp-2 mb-4">
                            {course.description}
                          </p>
                        </div>

                        <div className="mt-auto flex items-center justify-between pt-4 border-t border-slate-50 dark:border-slate-700/50">
                          <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">تكلفة الدورة</span>
                            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{course.price || 'مجاني'}</span>
                          </div>
                          
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleRegister(course); }} 
                            disabled={!!reg || !isActive} 
                            className={`px-5 py-2.5 rounded-xl text-[10px] font-black transition-all shadow-sm active:scale-95 ${
                              reg 
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                                : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-100 dark:hover:shadow-none'
                            }`}
                          >
                            {reg ? 'تم التسجيل' : 'سجل الآن'}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeSubTab === 'my-courses' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-between">
              <div>
                <h3 className="font-black text-slate-800 dark:text-white text-lg">إدارة دوراتي المنشورة</h3>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1">لديك {courses.filter(c => c.provider_id === appUser?.id).length} دورة نشطة حالياً</p>
              </div>
              <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-inner border border-indigo-100 dark:border-indigo-800/50">
                <BookOpen size={24} />
              </div>
            </div>

            <div className="grid gap-4">
              {courses.filter(c => c.provider_id === appUser?.id).length === 0 ? (
                <div className="py-24 text-center bg-white dark:bg-slate-800 rounded-[3.5rem] border-2 border-dashed border-slate-100 dark:border-slate-700 flex flex-col items-center">
                  <div className="w-20 h-20 bg-slate-50 dark:bg-slate-900/30 rounded-[2rem] flex items-center justify-center mb-5 border border-slate-100 dark:border-slate-700 shadow-inner">
                    <BookOpen size={32} className="text-slate-200 dark:text-slate-600" />
                  </div>
                  <p className="text-slate-400 dark:text-slate-500 font-black text-xs uppercase tracking-widest">لم تقم بنشر أي دورات حتى الآن</p>
                </div>
              ) : (
                courses.filter(c => c.provider_id === appUser?.id).map((course, idx) => (
                  <motion.div
                    key={course.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 flex flex-col md:flex-row justify-between items-center gap-6 shadow-sm hover:shadow-xl transition-all group"
                  >
                    <div className="flex items-center gap-5 min-w-0 flex-1">
                      <div className="w-14 h-14 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl flex items-center justify-center text-indigo-600 shrink-0 border border-indigo-100 shadow-sm">
                        {course.image_url ? (
                          <img src={course.image_url} className="w-full h-full object-cover rounded-2xl" alt="" />
                        ) : (
                          <BookOpen size={24} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-black text-slate-800 text-base truncate group-hover:text-indigo-600 transition-colors">{course.title}</h4>
                        <div className="flex flex-wrap items-center gap-4 mt-2">
                          <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            <Clock size={12} className="text-slate-300" /> {course.duration || 'غير محدد'}
                          </span>
                          <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-500 uppercase tracking-wider">
                            <Users size={12} /> {providerRequests.filter(r => r.course_id === course.id && r.status === 'approved').length} طالب مقبول
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 shrink-0">
                      <button onClick={() => setSelectedCourse(course)} className="p-3 bg-white text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl border border-slate-100 transition-all active:scale-90" title="معاينة">
                        <BookOpen size={18} />
                      </button>
                      <button onClick={() => onEditCourse?.(course)} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl border border-indigo-100 transition-all active:scale-95 font-bold text-xs">
                        <Edit3 size={14} />
                        <span>تعديل</span>
                      </button>
                      <button onClick={() => handleDeleteCourse(course.id)} className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-xl border border-red-100 transition-all active:scale-95 font-bold text-xs">
                        <Trash2 size={14} />
                        <span>حذف</span>
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        )}

        {activeSubTab === 'requests' && (
          <div className="space-y-8 pb-32">
            <div className="flex items-center justify-between bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
              <h3 className="text-xs font-black text-slate-800 mr-2">إجمالي المتقدمين ({providerRequests.length})</h3>
              <div className="flex gap-2">
                <button onClick={() => {
                  const apps = providerRequests;
                  if (apps.length === 0) { addToast('لا توجد بيانات', 'error'); return; }
                  const headers = ['Student Name', 'Course Title', 'Email', 'Status', 'Date'];
                  const rows = apps.map(r => [r.profiles?.full_name, r.courses?.title, r.profiles?.email || '', r.status, new Date(r.created_at).toLocaleDateString()]);
                  const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.join(",")).join("\n");
                  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = url; link.download = `prolink_course_all.csv`; link.click();
                }} className="flex items-center gap-2 px-5 py-2 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black border border-blue-100 hover:bg-blue-100 transition-all">
                  <Download size={14} /> تصدير الكل
                </button>
              </div>
            </div>

            {[
              { id: 'pending', label: 'قيد المراجعة', dot: 'bg-blue-500' },
              { id: 'approved', label: 'المقبولين', dot: 'bg-emerald-500' },
              { id: 'rejected', label: 'المرفوضين', dot: 'bg-red-500' }
            ].map((section) => {
              const reqs = providerRequests.filter(r => r.status === section.id);
              return (
                <div key={section.id} className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${section.dot}`} />
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">{section.label}</h3>
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold">{reqs.length}</span>
                    </div>
                    {section.id === 'approved' && reqs.length > 0 && (
                      <button onClick={() => exportRequests('approved')} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black border border-emerald-100 hover:bg-emerald-100 transition-all">
                        <Download size={12} /> تحميل المقبولين (CSV)
                      </button>
                    )}
                    {section.id === 'rejected' && reqs.length > 0 && (
                      <button onClick={() => exportRequests('rejected')} className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-[9px] font-black border border-red-100 hover:bg-red-100 transition-all">
                        <Download size={12} /> تحميل المرفوضين (CSV)
                      </button>
                    )}
                  </div>

                  {reqs.length === 0 ? (
                    <div className="py-8 text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                      <p className="text-[10px] font-bold text-slate-400">لا يوجد متقدمون في هذا القسم حالياً</p>
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      {reqs.map((req) => (
                        <motion.div
                          key={req.id} layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                          className="group flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md cursor-default transition-all"
                        >
                          <img src={req.profiles?.avatar_url || req.profiles?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(req.profiles?.name || req.profiles?.full_name || 'U')}&background=random`} className="w-12 h-12 rounded-xl object-cover" alt="" />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-black text-sm text-slate-800 truncate">{req.profiles?.name || req.profiles?.full_name}</h4>
                            <p className="text-[10px] text-blue-600 font-bold uppercase truncate">الدورة: {req.courses?.title}</p>
                          </div>
                          <div className="flex items-center gap-1">
                             {section.id === 'pending' && (
                               <>
                                 <button onClick={(e) => { e.stopPropagation(); handleActionRequest(req.id, 'approved'); }} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-500 hover:text-white transition-all"><CheckCircle size={14} /></button>
                                 <button onClick={(e) => { e.stopPropagation(); handleActionRequest(req.id, 'rejected'); }} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-500 hover:text-white transition-all"><XCircle size={14} /></button>
                               </>
                             )}
                             <ChevronRight size={14} className="text-slate-300" />
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. مودال تفاصيل الدورة (Course Details Modal) */}
      <AnimatePresence>
        {selectedCourse && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[120] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setSelectedCourse(null)}>
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="bg-white w-full max-w-lg rounded-[2.5rem] overflow-hidden flex flex-col shadow-2xl max-h-[85vh]" onClick={e => e.stopPropagation()} dir="rtl">
              <div className="h-48 bg-slate-100 relative">
                {selectedCourse.image_url && <img src={selectedCourse.image_url} className="w-full h-full object-cover opacity-50" alt="" />}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <button onClick={() => setSelectedCourse(null)} className="absolute top-4 left-4 p-2 bg-white/20 backdrop-blur-md rounded-xl text-white"><ArrowLeft size={18} className="rotate-180" /></button>
                <div className="absolute bottom-4 right-5"><h2 className="text-xl font-black text-white leading-tight">{selectedCourse.title}</h2><p className="text-white/70 text-xs font-bold">{selectedCourse.providerName}</p></div>
              </div>
              <div className="p-8 overflow-y-auto">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">وصف الدورة</h3>
                <p className="text-xs text-slate-500 leading-relaxed mb-6">{selectedCourse.description}</p>
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="p-4 bg-blue-50 rounded-2xl"><p className="text-[9px] font-black text-blue-400 mb-1 uppercase">المستوى</p><p className="text-xs font-black text-blue-600">{selectedCourse.level || 'مبتدئ'}</p></div>
                  <div className="p-4 bg-emerald-50 rounded-2xl"><p className="text-[9px] font-black text-emerald-400 mb-1 uppercase">السعر</p><p className="text-xs font-black text-emerald-600">{selectedCourse.price || 'مجاني'}</p></div>
                </div>
                <button onClick={() => handleRegister(selectedCourse)} disabled={!!registrations[selectedCourse.id]} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-sm hover:bg-blue-700 transition-all active:scale-95">{registrations[selectedCourse.id] ? 'أنت مسجل بالفعل' : 'سجل في الدورة الآن'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
