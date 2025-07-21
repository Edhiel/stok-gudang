import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

// Konfigurasi Firebase dari Anda
const firebaseConfig = {
  apiKey: "AIzaSyBucag6re9uHGX2xbKkCHDYp8EcpIo1A0A",
  authDomain: "managementstokgudang.firebaseapp.com",
  databaseURL: "https://managementstokgudang-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "managementstokgudang",
  storageBucket: "managementstokgudang.firebasestorage.app",
  messagingSenderId: "619194018490",
  appId: "1:619194018490:web:43f0480613276521c57083"
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);

// Ekspor service yang akan kita gunakan di komponen lain
export const db = getDatabase(app);
export const auth = getAuth(app);