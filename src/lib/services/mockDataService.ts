/**
 * ─────────────────────────────────────────────────────────────────
 * mockDataService.ts — محرك البيانات والمستخدمين الوهميين (Client-Side Only)
 * ─────────────────────────────────────────────────────────────────
 * • 2,000 مستخدم وهمي مكتمل البيانات (أسماء، مسميات، مدن، صور، مهارات).
 * • منشورات ووظائف وأخبار ومحادثات تفاعلية.
 * • خفيف الوزن ومخزن في الذاكرة / LocalStorage فقط (صفر استهلاك لسوبابيس).
 * • يدعم التفعيل/الإطفاء من لوحة الأدمن، وتصدير واستيراد ملفات JSON.
 * ─────────────────────────────────────────────────────────────────
 */

import type { AppUser, Job, Post } from '../../types';
import type { NewsItem } from './newsService';

export interface MockDataBundle {
  version: number;
  generatedAt: string;
  users: AppUser[];
  posts: Post[];
  jobs: Job[];
  news: NewsItem[];
  messages: any[];
}

const STORAGE_KEY_ENABLED = 'prolink_mock_data_enabled';
const STORAGE_KEY_CUSTOM_DATA = 'prolink_mock_custom_data_v1';
const MOCK_CHANGE_EVENT = 'prolink_mock_data_change';

// ── قوائم أسماء وبيانات حقيقية غنية لتوليد 2000 مستخدم متنوع ─────────────
const MALE_NAMES = [
  'أحمد', 'محمد', 'علي', 'حسين', 'سجاد', 'كرار', 'حيدر', 'مصطفى', 'عمر', 'يوسف',
  'حسن', 'جعفر', 'مهدي', 'زيد', 'عمار', 'بلال', 'خالد', 'طارق', 'حمزة', 'إبراهيم',
  'صادق', 'أمير', 'ياسر', 'سيف', 'فهد', 'عبدالله', 'محمود', 'باسم', 'منتظر', 'سلام',
  'سامر', 'مازن', 'ليث', 'وسام', 'بهاء', 'زياد', 'طه', 'فراس', 'مروان', 'أيمن'
];

const FEMALE_NAMES = [
  'فاطمة', 'زينب', 'مريم', 'نور', 'سارة', 'آية', 'ريم', 'هدى', 'شهد', 'زهراء',
  'روان', 'رنا', 'تبارك', 'دعاء', 'مروة', 'حنين', 'أبرار', 'هاجر', 'بسمة', 'ياسمين',
  'ضحى', 'إسراء', 'أماني', 'منى', 'داليا', 'سناء', 'شمس', 'بنين', 'غدير', 'رشا',
  'تمارة', 'دينا', 'رواء', 'عبير', 'رند', 'آمنة', 'ملاك', 'سجى', 'رغد', 'وئام'
];

const SURNAMES = [
  'العبيدي', 'الجبوري', 'الشمري', 'الموسوي', 'السعدي', 'الكعبي', 'التميمي', 'الزيدي',
  'المالكي', 'الدليمي', 'الخفاجي', 'الحسيني', 'السامرائي', 'الربيعي', 'البصري', 'البغدادي',
  'الخزرجي', 'الهاشمي', 'الجاف', 'البرزنجي', 'النعيمي', 'العزاوي', 'اللامي', 'الجنابي',
  'الساعدي', 'البياتي', 'المحمداوي', 'الحمداني', 'القيسي', 'السوداني', 'الركابي', 'المشهداني'
];

