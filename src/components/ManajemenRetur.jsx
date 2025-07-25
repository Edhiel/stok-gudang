import React, { useState, useEffect } from 'react';
import { ref, onValue, get, update, push, serverTimestamp, runTransaction, query, orderByChild } from 'firebase/database';
import { db as firebaseDb } from '../firebaseConfig';
import { db as offlineDb, addReturnToQueue, getQueuedReturns, removeReturnFromQueue } from '../offlineDb';
import CameraBarcodeScanner from './CameraBarcodeScanner';
import toast from 'react-hot-toast';

const TabReturBaik = ({ userProfile, syncOfflineReturns, setView }) => {
  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [dosQty, setDosQty] = useState(0);
  const [packQty, setPackQty] = useState(0);
  const [pcsQty, setPcsQty] = useState(0);
  const [storeName, setStoreName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [transactionItems, setTransactionItems] = useState([]);
  const [showScanner, setShowScanner] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // ... (logika useEffect tidak berubah) ...
  }, [userProfile.depotId]);

  const handleBarcodeDetected = (scannedBarcode) => { /* ... (tidak berubah) ... */ };
  const handleSelectItem = (item) => { /* ... (tidak berubah) ... */ };
  const handleAddItemToList = () => { /* ... (tidak berubah) ... */ };
  const handleRemoveFromList = (indexToRemove) => { /* ... (tidak berubah) ... */ };

  const handleSaveTransaction = async () => {
    if (transactionItems.length === 0 || !storeName) { 
      return toast.error("Nama Toko dan minimal 1 barang wajib diisi.");
    }
    setIsSubmitting(true);
    
    const returnData = {
        type: 'Retur Baik', fromStore: storeName, invoiceNumber, items: transactionItems,
        depotId: userProfile.depotId, user: userProfile.fullName
    };

    if(navigator.onLine) {
        await syncOfflineReturns([returnData], true);
        setTransactionItems([]); setStoreName(''); setInvoiceNumber('');
    } else {
        const success = await addReturnToQueue(returnData);
        if (success) {
            toast.success("Koneksi offline. Retur disimpan lokal.");
            setTransactionItems([]); setStoreName(''); setInvoiceNumber('');
            if (setView) setView('riwayat'); // Opsional: pindah ke riwayat setelah simpan
        } else {
            toast.error("Gagal menyimpan retur di penyimpanan lokal.");
        }
    }
    setIsSubmitting(false);
  };

  return (
    <div className="p-4 space-y-4">
        {/* ... (Seluruh JSX untuk form input Retur Baik tetap sama) ... */}
        <div className="mt-6 flex justify-end">
            <button onClick={handleSaveTransaction} disabled={isSubmitting} className="btn btn-success btn-lg">
                {isSubmitting ? <span className="loading loading-spinner"></span> : 'Simpan Retur Baik'}
            </button>
        </div>
    </div>
  );
};

const TabReturRusak = ({ userProfile, syncOfflineReturns, setView }) => {
  const [items, setItems] = useState([]);
  // ... (semua state lainnya di TabReturRusak tidak berubah) ...
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => { /* ... (tidak berubah) ... */ }, [userProfile.depotId]);
  const handleBarcodeDetected = (scannedBarcode) => { /* ... (tidak berubah) ... */ };
  const handleSelectItem = async (item) => { /* ... (tidak berubah) ... */ };
  const handleAddItemToList = () => { /* ... (tidak berubah) ... */ };
  const handleRemoveFromList = (indexToRemove) => { /* ... (tidak berubah) ... */ };
  
  const handleSaveTransaction = async () => {
    if (transactionItems.length === 0) { return toast.error("Minimal 1 barang wajib diisi."); }
    if (returnOrigin === 'toko' && !storeName) { return toast.error("Nama Toko wajib diisi."); }
    setIsSubmitting(true);

    const returnData = {
        type: 'Retur Rusak', origin: returnOrigin, fromStore: storeName, 
        invoiceNumber, description, items: transactionItems,
        depotId: userProfile.depotId, user: userProfile.fullName
    };

    if (navigator.onLine) {
        await syncOfflineReturns([returnData], true);
        setTransactionItems([]); setDescription(''); setReturnOrigin('toko'); setStoreName(''); setInvoiceNumber('');
    } else {
        const success = await addReturnToQueue(returnData);
        if (success) {
            toast.success("Koneksi offline. Retur disimpan lokal.");
            setTransactionItems([]); setDescription(''); setReturnOrigin('toko'); setStoreName(''); setInvoiceNumber('');
        } else {
            toast.error("Gagal menyimpan retur di penyimpanan lokal.");
        }
    }
    setIsSubmitting(false);
  };

  return (
    <div className="p-4 space-y-4">
        {/* ... (Seluruh JSX untuk form input Retur Rusak tetap sama) ... */}
        <div className="mt-6 flex justify-end">
            <button onClick={handleSaveTransaction} disabled={isSubmitting} className="btn btn-warning btn-lg">
                {isSubmitting ? <span className="loading loading-spinner"></span> : 'Simpan Retur Rusak'}
            </button>
        </div>
    </div>
  );
};

