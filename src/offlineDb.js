import Dexie from 'dexie';

export const db = new Dexie('StokGudangDB');

// Definisikan struktur tabel untuk database lokal
// Versi dinaikkan menjadi 2 untuk menambahkan tabel baru
db.version(2).stores({
  pendingOrders: '++localId, orderNumber, depotId',
  pendingReceipts: '++localId, suratJalan, depotId' // <-- TABEL BARU
});

// Pastikan versi 1 tetap ada untuk transisi
db.version(1).stores({
  pendingOrders: '++localId, orderNumber, depotId',
});


// --- FUNGSI UNTUK ORDER (TIDAK BERUBAH) ---
export const addOrderToQueue = async (orderData) => {
  try {
    await db.pendingOrders.add(orderData);
    console.log("Order disimpan ke antrean offline.");
    return true;
  } catch (error) {
    console.error("Gagal menyimpan order offline:", error);
    return false;
  }
};
export const getQueuedOrders = async () => {
  return await db.pendingOrders.toArray();
};
export const removeOrderFromQueue = async (localId) => {
  await db.pendingOrders.delete(localId);
  console.log(`Order ${localId} dihapus dari antrean.`);
};


// --- FUNGSI BARU UNTUK PENERIMAAN BARANG ---
export const addReceiptToQueue = async (receiptData) => {
  try {
    await db.pendingReceipts.add(receiptData);
    console.log("Penerimaan barang disimpan ke antrean offline.");
    return true;
  } catch (error) {
    console.error("Gagal menyimpan penerimaan barang offline:", error);
    return false;
  }
};
export const getQueuedReceipts = async () => {
  return await db.pendingReceipts.toArray();
};
export const removeReceiptFromQueue = async (localId) => {
  await db.pendingReceipts.delete(localId);
  console.log(`Penerimaan barang ${localId} dihapus dari antrean.`);
};
