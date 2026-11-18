import { CvData, CvSnapshot, cvHasContent, snapshotCv } from './cvData';
import { cvProfileService } from '../services/cvProfileService';

export function cvApplicationFields(data: CvData) {
  return {
    experience: data.experiences.map(e => [e.role, e.company, [e.start, e.current ? (data.settings.language === 'ar' ? 'حتى الآن' : 'Present') : e.end].filter(Boolean).join(' — '), e.description].filter(Boolean).join('\n')).join('\n\n'),
    education: data.education.map(e => [e.degree, e.school, e.field, [e.start, e.end].filter(Boolean).join(' — '), e.description].filter(Boolean).join('\n')).join('\n\n'),
    skills: data.skills,
    summary: data.summary,
  };
}

export async function getApplicationCv(userId: string): Promise<CvSnapshot | null> {
  const record = await cvProfileService.loadOwn(userId);
  return record && cvHasContent(record.data) ? snapshotCv(record.data) : null;
}