const TabKirimPusat = ({ userProfile }) => {
  // ... (Komponen ini tidak diubah, karena aksi final butuh koneksi online) ...
};

const TabRiwayat = ({ userProfile }) => {
  // ... (Komponen ini tidak diubah) ...
};

function ManajemenRetur({ userProfile }) {
  const [activeTab, setActiveTab] = useState('returBaik');
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const syncOfflineReturns = async (returnsToSync, isOnlineSave = false) => {
    if (isSyncing && !isOnlineSave) return;
    setIsSyncing(true);
    let successCount = 0;

    for (const returnData of returnsToSync) {
        try {
            // Logika disesuaikan berdasarkan tipe retur
            if (returnData.type === 'Retur Baik') {
                for (const transItem of returnData.items) {
                    const stockRef = ref(firebaseDb, `depots/${returnData.depotId}/stock/${transItem.id}`);
                    await runTransaction(stockRef, (currentStock) => {
                        if(!currentStock) return { totalStockInPcs: transItem.quantityInPcs, damagedStockInPcs: 0 };
                        currentStock.totalStockInPcs = (currentStock.totalStockInPcs || 0) + transItem.quantityInPcs;
                        return currentStock;
                    });
                }
            } else if (returnData.type === 'Retur Rusak') {
                 for (const transItem of returnData.items) {
                    const stockRef = ref(firebaseDb, `depots/${returnData.depotId}/stock/${transItem.id}`);
                    await runTransaction(stockRef, (currentStock) => {
                        if (!currentStock) { currentStock = { totalStockInPcs: 0, damagedStockInPcs: 0 }; }
                        currentStock.damagedStockInPcs = (currentStock.damagedStockInPcs || 0) + transItem.quantityInPcs;
                        if (returnData.origin === 'gudang') {
                            if ((currentStock.totalStockInPcs || 0) < transItem.quantityInPcs) { throw new Error(`Stok ${transItem.name} tidak cukup.`); }
                            currentStock.totalStockInPcs -= transItem.quantityInPcs;
                        }
                        return currentStock;
                    });
                }
            }

            // Simpan log transaksi ke Firebase
            const transactionsRef = ref(firebaseDb, `depots/${returnData.depotId}/transactions`);
            await push(transactionsRef, { ...returnData, timestamp: serverTimestamp() });
            
            if (returnData.localId) {
                await removeReturnFromQueue(returnData.localId);
            }
            successCount++;
        } catch (err) {
            toast.error(`Gagal sinkronisasi retur: ${err.message}`);
            break;
        }
    }

    if (successCount > 0) toast.success(`${successCount} data retur berhasil disinkronkan.`);
    checkPendingReturns();
    setIsSyncing(false);
  };

  const checkPendingReturns = async () => {
    const pending = await getQueuedReturns();
    setPendingSyncCount(pending.length);
    if (pending.length > 0 && navigator.onLine) {
        toast.loading(`Menyinkronkan ${pending.length} data retur...`, { id: 'sync-toast-return' });
        await syncOfflineReturns(pending);
        toast.dismiss('sync-toast-return');
    }
  };

  useEffect(() => {
    checkPendingReturns();
    window.addEventListener('online', checkPendingReturns);
    return () => window.removeEventListener('online', checkPendingReturns);
  }, []);
  
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6 print:hidden">Manajemen Retur</h1>
      {pendingSyncCount > 0 && 
        <div role="alert" className="alert alert-info mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <span>Ada {pendingSyncCount} data retur yang menunggu untuk disinkronkan ke server.</span>
        </div>
      }
      <div role="tablist" className="tabs tabs-lifted print:hidden">
        <a role="tab" className={`tab ${activeTab === 'returBaik' ? 'tab-active' : ''}`} onClick={() => setActiveTab('returBaik')}>Retur Baik</a>
        <a role="tab" className={`tab ${activeTab === 'returRusak' ? 'tab-active' : ''}`} onClick={() => setActiveTab('returRusak')}>Retur Rusak</a>
        <a role="tab" className={`tab ${activeTab === 'kirimPusat' ? 'tab-active' : ''}`} onClick={() => setActiveTab('kirimPusat')}>Rekap & Pengiriman</a>
        <a role="tab" className={`tab ${activeTab === 'riwayat' ? 'tab-active' : ''}`} onClick={() => setActiveTab('riwayat')}>Riwayat Retur</a>
      </div>
      <div className="bg-white p-6 rounded-b-lg rounded-tr-lg shadow-lg min-h-96">
        {activeTab === 'returBaik' && <TabReturBaik userProfile={userProfile} syncOfflineReturns={syncOfflineReturns} setView={setActiveTab}/>}
        {activeTab === 'returRusak' && <TabReturRusak userProfile={userProfile} syncOfflineReturns={syncOfflineReturns} setView={setActiveTab}/>}
        {activeTab === 'kirimPusat' && <TabKirimPusat userProfile={userProfile} />}
        {activeTab === 'riwayat' && <TabRiwayat userProfile={userProfile} />}
      </div>
    </div>
  );
}

export default ManajemenRetur;
