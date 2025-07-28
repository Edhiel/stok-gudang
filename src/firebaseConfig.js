import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBucag6re9uHGX2xbKkCHDYp8EcpIo1A0A",
  authDomain: "managementstokgudang.firebaseapp.com",
  databaseURL: "https://managementstokgudang-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "manajemenstokgudang",
  storageBucket: "managementstokgudang.firebasestorage.app",
  messagingSenderId: "619194018490",
  appId: "1:619194018490:web:43f0480613276521c57083"
};

// Inisialisasi aplikasi Firebase
const app = initializeApp(firebaseConfig);

// Ekspor untuk layanan Autentikasi
export const auth = getAuth(app);

// Ekspor untuk layanan Firestore Database
export const firestoreDb = getFirestore(app);

// Ekspor untuk layanan Realtime Database
export const rtdb = getDatabase(app);

export default app;
