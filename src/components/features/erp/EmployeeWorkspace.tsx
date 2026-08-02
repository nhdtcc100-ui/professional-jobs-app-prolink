import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Fingerprint, 
  Clock, 
  CalendarCheck, 
  MapPin, 
  Building2, 
  Briefcase, 
  DollarSign,
  LogIn,
  LogOut 
} from 'lucide-react';
import { erpService } from '../../../lib/services/erpService';
import { AppUser, Attendance, Employee } from '../../../types';
import { GlassCard } from '../../ui';

interface EmployeeWorkspaceProps {
  appUser: AppUser;
  addToast: (msg: string, type?: any) => void;
}

export const EmployeeWorkspace: React.FC<EmployeeWorkspaceProps> = ({ appUser, addToast }) => {
  const [employeeData, setEmployeeData] = useState<Employee | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    // Clock
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchMyData();
  }, [appUser.id]);

  const fetchMyData = async () => {
    setLoading(true);
    // Since we don't have a direct 'getMyEmployeeProfile' in erpService, let's fetch all employees for their employer...
    // Actually, we can't easily find their employer without a backend function. 
    // Wait, let's add `getEmployeeByUserId` to erpService.
    const { supabase } = await import('../../../lib/supabase');
    const { data, error: empErr } = await supabase.from('employees').select('*, jobs(title, company)').eq('user_id', appUser.id).eq('status', 'active').single();
    const empData = data as any;
    
    if (empData) {
      setEmployeeData({ ...empData, jobTitle: empData.jobs?.title, company: empData.jobs?.company });
      const { data: attData } = await erpService.getMyAttendance(empData.id);
      if (attData) setAttendanceRecords(attData);
    }
    setLoading(false);
  };

  const handleCheckOut = async () => {
    if (!todaysRecord) return;
    setCheckingIn(true);
    
    let lat, lng;
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });
      lat = position.coords.latitude;
      lng = position.coords.longitude;
    } catch (e) {}

    const { data, error } = await erpService.checkOut(todaysRecord.id, lat, lng);
    setCheckingIn(false);

    if (error) {
      addToast('فشل تسجيل الانصراف: ' + error.message, 'error');
    } else {
      addToast('✅ تم تسجيل الانصراف وحساب ساعات الدوام بنجاح');
      fetchMyData();
    }
  };

  const handleCheckIn = async () => {
    if (!employeeData) return;
    setCheckingIn(true);
    
    // Simulate getting location
    let lat, lng;
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });
      lat = position.coords.latitude;
      lng = position.coords.longitude;
    } catch (e) {
      // Ignored
    }

    const { data, error } = await erpService.checkIn(employeeData.id, lat, lng);
    setCheckingIn(false);

    if (error) {
      addToast('فشل تسجيل الحضور: ' + error.message, 'error');
    } else {
      addToast('✅ تم تسجيل الحضور (البصمة) بنجاح لهذا اليوم');
      fetchMyData();
    }
  };

  if (loading) {
    return <div className="p-10 flex justify-center"><div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (!employeeData) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-10 text-center shadow-sm border border-slate-100 dark:border-slate-700">
        <Building2 className="mx-auto text-slate-200 dark:text-slate-600 mb-4" size={64} />
        <h2 className="text-xl font-black text-slate-800 dark:text-white mb-2">لست منضماً لأي شركة بعد</h2>
        <p className="text-slate-500 font-bold">بمجرد تعيينك في وظيفة من قبل شركة، سيظهر نظام الموارد البشرية الخاص بك هنا لتتمكن من إثبات الحضور ومتابعة رواتبك.</p>
      </div>
    );
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const todaysRecord = attendanceRecords.find(a => a.date === todayStr);
  const hasCheckedInToday = !!todaysRecord;
  const hasCheckedOutToday = hasCheckedInToday && !!todaysRecord.check_out_time;

  return (
    <div className="space-y-8 pb-10" dir="rtl">
      {/* Top Banner: Premium 3D Glass */}
      <GlassCard className="rounded-[3rem] p-10 border-none shadow-[0_25px_60px_rgba(10,102,194,0.3)] bg-gradient-to-br from-[#0a66c2] via-[#004182] to-[#001d3d] text-white relative overflow-hidden group">
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-blue-400/20 blur-[100px] rounded-full animate-pulse group-hover:bg-blue-300/30 transition-all duration-700" />
        <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-indigo-500/10 blur-[80px] rounded-full" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <motion.div 
              whileHover={{ rotate: 10, scale: 1.1 }}
              className="w-20 h-20 bg-white/10 backdrop-blur-3xl rounded-[2rem] flex items-center justify-center border-2 border-white/30 shadow-2xl group-hover:bg-white/20 transition-all duration-500"
            >
              <Briefcase size={32} className="text-blue-100" />
            </motion.div>
            <div className="text-center md:text-right">
              <h2 className="text-3xl font-black tracking-tighter mb-1.5">{employeeData.company || 'نظام الشركة'}</h2>
              <div className="flex items-center gap-3 justify-center md:justify-start">
                 <div className="px-4 py-1.5 bg-white/10 backdrop-blur-md rounded-full border border-white/20 text-[10px] font-black uppercase tracking-widest text-blue-100">
                    {employeeData.jobTitle || 'موظف'}
                 </div>
                 <div className="px-4 py-1.5 bg-emerald-500/20 backdrop-blur-md rounded-full border border-emerald-400/30 text-[10px] font-black uppercase tracking-widest text-emerald-300">
                    {employeeData.department}
                 </div>
              </div>
            </div>
          </div>
          
          <div className="bg-black/20 backdrop-blur-2xl px-10 py-6 rounded-[2.5rem] border border-white/10 shadow-2xl text-center min-w-[200px] group/time hover:bg-black/30 transition-all">
            <p className="text-[10px] text-blue-200 uppercase tracking-[0.3em] font-black mb-2 group-hover/time:text-white transition-colors">إشارة الوقت الحية</p>
            <p className="text-4xl font-black tracking-widest text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]" dir="ltr">
              {currentTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          </div>
        </div>
      </GlassCard>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Fingerprint / Check-in Card: 3D Pop */}
        <div className="lg:col-span-1">
          <GlassCard className="rounded-[3rem] p-10 text-center h-full flex flex-col items-center justify-center border-none shadow-[0_30px_70px_rgba(0,0,0,0.06)] dark:shadow-[0_30px_70px_rgba(0,0,0,0.4)] bg-white/80 dark:bg-[#0f172a]/80 backdrop-blur-2xl relative overflow-hidden group/fp">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-30" />
            <h3 className="text-sm font-black text-slate-800 dark:text-white mb-8 uppercase tracking-[0.2em] border-b border-slate-50 dark:border-slate-800 pb-5 w-full">بصمة الدوام اليومية</h3>
            
            <div className="relative mb-8">
              {/* Animated Rings */}
              {!hasCheckedOutToday && !checkingIn && (
                <div className="absolute inset-0">
                  <div className="absolute inset-0 rounded-full border-4 border-blue-500/20 animate-ping" />
                  <div className="absolute inset-0 rounded-full border-2 border-blue-400/10 animate-ping delay-700" />
                </div>
              )}
              
              <motion.button
                whileHover={!hasCheckedOutToday && !checkingIn ? { scale: 1.05, y: -8 } : undefined}
                whileTap={!hasCheckedOutToday && !checkingIn ? { scale: 0.9, y: 0 } : undefined}
                onClick={hasCheckedInToday ? handleCheckOut : handleCheckIn}
                disabled={hasCheckedOutToday || checkingIn}
                className={`relative w-48 h-48 rounded-[3rem] flex flex-col items-center justify-center gap-4 transition-all duration-700 shadow-[0_30px_60px_rgba(0,0,0,0.15)] dark:shadow-[0_30px_60px_rgba(0,0,0,0.6)] border-4 group/btn ${
                  hasCheckedOutToday 
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-60' 
                    : hasCheckedInToday
                    ? 'bg-gradient-to-br from-orange-500 to-red-600 text-white border-orange-400 shadow-[0_20px_50px_rgba(249,115,22,0.5)]'
                    : checkingIn
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-500 border-blue-400 animate-pulse'
                    : 'bg-gradient-to-br from-blue-600 to-[#004182] text-white border-blue-400 shadow-[0_20px_50px_rgba(37,99,235,0.6)]'
                }`}
              >
                <div className={`relative ${checkingIn ? 'animate-bounce' : ''}`}>
                   <Fingerprint size={80} className={`transition-all duration-700 ${hasCheckedOutToday ? 'opacity-30' : 'drop-shadow-[0_10px_20px_rgba(0,0,0,0.3)] group-hover/btn:scale-110'}`} />
                   {checkingIn && <div className="absolute inset-0 bg-blue-400 blur-xl opacity-50 animate-pulse" />}
                </div>
                <span className="font-black text-xs uppercase tracking-widest">
                  {hasCheckedOutToday ? 'تم إغلاق الوردية' : checkingIn ? 'جارٍ المعالجة...' : hasCheckedInToday ? 'تسجيل انصراف ↩' : 'بصمة دخول 🚀'}
                </span>
                
                {/* 3D Glass Layer on button */}
                <div className="absolute inset-2 border border-white/20 rounded-[2.5rem] pointer-events-none" />
              </motion.button>
            </div>

            <div className="space-y-3 w-full px-4">
              <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ساعات العمل</span>
                 <span className="text-xs font-black text-blue-600">{employeeData.working_hours}</span>
              </div>
              
              {hasCheckedOutToday && todaysRecord && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-emerald-500 text-white p-4 rounded-2xl shadow-xl shadow-emerald-500/20 border border-emerald-400"
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-1">إنجاز اليوم</p>
                  <p className="text-lg font-black">{Math.round((new Date(todaysRecord.check_out_time).getTime() - new Date(todaysRecord.check_in_time).getTime()) / (1000 * 60 * 60) * 10) / 10} <span className="text-xs opacity-70">ساعة عمل فعالة</span></p>
                </motion.div>
              )}
            </div>
          </GlassCard>
        </div>

        {/* Info & History */}
        <div className="lg:col-span-2 space-y-8">
          {/* Quick Stats: 3D Grid */}
          <div className="grid grid-cols-2 gap-6">
            <motion.div 
              whileHover={{ y: -5 }}
              className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-2xl p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-[0_20px_40px_rgba(0,0,0,0.04)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.3)] flex items-center gap-6 group cursor-pointer"
            >
              <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xl shadow-blue-500/30 group-hover:rotate-[15deg] transition-all duration-500">
                <CalendarCheck size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">الحضور الشهري</p>
                <p className="text-2xl font-black text-slate-800 dark:text-white">{attendanceRecords.length} <span className="text-xs text-slate-400 ml-1">أيام</span></p>
              </div>
            </motion.div>
            
            <motion.div 
              whileHover={{ y: -5 }}
              className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-2xl p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-[0_20px_40px_rgba(0,0,0,0.04)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.3)] flex items-center gap-6 group cursor-pointer"
            >
              <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xl shadow-emerald-500/30 group-hover:rotate-[-15deg] transition-all duration-500">
                <DollarSign size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">الراتب المتوقع</p>
                <p className="text-xl md:text-2xl font-black text-emerald-600">{employeeData.salary}</p>
              </div>
            </motion.div>
          </div>

          {/* Attendance History: Premium List */}
          <GlassCard className="rounded-[3rem] p-10 border-none shadow-[0_40px_100px_rgba(0,0,0,0.05)] dark:shadow-[0_40px_100px_rgba(0,0,0,0.4)] bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl">
            <div className="flex justify-between items-center mb-8 border-b border-slate-50 dark:border-slate-800 pb-6">
              <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-[0.2em]">سجل النشاط الميداني</h3>
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                 <Clock size={18} className="text-blue-500" />
              </div>
            </div>
            
            <div className="space-y-4">
              {attendanceRecords.length === 0 ? (
                <div className="text-center py-10 opacity-30">
                   <p className="text-xs font-black uppercase tracking-widest">لا توجد بيانات متاحة بعد</p>
                </div>
              ) : (
                attendanceRecords.slice(0, 5).map((record, i) => (
                  <motion.div 
                    key={record.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center justify-between p-5 bg-white dark:bg-slate-800/40 rounded-[2rem] border border-slate-100 dark:border-slate-800 hover:border-blue-500/50 hover:shadow-xl hover:-translate-x-2 transition-all duration-500 group"
                  >
                    <div className="flex items-center gap-5">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 ${
                        record.status === 'present' ? 'bg-emerald-500 text-white shadow-emerald-500/20' : 
                        record.status === 'late' ? 'bg-amber-500 text-white shadow-amber-500/20' : 'bg-red-500 text-white shadow-red-500/20'
                      }`}>
                        <LogIn size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tighter">{record.date}</p>
                        <p className="text-[10px] font-bold text-slate-400 mt-1 flex items-center gap-1.5 uppercase">
                          <MapPin size={10} className="text-blue-500" /> 
                          {record.location_lat ? `Location Verified: ${record.location_lat.toFixed(2)}` : 'Remote Entry'}
                        </p>
                      </div>
                    </div>
                    <div className="text-left">
                      <span className="block text-sm font-black text-slate-800 dark:text-white" dir="ltr">
                        {new Date(record.check_in_time).toLocaleTimeString('en-US', { hour: '2-digit', minute:'2-digit' })}
                      </span>
                      <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full mt-2 inline-block border ${
                        record.status === 'present' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                        record.status === 'late' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-red-50 text-red-500 border-red-100'
                      }`}>
                        {record.status === 'present' ? '✅ On-Time' : record.status === 'late' ? '⏰ Delayed' : '❌ Absence'}
                      </span>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
            
            <button className="w-full mt-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
               مشاهدة السجل الكامل ⚡
            </button>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};
