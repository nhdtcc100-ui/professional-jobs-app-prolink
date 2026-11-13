/**
 * CalligraphyBg – خلفية خط ديواني مفرّغة (Outlined)
 * تُستخدم كعنصر زخرفي خلف محتوى البطاقات والصفحات.
 *
 * الاستخدام:
 *   <div className="relative ...">
 *     <CalligraphyBg word="تواصل" />
 *     (المحتوى الفعلي هنا)
 *   </div>
 */
import React from 'react';

interface CalligraphyBgProps {
  word: string;
  /** حجم الخط — افتراضي: 7rem */
  size?: string;
  /** الشفافية — افتراضي: 0.06 */
  opacity?: number;
  /** لون الخط المفرّغ (css color) — افتراضي: currentColor */
  color?: string;
  /** سماكة حد الكتابة — افتراضي: 1px */
  strokeWidth?: string;
  /** موضع العنصر داخل الحاوية */
  position?: 'center' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-left';
  className?: string;
}

export const CalligraphyBg: React.FC<CalligraphyBgProps> = ({
  word,
  size = '7rem',
  opacity = 0.06,
  color = 'currentColor',
  strokeWidth = '1px',
  position = 'center',
  className = '',
}) => {
  const positionClasses: Record<string, string> = {
    center:       'inset-0 flex items-center justify-center',
    'top-right':  'top-1 right-2 flex items-start justify-end',
    'top-left':   'top-1 left-2 flex items-start justify-start',
    'bottom-left':'bottom-1 left-2 flex items-end justify-start',
    'bottom-right':'bottom-1 right-2 flex items-end justify-end',
  };

  return (
    <div
      className={`absolute ${positionClasses[position]} overflow-hidden select-none pointer-events-none ${className}`}
      aria-hidden="true"
      style={{ opacity }}
    >
      <span
        style={{
          fontFamily: "'Scheherazade New', 'Traditional Arabic', 'Amiri', 'Noto Naskh Arabic', serif",
          fontSize: size,
          fontWeight: 900,
          WebkitTextStroke: `${strokeWidth} ${color}`,
          WebkitTextFillColor: 'transparent',
          lineHeight: 1,
          userSelect: 'none',
          whiteSpace: 'nowrap',
          letterSpacing: '-0.02em',
        } as React.CSSProperties}
      >
        {word}
      </span>
    </div>
  );
};

export default CalligraphyBg;
