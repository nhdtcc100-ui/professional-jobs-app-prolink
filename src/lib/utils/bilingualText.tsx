import React from 'react';
import { ExternalLink, Phone, Send, MessageCircle, MapPin, Clock } from 'lucide-react';
import { RECOGNIZED_LOCATIONS, WORKING_HOURS_KEYWORDS } from './formatNews';

const ARABIC_CHAR_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const ENGLISH_CHAR_REGEX = /[a-zA-Z]/;

export interface BilingualSegment {
  id: string;
  text: string;
  dir: 'rtl' | 'ltr';
  align: 'text-right' | 'text-left';
  isArabic: boolean;
}

/**
 * Checks if a piece of text is predominantly Arabic.
 */
export function isArabicText(text: string): boolean {
  let arabicLetters = 0;
  let latinLetters = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ARABIC_CHAR_REGEX.test(ch)) arabicLetters++;
    else if (ENGLISH_CHAR_REGEX.test(ch)) latinLetters++;
  }
  if (arabicLetters === 0 && latinLetters === 0) return true; // default RTL
  return arabicLetters >= latinLetters * 0.4;
}

/**
 * Splits dense or mixed text into separate Arabic and English lines/paragraphs
 * so that English flows naturally LTR from the left and Arabic flows RTL from the right.
 */
export function splitBilingualText(rawText: string): BilingualSegment[] {
  if (!rawText) return [];

  // Normalize newlines and HTML tags
  const cleanRaw = rawText.replace(/<[^>]*>?/gm, '').replace(/\r\n/g, '\n');
  const rawLines = cleanRaw.split('\n');
  const segments: BilingualSegment[] = [];

  rawLines.forEach((line, lineIdx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }

    const hasArabic = ARABIC_CHAR_REGEX.test(trimmed);
    const englishWords = trimmed.match(/[a-zA-Z]{2,}/g) || [];
    const hasSubstantialEnglish = englishWords.length >= 2;

    // If line has a mix of significant Arabic and English, separate them into distinct lines
    if (hasArabic && hasSubstantialEnglish) {
      const subChunks = breakMixedLine(trimmed);
      subChunks.forEach((chunk, chunkIdx) => {
        const chunkTrimmed = chunk.trim();
        if (!chunkTrimmed) return;
        const isAr = isArabicText(chunkTrimmed);
        segments.push({
          id: `${lineIdx}-${chunkIdx}`,
          text: chunkTrimmed,
          dir: isAr ? 'rtl' : 'ltr',
          align: isAr ? 'text-right' : 'text-left',
          isArabic: isAr
        });
      });
    } else {
      const isAr = isArabicText(trimmed);
      segments.push({
        id: `${lineIdx}-0`,
        text: trimmed,
        dir: isAr ? 'rtl' : 'ltr',
        align: isAr ? 'text-right' : 'text-left',
        isArabic: isAr
      });
    }
  });

  return segments;
}

/**
 * Breaks a single line that mixes Arabic and English sentences/clauses
 */
