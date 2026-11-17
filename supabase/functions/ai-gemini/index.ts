import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || '';
const MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-1.5-flash';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

async function callGemini(parts: unknown[]): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
      body: JSON.stringify({ contents: [{ parts }] }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Gemini HTTP ${res.status}`);
  const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
  if (!text) throw new Error('Empty Gemini response');
  return text;
}

const parseJsonReply = (text: string) => JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    if (!GEMINI_API_KEY) return json({ error: 'GEMINI_API_KEY not configured' }, 503);

    const { action, payload } = await req.json();

    switch (action) {
      case 'evaluate-cv': {
        const { jobTitle, jobRequirements, cvUrl, applicantSkills } = payload || {};
        const prompt = `
        أنت خبير موارد بشرية ومحترف في استقطاب الكفاءات (HR & Talent Acquisition Expert).
        قيم مطابقة السيرة الذاتية لوظيفة: "${jobTitle || ''}".
        المتطلبات: "${jobRequirements || 'خبرة مهنية'}".

        ⚠️ تنبيه: إذا كان الملف المرفوع ليس سيرة ذاتية، ضع النتيجة 0 واكتب تحذيراً.

        الرد JSON:
        {
          "score": number (0-100),
          "strengths": [string],
          "weaknesses": [string],
          "summary": string
        }
      `;

        const parts: unknown[] = [{ text: prompt }];
        if (cvUrl) {
          try {
            const fileRes = await fetch(cvUrl);
            if (fileRes.ok) {
              const buf = await fileRes.arrayBuffer();
              const mime = fileRes.headers.get('content-type') || '';
              parts.push({
                inline_data: {
                  mime_type: mime.includes('pdf') ? 'application/pdf' : mime.startsWith('image/') ? mime : 'image/jpeg',
                  data: toBase64(buf),
                },
              });
            }
          } catch (e) {
            console.warn('CV fetch failed:', e);
          }
        }

        try {
          return json({ ok: true, result: parseJsonReply(await callGemini(parts)) });
        } catch {
          const fallbackPrompt = `Evaluate candidate for ${jobTitle || ''} with skills: ${(applicantSkills || []).join(', ')}. Return JSON with score, strengths, weaknesses, summary.`;
          return json({ ok: true, result: parseJsonReply(await callGemini([{ text: fallbackPrompt }])) });
        }
      }

      case 'job-match': {
        const { userProfile, jobDetails } = payload || {};
        const prompt = `
        أنت خبير موارد بشرية محترف.
        قم بتقييم مدى توافق هذا المرشح مع هذه الوظيفة، واقترح أسئلة للمقابلة.

        بيانات الوظيفة:
        العنوان: ${jobDetails?.title || ''}
        الوصف: ${jobDetails?.description || ''}
        المتطلبات: ${jobDetails?.requirements || ''}

        بيانات المرشح:
        نبذة: ${userProfile?.about || ''}
        المهارات: ${(userProfile?.skills || []).join('، ')}

        يجب أن يكون الرد بصيغة JSON فقط، بالهيكل التالي:
        {
          "score": number (0-100),
          "missingSkills": [string],
          "interviewQuestions": [string, string, string, string, string]
        }
      `;
        return json({ ok: true, result: parseJsonReply(await callGemini([{ text: prompt }])) });
      }

      case 'summary': {
        const prompt = String(payload?.prompt || '').slice(0, 8000);
        if (!prompt) return json({ error: 'Empty prompt' }, 400);
        return json({ ok: true, result: await callGemini([{ text: prompt }]) });
      }

      default:
        return json({ error: 'Unknown action' }, 400);
    }
  } catch (error) {
    console.error('ai-gemini error:', error);
    return json({ error: (error as Error).message }, 500);
  }
});