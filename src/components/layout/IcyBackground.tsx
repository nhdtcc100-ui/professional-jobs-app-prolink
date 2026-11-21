import React from 'react';
import { useAppContext } from '../../contexts/AppContext';

export const IcyBackground = () => {
  const { theme } = useAppContext();

  // Khaki theme: solid warm background, NO glowing blur orbs (they look like sunlight glare)
  if (theme === 'khaki') {
    return <div className="fixed inset-0 pointer-events-none z-0 bg-[#f4f2e9]" />;
  }

  if (theme === 'dark') {
    return (
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#090d16]">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-900/20 blur-[150px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-900/15 blur-[150px] rounded-full animate-pulse" />
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-slate-800/20 blur-[120px] rounded-full" />
        <div className="absolute inset-0 bg-[#090d16]/60" />
      </div>
    );
  }

  // Light theme
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#f0f4f8]">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-200/40 blur-[150px] rounded-full animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-100/40 blur-[150px] rounded-full animate-pulse" />
      <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-cyan-50/30 blur-[120px] rounded-full" />
      <div className="absolute inset-0 bg-white/40" />
    </div>
  );
};