const PROFESSIONS = [
  { title: 'مهندس برمجيات Full-Stack', skills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'Tailwind'] },
  { title: 'مصمم واجهات وتجربة مستخدم UI/UX', skills: ['Figma', 'Prototyping', 'User Research', 'Design Systems'] },
  { title: 'مطور تطبيقات موبايل Flutter', skills: ['Flutter', 'Dart', 'State Management', 'REST API', 'Firebase'] },
  { title: 'محاسب مالي ومدقق حسابات', skills: ['Excel Advanced', 'QuickBooks', 'Financial Auditing', 'VAT & Tax'] },
  { title: 'مدير تسويق رقمي وإعلانات', skills: ['SEO', 'Google Ads', 'Meta Ads', 'Content Strategy', 'Copywriting'] },
  { title: 'اختصاصي أمن سيبراني وشبكات', skills: ['Network Security', 'Penetration Testing', 'Firewalls', 'Linux'] },
  { title: 'مسؤول موارد بشرية HR', skills: ['Recruitment', 'Talent Acquisition', 'Labor Law', 'Payroll'] },
  { title: 'مهندس ذكاء اصطناعي وتحليل بيانات', skills: ['Python', 'Pandas', 'Machine Learning', 'Power BI', 'SQL'] },
  { title: 'مهندس معماري وتصميم داخلي', skills: ['AutoCAD', 'Revit', '3ds Max', 'Interior Design'] },
  { title: 'صيدلاني سريري واستشاري أدوية', skills: ['Clinical Pharmacy', 'Patient Care', 'Drug Dispensing', 'Inventory'] },
  { title: 'مترجم قانوني وتقني', skills: ['English/Arabic', 'Legal Translation', 'Technical Documentation'] },
  { title: 'مدير مبيعات وتطوير أعمال', skills: ['B2B Sales', 'Negotiation', 'CRM', 'Key Account Management'] },
  { title: 'فني صيانة شبكات وهواتف', skills: ['Hardware Repair', 'Fiber Optics', 'CCTV', 'VoIP'] },
  { title: 'كاتب ومصمم محتوى إبداعي', skills: ['Content Creation', 'Storytelling', 'Photoshop', 'Branding'] },
  { title: 'مهندس كهرباء وأتمتة صناعية', skills: ['PLC', 'Automation', 'Power Distribution', 'Maintenance'] },
  { title: 'طبيب عام واستشاري صحة', skills: ['General Medicine', 'Diagnosis', 'Public Health', 'First Aid'] }
];

const CITIES = [
  'بغداد', 'البصرة', 'أربيل', 'النجف الأشرف', 'كربلاء المقدسة', 'الموصل', 'السليمانية',
  'كركوك', 'الحلة (بابل)', 'الكوت (واسط)', 'الناصرية (ذي قار)', 'العمارة (ميسان)',
  'الديوانية', 'دهوك', 'الرمادي (الأنبار)', 'عن بُعد (Remote)'
];

const COMPANIES = [
  'زين العراق', 'آسياسيل', 'مصرف بغداد', 'إيرثلنك للاتصالات', 'شركة سومر للحلول التقنية',
  'دجلة للبرمجيات', 'بابل للمقاولات العامة', 'دار الدواء الدولية', 'المتحدون للخدمات اللوجستية',
  'الرازي للرعاية الصحية', 'الأفق للطاقة والتكنولوجيا', 'الرافدين للمدفوعات الإلكترونية',
  'مجموعة النماء التجارية', 'رواد الأعمال للتطوير', 'تيك فيجين الشرق الأوسط'
];

// روابط صور متنوعة وعالية الجودة
const AVATAR_SEEDS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80'
];

// دالة عشوائية محددة بالـ seed لضمان ثبات النتائج وسرعتها
function seededRandom(seed: number) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

/**
 * توليد 2000 مستخدم وهمي كامل البيانات بكفاءة فائقة (خلال بضع أجزاء من الثانية)
 */