function breakMixedLine(line: string): string[] {
  // 1. Split on punctuation delimiters that often separate clauses: (: | - • | . | !)
  // Example: "المتطلبات: Requirements: 3 years experience" -> "المتطلبات:", "Requirements: 3 years experience"
  const delimiterPattern = /(?<=[.:؛!؟\-\n•|])\s+(?=[A-Za-z\u0600-\u06FF])/;
  const initialChunks = line.split(delimiterPattern);
  const result: string[] = [];

  for (const chunk of initialChunks) {
    const hasAr = ARABIC_CHAR_REGEX.test(chunk);
    const englishMatches = chunk.match(/([a-zA-Z][a-zA-Z0-9+#/.,\s-]{4,}[a-zA-Z0-9])/g);

    if (hasAr && englishMatches && englishMatches.some(m => m.trim().split(/\s+/).length >= 2)) {
      // Extract English phrases of 2+ words or significant length
      let remaining = chunk;
      for (const engPhrase of englishMatches) {
        if (engPhrase.trim().split(/\s+/).length >= 2 || engPhrase.length >= 10) {
          const idx = remaining.indexOf(engPhrase);
          if (idx !== -1) {
            const before = remaining.substring(0, idx).trim();
            if (before) result.push(before);
            result.push(engPhrase.trim());
            remaining = remaining.substring(idx + engPhrase.length).trim();
          }
        }
      }
      if (remaining) result.push(remaining);
    } else {
      result.push(chunk);
    }
  }

  return result.filter(c => c.trim().length > 0);
}

/**
 * Formats inline interactive tokens (links, phones, emails, tags) within a single line
 */
export const SmartLineRenderer: React.FC<{ text: string; isArabic: boolean }> = ({ text, isArabic }) => {
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  const phonePattern = /((?:\+?964|0)7[0-9]{9})/g;
  const emailPattern = /([\w.-]+@[\w.-]+\.[a-z]{2,})/gi;

  const combined = /(https?:\/\/[^\s]+|(?:\+?964|0)7[0-9]{9}|[\w.-]+@[\w.-]+\.[a-z]{2,})/g;
  const parts = text.split(combined);

  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;
        if (urlPattern.test(part)) {
          urlPattern.lastIndex = 0;
          const url = part;
          let label = 'رابط خارجي';
          let colorClass = 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800/40';
          let Icon = ExternalLink;
          if (url.includes('wa.me') || url.includes('whatsapp')) {
            label = 'WhatsApp';
            colorClass = 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800/40';
            Icon = MessageCircle;
          } else if (url.includes('t.me')) {
            label = 'Telegram';
            colorClass = 'text-sky-600 bg-sky-50 dark:bg-sky-900/30 border-sky-200 dark:border-sky-800/40';
            Icon = Send;
          } else if (url.includes('linkedin.com')) {
            label = 'LinkedIn';
            colorClass = 'text-[#0a66c2] bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800/40';
          }
          return (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              dir="ltr"
              className={`inline-flex items-center gap-1.5 font-black ${colorClass} px-2.5 py-1 rounded-xl border text-[11px] mx-1 shadow-sm hover:scale-105 transition-all my-0.5`}
            >
              <Icon size={12} /> {label}
            </a>
          );
        }
        if (phonePattern.test(part)) {
          phonePattern.lastIndex = 0;
          const clean = part.replace(/\s/g, '');
          return (
            <span
              key={i}
              onClick={() => window.open(`tel:${clean}`)}
              dir="ltr"
              className="inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/25 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-xl border border-emerald-200 dark:border-emerald-800/40 font-black text-[11px] mx-1 shadow-sm hover:scale-105 transition-all cursor-pointer my-0.5"
            >
              <Phone size={11} /> {part}
            </span>
          );
        }
        if (emailPattern.test(part)) {
          emailPattern.lastIndex = 0;
          return (
            <a
              key={i}
              href={`mailto:${part}`}
              dir="ltr"
              className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 font-black text-[11px] mx-1 shadow-sm hover:scale-105 transition-all my-0.5"
            >
              <Send size={11} /> {part}
            </a>
          );
        }

        // Location & Working Hour Highlights for Arabic
        if (isArabic) {
          const words = part.split(' ');
          return (
            <span key={i}>
              {words.map((word, wIdx) => {
                const cleanWord = word.replace(/[،؛:.!?]/g, '').trim();
                const isLocation = RECOGNIZED_LOCATIONS.includes(cleanWord);
                const isWorkingHour = WORKING_HOURS_KEYWORDS.some(kw => word.includes(kw));

                if (isLocation) {
                  return (
                    <span key={wIdx} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-0.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-black text-xs border border-blue-200/50 dark:border-blue-800/50">
                      <MapPin size={10} className="text-blue-500" />
                      {word}{' '}
                    </span>
                  );
                }
                if (isWorkingHour) {
                  return (
                    <span key={wIdx} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-0.5 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-black text-xs border border-amber-200/50 dark:border-amber-800/50">
                      <Clock size={10} className="text-amber-500" />
                      {word}{' '}
                    </span>
                  );
                }
                return word + ' ';
              })}
            </span>
          );
        }

        return <span key={i}>{part}</span>;
      })}
    </>
  );
};

/**
 * 🌟 BilingualSmartText Component:
 * Automatically formats bilingual mixed text, ensuring:
 * - English lines render from the Left (dir="ltr", text-left).
 * - Arabic lines render from the Right (dir="rtl", text-right).
 * - Mixed text splits onto separate lines so neither gets corrupted.
 */
export const BilingualSmartText: React.FC<{
  text: string;
  className?: string;
  paragraphClassName?: string;
}> = ({ text, className = 'space-y-3', paragraphClassName = '' }) => {
  if (!text) return null;

  const segments = splitBilingualText(text);

  if (segments.length === 0) return null;

  return (
    <div className={className}>
      {segments.map((segment) => (
        <p
          key={segment.id}
          dir={segment.dir}
          className={`leading-relaxed text-sm md:text-base ${segment.align} ${
            segment.isArabic
              ? 'font-medium text-slate-700 dark:text-slate-200 font-arabic'
              : 'font-normal text-slate-800 dark:text-slate-100 font-sans tracking-wide'
          } ${paragraphClassName}`}
        >
          <SmartLineRenderer text={segment.text} isArabic={segment.isArabic} />
        </p>
      ))}
    </div>
  );
};
