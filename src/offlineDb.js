import Dexie from 'dexie';

export const db = new Dexie('StokGudangDB');

// Definisikan struktur tabel untuk database lokal
db.version(1).stores({
  pendingOrders: '++localId, orderNumber, depotId', // '++' artinya auto-increment
});

// Fungsi untuk menambahkan order ke antrean offline
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

// Fungsi untuk mengambil semua order dari antrean offline
export const getQueuedOrders = async () => {
  return await db.pendingOrders.toArray();
};

// Fungsi untuk menghapus order dari antrean setelah berhasil sinkronisasi
export const removeOrderFromQueue = async (localId) => {
  await db.pendingOrders.delete(localId);
  console.log(`Order ${localId} dihapus dari antrean.`);
};