function generate2000MockUsers(): AppUser[] {
  const users: AppUser[] = [];
  const total = 2000;

  for (let i = 1; i <= total; i++) {
    const isFemale = seededRandom(i * 11) > 0.48;
    const firstNames = isFemale ? FEMALE_NAMES : MALE_NAMES;
    const firstName = firstNames[Math.floor(seededRandom(i * 13) * firstNames.length)];
    const middleName = MALE_NAMES[Math.floor(seededRandom(i * 17) * MALE_NAMES.length)];
    const surname = SURNAMES[Math.floor(seededRandom(i * 19) * SURNAMES.length)];
    const fullName = `${firstName} ${middleName} ${surname}`;

    const prof = PROFESSIONS[Math.floor(seededRandom(i * 23) * PROFESSIONS.length)];
    const city = CITIES[Math.floor(seededRandom(i * 29) * CITIES.length)];
    const company = COMPANIES[Math.floor(seededRandom(i * 31) * COMPANIES.length)];
    
    // توزيع الأدوار: 65% باحث عن عمل، 25% صاحب عمل، 10% عمل حر
    const roleDice = seededRandom(i * 37);
    const role: 'seeker' | 'employer' | 'freelancer' =
      roleDice < 0.65 ? 'seeker' : roleDice < 0.90 ? 'employer' : 'freelancer';

    const avatarUrl = AVATAR_SEEDS[i % AVATAR_SEEDS.length];
    const isPro = seededRandom(i * 41) > 0.85;
    const isAvailable = role === 'seeker' ? seededRandom(i * 43) > 0.35 : false;

    users.push({
      id: `mock-user-${i}`,
      name: fullName,
      email: `user${i}@prolink.local`,
      avatar: avatarUrl,
      role,
      isPro,
      is_pro: isPro,
      isAdmin: false,
      is_admin: false,
      isActive: true,
      is_active: true,
      title: prof.title,
      displayTitle: prof.title,
      display_title: prof.title,
      location: city,
      skills: prof.skills,
      companyName: company,
      companyLogoUrl: avatarUrl,
      isAvailable,
      is_available: isAvailable,
      bio: `مهني متخصص في ${prof.title} مقيم في ${city}. شغوف بالتطوير ومستعد للفرص المهنية المميزة.`,
      phone: `+964 77${Math.floor(10000000 + seededRandom(i * 47) * 89999999)}`,
      coverUrl: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1200&auto=format&fit=crop&q=80',
      cvUrl: isAvailable ? `https://prolink.local/mock-cv-${i}.pdf` : undefined,
    });
  }

  return users;
}

/**
 * توليد 60 منشوراً واقعياً للرئيسية
 */
function generateMockPosts(mockUsers: AppUser[]): Post[] {
  const postTemplates = [
    'يسعدني أن أعلن عن إتمام مشروعنا الجديد بنجاح مع فريق العمل. تجربة رائعة وتحديات أثمرت نتائج مميزة! 🚀',
    'نصيحة لكل باحث عن عمل في مجالنا: الاهتمام ببناء معرض أعمال حقيقي (Portfolio) أهم بكثير من مجرد كتابة السيرة الذاتية.',
    'نبحث حالياً عن مطورين ومصممين موهوبين للانضمام إلى فريقنا في بغداد وأربيل. التفاصيل متوفرة في قسم الوظائف. 💼',
    'ما هي أفضل الممارسات التي تتبعونها لإدارة الوقت أثناء العمل عن بُعد؟ شاركونا تجاربكم 👇',
    'سعيد جداً بحصولي على شهادة الاعتماد المهنية المتقدمة بعد 3 أشهر من الدراسة والتدريب المكثف. 🎓',
    'الذكاء الاصطناعي لا يستبدل المتخصصين، بل يمنح المتخصصين الذين يتقنون أدواته سرعة وإنتاجية مضاعفة!',
    'تم اليوم إطلاق التحديث الجديد لمنصتنا مع تحسينات كبيرة في سرعة الاستجابة وتجربة المستخدم.',
    'شكراً لكل من شارك في ورشة العمل اليوم حول مستقبل سوق العمل المهني في العراق. نقاشات ملهمة!'
  ];

  const posts: Post[] = [];
  for (let i = 1; i <= 60; i++) {
    const user = mockUsers[(i * 7) % mockUsers.length];
    const content = postTemplates[i % postTemplates.length];
    const likesCount = Math.floor(15 + seededRandom(i * 53) * 180);
    const commentsCount = Math.floor(2 + seededRandom(i * 59) * 35);
    const hoursAgo = Math.floor(i * 1.5);

    posts.push({
      id: `mock-post-${i}`,
      authorId: user.id,
      authorName: user.name,
      authorAvatar: user.avatar,
      authorTitle: user.title || 'مستخدم منصة عمل',
      content,
      likesCount,
      dislikesCount: 0,
      commentsCount,
      timestamp: new Date(Date.now() - hoursAgo * 3600000).toISOString(),
      created_at: new Date(Date.now() - hoursAgo * 3600000).toISOString(),
      imageUrl: i % 3 === 0 ? 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop&q=80' : undefined
    });
  }

  return posts;
}

