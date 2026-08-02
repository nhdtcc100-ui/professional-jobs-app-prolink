export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorTitle: string;
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  timestamp: any;
  likesCount: number;
}

export interface Job {
  id: string;
  employer_id?: string;
  employerName?: string;
  title: string;
  company: string;
  location?: string;
  salary?: string;
  description: string;
  requirements?: string;
  jobType?: string;
  working_hours?: string;
  image_url?: string;
  is_active?: boolean;
  postedAt: any;
}

export interface Course {
  id: string;
  provider_id?: string;
  providerName?: string;
  providerAvatar?: string;
  title: string;
  description: string;
  image_url?: string;
  duration?: string;
  price?: string;
  level?: string;
  is_active?: boolean;
  created_at?: any;
}

export interface CourseRegistration {
  id: string;
  course_id: string;
  user_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at?: any;
}

export interface WorkExperience {
  id: string;
  company: string;
  role: string;
  tasks: string;
  skills: string;
  duration: string;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: 'seeker' | 'employer';
  isPro: boolean;
  isAdmin?: boolean;
  bio?: string;
  title?: string;
  companyName?: string;
  industry?: string;
  website?: string;
  skills?: string[];
  location?: string;
  phone?: string;
  coverUrl?: string;
  cvUrl?: string;
  experience?: string;
  education?: string;
  workExperiences?: WorkExperience[];
  hasErpAccess?: boolean;
  hasCallsAccess?: boolean;
}

export interface AppConnection {
  id: string;
  requesterId: string;
  recipientId: string;
  status: 'pending' | 'accepted';
  timestamp: any;
}

export interface AppNotification {
  id: string;
  userId: string;
  type: 'follow_request' | 'sync_approval' | 'like' | 'comment' | 'repost' | 'message' | 'job_application' | 'missed_call';
  fromId: string;
  fromName: string;
  fromAvatar: string;
  targetId: string;
  read: boolean;
  timestamp: any;
}
export interface JobApplication {
  id: string;
  job_id: string;
  applicant_id: string;
  applicant_name: string;
  applicant_avatar: string;
  status: 'pending' | 'approved' | 'rejected';
  cover_letter?: string;
  cv_url?: string;
  created_at: any;
  job_title?: string;
}

export interface Employee {
  id: string;
  employer_id: string;
  user_id: string;
  job_id: string;
  salary: string;
  working_hours: string;
  department: string;
  hire_date: any;
  status: 'active' | 'inactive' | 'terminated';
  // Joined/enriched fields (not in DB, added client-side)
  employee_data?: {
    name: string;
    avatar: string;
    role: string;
  };
  // Aliased from join
  jobTitle?: string;
  company?: string;
  biometric_id?: string;
}

export interface Attendance {
  id: string;
  employee_id: string;
  date: string; // YYYY-MM-DD
  check_in_time: any;
  check_out_time?: any;
  location_lat?: number;
  location_lng?: number;
  photo_url?: string;
  status: 'present' | 'late' | 'absent' | 'excused';
}

export interface KioskDevice {
  id: string;
  employer_id: string;
  device_name: string;
  device_fingerprint: string;
  location_lat?: number;
  location_lng?: number;
  geofence_radius?: number; // meters
  is_active: boolean;
  last_used_at?: any;
  created_at: any;
}
