import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase, ref, set, push, onValue, remove, update, get, child } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyDMF9yIEIY_CWoLZN4vaug4vY4AQsHGzRo",
  authDomain: "gaqy-8e970.firebaseapp.com",
  databaseURL: "https://gaqy-8e970-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "gaqy-8e970",
  storageBucket: "gaqy-8e970.firebasestorage.app",
  messagingSenderId: "837523908397",
  appId: "1:837523908397:web:f3507aedd5bf49145f55a4"
};

// Initialize Firebase
let app;
let auth;
let db;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getDatabase(app);
} catch (e) {
  console.error("Firebase initialization failed:", e);
}

export { auth, db, ref, set, push, onValue, remove, update, get, child };

// Helper to convert file to Base64
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};