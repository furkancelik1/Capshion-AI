import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeAuth,
  // @ts-ignore
  getReactNativePersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
  signOut as fbSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBSPr7j5UprTi3Cl0D7VjzkfILpPWyVnmM',
  authDomain: 'tracking-app-492512.firebaseapp.com',
  projectId: 'tracking-app-492512',
  storageBucket: 'tracking-app-492512.firebasestorage.app',
  messagingSenderId: '155828266486',
  appId: '1:155828266486:android:9671ef124f66021eb253d7',
};

// 1. Firebase App Singleton
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// 2. Firebase Auth with React Native AsyncStorage persistence
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

// 3. Cloud Firestore
export const db = getFirestore(app);

// 4. Firestore Profile Interface
export interface UserProfile {
  id: string;
  email: string;
  age_range?: string | null;
  credits: number;
  is_premium: boolean;
  created_at?: any;
  updated_at?: any;
}

/**
 * Creates or fetches user profile from Firestore upon registration/login
 */
export async function syncUserProfile(user: FirebaseUser, extraData?: { ageRange?: string | null }): Promise<UserProfile> {
  const profileRef = doc(db, 'profiles', user.uid);
  const snap = await getDoc(profileRef);

  if (!snap.exists()) {
    const newProfile: UserProfile = {
      id: user.uid,
      email: user.email || '',
      age_range: extraData?.ageRange || null,
      credits: 5,
      is_premium: false,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    };
    await setDoc(profileRef, newProfile);
    return newProfile;
  }

  const existingData = snap.data() as UserProfile;
  return {
    ...existingData,
    id: user.uid,
    email: user.email || existingData.email,
  };
}

/**
 * Sign up with Email and Password
 */
export async function firebaseSignUpWithEmail(email: string, password: string, ageRange?: string | null) {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const profile = await syncUserProfile(cred.user, { ageRange });
  return { user: cred.user, profile };
}

/**
 * Sign in with Email and Password
 */
export async function firebaseSignInWithEmail(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  const profile = await syncUserProfile(cred.user);
  return { user: cred.user, profile };
}

/**
 * Sign in with Google ID Token
 */
export async function firebaseSignInWithGoogle(idToken: string) {
  const credential = GoogleAuthProvider.credential(idToken);
  const cred = await signInWithCredential(auth, credential);
  const profile = await syncUserProfile(cred.user);
  return { user: cred.user, profile };
}

/**
 * Sign out
 */
export async function firebaseSignOut() {
  await fbSignOut(auth);
}
