import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, GithubAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyCJApDVvk5Z_clBq-eXjcMTg1AosgnQ5j4",
  authDomain: "divu-ai.firebaseapp.com",
  projectId: "divu-ai",
  storageBucket: "divu-ai.firebasestorage.app",
  messagingSenderId: "774322433457",
  appId: "1:774322433457:web:80bf5c87f7d6e332522190",
  measurementId: "G-CER3JC445L"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const googleProvider = new GoogleAuthProvider();
export const githubProvider = new GithubAuthProvider();