/**
 * توليد 50 وظيفة متنوعة
 */
function generateMockJobs(mockUsers: AppUser[]): Job[] {
  const jobTemplates = [
    { title: 'مطور واجهات أمامية Senior Frontend Developer', cat: 'تكنولوجيا وبرمجيات', sal: '1,800,000 - 2,500,000 د.ع', type: 'دوام كامل' },
    { title: 'مصمم جرافيك وهوية بصرية Creative Graphic Designer', cat: 'تصميم وإبداع', sal: '1,200,000 د.ع', type: 'دوام كامل' },
    { title: 'محاسب عام وتكاليف General Accountant', cat: 'مالية ومحاسبة', sal: '1,500,000 د.ع', type: 'دوام كامل' },
    { title: 'مدير فرع ومسؤول عمليات Branch Manager', cat: 'إدارة وأعمال', sal: '2,200,000 د.ع', type: 'دوام كامل' },
    { title: 'اختصاصي تسويق إلكتروني Digital Marketing Specialist', cat: 'تسويق وإعلانات', sal: '1,400,000 د.ع', type: 'عن بُعد' },
    { title: 'مهندس اتصالات وشبكات Network Engineer', cat: 'هندسة وشبكات', sal: '1,700,000 د.ع', type: 'دوام كامل' },
    { title: 'مترجم ومحرر لغوي Content Writer & Translator', cat: 'إعلام وترجمة', sal: '1,000,000 د.ع', type: 'عن بُعد' },
    { title: 'مسؤول مبيعات ميدانية B2B Sales Representative', cat: 'مبيعات', sal: '1,300,000 + عمولة', type: 'دوام كامل' },
    { title: 'صيدلاني مجاز لمجمع طبي', cat: 'صحة وطب', sal: '1,600,000 د.ع', type: 'دوام كامل' },
    { title: 'مطور تطبيقات فلاتر Mobile App Developer (Flutter)', cat: 'تكنولوجيا وبرمجيات', sal: '2,000,000 د.ع', type: 'عن بُعد' }
  ];

  const jobs: Job[] = [];
  const employers = mockUsers.filter(u => u.role === 'employer');

  for (let i = 1; i <= 50; i++) {
    const tmpl = jobTemplates[i % jobTemplates.length];
    const employer = employers[i % employers.length] || mockUsers[i % mockUsers.length];
    const city = CITIES[i % (CITIES.length - 1)]; // استبعاد remote المباشر وتضمينه كنوع
    const hoursAgo = Math.floor(i * 3);

    jobs.push({
      id: `mock-job-${i}`,
      employer_id: employer.id,
      employerName: employer.name,
      title: tmpl.title,
      company: employer.companyName || 'شركة رائدة',
      location: tmpl.type === 'عن بُعد' ? 'عن بُعد (Remote)' : city,
      salary: tmpl.sal,
      description: `نحن في ${employer.companyName || 'الشركة'} نبحث عن ${tmpl.title} ذو كفاءة للانضمام إلى فريقنا المتميز. بيئة عمل احترافية وفرص نمو واعدة ومكافآت مجزية.`,
      requirements: 'خبرة عملية لا تقل عن سنتين في نفس المجال، إتقان الأدوات الحديثة، مهارات تواصل ممتازة، والقدرة على العمل بروح الفريق.',
      jobType: tmpl.type,
      category: tmpl.cat,
      image_url: employer.avatar,
      is_active: true,
      postedAt: new Date(Date.now() - hoursAgo * 3600000).toISOString()
    });
  }

  return jobs;
}

/**
 * توليد 35 خبراً مهنياً واقتصادياً
 */
