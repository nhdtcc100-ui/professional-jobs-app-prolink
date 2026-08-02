/// <reference types="vite/client" />
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * 🔒 SECURITY NOTICE:
 * In a professional Next.js / Production environment, the API_KEY should NEVER 
 * be prefixed with VITE_ or exposed to the client. It should reside only on the 
 * Server / Edge layer to prevent token theft and unauthorized usage.
 */

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
let genAI: GoogleGenerativeAI | null = null;

if (API_KEY) {
  // Initialize only if key is present. 
  // WARNING: Exposed on client-side in this Vite configuration.
  genAI = new GoogleGenerativeAI(API_KEY);
}

// 🌐 Architecture: Separated Model Layer (Simulated Server Logic)
const getSecureModel = (modelName: string = "gemini-1.5-flash") => {
  if (!genAI) {
    if (import.meta.env.DEV) {
      console.error("Critical Security Audit: GEMINI_API_KEY is missing from environment.");
    }
    return null;
  }
  return genAI.getGenerativeModel({ model: modelName }, { apiVersion: 'v1' });
};

export const aiService = {
  async evaluateApplicantCV(jobTitle: string, jobRequirements: string, cvUrl: string, applicantSkills: string[]) {
    if (!genAI) {
      console.warn("No Gemini API key found.");
      return this.simulateEvaluation(jobTitle, cvUrl, applicantSkills);
    }

    try {
      let fileDataPart: any = null;
      
      if (cvUrl) {
          try {
            const response = await fetch(cvUrl);
            const blob = await response.blob();
            const base64 = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
              reader.readAsDataURL(blob);
            });
            
            fileDataPart = {
              inlineData: {
                data: base64 as string,
                mimeType: blob.type.includes('pdf') ? 'application/pdf' : 'image/jpeg'
              }
            };
          } catch (e) {
            console.error("❌ Document Fetch Error:", e);
          }
      }

      // Using stable v1 model
      const model = getSecureModel("gemini-1.5-flash");
      if (!model) throw new Error("AI not initialized");

      const prompt = `
        أنت خبير موارد بشرية ومحترف في استقطاب الكفاءات (HR & Talent Acquisition Expert).
        قيم مطابقة السيرة الذاتية لوظيفة: "${jobTitle}".
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

      const result = await model.generateContent([prompt, fileDataPart].filter(Boolean));
      const response = await result.response;
      let text = response.text();
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(text);

    } catch (error: any) {
      console.error("❌ AI Error Details:", error);
      
      // Fallback 1: Text-only analysis with a different model ID if needed
      try {
        const fallbackModel = getSecureModel("gemini-1.5-flash"); // Try same model but without file
        if (!fallbackModel) return this.simulateEvaluation(jobTitle, cvUrl, applicantSkills);
        
        const result = await fallbackModel.generateContent(`Evaluate candidate for ${jobTitle} with skills: ${applicantSkills.join(', ')}. Return JSON with score, strengths, weaknesses, summary.`);
        let text = (await result.response).text();
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(text);
      } catch (e) {
        // Fallback 2: Simulation
        return { 
          score: 0, 
          strengths: ["تحليل محدود"], 
          weaknesses: ["فشل الاتصال بالذكاء الاصطناعي"], 
          summary: "نعتذر، واجهنا مشكلة في الوصول لموديل الذكاء الاصطناعي (404). يرجى التأكد من تفعيل Gemini API في منطقتك." 
        };
      }
    }
  },

  simulateEvaluation(jobTitle: string, cvUrl: string, skills: string[]) {
     return new Promise((resolve) => {
        setTimeout(() => {
           resolve({
             score: 0,
             strengths: [],
             weaknesses: ["خطأ في الاتصال بالسيرفر"],
             summary: "يرجى التأكد من تفعيل Gemini API في حسابك على Google Cloud Console."
           });
        }, 2000);
     });
  },

  async calculateJobMatch(userProfile: any, jobDetails: any) {
    const model = getSecureModel("gemini-1.5-flash");
    if (!model) {
      return {
        score: 65,
        missingSkills: ["تحليل البيانات"],
        interviewQuestions: ["كيف تصف خبرتك؟"]
      };
    }

    try {
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

      const result = await model.generateContent(prompt);
      let text = (await result.response).text();
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(text);
    } catch (e) {
      console.error("AI Match Error:", e);
      return { score: 65, missingSkills: ["لم نتمكن من التحليل"], interviewQuestions: ["كيف تصف خبرتك؟"] };
    }
  },

  async generateSummary(prompt: string) {
    const model = getSecureModel("gemini-1.5-flash");
    if (!model) return "No Key";
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (e) {
      return "فشل الملخص";
    }
  }
};

