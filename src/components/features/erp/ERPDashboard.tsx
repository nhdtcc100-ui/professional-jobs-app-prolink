import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Clock, 
  DollarSign, 
  Building2, 
  Download, 
  Monitor,
  CheckCircle,
  LogIn,
  LogOut,
  ChevronRight,
  TrendingUp,
  Award,
  ShieldCheck,
  FileText,
  ExternalLink
} from 'lucide-react';
import { erpService } from '../../../lib/services/erpService';
import { biometricService } from '../../../lib/services/biometricService';
import { AppUser, Employee, Attendance } from '../../../types';
import { GlassCard } from '../../ui';
import { KioskSetupCard } from './KioskSetupCard';
import { KioskModeView } from './KioskModeView';

interface ERPDashboardProps {
  appUser: AppUser;
  addToast: (msg: string, type?: any) => void;
}

export const ERPDashboard: React.FC<ERPDashboardProps> = ({ appUser, addToast }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'employees' | 'attendance' | 'salary' | 'ranks' | 'kiosk' | 'leaves'>('employees');
  const [isScanning, setIsScanning] = useState(false);
  const [scanningUser, setScanningUser] = useState<string | null>(null);

  const [kioskMode, setKioskMode] = useState(false);
  const onEnterKiosk = () => setKioskMode(true);
  const onExitKiosk = () => setKioskMode(false);

  useEffect(() => {
    fetchERPData();
  }, [appUser.id]);

  const fetchERPData = async () => {
    setLoading(true);
    try {
      const { data: empData, error: empErr } = await erpService.getEmployeesByEmployer(appUser.id);
      if (empErr) throw empErr;

      if (empData && empData.length > 0) {
        const { supabase } = await import('../../../lib/supabase');
        
        // --- High Performance Bulk Fetching ---
        const userIds = empData.map(e => e.user_id);
        const jobIds = [...new Set(empData.map(e => e.job_id))];

        const [profilesRes, jobsRes] = await Promise.all([
          supabase.from('profiles').select('id, name, avatar_url, role').in('id', userIds),
          supabase.from('jobs').select('id, title').in('id', jobIds)
        ]);

        const profilesMap = Object.fromEntries((profilesRes.data || []).map(p => [p.id, p]));
        const jobsMap = Object.fromEntries((jobsRes.data || []).map(j => [j.id, j]));

        const enrichedEmp = empData.map((emp: Employee) => {
          const profile = profilesMap[emp.user_id];
          const job = jobsMap[emp.job_id];
          return {
            ...emp,
            employee_data: {
              name: profile?.name || 'مستخدم',
              avatar: profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.name || 'E')}&background=0a66c2&color=fff`,
              role: job?.title || 'وظيفة'
            }
          };
        });

        setEmployees(enrichedEmp);
        
        const { data: attData } = await erpService.getEmployerAttendanceReports(appUser.id);
        if (attData) setAttendance(attData);
      }
    } catch (error) {
      console.error('ERP Fetch Error:', error);
      addToast('فشل جلب بيانات الموارد البشرية بشكل آمن', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
     return <div className="p-20 flex justify-center"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (kioskMode) {
    return <KioskModeView appUser={appUser} addToast={addToast} onExit={onExitKiosk} />;
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const todayAttendance = attendance.filter(a => a.date === todayStr);

  return (
    <div className="max-w-6xl mx-auto px-2 sm:px-4 lg:px-6 mb-20" dir="rtl">
      {/* Premium ERP Terminal Window */}
      <GlassCard className="rounded-[2.5rem] md:rounded-[3.5rem] border-none shadow-[0_40px_100px_rgba(0,0,0,0.08)] dark:shadow-[0_40px_120px_rgba(0,0,0,0.5)] bg-white/90 dark:bg-slate-900/90 backdrop-blur-3xl overflow-hidden min-h-[85vh] flex flex-col">
        
        {/* Window Header / Global Info */}
        <div className="bg-gradient-to-br from-[#020617] via-[#0f172a] to-[#1e293b] p-6 md:p-10 relative overflow-hidden group">
          <div className="absolute -right-20 -top-20 w-80 h-80 bg-blue-600/10 blur-[100px] rounded-full animate-pulse" />
          <div className="absolute -left-20 -bottom-20 w-60 h-60 bg-indigo-500/10 blur-[80px] rounded-full" />
          
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-center md:text-right">
              <div className="inline-flex items-center gap-3 bg-white/5 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-2xl mb-4 shadow-xl">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-200">Terminal Pro • {appUser.companyName || 'ProLink Corp'}</span>
              </div>
              <h1 className="text-2xl md:text-4xl font-black text-white tracking-tighter flex items-center gap-3 justify-center md:justify-start">
                <ShieldCheck className="text-blue-500 w-8 h-8 md:w-10 md:h-10" />
                إدارة الموارد البشرية
              </h1>
            </div>
            
            <div className="flex gap-4">
              <div className="bg-white/5 backdrop-blur-2xl rounded-2xl md:rounded-[2.5rem] px-8 py-5 border border-white/10 text-center shadow-2xl transition-all hover:bg-white/10 group/stat">
                <Users className="mx-auto mb-2 text-blue-400 group-hover/stat:scale-110 transition-transform" size={20} />
                <p className="text-2xl md:text-3xl font-black text-white">{employees.length}</p>
                <p className="text-[8px] uppercase tracking-[0.2em] font-black text-blue-300/60">موظف مسجل</p>
              </div>
              <div className="bg-white/5 backdrop-blur-2xl rounded-2xl md:rounded-[2.5rem] px-8 py-5 border border-white/10 text-center shadow-2xl transition-all hover:bg-white/10 group/stat">
                <TrendingUp className="mx-auto mb-2 text-emerald-400 group-hover/stat:scale-110 transition-transform" size={20} />
                <p className="text-2xl md:text-3xl font-black text-white">{todayAttendance.length}</p>
                <p className="text-[8px] uppercase tracking-[0.2em] font-black text-emerald-300/60">حضور اليوم</p>
              </div>
            </div>
          </div>
        </div>

        {/* Professional 3D Tab Navigation */}
        <div className="p-3 md:p-6 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap md:flex-nowrap gap-2 md:gap-3 justify-center">
            {[
              { id: 'employees', label: 'الموظفين', icon: Users },
              { id: 'attendance', label: 'سجل الحضور', icon: Clock },
              { id: 'leaves', label: 'الإجازات', icon: FileText },
              { id: 'salary', label: 'الرواتب', icon: DollarSign },
              { id: 'ranks', label: 'الرتب', icon: Award },
              { id: 'kiosk', label: 'البصمة', icon: Monitor },
            ].map(t => (
              <button
                key={t.id}
                id={t.id === 'kiosk' ? 'erp-kiosk-tab' : undefined}
                onClick={() => setActiveTab(t.id as any)}
                className={`flex-1 min-w-[70px] md:min-w-0 flex items-center justify-center gap-1.5 md:gap-3 py-3 md:py-4 px-2 md:px-8 rounded-2xl md:rounded-3xl text-[9px] md:text-[11px] font-black transition-all duration-500 relative group overflow-hidden ${
                  activeTab === t.id 
                    ? `bg-slate-900 text-white shadow-[0_15px_30px_rgba(0,0,0,0.2)] scale-105` 
                    : 'text-slate-500 hover:bg-white dark:hover:bg-slate-800 hover:text-blue-600 border border-transparent hover:border-slate-100'
                }`}
              >
                {activeTab === t.id && (
                  <motion.div layoutId="erp_active_tab" className="absolute inset-0 bg-blue-600 -z-10" />
                )}
                <t.icon size={14} className={activeTab === t.id ? 'animate-pulse' : 'group-hover:rotate-12 transition-transform'} /> 
                <span className="uppercase tracking-tight md:tracking-widest">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Content Area */}
        <div className="flex-1 p-6 md:p-10 relative min-h-0 overflow-y-auto">
          <AnimatePresence mode="wait">
            {activeTab === 'employees' && (
              <motion.div key="emp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                
                {/* Security & Permissions Pre-flight (Crucial for Mobile) */}
                <GlassCard className="p-4 rounded-[2rem] border-blue-100 dark:border-blue-900/30 bg-blue-50/30 dark:bg-blue-900/10">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4 text-right">
                      <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <ShieldCheck size={24} />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-800 dark:text-white">إعدادات الأمان والخصوصية</h4>
                        <p className="text-[10px] text-slate-400 font-bold">يجب الموافقة على الأذونات لتفعيل البصمة والكاميرا</p>
                      </div>
                    </div>
                    <button 
                      onClick={async () => {
                        const webRTC = new (await import('../../../lib/services/webRTCService')).WebRTCService(appUser?.id || 'setup');
                        const media = await webRTC.requestPermissions();
                        const bio = await biometricService.checkBiometricSupport();
                        
                        if (media.error) addToast(media.error, 'error');
                        else if (bio.error) addToast(bio.error, 'warning');
                        else addToast('تم تفعيل كافة الصلاحيات بنجاح ✅', 'success');
                      }}
                      className="w-full md:w-auto px-6 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all uppercase tracking-widest"
                    >
                      تفعيل الحساسات والأذونات
                    </button>
                  </div>
                </GlassCard>

                <div className="flex flex-col md:flex-row justify-between items-center gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tighter">قائمة الكادر الوظيفي</h3>
                    <p className="text-xs text-slate-400 font-bold mt-1">إدارة بيانات ومؤهلات الفريق الخاص بك</p>
                  </div>
                  <button onClick={fetchERPData} className="flex items-center gap-2 px-6 py-3 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-black text-[10px] hover:bg-blue-50 hover:text-blue-600 transition-all border border-slate-100 dark:border-slate-700">
                    <Clock size={16} /> تحديث البيانات
                  </button>
                </div>
                
                {employees.length === 0 ? (
                  <div className="text-center py-32 bg-slate-50/50 dark:bg-slate-900/30 rounded-[3rem] border-4 border-dashed border-slate-100 dark:border-slate-800">
                    <Users size={64} className="mx-auto text-slate-200 mb-6" />
                    <p className="font-black text-xl text-slate-400">لا يوجد موظفين مسجلين حالياً</p>
                    <p className="text-xs text-slate-300 font-bold mt-2 tracking-widest uppercase">ابدأ بإضافة أعضاء الفريق من لوحة التحكم</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {employees.map((emp, i) => (
                      <motion.div 
                        key={emp.id} 
                        initial={{ opacity: 0, x: -10 }} 
                        animate={{ opacity: 1, x: 0 }} 
                        transition={{ delay: i * 0.05 }}
                      >
                        <div className="group relative bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl p-3 border border-slate-100 dark:border-slate-700/50 hover:border-blue-500/50 transition-all flex items-center justify-between gap-4 shadow-sm hover:shadow-md">
                          
                          {/* Identity Section */}
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="relative flex-shrink-0">
                              <img 
                                src={emp.employee_data?.avatar} 
                                className="w-12 h-12 rounded-xl object-cover border border-slate-100 dark:border-slate-700 shadow-sm transition-transform group-hover:scale-105" 
                              />
                              <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 ${emp.biometric_id ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-sm font-black text-slate-800 dark:text-white truncate">{emp.employee_data?.name}</h4>
                              <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{emp.employee_data?.role}</p>
                            </div>
                          </div>

                          {/* Quick Actions */}
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={async () => {
                                setScanningUser(emp.employee_data?.name || '');
                                setIsScanning(true);
                                const { credentialId, error } = await biometricService.registerUserBiometric(emp.id, emp.employee_data?.name || '');
                                setIsScanning(false);
                                setScanningUser(null);
                                if (error) addToast(error, 'error');
                                else { addToast('تم تسجيل البصمة بنجاح!', 'success'); fetchERPData(); }
                              }}
                              className={`h-9 px-5 rounded-xl text-[9px] font-black transition-all flex items-center gap-2 ${
                                emp.biometric_id 
                                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                                  : 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95'
                              }`}
                            >
                              <ShieldCheck size={12} />
                              {emp.biometric_id ? 'تحديث' : 'تسجيل'}
                            </button>
                            <button className="h-9 w-9 flex items-center justify-center bg-slate-50 dark:bg-slate-700/50 text-slate-400 dark:text-slate-500 rounded-xl hover:bg-blue-600 hover:text-white transition-all">
                              <ExternalLink size={14} />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'attendance' && (
              <motion.div key="att" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 pb-8 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tighter">سجل الحضور الذكي</h3>
                    <p className="text-xs text-slate-400 font-bold mt-1">مراقبة الوقت الفعلي لحضور وانصراف الفريق</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button className="px-5 py-2.5 bg-blue-600 text-white rounded-2xl font-black text-[10px] shadow-lg shadow-blue-500/20 flex items-center gap-2 uppercase tracking-widest">
                       <FileText size={14} /> تصدير Excel
                    </button>
                    <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
                      <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest animate-pulse">Live Tracking</span>
                    </div>
                  </div>
                </div>
                
                <div className="overflow-hidden rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900/50">
                  <table className="w-full text-right">
                    <thead className="bg-slate-900 text-white">
                      <tr>
                        <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em]">الموظف</th>
                        <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em]">توقيت الحضور</th>
                        <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em]">توقيت الانصراف</th>
                        <th className="p-6 text-center text-[10px] font-black uppercase tracking-[0.2em]">التوثيق البصري</th>
                        <th className="p-6 text-center text-[10px] font-black uppercase tracking-[0.2em]">الحالة الأمنية</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                      {attendance.map((att, i) => {
                        const emp = employees.find(e => e.id === att.employee_id);
                        return (
                          <motion.tr 
                            key={att.id} 
                            initial={{ opacity: 0, y: 10 }} 
                            animate={{ opacity: 1, y: 0 }} 
                            transition={{ delay: i * 0.05 }}
                            className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors group"
                          >
                            <td className="p-6">
                              <div className="flex items-center gap-4">
                                <img src={emp?.employee_data?.avatar} className="w-10 h-10 rounded-xl object-cover" />
                                <span className="font-black text-sm text-slate-800 dark:text-white group-hover:text-blue-600 transition-colors">{emp?.employee_data?.name}</span>
                              </div>
                            </td>
                            <td className="p-6 text-emerald-600 font-black text-xs" dir="ltr">
                              <div className="flex items-center gap-2"><LogIn size={14} /> {new Date(att.check_in_time).toLocaleTimeString('en-US', { hour: '2-digit', minute:'2-digit' })}</div>
                            </td>
                            <td className="p-6 text-orange-500 font-black text-xs" dir="ltr">
                              {att.check_out_time ? (
                                <div className="flex items-center gap-2"><LogOut size={14} /> {new Date(att.check_out_time).toLocaleTimeString('en-US', { hour: '2-digit', minute:'2-digit' })}</div>
                              ) : '--:--'}
                            </td>
                            <td className="p-6">
                               <div className="flex justify-center">
                                 {att.photo_url ? (
                                   <div className="relative group/photo">
                                     <img src={att.photo_url} className="w-10 h-10 rounded-lg object-cover border-2 border-blue-500/20 group-hover/photo:scale-110 transition-transform cursor-pointer" />
                                     <div className="absolute opacity-0 group-hover/photo:opacity-100 transition-opacity bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 h-48 bg-white rounded-2xl shadow-2xl border-4 border-white overflow-hidden pointer-events-none z-50">
                                       <img src={att.photo_url} className="w-full h-full object-cover" />
                                       <div className="absolute bottom-0 inset-x-0 bg-blue-600 py-1 text-white text-[8px] font-black text-center uppercase">Live Audit Image</div>
                                     </div>
                                   </div>
                                 ) : (
                                   <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300">
                                     <ShieldCheck size={16} />
                                   </div>
                                 )}
                               </div>
                            </td>
                            <td className="p-6 text-center">
                              <span className={`px-4 py-2 rounded-2xl text-[9px] font-black tracking-widest ${
                                att.status === 'present' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                              }`}>
                                {att.status === 'present' ? '✅ نـظامـي' : '⏰ تـأخـيـر'}
                              </span>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {activeTab === 'leaves' && (
              <motion.div key="leaves" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
                <div className="flex justify-between items-center pb-6 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tighter">طلبات الإجازة المعلقة</h3>
                  <div className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest">
                    3 طلبات جديدة
                  </div>
                </div>
                
                <div className="grid gap-4">
                  {employees.slice(0, 3).map((emp, i) => (
                    <div key={emp.id} className="p-6 bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 flex flex-col md:flex-row justify-between items-center gap-6 group hover:shadow-xl transition-all">
                      <div className="flex items-center gap-5">
                        <img src={emp.employee_data?.avatar} className="w-14 h-14 rounded-2xl object-cover border-2 border-white shadow-md" />
                        <div>
                          <p className="font-black text-lg text-slate-800 dark:text-white group-hover:text-blue-600 transition-colors">{emp.employee_data?.name}</p>
                          <div className="flex items-center gap-3 mt-1">
                             <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">إجازة مرضية • 3 أيام</p>
                             <span className="text-slate-300">|</span>
                             <p className="text-[10px] font-bold text-slate-400">تبدأ في: 2024-05-10</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button className="px-6 py-3 bg-emerald-500 text-white rounded-2xl text-[10px] font-black shadow-lg shadow-emerald-200 hover:scale-105 transition-all">موافقة</button>
                        <button className="px-6 py-3 bg-red-50 text-red-500 rounded-2xl text-[10px] font-black hover:bg-red-100 transition-all">رفض</button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'salary' && (
              <motion.div key="sal" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">
                <div className="flex justify-between items-center pb-8 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tighter">مسير الرواتب والمالية</h3>
                  <button className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl">تحميل كشف مجمع</button>
                </div>
                <div className="grid gap-4">
                  {employees.map(emp => (
                    <div key={emp.id} className="p-6 bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 flex flex-col md:flex-row justify-between items-center gap-6 group hover:shadow-xl transition-all">
                      <div className="flex items-center gap-5">
                        <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center text-blue-600">
                          <DollarSign size={28} />
                        </div>
                        <div>
                          <p className="font-black text-lg text-slate-800 dark:text-white group-hover:text-blue-600 transition-colors">{emp.employee_data?.name}</p>
                          <div className="flex items-center gap-3 mt-1">
                             <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">الأساسي: {emp.salary}</p>
                             <span className="text-slate-300">|</span>
                             <p className="text-[10px] font-bold text-slate-400">{emp.department}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button className="px-6 py-3 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 rounded-2xl text-[10px] font-black hover:bg-blue-600 hover:text-white transition-all">مراجعة الخصومات</button>
                        <button className="px-6 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black shadow-lg shadow-blue-500/20 hover:scale-105 transition-all flex items-center gap-2">
                           <Download size={14} /> تحميل الفاتورة
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'ranks' && (
              <motion.div key="ranks" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8">
                 <div className="flex justify-between items-center pb-8 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tighter">الرتب والتقييم المهني</h3>
                  <div className="p-3 bg-amber-50 rounded-xl text-amber-600"><Award size={24} /></div>
                </div>
                
                <div className="grid md:grid-cols-2 gap-6">
                  {employees.map((emp, i) => (
                    <div key={emp.id} className="p-8 bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-[3rem] border border-slate-100 dark:border-slate-700 shadow-sm relative group overflow-hidden">
                       <div className="absolute top-0 left-0 w-2 h-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                       <div className="flex items-center gap-6">
                          <div className="relative">
                             <img src={emp.employee_data?.avatar} className="w-20 h-20 rounded-[1.5rem] object-cover" />
                             <div className="absolute -top-2 -right-2 bg-amber-400 text-white p-1.5 rounded-lg shadow-lg">
                                <TrendingUp size={14} />
                             </div>
                          </div>
                          <div>
                             <h4 className="font-black text-lg text-slate-800 dark:text-white">{emp.employee_data?.name}</h4>
                             <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1">الرتبة: محترف درجة أ</p>
                             <div className="flex gap-1 mt-3">
                                {[1,2,3,4,5].map(s => <div key={s} className={`w-2 h-2 rounded-full ${s <= 4 ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]' : 'bg-slate-200'}`} />)}
                             </div>
                          </div>
                       </div>
                       <div className="mt-8 grid grid-cols-2 gap-4">
                          <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 text-center">
                             <p className="text-[9px] font-black text-slate-400 uppercase mb-1">الالتزام</p>
                             <p className="text-sm font-black text-emerald-600">98%</p>
                          </div>
                          <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 text-center">
                             <p className="text-[9px] font-black text-slate-400 uppercase mb-1">الإنتاجية</p>
                             <p className="text-sm font-black text-blue-600">متفوق</p>
                          </div>
                       </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'kiosk' && (
              <motion.div key="kiosk" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-12 text-center max-w-xl mx-auto">
                <div className="w-24 h-24 bg-blue-600/10 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 text-blue-600 shadow-inner">
                  <Monitor size={48} />
                </div>
                <h3 className="text-3xl font-black text-slate-800 dark:text-white mb-4 tracking-tighter text-right">محطة البصمة المركزية</h3>
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-[3rem]">
                   <KioskSetupCard appUser={appUser} addToast={addToast} onEnterKiosk={onEnterKiosk} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </GlassCard>

      {/* ─── Biometric Scanning Modal ─── */}
      <AnimatePresence>
        {isScanning && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-xl"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white dark:bg-slate-900 rounded-[3rem] p-10 max-w-sm w-full text-center shadow-2xl border border-white/10"
            >
              <div className="relative w-32 h-32 mx-auto mb-8">
                 <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping" />
                 <div className="relative w-full h-full bg-gradient-to-br from-blue-600 to-indigo-700 rounded-full flex items-center justify-center text-white shadow-2xl">
                    <ShieldCheck size={48} className="animate-pulse" />
                 </div>
              </div>
              <h3 className="text-xl font-black text-slate-800 dark:text-white mb-2 tracking-tighter">جاري طلب البصمة...</h3>
              <p className="text-sm text-slate-500 font-bold mb-6">يرجى وضع إصبع الموظف ({scanningUser}) على مستشعر الجهاز الآن</p>
              
              <div className="flex justify-center gap-2">
                 <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
                 <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
                 <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
