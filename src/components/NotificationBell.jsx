import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { firestoreDb } from '../firebaseConfig';

function NotificationBell({ userProfile, setPage }) {
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    // Pastikan user adalah admin yang punya depotId
    if (!userProfile?.depotId || !['Admin Depo', 'Kepala Depo', 'Kepala Gudang', 'Super Admin'].includes(userProfile.role)) {
      return;
    }

    const ordersRef = collection(firestoreDb, `depots/${userProfile.depotId}/salesOrders`);
    const q = query(ordersRef, where('status', '==', 'Menunggu Approval Admin'));

    // onSnapshot akan berjalan setiap kali ada perubahan pada data yang sesuai query
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotificationCount(snapshot.size); // snapshot.size adalah jumlah dokumen yang cocok
    }, (error) => {
      console.error("Gagal mendengarkan notifikasi order:", error);
    });

    // Cleanup listener saat komponen tidak lagi digunakan
    return () => unsubscribe();
  }, [userProfile]);

  // Jangan tampilkan apapun jika tidak ada notifikasi
  if (notificationCount === 0) {
    return null;
  }

  return (
    <button className="btn btn-ghost btn-circle" onClick={() => setPage('proses-order')}>
      <div className="indicator">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
        <span className="badge badge-xs badge-secondary indicator-item">{notificationCount}</span>
      </div>
    </button>
  );
}

export default NotificationBell;
