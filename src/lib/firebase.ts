import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// ✅ [SECURITY FIX CRIT-1] Firebase config loaded from environment variables only.
// Never import firebase-applet-config.json directly — it contains API keys.
// Ensure firebase-applet-config.json is listed in .gitignore.
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            as string,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        as string,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         as string,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             as string,
};

// Validate critical Firebase config at startup
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.warn(
    '⚠️ Firebase config is missing. Set VITE_FIREBASE_* environment variables.\n' +
    'Copy .env.example to .env and fill in your Firebase credentials.'
  );
}

// تهيئة التطبيق
const app = initializeApp(firebaseConfig);

// التصديرات الأساسية
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// دالة تسجيل الدخول عبر جوجل
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google:", error);
    throw error;
  }
};

// ✅ [SECURITY FIX HIGH-4] Mock login restricted to DEV environment only.
// In production this throws immediately to prevent accidental auth bypass.
export const signInWithMock = async () => {
  if (!import.meta.env.DEV) {
    throw new Error('[Security] Mock authentication is disabled in production. Use a real auth provider.');
  }
  return {
    uid: 'mock-user-123',
    displayName: 'المستخدم التجريبي',
    email: 'test@prolink.com',
    photoURL: 'https://ui-avatars.com/api/?name=Mock+User&background=random'
  } as any;
};

// جلب بيانات المستخدم
export const getUserData = async (uid: string) => {
  // إذا كان المستخدم وهمياً، جلب البيانات من الذاكرة المحلية (DEV only)
  if (uid === 'mock-user-123' && import.meta.env.DEV) {
    const localData = localStorage.getItem('mock_user_data');
    return localData ? JSON.parse(localData) : {
      uid: 'mock-user-123',
      name: 'المستخدم التجريبي',
      email: 'test@prolink.com',
      avatar: 'https://ui-avatars.com/api/?name=Mock+User&background=random',
      role: 'seeker',
      isPro: true,
      bio: 'أنا مستخدم تجريبي استكشف التطبيق حالياً.',
      skills: ['React', 'Firebase', 'Design']
    };
  }

  try {
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
  } catch (error) {
    console.error("Error fetching user data:", error);
    return null;
  }
};

// حفظ دور المستخدم وبياناته الأساسية
export const saveUserRole = async (uid: string, role: 'seeker' | 'employer', name: string, email: string, avatar: string) => {
  if (uid === 'mock-user-123' && import.meta.env.DEV) {
    const data = {
      uid, name, email, avatar, role,
      isPro: true,
      bio: 'أنا مستخدم تجريبي استكشف التطبيق حالياً.',
      experience: '',
      skills: ['React', 'Firebase', 'Design'],
      createdAt: new Date().toISOString()
    };
    localStorage.setItem('mock_user_data', JSON.stringify(data));
    return;
  }

  try {
    await setDoc(doc(db, 'users', uid), {
      uid,
      name,
      email,
      avatar,
      role,
      isPro: false,
      bio: '',
      experience: '',
      skills: [],
      createdAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error("Error saving user role:", error);
    throw error;
  }
};