function generateMockNews(): NewsItem[] {
  const newsTitles = [
    'وزارة التخطيط تعلن عن نمو ملحوظ في قطاع الخدمات والوظائف الرقمية خلال الربع الأخير',
    'انطلاق فعاليات ملتقى بغداد السنوي للابتكار وتكنولوجيا المعلومات بمشاركة 80 شركة',
    'تقرير اقتصادي: تزايد الطلب على مهندسي البرمجيات واختصاصيي الأمن السيبراني في العراق',
    'افتتاح أول مركز حاضنة أعمال رقمية في البصرة لدعم رواد الأعمال والمشاريع الناشئة',
    'دراسة: العمل عن بُعد يحقق زيادة بنسبة 25% في الإنتاجية لدى الشركات التكنولوجية',
    'البنك المركزي يطلق مبادرة تمويلية جديدة لدعم مشاريع الشباب والشركات الصغيرة',
    'نصائح ذهبية لاجتياز مقابلات العمل التقنية في الشركات العالمية عبر الإنترنت',
    'أربيل تستضيف مؤتمر الاستثمار والتطوير العقاري بمشاركة وفود عربية ودولية'
  ];

  const news: NewsItem[] = [];
  for (let i = 1; i <= 35; i++) {
    const title = newsTitles[i % newsTitles.length];
    const hoursAgo = Math.floor(i * 4);

    news.push({
      id: `mock-news-${i}`,
      title,
      link: '#',
      pubDate: new Date(Date.now() - hoursAgo * 3600000).toISOString(),
      content: `${title}. يأتي هذا في إطار التطورات الاقتصادية والمهنية المتسارعة التي تشهدها المنطقة، مع تركيز متزايد على الرقمنة والمهارات الحديثة وتطوير الكوادر الشابة بما يلائم متطلبات السوق الإقليمي والدولي.`,
      description: `${title}. استعراض لأهم التطورات والفرص الواعدة في السوق المحلي.`,
      author: 'فريق تحرير منصة عمل',
      thumbnail: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&auto=format&fit=crop&q=80',
      source: 'شبكة الأخبار المهنية',
      region: 'iraq',
      topic: 'وظائف'
    });
  }

  return news;
}

/**
 * توليد 15 محادثة وهمية تفاعلية للرسائل
 */
function generateMockMessages(currentUserId: string, mockUsers: AppUser[]): any[] {
  const messages: any[] = [];
  const selectedPartners = mockUsers.slice(0, 15);

  selectedPartners.forEach((partner, idx) => {
    const sampleConversations = [
      'مرحباً، اطلعت على ملفك المهني المتميز ونود دعوتك لإجراء مقابلة عمل لوظيفة تناسب خبراتك.',
      'السلام عليكم أخي الكريم، هل أنت متاح حالياً لمشروع عمل حر قصير الأمد؟',
      'شكراً لتواصلك، سنقوم بمراجعة سيرتك الذاتية والرد عليك خلال 48 ساعة بإذن الله.',
      'أهلاً بك، سعداء بالتواصل معك عبر منصة عمل. نتمنى لك التوفيق الدائم!',
      'مرحباً، تم قبول طلب انضمامك للشبكة، نتطلع لفرص تعاون مشتركة ومثمرة.'
    ];

    const text = sampleConversations[idx % sampleConversations.length];
    const hoursAgo = idx * 2 + 1;

    messages.push({
      id: `mock-msg-${idx + 1}`,
      sender_id: partner.id,
      receiver_id: currentUserId || 'current-user',
      content: text,
      created_at: new Date(Date.now() - hoursAgo * 3600000).toISOString(),
      read: idx > 2 // أول 3 غير مقروءة
    });
  });

  return messages;
}

// ── فئة إدارة البيانات الوهمية ──────────────────────────────────────────
class MockDataService {
  private cache: MockDataBundle | null = null;

