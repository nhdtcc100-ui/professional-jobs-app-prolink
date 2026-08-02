import React from 'react';

export const IcyBackground = () => {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#f0f4f8]">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-200/40 blur-[150px] rounded-full animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-100/40 blur-[150px] rounded-full animate-pulse" />
      <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-cyan-50/30 blur-[120px] rounded-full" />
      <div className="absolute inset-0 bg-white/40" />
    </div>
  );
};
