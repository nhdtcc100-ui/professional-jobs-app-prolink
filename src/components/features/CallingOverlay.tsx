import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, 
  Video, VideoOff, Maximize2, User, Loader2 
} from 'lucide-react';

interface CallingOverlayProps {
  show: boolean;
  callId?: string;
  user: {
    name: string;
    avatar?: string;
    role?: string;
  } | null;
  type: 'incoming' | 'outgoing' | 'active';
  mode: 'voice' | 'video';
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onEnd: () => void;
  onAccept?: () => void;
}

export function CallingOverlay({ 
  show, callId, user, type, mode, 
  localStream, remoteStream, 
  onEnd, onAccept 
}: CallingOverlayProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [isVideo, setIsVideo] = useState(mode === 'video');
  const [callTime, setCallTime] = useState(0);

  const localVideoRef = React.useRef<HTMLVideoElement>(null);
  const remoteVideoRef = React.useRef<HTMLVideoElement>(null);
  const audioRef = React.useRef<HTMLAudioElement>(null);

  // Diagnostic for mobile security context
  useEffect(() => {
    if (show && !window.isSecureContext && window.location.protocol !== 'capacitor:' && window.location.protocol !== 'app:') {
      console.warn("DEBUG: Non-secure context detected. Camera/Mic will likely be blocked.");
    }
  }, [show]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.muted = true;
      localVideoRef.current.play().catch(e => console.error("DEBUG: Local video play failed", e));
    }
  }, [localStream]);

  useEffect(() => {
    const playAudio = async () => {
      if (remoteVideoRef.current && remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.muted = false;
        try {
          await remoteVideoRef.current.play();
        } catch (e) {
          console.error("DEBUG: Remote video/audio play failed", e);
          // Fallback: Audio context might be suspended
          const resumeAudio = () => {
            remoteVideoRef.current?.play();
            document.removeEventListener('click', resumeAudio);
          };
          document.addEventListener('click', resumeAudio);
        }
      }
      
      if (audioRef.current && remoteStream) {
        audioRef.current.srcObject = remoteStream;
        try {
          await audioRef.current.play();
        } catch (e) {
          console.warn("DEBUG: Dedicated audio element play failed", e);
        }
      }
    };

    playAudio();
  }, [remoteStream]);

  useEffect(() => {
    let interval: any;
    if (type === 'active' && show) {
      interval = setInterval(() => {
        setCallTime(prev => prev + 1);
      }, 1000);
    } else {
      setCallTime(0);
    }
    return () => clearInterval(interval);
  }, [type, show]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // if (!show || !user) return null; // Removed to allow parent AnimatePresence to work
  if (!user) return null;

  return (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[1000] bg-slate-950 flex flex-col items-center justify-between py-16 px-6 overflow-hidden"
      >
        {/* Cinematic Dynamic Background */}
        <div className="absolute inset-0 z-0">
          {/* Always render a hidden/visible video for audio to flow */}
          {remoteStream && (
            <>
              <video 
                ref={remoteVideoRef}
                autoPlay 
                playsInline 
                className={`w-full h-full object-cover transition-opacity duration-700 ${isVideo ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              />
              {/* Dedicated audio element for maximum reliability */}
              <audio 
                autoPlay 
                playsInline 
                ref={audioRef}
              />
            </>
          )}

          {!isVideo && (
            <>
              {user?.avatar ? (
                <motion.img 
                  initial={{ scale: 1.2, opacity: 0 }}
                  animate={{ scale: 1, opacity: 0.3 }}
                  src={user.avatar} 
                  className="w-full h-full object-cover blur-[100px] saturate-150"
                  alt=""
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-900 to-slate-900" />
              )}
              <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-3xl" />
            </>
          )}

          {isVideo && !remoteStream && (
            <div className="w-full h-full bg-slate-900 flex items-center justify-center">
              <motion.div 
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 10, repeat: Infinity }}
                className="absolute inset-0"
              >
                {user?.avatar && <img src={user.avatar} className="w-full h-full object-cover blur-2xl opacity-40" alt="" />}
              </motion.div>
            </div>
          )}
          
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/50" />
        </div>

        {/* Animated Rings for Incoming/Outgoing */}
        {type !== 'active' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {[1, 2, 3].map((i) => (
              <motion.div
                key={i}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 3, opacity: [0, 0.4, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.8, ease: "easeOut" }}
                className="absolute w-64 h-64 border-2 border-blue-400/20 rounded-full"
              />
            ))}
          </div>
        )}

        {/* User Profile Section (WhatsApp Style: Centered when no video, top-center when video) */}
        <div className={`relative z-10 flex flex-col items-center text-center transition-all duration-700 w-full ${isVideo && remoteStream ? 'mt-4 scale-75' : 'mt-12'}`}>
          <div className="relative mb-6">
            <AnimatePresence>
              {(!isVideo || !remoteStream) && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  className="w-44 h-44 rounded-[3.5rem] p-2 bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-xl shadow-2xl border border-white/10 relative z-20"
                >
                  <div className="w-full h-full rounded-[3.2rem] overflow-hidden bg-slate-800 ring-4 ring-slate-950/50">
                    {user?.avatar ? (
                      <img src={user.avatar} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-800">
                        <User size={72} className="text-slate-600" />
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* Live Indicator */}
            <motion.div 
              animate={{ opacity: [1, 0.5, 1], scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute -top-3 -right-3 px-4 py-1.5 bg-blue-500 text-white text-[9px] font-black rounded-xl shadow-xl shadow-blue-500/30 uppercase tracking-[0.2em] z-30 flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
              Secure
            </motion.div>
          </div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="space-y-3"
          >
            <h2 className={`font-black text-white tracking-tighter drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)] transition-all ${isVideo && remoteStream ? 'text-2xl' : 'text-5xl'}`}>
              {user?.name}
            </h2>
            
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center justify-center gap-3">
                <span className={`w-2 h-2 rounded-full animate-pulse ${type === 'active' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.5)]'}`} />
                <p className="text-blue-100 font-black uppercase tracking-[0.4em] text-[11px]">
                  {type === 'incoming' ? 'مكالمة واردة...' : 
                   type === 'active' ? (isVideo ? 'مكالمة فيديو جارية' : 'مكالمة صوتية آمنة') :
                   !callId ? 'جاري الاتصال...' : 'يرن...'}
                </p>
              </div>
              {type === 'active' && (
                <span className="text-white font-mono text-xl tracking-[0.2em] font-bold bg-black/20 px-4 py-1 rounded-full backdrop-blur-md">
                   {formatTime(callTime)}
                </span>
              )}
            </div>
          </motion.div>
        </div>

        {/* Floating Local Video (WhatsApp Style) */}
        {isVideo && localStream && (
          <motion.div 
            drag
            dragConstraints={{ left: -150, right: 150, top: -300, bottom: 300 }}
            initial={{ opacity: 0, scale: 0.8, x: 100, y: -200 }}
            animate={{ opacity: 1, scale: 1, x: 120, y: -240 }}
            className="absolute z-[100] w-32 h-44 bg-slate-900 rounded-3xl border-2 border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden cursor-move ring-4 ring-slate-950/50"
          >
             <video 
               ref={localVideoRef}
               autoPlay 
               playsInline 
               muted 
               className="w-full h-full object-cover mirror"
               style={{ transform: 'scaleX(-1)' }}
             />
             <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/50 backdrop-blur-md rounded text-[7px] text-white font-black uppercase tracking-widest">أنت</div>
          </motion.div>
        )}

        {/* Professional Controls Container */}
        <div className="relative z-10 w-full max-w-md bg-white/5 border border-white/10 p-8 rounded-[3.5rem] backdrop-blur-2xl shadow-2xl">
          {type === 'active' && (
            <div className="grid grid-cols-4 gap-4 mb-10">
              <ControlButton 
                icon={isMuted ? <MicOff /> : <Mic />} 
                label={isMuted ? "صامت" : "صوت"} 
                active={isMuted} 
                onClick={() => setIsMuted(!isMuted)} 
              />
              <ControlButton 
                icon={isSpeaker ? <VolumeX /> : <Volume2 />} 
                label="سبيكر" 
                active={isSpeaker} 
                onClick={() => setIsSpeaker(!isSpeaker)} 
              />
              <ControlButton 
                icon={isVideo ? <VideoOff /> : <Video />} 
                label="فيديو" 
                active={isVideo} 
                onClick={() => setIsVideo(!isVideo)} 
              />
              <ControlButton icon={<Maximize2 />} label="شاشة" />
            </div>
          )}

          <div className="flex items-center justify-center gap-16">
            {type === 'incoming' ? (
              <>
                <div className="flex flex-col items-center gap-3">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={onEnd}
                    className="w-20 h-20 bg-red-500/20 border border-red-500/40 text-red-500 rounded-full flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-xl shadow-red-500/10"
                  >
                    <PhoneOff size={32} />
                  </motion.button>
                  <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">رفض</span>
                </div>
                
                <div className="flex flex-col items-center gap-3">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={onAccept}
                    className="w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-2xl shadow-emerald-500/40 hover:bg-emerald-600 transition-all"
                  >
                    <Phone size={32} className="animate-bounce" />
                  </motion.button>
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">رد</span>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onEnd}
                  className="w-20 h-20 bg-red-500 text-white rounded-full flex items-center justify-center shadow-2xl shadow-red-500/40 hover:bg-red-600 transition-all ring-8 ring-red-500/10"
                >
                  <PhoneOff size={32} />
                </motion.button>
                <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">إنهاء الاتصال</span>
              </div>
            )}
          </div>
        </div>

        {/* Secure Encryption Message */}
        <div className="relative z-10 flex items-center gap-2 px-6 py-3 bg-white/5 rounded-2xl border border-white/5 backdrop-blur-md opacity-60">
           <div className="w-2 h-2 bg-emerald-500 rounded-full" />
           <p className="text-[9px] font-black text-white/80 uppercase tracking-[0.2em]">End-to-End Professional Encryption</p>
        </div>
      </motion.div>
  );
}

function ControlButton({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <motion.button
        whileHover={{ scale: 1.05, y: -2 }}
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
        className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
          active 
            ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20 border-transparent' 
            : 'bg-white/10 text-white/70 hover:bg-white/20 border border-white/10'
        }`}
      >
        {React.cloneElement(icon as React.ReactElement<any>, { size: 22 })}
      </motion.button>
      <span className={`text-[8px] font-black uppercase tracking-widest ${active ? 'text-blue-400' : 'text-white/40'}`}>{label}</span>
    </div>
  );
}
