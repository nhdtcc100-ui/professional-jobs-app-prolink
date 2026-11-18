import { CV_LIMITS, CvSnapshot, readCvSnapshot } from './cvData';
import { cvApplicationFields } from './cvApplication';

// Enforce privacy without changing the original capture time.
export function readApplicantCvSnapshot(input: unknown): CvSnapshot | null {
  const snapshot = readCvSnapshot(input);
  if (!snapshot) return null;
  const { data } = snapshot;
  if (!data.settings.showPhone) data.personal.phone = '';
  if (!data.settings.showEmail) data.personal.email = '';
  data.settings.showPhoto = false;
  return new TextEncoder().encode(JSON.stringify(snapshot)).length <= CV_LIMITS.maxBytes ? snapshot : null;
}

interface ApplicantCvSource {
  name?: string;
  full_name?: string;
  title?: string;
  job_title?: string;
  headline?: string;
  location?: string;
  phone?: string;
  email?: string;
  avatar?: string;
  avatar_url?: string;
  companyName?: string;
  industry?: string;
  experience?: string;
  education?: string;
  skills?: string | string[];
  bio?: string;
  cv?: unknown;
  cvUrl?: string;
  cv_url?: string;
  prevWorks?: unknown[];
}

export function resolveApplicantCvData(data: ApplicantCvSource = {}, profile: ApplicantCvSource = {}) {
  const snapshot = readApplicantCvSnapshot(data.cv);
  const fields = snapshot ? cvApplicationFields(snapshot.data) : null;
  const personal = snapshot?.data.personal;
  const hasSkills = Array.isArray(data.skills) ? data.skills.length > 0 : Boolean(data.skills?.trim());
  return {
    ...profile,
    ...data,
    cv: snapshot || undefined,
    // With a captured CV, even blank/hidden identity fields stay captured.
    name: personal ? personal.fullName : data.name || profile.name || profile.full_name || 'متقدم',
    title: personal ? personal.title : data.title || profile.title || profile.job_title || profile.headline || '',
    location: personal ? personal.location : data.location || profile.location || '',
    phone: personal ? personal.phone : data.phone || profile.phone || '',
    email: personal ? personal.email : data.email || profile.email || '',
    avatar: snapshot ? data.avatar || '' : data.avatar || profile.avatar || profile.avatar_url || '',
    companyName: data.companyName || (snapshot ? '' : profile.companyName) || '',
    industry: data.industry || (snapshot ? '' : profile.industry) || '',
    experience: data.experience || fields?.experience || (snapshot ? '' : profile.experience) || '',
    education: data.education || fields?.education || (snapshot ? '' : profile.education) || '',
    skills: hasSkills ? data.skills! : fields?.skills || profile.skills || [],
    bio: snapshot ? snapshot.data.summary : data.bio || profile.bio || '',
  };
}

// Excel interprets formula-looking values even in HTML imports.
export function excelCellText(value: unknown): string {
  let text = value == null ? '' : String(value);
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = `'${text}`;
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

interface ApplicantExcelApplication {
  status: string;
  created_at: string;
  applicant_data?: ApplicantCvSource;
  experience?: string;
  education?: string;
  skills?: string | string[];
  cv_url?: string;
  jobTitle?: string;
  jobs?: { title: string };
  job?: { title: string };
}

export function applicantExcelRow(app: ApplicantExcelApplication, index: number, profile?: ApplicantCvSource): string {
  const data = app.applicant_data || {};
  const a = resolveApplicantCvData({
    ...data,
    experience: data.experience || app.experience,
    education: data.education || app.education,
    skills: data.skills || app.skills,
  }, profile);
  const cv = a.cv?.data;
  const skills = cv ? JSON.stringify(cv.skills) : Array.isArray(a.skills) ? a.skills.join(' • ') : a.skills;
  const careerHistory = cv ? JSON.stringify(cv.experiences) : Array.isArray(a.prevWorks) ? a.prevWorks.map(raw => {
    const w = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    return `[${w.company || w.companyName || '-'}: ${w.role || w.title || '-'} | الراتب: ${w.salary || 'غير محدد'} | المهام: ${w.tasks || '-'}]`;
  }).join('\n') : '-';
  const hasUploadedCv = Boolean(app.cv_url || data.cvUrl || data.cv_url);
  const cvDescription = cv ? 'سيرة مرفقة بالطلب' : hasUploadedCv ? 'ملف سيرة ذاتية مرفق بالطلب' : '-';
  const statusText = app.status === 'approved' ? 'مقبول' : app.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة';
  const statusClass = app.status === 'approved' ? 'status-approved' : app.status === 'rejected' ? 'status-rejected' : 'status-pending';
  const values = [
    index + 1, a.name || '-', a.email || '-', a.phone || '-', a.location || '-', a.title || '-',
    a.companyName || '-', a.industry || '-',
    cv ? JSON.stringify(cv.experiences) : a.experience || '-',
    cv ? JSON.stringify(cv.education) : a.education || '-',
    skills || '-', cv ? cv.summary || '-' : a.bio || a.experience || '-', careerHistory,
    app.jobTitle || app.jobs?.title || app.job?.title || 'وظيفة غير معروفة',
    cvDescription, statusText, new Date(app.created_at).toLocaleDateString('ar-EG'),
  ];
  return `<tr class="${index % 2 === 0 ? 'row-even' : ''}">${values.map((value, i) => {
    const className = i === 13 ? 'job-title' : i === 15 ? statusClass : '';
    return `<td class="${className}" style="white-space: pre-wrap; mso-number-format:'\\@';">${excelCellText(value)}</td>`;
  }).join('')}</tr>`;
}
