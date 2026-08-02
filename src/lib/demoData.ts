import { AppUser, Post, Job } from '../types';

export const DEMO_JOBS: Job[] = [
  { id: 'demo-1', employer_id: 'demo', employerName: 'تيك إيراق', title: 'مهندس برمجيات أول', company: 'تيك إيراق', location: 'بغداد', salary: '2,500,000 د.ع', description: 'نبحث عن مهندس برمجيات ذو خبرة في React وNode.js لقيادة فريق التطوير. المتطلبات: 3+ سنوات خبرة، إتقان TypeScript وSQL.', postedAt: { toDate: () => new Date() } },
  { id: 'demo-2', employer_id: 'demo', employerName: 'نكست لاب', title: 'مصمم UI/UX محترف', company: 'نكست لاب', location: 'أربيل', salary: '1,800,000 د.ع', description: 'مطلوب مصمم واجهات مبدع لتصميم تجارب مستخدم استثنائية. خبرة في Figma وAdobe XD ضرورية.', postedAt: { toDate: () => new Date() } },
  { id: 'demo-3', employer_id: 'demo', employerName: 'كلاود سيستمز', title: 'مهندس DevOps', company: 'كلاود سيستمز', location: 'عن بُعد', salary: '3,200,000 د.ع', description: 'مطلوب مهندس DevOps متخصص في AWS وKubernetes وCI/CD pipelines. خبرة 5+ سنوات.', postedAt: { toDate: () => new Date() } },
  { id: 'demo-4', employer_id: 'demo', employerName: 'ديجيتال عراق', title: 'محلل بيانات', company: 'ديجيتال عراق', location: 'البصرة', salary: '2,000,000 د.ع', description: 'نبحث عن محلل بيانات يتقن Python وSQL والتصور البياني. خبرة في Machine Learning ميزة.', postedAt: { toDate: () => new Date() } },
  { id: 'demo-5', employer_id: 'demo', employerName: 'إنوفيت', title: 'مدير منتج', company: 'إنوفيت', location: 'بغداد', salary: '2,800,000 د.ع', description: 'مطلوب مدير منتج لقيادة تطوير تطبيق SaaS. خبرة في Agile وتحليل السوق ومتطلبات المستخدمين.', postedAt: { toDate: () => new Date() } },
];

export const DEMO_GROUPS = [
  { id: 'dg-1', name: 'مجتمع مطوري الذكاء الاصطناعي', description: 'تجمع نخبة المطورين في مجالات AI & ML وتقنيات البيانات الضخمة والتعلم العميق', category: 'برمجة', member_count: 1240, is_private: false, cover_url: 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=600&h=200&fit=crop&auto=format' },
  { id: 'dg-2', name: 'رواد الأعمال والشركات الناشئة', description: 'نقاشات حول الاستثمار، الإدارة وتطوير المشاريع الريادية في العراق والوطن العربي', category: 'ريادة أعمال', member_count: 856, is_private: false, cover_url: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=600&h=200&fit=crop&auto=format' },
  { id: 'dg-3', name: 'مهندسو البرمجيات عراق', description: 'مجتمع للمهندسين البرمجيين العراقيين لتبادل الخبرات والفرص الوظيفية والمعرفة التقنية', category: 'برمجة', member_count: 2341, is_private: false, cover_url: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&h=200&fit=crop&auto=format' },
  { id: 'dg-4', name: 'قادة التسويق الرقمي', description: 'منتدى حصري لمتخصصي التسويق الرقمي وصناع المحتوى وخبراء SEO وSocial Media', category: 'تسويق', member_count: 634, is_private: true, cover_url: 'https://images.unsplash.com/photo-1611926653458-09294b3142bf?w=600&h=200&fit=crop&auto=format' },
  { id: 'dg-5', name: 'نساء في التقنية — عراق', description: 'مجتمع داعم لتمكين المرأة في قطاع التكنولوجيا والابتكار والريادة التقنية', category: 'عام', member_count: 445, is_private: false, cover_url: 'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=600&h=200&fit=crop&auto=format' },
  { id: 'dg-6', name: 'مصممو الجرافيك والهوية البصرية', description: 'فضاء إبداعي لمصممي الجرافيك والهوية البصرية لعرض أعمالهم وتبادل الإلهام والموارد', category: 'تصميم', member_count: 389, is_private: false, cover_url: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=600&h=200&fit=crop&auto=format' },
];

export const DEMO_POSTS: Post[] = [
  {
    id: 'dp-1',
    authorId: 'demo-u1',
    authorName: 'أحمد علي',
    authorAvatar: 'https://i.pravatar.cc/150?u=ahmed',
    authorTitle: 'مهندس برمجيات أول',
    content: 'سعيد جداً بانضمامي لمجتمع Elevate عراق المهني. أتطلع لتبادل الخبرات مع زملائي في مجال تطوير الويب والذكاء الاصطناعي.',
    timestamp: { toDate: () => new Date() },
    likesCount: 12
  } as any,
  {
    id: 'dp-2',
    authorId: 'demo-u2',
    authorName: 'سارة محمود',
    authorAvatar: 'https://i.pravatar.cc/150?u=sara',
    authorTitle: 'مصممة واجهات مستخدم',
    content: 'ما هي أفضل الأدوات التي تنصحون بها لتصميم تجربة المستخدم في عام 2026؟ هل ما زال Figma هو الخيار الأول؟',
    timestamp: { toDate: () => new Date(Date.now() - 3600000) },
    likesCount: 8
  } as any
];

export const DEMO_USERS: AppUser[] = [
  {
    id: 'demo-u1',
    name: 'أحمد علي',
    email: 'ahmed@example.com',
    avatar: 'https://i.pravatar.cc/150?u=ahmed',
    role: 'seeker',
    isPro: true,
    bio: 'مهندس برمجيات شغوف بحل المشكلات التقنية وبناء تطبيقات قابلة للتوسع.',
    industry: 'تكنولوجيا المعلومات',
    skills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL'],
    location: 'بغداد'
  } as any,
  {
    id: 'demo-u2',
    name: 'سارة محمود',
    email: 'sara@example.com',
    avatar: 'https://i.pravatar.cc/150?u=sara',
    role: 'seeker',
    isPro: false,
    bio: 'مصممة واجهات أركز على تحسين تجربة المستخدم وجعلها أكثر سلاسة.',
    industry: 'التصميم الرقمي',
    skills: ['Figma', 'Adobe XD', 'UI Design', 'User Research'],
    location: 'أربيل'
  } as any
];
