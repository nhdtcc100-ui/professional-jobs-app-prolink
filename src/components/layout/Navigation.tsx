import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Plus } from 'lucide-react';

export function NavbarItem({ icon, label, active, onClick, badge }: any) {
  return (
    <div
      onClick={onClick}
      className={`flex flex-col items-center justify-center px-4 cursor-pointer relative h-full transition-all group text-slate-900 dark:text-slate-400 hover:text-blue-600`}
    >
      <div className="relative group-hover:scale-110 transition-transform">
        {icon}
        {badge > 0 && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-bounce pointer-events-none z-20" />
        )}
      </div>
      <span className="text-[10px] mt-1 hidden lg:block font-bold whitespace-nowrap">{label}</span>
    </div>
  );
}

export function SidebarLink({ label, onClick }: { label: string, onClick?: () => void }) {
  return (
    <div onClick={onClick} className="flex items-center gap-3 text-xs font-bold text-slate-500 hover:bg-[#0a66c2]/5 p-1.5 rounded-lg cursor-pointer transition-all group">
      <Users size={14} className="text-slate-400 group-hover:text-[#0a66c2]" />
      <span className="truncate">{label}</span>
      <Plus size={14} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

export function MobileNavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label?: string, active: boolean, onClick: () => void }) {
  return (
    <div className="relative flex flex-col items-center justify-end w-14 h-12">
      <motion.div 
        animate={active ? { y: -28 } : { y: 0 }}
        transition={{ type: "spring", stiffness: 350, damping: 20 }}
        className="flex flex-col items-center relative"
      >
        <motion.button 
          whileTap={{ scale: 0.85 }}
          onClick={onClick} 
          className={`relative flex items-center justify-center transition-all duration-300 z-10
            ${active ? 'text-white w-14 h-14 border-[4px] border-white dark:border-[#020817] rounded-full shadow-xl shadow-blue-500/30' : 'text-slate-900 dark:text-slate-500 hover:text-blue-600 dark:hover:text-slate-300 w-12 h-12 rounded-xl'}`}
        >
          <motion.div 
            animate={active ? { scale: 1.1 } : { scale: 1 }} 
            className="relative z-10"
          >
            {icon}
          </motion.div>
          
          {active && (
            <motion.div 
              layoutId="mobileNavActiveBg" 
              className="absolute inset-0 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-full -z-10"
              transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
            />
          )}
        </motion.button>

        <AnimatePresence>
          {active && label && (
            <motion.span
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="text-[8px] font-black mt-3 text-slate-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap"
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

export function DrawerItem({ icon, label, onClick, color = 'text-slate-700' }: { icon: React.ReactNode, label: string, onClick: () => void, color?: string }) {
  return (
    <motion.div 
      whileHover={{ x: -8, backgroundColor: 'rgba(241, 245, 249, 1)' }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick} 
      className="flex items-center gap-4 p-4 bg-white rounded-2xl cursor-pointer transition-all border border-slate-100 shadow-sm hover:shadow-md group mb-3"
    >
      <div className={`p-2.5 rounded-xl bg-slate-50 group-hover:bg-blue-50 transition-colors ${color}`}>
        {icon}
      </div>
      <span className={`text-sm font-black transition-colors ${color}`}>{label}</span>
    </motion.div>
  );
}

export function NavDropdownItem({ icon, label, onClick, color = 'text-slate-600' }: { icon: React.ReactNode, label: string, onClick: () => void, color?: string }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2.5 w-full text-right p-2.5 hover:bg-slate-50 rounded-xl transition-all ${color}`}>
       {icon}
       <span className="text-xs font-bold">{label}</span>
    </button>
  );
}

export const RoleOption = ({ selected, icon: Icon, title, description, onClick }: any) => (
  <motion.div
    whileHover={{ scale: 1.02 }}
    onClick={onClick}
    className={`p-6 rounded-3xl cursor-pointer transition-all border-2 flex items-start gap-4 ${selected
        ? 'bg-white border-[#0a66c2] shadow-md'
        : 'bg-white/50 border-transparent hover:border-slate-200'
      }`}
  >
    <div className={`p-4 rounded-2xl ${selected ? 'bg-[#0a66c2] text-white' : 'bg-slate-100 text-slate-500'}`}>
      <Icon size={32} />
    </div>
    <div className="flex-1">
      <h3 className={`font-bold text-lg mb-1 ${selected ? 'text-[#0a66c2]' : 'text-slate-800'}`}>{title}</h3>
      <p className="text-sm text-slate-500 leading-snug">{description}</p>
    </div>
  </motion.div>
);
