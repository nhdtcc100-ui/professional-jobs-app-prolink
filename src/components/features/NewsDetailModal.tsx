import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ExternalLink, Clock, Share2, Calendar, LayoutList, Send, CheckCircle, RefreshCw, Sparkles, Phone, MessageCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface NewsDetailModalProps {
  item: any;
  appUser: any;
  onClose: () => void;
}

export default function NewsDetailModal({ item, appUser, onClose }: NewsDetailModalProps) {
  const [isPosting, setIsPosting] = useState(false);
  const [postSuccess, setPostSuccess] = useState(false);
  const [showPostEditor, setShowPostEditor] = useState(false);
  const [postComment, setPostComment] = useState('');

  if (!item) return null;

  const timeAgo = (ds: string) => {
    try {
      const h = Math.floor((Date.now() - new Date(ds).getTime()) / 3.6e6);
      if (h < 1) return 'منذ قليل';
      if (h < 24) return `منذ ${h} ساعة`;
      const d = Math.floor(h / 24);
      if (d < 7) return `منذ ${d} أيام`;
      return `منذ ${Math.floor(d / 7)} أسابيع`;
    } catch { return ''; }
  };

  const formattedDate = new Date(item.pubDate).toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const handleShareAsPost = async () => {
    if (!appUser) return;
    if (!showPostEditor) {
      setShowPostEditor(true);
      return;
    }

    setIsPosting(true);
    try {
      const fullContent = item.content || item.description || '';
      const cleanContent = fullContent.replace(/<[^>]*>?/gm, '').trim();
      
      const { error } = await (supabase.from('posts') as any).insert([{
        author_id: appUser.id,
        author_name: appUser.name,
        author_avatar: appUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(appUser.name)}&background=random`,
        content: `${postComment ? postComment + '\n\n' : ''}📌 **${item.title}**\n\n${cleanContent}\n\nالمصدر: ${item.source}\nالرابط: ${item.link}`,
        image_url: item.thumbnail || null,
        likes_count: 0
      }]);

      if (error) throw error;

      setPostSuccess(true);
      setTimeout(() => {
        setPostSuccess(false);
        setShowPostEditor(false);
      }, 3000);
    } catch (error) {
      console.error('Error sharing post:', error);
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 50 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 50 }}
        className="bg-white dark:bg-slate-900 w-full md:max-w-4xl h-[70vh] md:h-[85vh] rounded-[2.5rem] md:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col relative z-50 border border-white/10"
      >
        {/* Header content ... */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-white border border-white/20">
              <LayoutList size={20} />
            </div>
            <div>
              <h2 className="font-black text-white line-clamp-1">{item.source}</h2>
              <p className="text-[10px] font-bold text-blue-100 uppercase tracking-widest">{timeAgo(item.pubDate)}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-white/80 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-10">
          <div className="max-w-3xl mx-auto space-y-8">
            {/* Image */}
            {item.thumbnail && (
              <div className="relative group">
                <div className="absolute inset-0 bg-blue-600/20 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity rounded-full" />
                <img 
                  src={item.thumbnail} 
                  alt={item.title}
                  className="relative w-full h-auto max-h-[400px] object-cover rounded-[2rem] shadow-2xl border border-white/10"
                />
              </div>
            )}

            {/* Title Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-100 dark:border-blue-800/30">
                  {item.category || 'أخبار المهنيين'}
                </span>
                <span className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <Calendar size={12} />
                  {formattedDate}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white leading-tight">
                {item.title}
              </h1>
            </div>

            <div className="space-y-6">
              <h3 className="font-black text-lg text-slate-800 dark:text-white border-r-4 border-blue-600 pr-4">التفاصيل الكاملة</h3>
              <div className="bg-white dark:bg-slate-800/30 p-6 sm:p-10 rounded-[2rem] sm:rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm">
                {(() => {
                  const content = item.content || item.description || '';
                  const urlPattern = /(https?:\/\/[^\s]+)/g;
                  const phonePattern = /((\+?964|0)7[0-9]{9})/g;

                  return content.split('\n').filter((p: string) => p.trim()).map((paragraph: string, idx: number) => (
                    <p key={idx} className="text-slate-700 dark:text-slate-300 text-sm sm:text-base leading-relaxed mb-4 text-justify">
                      {paragraph.split(/(\s+)/).map((part: string, i: number) => {
                        if (phonePattern.test(part)) {
                          const phone = part.match(phonePattern)?.[0] || '';
                          const cleanPhone = phone.replace(/\s/g, '');
                          return (
                            <span key={i} className="inline-flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-xl border border-blue-100 dark:border-blue-800/30 font-black text-[11px] mx-1 shadow-sm hover:scale-105 transition-all cursor-pointer my-0.5" onClick={() => window.open(`tel:${cleanPhone}`)}>
                              <Phone size={12} /> {phone}
                            </span>
                          );
                        }
                        if (part.includes('@') && part.includes('.')) {
                           return (
                             <span key={i} className="inline-flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-slate-800 font-black text-[11px] mx-1 shadow-sm hover:scale-105 transition-all cursor-pointer my-0.5" onClick={() => window.open(`mailto:${part}`)}>
                               <Send size={12} /> {part}
                             </span>
                           );
                        }
                        if (urlPattern.test(part)) {
                          const url = part.match(urlPattern)?.[0] || '';
                          let label = 'الرابط';
                          let color = 'text-blue-500 bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/30';
                          let Icon = ExternalLink;

                          if (url.includes('wa.me') || url.includes('whatsapp.com')) { 
                            label = 'WhatsApp'; color = 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/30'; 
                            Icon = MessageCircle;
                          }
                          else if (url.includes('linkedin.com')) { 
                            label = 'LinkedIn'; color = 'text-[#0a66c2] bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/30'; 
                          }
                          else if (url.includes('t.me')) { 
                            label = 'Telegram'; color = 'text-sky-600 bg-sky-50 dark:bg-sky-900/20 border-sky-100 dark:border-sky-800/30'; 
                            Icon = Send;
                          }
                          
                          return (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1.5 font-black ${color} px-3 py-1.5 rounded-xl border border-blue-100/20 text-[11px] mx-1 shadow-sm hover:scale-105 transition-all my-0.5`}>
                              <Icon size={12} /> {label}
                            </a>
                          );
                        }
                        if (part.startsWith('#')) {
                          return <span key={i} className="text-[#0a66c2] dark:text-blue-400 font-black hover:underline cursor-pointer">{part}</span>;
                        }
                        return <span key={i}>{part}</span>;
                      })}
                    </p>
                  ));
                })()}
              </div>
            </div>

            {/* Source Link */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shadow-sm">
                  <Clock size={18} className="text-slate-400" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">مصدر الخبر</p>
                  <p className="font-black text-slate-800 dark:text-white">{item.source}</p>
                </div>
              </div>
              <a 
                href={item.link} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-black text-xs border border-slate-200 dark:border-slate-700 hover:border-blue-500 transition-all shadow-sm group"
              >
                قراءة المقال الأصلي
                <ExternalLink size={14} className="group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-white/10 bg-gradient-to-l from-blue-600 to-indigo-700 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button 
              className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-all shadow-sm"
            >
              <RefreshCw size={20} />
            </button>
            <button 
              className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-all shadow-sm"
            >
              <Share2 size={20} />
            </button>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {showPostEditor && (
              <input 
                type="text"
                placeholder="أضف تعليقك..."
                value={postComment}
                onChange={(e) => setPostComment(e.target.value)}
                className="flex-1 sm:w-64 bg-white/20 backdrop-blur-md border border-white/20 text-white placeholder:text-blue-100 rounded-2xl px-5 py-3 text-xs outline-none focus:bg-white/30"
              />
            )}
            <button 
              onClick={handleShareAsPost}
              disabled={isPosting || postSuccess}
              className={`flex-1 sm:w-auto px-8 py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition-all shadow-xl ${
                postSuccess 
                  ? 'bg-emerald-500 text-white' 
                  : 'bg-white text-blue-600 hover:bg-blue-50 shadow-blue-500/20'
              }`}
            >
              {postSuccess ? (
                <span key="success" className="flex items-center gap-2">
                  <CheckCircle size={18} />
                  تم النشر بنجاح
                </span>
              ) : isPosting ? (
                <span key="posting" className="flex items-center gap-2">
                  <RefreshCw size={18} className="animate-spin" />
                  جاري النشر...
                </span>
              ) : (
                <span key="idle" className="flex items-center gap-2">
                  <Sparkles size={18} />
                  نشر على ProLink
                </span>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
