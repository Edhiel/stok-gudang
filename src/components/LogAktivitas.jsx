import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { firestoreDb } from '../firebaseConfig';

function LogAktivitas() {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterUser, setFilterUser] = useState('');
  const [filterAction, setFilterAction] = useState('');

  useEffect(() => {
    const logsRef = collection(firestoreDb, 'activity_logs');
    const q = query(logsRef, orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLogs(logList);
      setFilteredLogs(logList);
      setLoading(false);
    }, (error) => {
      console.error("Gagal memuat log aktivitas:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let newFilteredLogs = [...logs];
    if (filterUser) {
      newFilteredLogs = newFilteredLogs.filter(log =>
        log.user.fullName.toLowerCase().includes(filterUser.toLowerCase())
      );
    }
    if (filterAction) {
      newFilteredLogs = newFilteredLogs.filter(log => log.action === filterAction);
    }
    setFilteredLogs(newFilteredLogs);
  }, [filterUser, filterAction, logs]);
  
  const renderLogDetails = (log) => {
    switch (log.action) {
      case 'UPDATE_USER_ROLE':
        return `Mengubah peran ${log.details.targetUser} dari "${log.details.previousRole}" menjadi "${log.details.newRole}" di depo ${log.details.assignedDepot}.`;
      case 'DELETE_USER':
        return `Menghapus pengguna ${log.details.deletedUser} (${log.details.deletedUserEmail}).`;
      case 'APPROVE_ORDER':
        return `Menyetujui order #${log.details.orderNumber}.`;
      case 'REJECT_ORDER':
        return `Menolak order #${log.details.orderNumber}.`;
      default:
        return <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(log.details, null, 2)}</pre>;
    }
  };

  const actionTypes = [...new Set(logs.map(log => log.action))];

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-6">Log Aktivitas Pengguna</h1>
      <div className="card bg-white shadow-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="form-control">
            <label className="label-text">Filter Berdasarkan Nama Pengguna</label>
            <input
              type="text"
              placeholder="Ketik nama untuk mencari..."
              className="input input-bordered w-full"
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
            />
          </div>
          <div className="form-control">
            <label className="label-text">Filter Berdasarkan Tipe Aksi</label>
            <select
              className="select select-bordered w-full"
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
            >
              <option value="">Semua Aksi</option>
              {actionTypes.map(action => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="table w-full">
          <thead className="bg-gray-200">
            <tr>
              <th>Waktu</th>
              <th>Pengguna</th>
              <th>Jabatan</th>
              <th>Depo</th>
              <th>Aksi</th>
              <th>Detail Aktivitas</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="text-center"><span className="loading loading-dots"></span></td></tr>
            ) : filteredLogs.length === 0 ? (
              <tr><td colSpan="6" className="text-center">Tidak ada log yang cocok dengan filter.</td></tr>
            ) : (
              filteredLogs.map(log => (
                <tr key={log.id} className="hover">
                  <td className="text-xs">{log.timestamp?.toDate().toLocaleString('id-ID')}</td>
                  <td className="font-semibold">{log.user.fullName}</td>
                  <td>{log.user.role}</td>
                  <td>{log.user.depotId}</td>
                  <td><span className="badge badge-info">{log.action}</span></td>
                  <td className="text-sm">{renderLogDetails(log)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default LogAktivitas;
