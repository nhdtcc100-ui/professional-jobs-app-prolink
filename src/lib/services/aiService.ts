import { supabase } from '../supabase';

// All Gemini calls are proxied through the `ai-gemini` edge function.
// The API key lives only in Supabase secrets (GEMINI_API_KEY), never in the client bundle.

async function invokeAI(action: string, payload: Record<string, any>): Promise<any> {
  const { data, error } = await supabase.functions.invoke('ai-gemini', {
    body: { action, payload },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || 'AI request failed');
  return data.result;
}

export const aiService = {
  async evaluateApplicantCV(jobTitle: string, jobRequirements: string, cvUrl: string, applicantSkills: string[]) {
    try {
      return await invokeAI('evaluate-cv', { jobTitle, jobRequirements, cvUrl, applicantSkills });
    } catch (error) {
      console.error('AI evaluation failed:', error);
      return this.simulateEvaluation(jobTitle, cvUrl, applicantSkills);
    }
  },

  simulateEvaluation(jobTitle: string, cvUrl: string, skills: string[]) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          score: 0,
          strengths: [],
          weaknesses: ['خطأ في الاتصال بالسيرفر'],
          summary: 'تعذر الوصول لخدمة الذكاء الاصطناعي. يرجى المحاولة لاحقاً.'
        });
      }, 2000);
    });
  },

  async calculateJobMatch(userProfile: any, jobDetails: any) {
    try {
      return await invokeAI('job-match', { userProfile, jobDetails });
    } catch (e) {
      console.error('AI Match Error:', e);
      return { score: 65, missingSkills: ['لم نتمكن من التحليل'], interviewQuestions: ['كيف تصف خبرتك؟'] };
    }
  },

  async generateSummary(prompt: string) {
    try {
      return await invokeAI('summary', { prompt });
    } catch (e) {
      return 'فشل الملخص';
    }
  }
};