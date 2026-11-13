import React from 'react';

/**
 * Calligraphy background component stub.
 * Kept as a safe no-op placeholder for clean IDE caching and backward compatibility.
 * Renders null so no calligraphy backgrounds are displayed anywhere.
 */
export interface CalligraphyBgProps {
  words?: string[];
  opacity?: number;
  className?: string;
  count?: number;
  theme?: string;
}

export const CalligraphyBg: React.FC<CalligraphyBgProps> = () => null;

export default CalligraphyBg;
