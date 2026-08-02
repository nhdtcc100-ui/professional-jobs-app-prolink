import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Fingerprint, Clock, CheckCircle2, XCircle, LogIn, LogOut, Building2, ChevronRight, ShieldCheck, Sparkles } from 'lucide-react';
import { erpService } from '../../../lib/services/erpService';
import { biometricService } from '../../../lib/services/biometricService';
import { Employee, AppUser } from '../../../types';

interface KioskModeViewProps {
  appUser: AppUser; // The employer
  addToast: (msg: string, type?: any) => void;
  onExit: () => void; // Callback to exit kiosk mode
}

type KioskState = 'idle' | 'selected' | 'scanning' | 'success' | 'error';

interface EmployeeWithStatus extends Employee {
  name: string;
  avatar: string;
  todayCheckIn?: string;
  todayCheckOut?: string;
  todayAttendanceId?: string;
}

export const KioskModeView: React.FC<KioskModeViewProps> = ({ appUser, addToast, onExit }) => {
  const [employees, setEmployees] = useState<EmployeeWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [kioskState, setKioskState] = useState<KioskState>('idle');
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeWithStatus | null>(null);
  const [resultMsg, setResultMsg] = useState('');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    loadEmployees();
    
    // Start background camera for auditing
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      .then(stream => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(err => console.error("DEBUG: Kiosk Camera Access Denied:", err));

    const refresh = setInterval(loadEmployees, 30000);
    return () => clearInterval(refresh);
  }, [appUser.id]);

  const capturePhoto = () => {
    if (!videoRef.current) return null;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(videoRef.current, 0, 0);
      return canvas.toDataURL('image/jpeg', 0.7);
    } catch (e) {
      console.error("DEBUG: Photo capture failed:", e);
      return null;
    }
  };

  const loadEmployees = async () => {
    setLoading(true);
    const { supabase } = await import('../../../lib/supabase');
    const { data: empData } = await erpService.getEmployeesByEmployer(appUser.id);
    if (!empData || empData.length === 0) { setLoading(false); return; }

    const today = new Date().toISOString().split('T')[0];
    
    const enriched = await Promise.all(empData.map(async (emp: Employee) => {
      const { data: profile } = await supabase.from('profiles').select('name, avatar_url').eq('id', emp.user_id).single();
      const { data: att } = await supabase.from('attendance').select('*').eq('employee_id', emp.id).eq('date', today).maybeSingle();
      return {
        ...emp,
        name: profile?.name || 'موظف',
        avatar: profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.name || 'E')}&background=0a66c2&color=fff`,
        todayCheckIn: att?.check_in_time,
        todayCheckOut: att?.check_out_time,
        todayAttendanceId: att?.id,
      };
    }));
    
    setEmployees(enriched);
    setLoading(false);
  };

  const handleEmployeeSelect = (emp: EmployeeWithStatus) => {
    if (kioskState !== 'idle') return;
    setSelectedEmployee(emp);
    setKioskState('selected');
  };

  const handleGeneralScan = async () => {
    const registeredEmps = employees.filter(e => e.biometric_id);
    if (registeredEmps.length === 0) {
      addToast('لا توجد بصمات مسجلة في هذا الجهاز بعد. يرجى تسجيل البصمات من لوحة التحكم.', 'error');
      return;
    }

    setKioskState('scanning');
    const allowedIds = registeredEmps.map(e => e.biometric_id as string);
    const { credentialId, error: bioError } = await biometricService.verifyUserBiometric(allowedIds);

    if (bioError || !credentialId) {
      setKioskState('error');
      setResultMsg('فشل التعرف على البصمة. يرجى المحاولة مجدداً.');
      setTimeout(reset, 3000);
      return;
    }

    const matchedEmp = registeredEmps.find(e => e.biometric_id === credentialId);
    if (!matchedEmp) {
      setKioskState('error');
      setResultMsg('البصمة غير معروفة في هذا النظام.');
      setTimeout(reset, 3000);
      return;
    }

    setSelectedEmployee(matchedEmp);
    await processFinalAttendance(matchedEmp);
  };

  const handleScan = async () => {
    if (!selectedEmployee) return;
    if (!selectedEmployee.biometric_id) {
      addToast('هذا الموظف لم يسجل بصمته بعد.', 'warning');
      return;
    }

    setKioskState('scanning');
    const { credentialId, error: bioError } = await biometricService.verifyUserBiometric([selectedEmployee.biometric_id]);

    if (bioError || !credentialId) {
      setKioskState('error');
      setResultMsg('فشل التحقق من البصمة.');
      setTimeout(reset, 3000);
      return;
    }

    await processFinalAttendance(selectedEmployee);
  };

  const processFinalAttendance = async (emp: EmployeeWithStatus) => {
    let lat: number | undefined, lng: number | undefined;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 3000 }));
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch {}

    const photo = capturePhoto();
    setCapturedPhoto(photo);

    const { data, error, type, message } = await erpService.processSmartAttendance(
      emp.id, 
      { lat: lat || 0, lng: lng || 0 },
      photo || undefined
    );

    if (error) {
      setKioskState('error');
      setResultMsg('حدث خطأ أثناء معالجة البيانات.');
      setTimeout(reset, 3000);
    } else if (type === 'duplicate' || type === 'complete') {
      setKioskState('error');
      setResultMsg(message || 'إجراء غير مسموح حالياً');
      setTimeout(reset, 4000);
    } else {
      setKioskState('success');
      const action = !emp.todayCheckIn ? 'الدخول' : 'الانصراف';
      setResultMsg(`تم تسجيل ${action} بنجاح ✅\nأهلاً بك ${emp.name}`);
      await loadEmployees();
      setTimeout(reset, 4000);
    }
  };

  const reset = () => {
    setKioskState('idle');
    setSelectedEmployee(null);
    setResultMsg('');
    setCapturedPhoto(null);
  };

  const dateStr = currentTime.toLocaleDateString('ar-IQ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = currentTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="min-h-screen bg-[#020617] text-white flex flex-col selection:bg-blue-500/30 overflow-hidden" dir="rtl">
      {/* Hidden camera feed for background auditing */}
      <video ref={videoRef} autoPlay playsInline muted className="hidden" />

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/5 blur-[100px] rounded-full" />
      </div>

      <div className="relative z-20 m-4 md:m-6 rounded-[2rem] md:rounded-[2.5rem] border border-white/10 bg-black/40 backdrop-blur-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-4 md:p-6 flex flex-col md:flex-row items-center justify-between gap-6 transition-all duration-700">
        <div className="flex items-center gap-5">
          <button onClick={onExit} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 text-slate-400 hover:text-white transition-all group">
            <ChevronRight size={24} className="group-hover:-translate-x-1 transition-transform" />
          </button>
          <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[1.2rem] md:rounded-[1.5rem] flex items-center justify-center shadow-[0_10px_30px_rgba(37,99,235,0.4)] border border-white/20">
            <Building2 size={24} className="text-white drop-shadow-lg" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-black tracking-tighter text-blue-50/90">{appUser.companyName || 'محطة الحضور المركزية'}</h1>
            <div className="flex items-center gap-2 text-slate-400 font-bold mt-1">
               <Clock size={12} className="text-blue-500" />
               <p className="text-[10px] uppercase tracking-widest">{dateStr}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white/5 backdrop-blur-2xl px-8 md:px-12 py-3 md:py-4 rounded-[1.5rem] md:rounded-[2rem] border border-white/10 shadow-inner group/time">
          <p className="text-4xl md:text-6xl font-black tracking-[0.15em] text-blue-400 drop-shadow-[0_0_20px_rgba(59,130,246,0.3)] group-hover:text-white transition-colors duration-500" dir="ltr">
            {timeStr}
          </p>
        </div>

        <button onClick={onExit} className="group relative px-6 md:px-8 py-2 md:py-3 rounded-2xl bg-white/5 border border-white/10 text-[9px] md:text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:border-red-500/50 hover:bg-red-500/10 transition-all duration-500">
          <span className="relative z-10 flex items-center gap-2">إغلاق المحطة <XCircle size={14} className="group-hover:rotate-90 transition-transform" /></span>
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 relative z-10">
        <AnimatePresence mode="wait">
          {kioskState === 'idle' && (
            <motion.div key="idle" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} className="w-full max-w-6xl flex flex-col gap-12">
              <div className="text-center">
                 <div className="inline-block px-6 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full text-[10px] font-black uppercase tracking-[0.3em] text-blue-400 mb-4">Alpha Biometric Terminal</div>
                 <h2 className="text-3xl md:text-5xl font-black text-white tracking-tighter mb-4">بصمة النخبة • ابدأ الآن</h2>
                 <p className="text-slate-400 font-bold tracking-widest uppercase text-xs opacity-60">ضع بصمتك فوراً للتعرف التلقائي أو اختر اسمك من القائمة</p>
              </div>

              <div className="flex justify-center">
                <motion.button whileHover={{ scale: 1.05, boxShadow: '0 0 50px rgba(37,99,235,0.4)' }} whileTap={{ scale: 0.95 }} onClick={handleGeneralScan} className="relative group p-1 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 rounded-[3rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                  <div className="bg-[#020617] rounded-[2.9rem] px-12 py-8 flex flex-col items-center gap-4 transition-all group-hover:bg-transparent">
                    <Fingerprint size={80} className="text-white relative z-10 group-hover:scale-110 transition-transform" />
                    <span className="text-xl font-black text-white uppercase tracking-widest">بصمة سريعة ⚡</span>
                  </div>
                </motion.button>
              </div>

              <div className="h-px bg-white/5 w-1/2 mx-auto" />

              {loading ? (
                <div className="flex justify-center py-20"><div className="w-20 h-20 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-8 max-h-[40vh] overflow-y-auto no-scrollbar p-4">
                  {employees.map((emp, i) => {
                    const isDone = !!emp.todayCheckIn && !!emp.todayCheckOut;
                    const isIn = !!emp.todayCheckIn && !emp.todayCheckOut;
                    return (
                      <motion.button key={emp.id} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} onClick={() => !isDone && handleEmployeeSelect(emp)} className={`relative p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border-2 text-center flex flex-col items-center gap-5 transition-all duration-500 group overflow-hidden ${isDone ? 'bg-slate-900/40 border-white/5 opacity-40 cursor-not-allowed' : isIn ? 'bg-orange-500/10 border-orange-500/30 hover:border-orange-500' : 'bg-white/5 border-white/10 hover:border-blue-500/50'}`}>
                        <img src={emp.avatar} className="w-16 h-16 md:w-24 md:h-24 rounded-[1.5rem] md:rounded-[2rem] object-cover border-2 border-white/10 shadow-2xl transition-transform duration-500 group-hover:rotate-3" />
                        <div className="relative z-10">
                          <p className="font-black text-sm md:text-lg text-white group-hover:text-blue-400 transition-colors tracking-tight truncate w-full max-w-[120px]">{emp.name}</p>
                          <p className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1">{emp.department}</p>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {kioskState === 'selected' && selectedEmployee && (
            <motion.div key="selected" initial={{ opacity: 0, z: -100 }} animate={{ opacity: 1, z: 0 }} exit={{ opacity: 0, scale: 0.9 }} className="flex flex-col items-center gap-10 max-w-lg w-full bg-white/5 backdrop-blur-3xl p-12 rounded-[4rem] border border-white/10 shadow-2xl">
              <img src={selectedEmployee.avatar} className="w-40 h-40 rounded-[3rem] border-4 border-blue-500 shadow-2xl" />
              <div className="text-center space-y-4">
                <h2 className="text-4xl font-black tracking-tighter text-white">{selectedEmployee.name}</h2>
                <div className={`mt-6 p-6 rounded-[2rem] border-2 ${selectedEmployee.todayCheckIn ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' : 'bg-blue-600/10 border-blue-500/30 text-blue-400'}`}>
                   <p className="text-2xl font-black">{selectedEmployee.todayCheckIn ? 'تأكيد إشارة الانصراف ↩' : 'تأكيد إشارة الدخول 🚀'}</p>
                </div>
              </div>
              <div className="flex gap-6 w-full">
                <button onClick={reset} className="flex-1 py-5 rounded-[2rem] bg-white/5 text-slate-400 font-black border border-white/10 hover:bg-white/10 hover:text-white transition-all uppercase tracking-widest text-xs">تراجع</button>
                <button onClick={handleScan} className={`flex-1 py-5 rounded-[2rem] font-black flex items-center justify-center gap-4 shadow-2xl transition-all uppercase tracking-widest text-xs ${selectedEmployee.todayCheckIn ? 'bg-gradient-to-r from-orange-500 to-red-600' : 'bg-gradient-to-r from-blue-600 to-indigo-700'}`}>
                  <Fingerprint size={24} /> بدء المسح
                </button>
              </div>
            </motion.div>
          )}

          {kioskState === 'scanning' && (
            <motion.div key="scanning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-12">
              <div className="relative w-64 h-64 rounded-full bg-slate-900 border-8 border-blue-600/30 flex items-center justify-center overflow-hidden shadow-[0_0_80px_rgba(37,99,235,0.4)]">
                 <Fingerprint size={120} className="text-blue-500 animate-pulse" />
                 <motion.div initial={{ top: '-100%' }} animate={{ top: '200%' }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} className="absolute left-0 w-full h-1/4 bg-gradient-to-b from-transparent via-blue-400 to-transparent opacity-40" />
              </div>
              <h3 className="text-3xl font-black text-blue-400 tracking-tighter animate-pulse">جارٍ تحليل البصمة...</h3>
            </motion.div>
          )}

          {(kioskState === 'success' || kioskState === 'error') && (
            <motion.div key="result" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-6 max-w-2xl text-center">
              
              {/* Profile Context for Success */}
              {kioskState === 'success' && selectedEmployee && (
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="mb-4 flex gap-4 items-center">
                  <div className="relative">
                    <img src={selectedEmployee.avatar} className="w-24 h-24 md:w-32 md:h-32 rounded-[2rem] md:rounded-[2.5rem] border-4 border-emerald-500 shadow-2xl object-cover" />
                    <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center border-4 border-[#020617] shadow-lg">
                      <CheckCircle2 size={20} className="text-white" />
                    </div>
                  </div>
                  {capturedPhoto && (
                    <motion.div initial={{ scale: 0.8, rotate: 5 }} animate={{ scale: 1, rotate: 0 }} className="relative">
                      <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full" />
                      <img src={capturedPhoto} className="w-24 h-24 md:w-32 md:h-32 rounded-[2rem] md:rounded-[2.5rem] border-4 border-blue-500/50 shadow-2xl object-cover relative z-10" />
                      <div className="absolute top-1 right-1 bg-blue-600 text-[8px] font-black px-2 py-1 rounded-full text-white z-20 uppercase tracking-widest">Live Audit</div>
                    </motion.div>
                  )}
                </motion.div>
              )}

              <div className={`w-32 h-32 rounded-[2.5rem] border-4 flex items-center justify-center shadow-2xl ${kioskState === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                {kioskState === 'success' ? <Sparkles size={60} className="animate-pulse" /> : <XCircle size={60} />}
              </div>
              
              <div className="space-y-2">
                <h2 className={`text-3xl font-black tracking-tighter ${kioskState === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {kioskState === 'success' ? 'تمت العملية بنجاح' : 'فشل في التحقق'}
                </h2>
                <p className="text-xl font-bold text-white/90 whitespace-pre-line leading-relaxed">{resultMsg}</p>
              </div>

              {kioskState === 'error' && (
                <button onClick={reset} className="mt-4 px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
                  إعادة المحاولة
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="relative z-20 m-6 p-6 rounded-3xl border border-white/5 bg-black/40 backdrop-blur-2xl flex items-center justify-between">
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em]">ProLink Bio-Terminal v2.0 • Encryption Active</p>
        <div className="hidden md:flex gap-6 text-[9px] font-black text-slate-600 uppercase tracking-widest">
           <span>Network: Optimal</span>
           <span>Latency: 12ms</span>
           <span>Sensors: Active</span>
        </div>
      </div>
    </div>
  );
};