  /**
   * هل وضع البيانات الوهمية مفعل حالياً؟
   */
  isEnabled(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY_ENABLED) === 'true';
    } catch {
      return false;
    }
  }

  /**
   * تفعيل أو تعطيل وضع البيانات الوهمية
   */
  setEnabled(enabled: boolean): void {
    try {
      localStorage.setItem(STORAGE_KEY_ENABLED, enabled ? 'true' : 'false');
      window.dispatchEvent(new CustomEvent(MOCK_CHANGE_EVENT, { detail: { enabled } }));
    } catch (e) {
      console.error('[MockDataService] Failed to set enabled state:', e);
    }
  }

  /**
   * الاستماع لتغييرات حالة البيانات الوهمية
   */
  onStateChange(callback: (enabled: boolean) => void): () => void {
    const handler = (e: any) => callback(e.detail?.enabled ?? this.isEnabled());
    window.addEventListener(MOCK_CHANGE_EVENT, handler);
    return () => window.removeEventListener(MOCK_CHANGE_EVENT, handler);
  }

  /**
   * جلب حزمة البيانات الوهمية الكاملة (تُنشأ مرة واحدة في الذاكرة)
   */
  getBundle(currentUserId = 'me'): MockDataBundle {
    // 1. إذا كان هناك حزمة مخصصة رفعها الأدمن
    if (!this.cache) {
      try {
        const custom = localStorage.getItem(STORAGE_KEY_CUSTOM_DATA);
        if (custom) {
          this.cache = JSON.parse(custom);
          return this.cache!;
        }
      } catch {}

      // 2. توليد 2000 مستخدم + المحتوى المرافق تلقائياً
      const users = generate2000MockUsers();
      const posts = generateMockPosts(users);
      const jobs = generateMockJobs(users);
      const news = generateMockNews();
      const messages = generateMockMessages(currentUserId, users);

      this.cache = {
        version: 1,
        generatedAt: new Date().toISOString(),
        users,
        posts,
        jobs,
        news,
        messages
      };
    }

    return this.cache;
  }

  /**
   * تصدير البيانات الوهمية كملف JSON وتنزيله للمستخدم
   */
  exportAsJsonFile(): void {
    const bundle = this.getBundle();
    const jsonStr = JSON.stringify(bundle, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prolink_mock_data_2000_users_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * استيراد ملف JSON خارجي وحفظه في الذاكرة وLocalStorage
   */
  importFromJsonString(jsonStr: string): { success: boolean; error?: string; count?: number } {
    try {
      const parsed = JSON.parse(jsonStr);
      if (!parsed || !Array.isArray(parsed.users) || parsed.users.length === 0) {
        return { success: false, error: 'ملف JSON غير صالح: يجب أن يحتوي على مصفوفة users' };
      }

      this.cache = {
        version: parsed.version || 1,
        generatedAt: parsed.generatedAt || new Date().toISOString(),
        users: parsed.users,
        posts: Array.isArray(parsed.posts) ? parsed.posts : [],
        jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
        news: Array.isArray(parsed.news) ? parsed.news : [],
        messages: Array.isArray(parsed.messages) ? parsed.messages : []
      };

      try {
        localStorage.setItem(STORAGE_KEY_CUSTOM_DATA, JSON.stringify(this.cache));
      } catch (err: any) {
        console.warn('[MockDataService] localStorage full, kept in RAM only:', err);
      }

      window.dispatchEvent(new CustomEvent(MOCK_CHANGE_EVENT, { detail: { enabled: this.isEnabled() } }));
      return { success: true, count: this.cache.users.length };
    } catch (err: any) {
      return { success: false, error: err?.message || 'خطأ في معالجة ملف JSON' };
    }
  }

  /**
   * إعادة ضبط البيانات واستعادة الـ 2000 مستخدم الافتراضيين
   */
  resetToDefault(): void {
    try {
      localStorage.removeItem(STORAGE_KEY_CUSTOM_DATA);
    } catch {}
    this.cache = null;
    this.getBundle(); // يعيد بناء الـ 2000 مستخدم
    window.dispatchEvent(new CustomEvent(MOCK_CHANGE_EVENT, { detail: { enabled: this.isEnabled() } }));
  }

  /**
   * إحصائيات البيانات الوهمية
   */
  getStats() {
    const b = this.getBundle();
    return {
      users: b.users.length,
      posts: b.posts.length,
      jobs: b.jobs.length,
      news: b.news.length,
      messages: b.messages.length,
      usersCount: b.users.length,
      postsCount: b.posts.length,
      jobsCount: b.jobs.length,
      newsCount: b.news.length,
      messagesCount: b.messages.length
    };
  }
}

export const mockDataService = new MockDataService();

