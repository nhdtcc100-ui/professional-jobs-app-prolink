import React from 'react';
import { motion } from 'motion/react';

interface RecedeCardProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * RecedeCard — تأثير سينمائي احترافي عند التمرير:
 * • عند الدخول لمجال الرؤية: يكبر العنصر بسلاسة من حجم أصغر (0.94 -> 1.0) وتتزايد الشفافية.
 * • عند الخروج أعلى أو أسفل الشاشة: يبتعد العنصر ويصغر تدريجياً (1.0 -> 0.94).
 * • مصمم ليعمل بتسريع عتادي GPU 60-120FPS دون أي ثقل على الذاكرة أو إعادة طلب البيانات.
 */
export const RecedeCard: React.FC<RecedeCardProps> = ({ children, className = '' }) => {
  return (
    <motion.div
      initial={{ opacity: 0.65, scale: 0.94 }}
      whileInView={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0.6, scale: 0.94 }}
      viewport={{ margin: "-25px 0px -25px 0px", amount: 0.12 }}
      transition={{
        duration: 0.32,
        ease: [0.22, 1, 0.36, 1]
      }}
      className={`will-change-transform transform-gpu ${className}`}
    >
      {children}
    </motion.div>
  );
};
