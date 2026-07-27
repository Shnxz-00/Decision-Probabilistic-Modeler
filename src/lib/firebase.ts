import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  GithubAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  initializeFirestore,
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAUbu5x9dS3BuZRDRNLtW6sKo_riLJbnfs",
  authDomain: "gen-lang-client-0559716445.firebaseapp.com",
  projectId: "gen-lang-client-0559716445",
  storageBucket: "gen-lang-client-0559716445.firebasestorage.app",
  messagingSenderId: "964908792154",
  appId: "1:964908792154:web:e3a8de25954cf060219b63"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore with the custom databaseId provided by the platform
const db = initializeFirestore(app, {}, "ai-studio-03d4b561-5193-41e5-92a4-20585525c371");

// Initialize Authentication
const auth = getAuth(app);

// Authentication Providers
const googleProvider = new GoogleAuthProvider();
const githubProvider = new GithubAuthProvider();

export {
  app,
  db,
  auth,
  googleProvider,
  githubProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot
};
export type { FirebaseUser };
