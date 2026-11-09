import { AppUser } from '../../types';

/**
 * 👑 Checks if a user is an Administrator (highest authority).
 * Administrators always have full superpowers and access to all tools.
 */
export const isUserAdmin = (user: any): boolean => {
  if (!user) return false;
  const role = String(user.role || '').toLowerCase().trim();
  const email = String(user.email || '').toLowerCase().trim();

  return Boolean(
    user.isAdmin === true ||
    user.is_admin === true ||
    role === 'admin' ||
    role === 'superadmin' ||
    role === 'مدير' ||
    role === 'ادمن' ||
    email === 'admin@prolink.com' ||
    email.includes('nhdtcc100@gmail.com') ||
    email.includes('nhd0770@gmail.com')
  );
};

/**
 * 💼 Checks if a user is authorized to post jobs.
 * 1. Seeker & Freelancer: STRICTLY FALSE (always respected, even for testing admins).
 * 2. Employer: TRUE.
 * 3. Dedicated Admin role (role === 'admin'): TRUE.
 */
export const isJobPoster = (user: any): boolean => {
  if (!user) return false;
  const role = String(user.role || '').toLowerCase().trim();

  // 🚫 Seeker and Freelancer are strictly forbidden from posting formal corporate jobs
  if (
    role === 'seeker' ||
    role === 'jobseeker' ||
    role === 'job_seeker' ||
    role === 'candidate' ||
    role === 'applicant' ||
    role === 'باحث' ||
    role === 'باحث عن عمل' ||
    role === 'freelancer' ||
    role === 'عمل حر' ||
    role === 'كشفي'
  ) {
    return false;
  }

  // ✅ Only explicitly designated Employers can post jobs
  if (
    role === 'employer' ||
    role === 'company' ||
    role === 'recruiter' ||
    role === 'صاحب عمل' ||
    role === 'شركة' ||
    role === 'مؤسسة' ||
    user.hasCompanyProfile === true
  ) {
    return true;
  }

  // 👑 Dedicated Admin account (without seeker/freelancer choice)
  if (isUserAdmin(user) && (role === 'admin' || role === 'superadmin' || !role)) {
    return true;
  }

  return false;
};

/**
 * 👤 Checks if a user is a Job Seeker.
 */
export const isJobSeeker = (user: any): boolean => {
  if (!user) return false;
  const role = String(user.role || '').toLowerCase().trim();
  return (
    role === 'seeker' ||
    role === 'jobseeker' ||
    role === 'job_seeker' ||
    role === 'candidate' ||
    role === 'applicant' ||
    role === 'باحث' ||
    role === 'باحث عن عمل'
  );
};

/**
 * ⚡ Checks if a user is a Freelancer / Field Specialist (عمل حر / كشفي).
 */
export const isFreelancer = (user: any): boolean => {
  if (!user) return false;
  const role = String(user.role || '').toLowerCase().trim();
  return (
    role === 'freelancer' ||
    role === 'كشفي' ||
    role === 'عمل حر' ||
    role === 'technician' ||
    role === 'فني'
  );
};

/**
 * 📝 Checks if a user can post articles, posts, and interact (like/dislike/comment/echo).
 * Seekers are read-only for posts and cannot publish or interact.
 * Employers and Admins have full access to post and interact.
 */
export const canUserPostAndInteract = (user: any): boolean => {
  if (!user) return false;
  if (isUserAdmin(user)) return true;
  if (isJobSeeker(user)) return false;
  return isJobPoster(user);
};


