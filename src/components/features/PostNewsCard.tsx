import React from 'react';
import { motion } from 'motion/react';
import { 
  Clock, 
  ThumbsUp, 
  MessageCircle, 
  Repeat2, 
  Image as ImageIcon,
  PlayCircle
} from 'lucide-react';
import { Post } from '../../types';

interface PostNewsCardProps {
  post: Post;
  delay?: number;
  onClick: () => void;
  onAuthorClick?: (e: React.MouseEvent) => void;
  allUsers: any[];
}

const timeAgo = (ds: string) => {
  try {
    const h = Math.floor((Date.now() - new Date(ds).getTime()) / 3.6e6);
    if (h < 1) return 'منذ قليل';
    if (h < 24) return `منذ ${h}س`;
    const d = Math.floor(h / 24);
    if (d < 7) return `منذ ${d}ي`;
    return `منذ ${Math.floor(d / 7)} أسبوع`;
  } catch { return ''; }
};

export function PostNewsCard({ post, delay = 0, onClick, onAuthorClick, allUsers }: PostNewsCardProps) {
  const author = allUsers.find(u => u.id === post.authorId);
  const displayImage = post.imageUrl || author?.coverUrl;
  const hasVisual = !!displayImage;
  const hasVideo = !!post.videoUrl;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      onClick={onClick}
      whileHover={{ y: -4, scale: 1.005 }}
      className="group relative flex flex-col md:flex-row items-stretch gap-4 p-4 bg-white dark:bg-[#0f172a] rounded-[2rem] border border-slate-100 dark:border-slate-800 hover:border-blue-500/50 shadow-sm hover:shadow-xl transition-all cursor-pointer overflow-hidden"
    >
      {/* Visual Indicator (Gradient Bar) */}
      <div className="absolute top-0 right-0 bottom-0 w-1.5 bg-gradient-to-b from-blue-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* Media Preview (Thumbnail) */}
      {(hasVisual || hasVideo) ? (
        <div className="relative shrink-0 w-full md:w-36 h-48 md:h-28 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-inner">
          <img 
            src={displayImage || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400&h=400&fit=crop'} 
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-90 group-hover:opacity-100"
            alt=""
          />
          <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
          
          {hasVideo && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white border border-white/30 shadow-lg">
                <PlayCircle size={20} fill="currentColor" className="text-white/80" />
              </div>
            </div>
          )}

          {!hasVideo && hasVisual && (
             <div className="absolute bottom-2 left-2 p-1.5 bg-black/40 backdrop-blur-sm rounded-lg text-white">
                <ImageIcon size={12} />
             </div>
          )}
        </div>
      ) : (
        <div className="relative shrink-0 w-full md:w-36 h-28 rounded-2xl overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 border border-blue-100/50 dark:border-blue-900/20 flex items-center justify-center group-hover:from-blue-100 transition-colors">
           <div className="text-blue-500/30 group-hover:text-blue-500 transition-colors">
              <Clock size={32} />
           </div>
        </div>
      )}

      {/* Content Section */}
      <div className="flex-1 min-w-0 flex flex-col py-1">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <div 
            className="flex items-center gap-2 pr-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
            onClick={(e) => { e.stopPropagation(); onAuthorClick?.(e); }}
          >
            <img 
              src={post.authorAvatar} 
              className="w-5 h-5 rounded-full border border-white dark:border-slate-700 shadow-sm" 
              alt={post.authorName} 
            />
            <span className="text-[10px] font-black text-slate-900 dark:text-slate-100">{post.authorName}</span>
          </div>
          <span className="text-slate-300 dark:text-slate-700 text-[10px]">•</span>
          <span className="flex items-center gap-1 text-[9px] font-bold text-slate-400 dark:text-slate-500">
            <Clock size={10} /> {timeAgo(post.timestamp || new Date().toISOString())}
          </span>
          <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[8px] font-black px-2 py-0.5 rounded-full border border-blue-100 dark:border-blue-800/30 uppercase tracking-widest mr-auto">
            منشور مهني
          </span>
        </div>

        <h4 className="font-black text-sm text-slate-800 dark:text-slate-100 leading-snug line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors break-words">
          {post.content.split('\n')[0] || 'منشور جديد من ' + post.authorName}
        </h4>
        
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 line-clamp-1 italic font-medium">
          {post.content.split('\n').slice(1).join(' ').trim() || post.authorTitle}
        </p>

        {/* Footer Interaction Stats */}
        <div className="flex items-center gap-4 mt-auto pt-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center border border-blue-100/50 dark:border-blue-800/30">
              <ThumbsUp size={10} className="text-blue-600 dark:text-blue-400 fill-blue-600/10" />
            </div>
            <span className="text-[10px] font-black text-slate-400">{post.likesCount || 0}</span>
          </div>
          
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center border border-slate-100 dark:border-slate-700">
              <MessageCircle size={10} className="text-slate-400" />
            </div>
            <span className="text-[10px] font-black text-slate-400">تفاعل</span>
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-[9px] font-black text-blue-500/60 uppercase tracking-tighter group-hover:text-blue-600 transition-colors">عرض التفاصيل</span>
            <div className="w-6 h-6 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center group-hover:bg-blue-600 transition-all group-hover:text-white">
               <Repeat2 size={12} className="group-hover:rotate-180 transition-transform duration-500" />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
