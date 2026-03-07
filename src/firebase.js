import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
const firebaseConfig = {
  apiKey: "AIzaSyAEhY652VGkwBg6gfguPvpXXTxc--f7T9s",
  authDomain: "smartlpg-app-cdb4d.firebaseapp.com",
  projectId: "smartlpg-app-cdb4d",
  storageBucket: "smartlpg-app-cdb4d.firebasestorage.app",
  messagingSenderId: "917409609295",
  appId: "1:917409609295:web:a9411cbe6b7b5e9e0d1c3a",
};

const app = initializeApp(firebaseConfig);

// RN usable services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
