import Dexie from 'dexie';

export const db = new Dexie('StokGudangDB');

// Versi dinaikkan menjadi 3 untuk menambahkan tabel retur
db.version(3).stores({
  pendingOrders: '++localId, orderNumber, depotId',
  pendingReceipts: '++localId, suratJalan, depotId',
  pendingReturns: '++localId, fromStore, depotId' // <-- TABEL BARU
});

// Versi sebelumnya tetap ada untuk transisi
db.version(2).stores({
  pendingOrders: '++localId, orderNumber, depotId',
  pendingReceipts: '++localId, suratJalan, depotId'
});
db.version(1).stores({
  pendingOrders: '++localId, orderNumber, depotId',
});


// --- FUNGSI UNTUK ORDER & PENERIMAAN (TIDAK BERUBAH) ---
export const addOrderToQueue = async (orderData) => { /* ... */ };
export const getQueuedOrders = async () => { /* ... */ };
export const removeOrderFromQueue = async (localId) => { /* ... */ };
export const addReceiptToQueue = async (receiptData) => { /* ... */ };
export const getQueuedReceipts = async () => { /* ... */ };
export const removeReceiptFromQueue = async (localId) => { /* ... */ };


// --- FUNGSI BARU UNTUK MANAJEMEN RETUR ---
export const addReturnToQueue = async (returnData) => {
  try {
    await db.pendingReturns.add(returnData);
    console.log("Data retur disimpan ke antrean offline.");
    return true;
  } catch (error) {
    console.error("Gagal menyimpan retur offline:", error);
    return false;
  }
};
export const getQueuedReturns = async () => {
  return await db.pendingReturns.toArray();
};
export const removeReturnFromQueue = async (localId) => {
  await db.pendingReturns.delete(localId);
  console.log(`Retur ${localId} dihapus dari antrean.`);
};
