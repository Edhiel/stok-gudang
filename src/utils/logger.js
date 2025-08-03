import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { firestoreDb } from '../firebaseConfig';

/**
 * Mencatat aktivitas pengguna ke dalam koleksi 'activity_logs' di Firestore.
 * @param {string} action - Tipe aksi yang dilakukan (e.g., 'CREATE_ORDER', 'UPDATE_USER_ROLE').
 * @param {object} user - Objek userProfile dari pengguna yang melakukan aksi.
 * @param {object} details - Objek yang berisi detail tambahan terkait aksi (e.g., { orderId: 'SO-123', targetUser: 'John Doe' }).
 */
export const logActivity = async (action, user, details) => {
  // Jangan catat jika user tidak ada atau tidak punya role
  if (!user?.role) {
    console.warn("Log activity skipped: User profile is incomplete.");
    return;
  }

  try {
    const logsCollectionRef = collection(firestoreDb, 'activity_logs');
    await addDoc(logsCollectionRef, {
      action: action,
      user: {
        uid: user.uid,
        fullName: user.fullName,
        role: user.role,
        depotId: user.depotId || 'PUSAT'
      },
      details: details, // Menyimpan semua detail relevan
      timestamp: serverTimestamp() // Menggunakan timestamp server untuk akurasi
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
    // Gagal mencatat log tidak boleh menghentikan alur kerja utama,
    // jadi kita hanya menampilkannya di konsol.
  }
};
