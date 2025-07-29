import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBucag6re9uHGX2xbKkCHDYp8EcpIo1A0A",
  authDomain: "managementstokgudang.firebaseapp.com",
  projectId: "manajemenstokgudang",
  storageBucket: "managementstokgudang.firebasestorage.app",
  messagingSenderId: "619194018490",
  appId: "1:619194018490:web:43f0480613276521c57083"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const firestoreDb = getFirestore(app);
export default app;
