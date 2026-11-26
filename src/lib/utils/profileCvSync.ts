/**
 * Bi-directional synchronization utilities between User Profile and ATS CV data.
 * Ensures changes made in either Profile or CV Builder immediately sync with each other,
 * persist cleanly to DB & per-user localStorage, and remain strictly isolated per user ID.
 */

export function readStoredCvForUser(userId?: string | null): any | null {
  if (!userId || typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`prolink_ats_cv_${userId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function resolveLatestCvData(userObj: any): any | null {
  const dbCv = userObj?.cv_data || userObj?.cvData || null;
  const lsCv = readStoredCvForUser(userObj?.id);
  if (!dbCv && !lsCv) return null;
  if (!dbCv) return lsCv;
  if (!lsCv) return dbCv;
  const dbTs = Date.parse(dbCv?.updatedAt || userObj?.cv_updated_at || '') || 0;
  const lsTs = Date.parse(lsCv?.updatedAt || '') || 0;
  return lsTs > dbTs ? lsCv : dbCv;
}

export function buildProfileWithSyncedCv(
  userId: string,
  currentUser: any,
  profileUpdates: Record<string, any>
): { dbUpdates: Record<string, any>; syncedCvData: Record<string, any>; now: string } {
  const now = new Date().toISOString();
  const existingCv = resolveLatestCvData(currentUser) || {};

  const resolvedTitle =
    profileUpdates.title !== undefined
      ? profileUpdates.title
      : profileUpdates.display_title !== undefined
        ? profileUpdates.display_title
        : (currentUser?.title || currentUser?.displayTitle || existingCv.title || '');

  const syncedCvData: Record<string, any> = {
    ...existingCv,
    name: profileUpdates.name !== undefined ? profileUpdates.name : (existingCv.name || currentUser?.name || ''),
    title: resolvedTitle,
    location: profileUpdates.location !== undefined ? profileUpdates.location : (existingCv.location || currentUser?.location || ''),
    bio: profileUpdates.bio !== undefined ? profileUpdates.bio : (existingCv.bio || currentUser?.bio || ''),
    phone: profileUpdates.phone !== undefined ? profileUpdates.phone : (existingCv.phone || currentUser?.phone || ''),
    email: existingCv.email || currentUser?.email || '',
    education: profileUpdates.education !== undefined ? profileUpdates.education : (existingCv.education || currentUser?.education || ''),
    skills: profileUpdates.skills !== undefined ? profileUpdates.skills : (existingCv.skills || currentUser?.skills || []),
    updatedAt: now,
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`prolink_ats_cv_${userId}`, JSON.stringify(syncedCvData));
    } catch {}
  }

  return {
    now,
    syncedCvData,
    dbUpdates: {
      ...profileUpdates,
      cv_data: syncedCvData,
      cv_updated_at: now,
    },
  };
}

export function resolveSyncedProfileFields(userObj: any, fallbackApplicant?: any) {
  const savedCvData = resolveLatestCvData(userObj) || fallbackApplicant?.cv_data || fallbackApplicant?.cvData || fallbackApplicant?.atsCV || null;

  const profileTs = Date.parse(userObj?.updated_at || '') || 0;
  const cvTs = Date.parse(savedCvData?.updatedAt || userObj?.cv_updated_at || '') || 0;
  const preferProfile = profileTs > cvTs + 1500;

  const pick = (profileVal: any, cvVal: any, applicantVal?: any, fallback = '') => {
    if (applicantVal) return applicantVal;
    if (preferProfile) {
      return (profileVal !== undefined && profileVal !== null && String(profileVal).trim() !== '')
        ? profileVal
        : (cvVal || fallback);
    }
    return (cvVal !== undefined && cvVal !== null && String(cvVal).trim() !== '')
      ? cvVal
      : (profileVal || fallback);
  };

  const profileTitle = userObj?.title || userObj?.displayTitle || userObj?.display_title || userObj?.job_title || userObj?.headline || '';
  const cvTitle = savedCvData?.title || '';

  return {
    savedCvData,
    name: pick(userObj?.name || userObj?.full_name, savedCvData?.name || savedCvData?.fullName, fallbackApplicant?.name, ''),
    title: pick(profileTitle, cvTitle, fallbackApplicant?.title, ''),
    phone: pick(userObj?.phone, savedCvData?.phone, fallbackApplicant?.phone, ''),
    email: pick(userObj?.email, savedCvData?.email, fallbackApplicant?.email, ''),
    location: pick(userObj?.location, savedCvData?.location, fallbackApplicant?.location, ''),
    bio: pick(userObj?.bio, savedCvData?.bio || savedCvData?.summary, fallbackApplicant?.bio, ''),
    education: pick(userObj?.education, savedCvData?.education || savedCvData?.educationText, fallbackApplicant?.education, ''),
    skills: ((): string[] => {
      if (Array.isArray(fallbackApplicant?.skills) && fallbackApplicant.skills.length > 0) return [...fallbackApplicant.skills];
      if (preferProfile && Array.isArray(userObj?.skills) && userObj.skills.length > 0) return [...userObj.skills];
      if (Array.isArray(savedCvData?.skills) && savedCvData.skills.length > 0) return [...savedCvData.skills];
      return Array.isArray(userObj?.skills) ? [...userObj.skills] : [];
    })(),
  };
}
