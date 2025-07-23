import React, { useState, useEffect, useRef } from 'react';
import { ref, onValue, get, push, serverTimestamp, runTransaction, update, query, orderByChild, equalTo } from 'firebase/database';
import { db } from '../firebaseConfig';
import CameraBarcodeScanner from './CameraBarcodeScanner';
import toast from 'react-hot-toast';

const formatToDPP = (totalPcs, conversions) => {
  if (!totalPcs || !conversions) return '0.0.0';
  const dosInPcs = conversions.Dos?.inPcs || (conversions.Pack?.inPcs || 1);
  const packInPcs = conversions.Pack?.inPcs || 1;
  return `${Math.floor(totalPcs / dosInPcs)}.${Math.floor((totalPcs % dosInPcs) / packInPcs)}.${totalPcs % packInPcs}`;
};

// --- KOMPONEN BARU UNTUK TAB 1: BUAT TRANSFER ---
const BuatTransferTab = ({ userProfile }) => {
  const [loading, setLoading] = useState(true);
  const [allDepots, setAllDepots] = useState([]);
  const [availableItems, setAvailableItems] = useState([]);
  const [suratJalan, setSuratJalan] = useState('');
  const [destinationDepot, setDestinationDepot] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemStock, setItemStock] = useState(0);
  const [dosQty, setDosQty] = useState(0);
  const [packQty, setPackQty] = useState(0);
  const [pcsQty, setPcsQty] = useState(0);
  const [transferItems, setTransferItems] = useState([]);
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    if (!userProfile || !userProfile.depotId) return;
    const depotsRef = ref(db, 'depots');
    onValue(depotsRef, (snapshot) => {
      const data = snapshot.val() || {};
      const depotList = Object.keys(data)
        .filter(key => key !== userProfile.depotId)
        .map(key => ({ id: key, name: data[key].info.name }));
      setAllDepots(depotList);
    });
    const masterItemsRef = ref(db, 'master_items');
    get(masterItemsRef).then((masterSnapshot) => {
      const masterItems = masterSnapshot.val() || {};
      const stockRef = ref(db, `depots/${userProfile.depotId}/stock`);
      onValue(stockRef, (stockSnapshot) => {
        const stockData = stockSnapshot.val() || {};
        const available = Object.keys(stockData)
          .filter(itemId => (stockData[itemId].totalStockInPcs || 0) > 0)
          .map(itemId => ({ id: itemId, ...masterItems[itemId], totalStockInPcs: stockData[itemId].totalStockInPcs }));
        setAvailableItems(available);
        setLoading(false);
      });
    });
  }, [userProfile]);

  const handleBarcodeDetected = (scannedBarcode) => {
    const foundItem = availableItems.find(item => item.barcodePcs === scannedBarcode || item.barcodeDos === scannedBarcode);
    if (foundItem) handleSelectItem(foundItem); else toast.error("Barang tidak ditemukan atau stok kosong.");
    setShowScanner(false);
  };

  const handleSelectItem = (item) => {
    setSelectedItem(item);
    setSearchTerm(item.name);
    setItemStock(item.totalStockInPcs);
  };

  const handleAddItemToList = () => {
    if (!selectedItem) { toast.error("Pilih barang dulu."); return; }
    const totalPcs = (Number(dosQty) * (selectedItem.conversions.Dos?.inPcs || 1)) + (Number(packQty) * (selectedItem.conversions.Pack?.inPcs || 1)) + (Number(pcsQty));
    if (totalPcs <= 0) { toast.error("Masukkan jumlah yang valid."); return; }
    if (totalPcs > itemStock) {
      toast.error(`Stok tidak cukup! Sisa stok hanya ${itemStock} Pcs.`);
      return;
    }
    setTransferItems([...transferItems, { id: selectedItem.id, name: selectedItem.name, quantityInPcs: totalPcs, displayQty: `${dosQty}.${packQty}.${pcsQty}` }]);
    setSelectedItem(null); setSearchTerm(''); setDosQty(0); setPackQty(0); setPcsQty(0);
  };

  const handleRemoveFromList = (indexToRemove) => {
    setTransferItems(transferItems.filter((_, index) => index !== indexToRemove));
  };
  
  const handleSaveDraft = async () => {
    if (!suratJalan || !destinationDepot || transferItems.length === 0) {
      toast.error("No. Surat Jalan, Depo Tujuan, dan minimal 1 barang wajib diisi.");
      return;
    }
    try {
      for (const item of transferItems) {
        const stockRef = ref(db, `depots/${userProfile.depotId}/stock/${item.id}`);
        await runTransaction(stockRef, (currentStock) => {
          if (currentStock) {
            if ((currentStock.totalStockInPcs || 0) < item.quantityInPcs) {
              throw new Error(`Stok untuk ${item.name} tidak cukup.`);
            }
            currentStock.totalStockInPcs -= item.quantityInPcs;
            currentStock.inTransitStock = (currentStock.inTransitStock || 0) + item.quantityInPcs;
          }
          return currentStock;
        });
      }
      const transfersRef = ref(db, 'stock_transfers');
      await push(transfersRef, {
        suratJalan,
        fromDepotId: userProfile.depotId,
        fromDepotName: userProfile.depotId,
        toDepotId: destinationDepot,
        toDepotName: allDepots.find(d => d.id === destinationDepot)?.name || destinationDepot,
        items: transferItems,
        status: 'Dikirim',
        createdBy: userProfile.fullName,
        createdAt: serverTimestamp()
      });
      toast.success("Surat jalan transfer berhasil dibuat dan stok telah dialokasikan.");
      setSuratJalan(''); setDestinationDepot(''); setTransferItems([]);
    } catch (err) {
      toast.error(`Gagal membuat transfer: ${err.message}`);
      console.error(err);
    }
  };

  const handlePrint = () => {
    if (transferItems.length === 0) {
      toast.error("Tidak ada barang dalam daftar untuk dicetak.");
      return;
    }
    window.print();
  };

  const filteredItems = searchTerm.length > 0 
    ? availableItems.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : [];

  return (
    <>
      {showScanner && <CameraBarcodeScanner onScan={handleBarcodeDetected} onClose={() => setShowScanner(false)} />}
      <div className="printable-area-transfer">
        <div className="hidden print:block p-4">
            {/* ... Tampilan Cetak ... */}
        </div>
        <div className="p-4 print:hidden">
            <div className="flex justify-end mb-4">
                <button className="btn btn-info" onClick={handlePrint} disabled={transferItems.length === 0}>Cetak Surat Jalan</button>
            </div>
            {/* ... Sisa Form ... */}
        </div>
      </div>
    </>
  );
};
// --- KOMPONEN BARU UNTUK TAB 2: PENGIRIMAN KELUAR ---
const PengirimanKeluarTab = ({ userProfile }) => {
    const [outgoingTransfers, setOutgoingTransfers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const transfersRef = query(ref(db, 'stock_transfers'), orderByChild('fromDepotId'), equalTo(userProfile.depotId));
        onValue(transfersRef, (snapshot) => {
            const data = snapshot.val() || {};
            const transferList = Object.keys(data).map(key => ({ id: key, ...data[key] }));
            setOutgoingTransfers(transferList.sort((a,b) => b.createdAt - a.createdAt));
            setLoading(false);
        });
    }, [userProfile.depotId]);

    return (
        <div className="p-4">
            <h3 className="text-xl font-semibold mb-4">Daftar Pengiriman Keluar</h3>
            <div className="overflow-x-auto">
                <table className="table table-zebra w-full">
                    <thead className="bg-gray-200">
                        <tr><th>Tanggal</th><th>No. Surat Jalan</th><th>Tujuan</th><th>Status</th><th>Detail</th></tr>
                    </thead>
                    <tbody>
                        {loading ? <tr><td colSpan="5" className="text-center"><span className="loading loading-dots"></span></td></tr>
                        : outgoingTransfers.map(t => (
                            <tr key={t.id}>
                                <td>{new Date(t.createdAt).toLocaleDateString('id-ID')}</td>
                                <td>{t.suratJalan}</td>
                                <td>{t.toDepotName}</td>
                                <td><span className={`badge ${t.status === 'Diterima' ? 'badge-success' : 'badge-warning'}`}>{t.status}</span></td>
                                <td><button className="btn btn-xs btn-info">Lihat</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- KOMPONEN BARU UNTUK TAB 3: PENERIMAAN MASUK ---
const PenerimaanMasukTab = ({ userProfile }) => {
    const [incomingTransfers, setIncomingTransfers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const transfersRef = query(ref(db, 'stock_transfers'), orderByChild('toDepotId'), equalTo(userProfile.depotId));
        onValue(transfersRef, (snapshot) => {
            const data = snapshot.val() || {};
            const transferList = Object.keys(data).map(key => ({ id: key, ...data[key] }));
            setIncomingTransfers(transferList.sort((a,b) => b.createdAt - a.createdAt));
            setLoading(false);
        });
    }, [userProfile.depotId]);

    const handleConfirmReceipt = async (transfer) => {
        if (!window.confirm(`Konfirmasi penerimaan barang dari ${transfer.fromDepotName} dengan No. SJ ${transfer.suratJalan}? Stok akan diperbarui.`)) return;

        try {
            const updates = {};
            // 1. Update status transfer
            updates[`/stock_transfers/${transfer.id}/status`] = 'Diterima';
            updates[`/stock_transfers/${transfer.id}/receivedAt`] = serverTimestamp();
            updates[`/stock_transfers/${transfer.id}/receivedBy`] = userProfile.fullName;

            // 2. Tambahkan stok di depo penerima
            for (const item of transfer.items) {
                const stockRef = ref(db, `depots/${userProfile.depotId}/stock/${item.id}`);
                await runTransaction(stockRef, (currentStock) => {
                    if (!currentStock) return { totalStockInPcs: item.quantityInPcs, damagedStockInPcs: 0, inTransitStock: 0 };
                    currentStock.totalStockInPcs = (currentStock.totalStockInPcs || 0) + item.quantityInPcs;
                    return currentStock;
                });
            }
            
            // 3. Kurangi stok 'inTransit' di depo pengirim
            for (const item of transfer.items) {
                 const stockRef = ref(db, `depots/${transfer.fromDepotId}/stock/${item.id}`);
                 await runTransaction(stockRef, (currentStock) => {
                    if (currentStock) {
                        currentStock.inTransitStock = (currentStock.inTransitStock || 0) - item.quantityInPcs;
                    }
                    return currentStock;
                });
            }

            // 4. Jalankan semua update
            await update(ref(db), updates);
            toast.success("Penerimaan barang berhasil dikonfirmasi.");

        } catch (err) {
            toast.error("Gagal mengonfirmasi penerimaan.");
            console.error(err);
        }
    };

    return (
        <div className="p-4">
            <h3 className="text-xl font-semibold mb-4">Daftar Penerimaan Masuk</h3>
            <div className="overflow-x-auto">
                <table className="table table-zebra w-full">
                    <thead className="bg-gray-200">
                        <tr><th>Tanggal Kirim</th><th>No. Surat Jalan</th><th>Dari Depo</th><th>Status</th><th>Aksi</th></tr>
                    </thead>
                    <tbody>
                        {loading ? <tr><td colSpan="5" className="text-center"><span className="loading loading-dots"></span></td></tr>
                        : incomingTransfers.map(t => (
                            <tr key={t.id}>
                                <td>{new Date(t.createdAt).toLocaleDateString('id-ID')}</td>
                                <td>{t.suratJalan}</td>
                                <td>{t.fromDepotName}</td>
                                <td><span className={`badge ${t.status === 'Diterima' ? 'badge-success' : 'badge-warning'}`}>{t.status}</span></td>
                                <td>
                                    {t.status === 'Dikirim' && (
                                        <button onClick={() => handleConfirmReceipt(t)} className="btn btn-xs btn-success">Konfirmasi Terima</button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
// --- KOMPONEN UTAMA (YANG MENGATUR TAB) ---
function TransferStok({ userProfile }) {
  const [activeTab, setActiveTab] = useState('buat');

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Transfer Stok Antar Depo</h1>
      
      <div role="tablist" className="tabs tabs-lifted">
        <a role="tab" className={`tab ${activeTab === 'buat' ? 'tab-active' : ''}`} onClick={() => setActiveTab('buat')}>
          Buat Transfer Baru
        </a>
        <a role="tab" className={`tab ${activeTab === 'keluar' ? 'tab-active' : ''}`} onClick={() => setActiveTab('keluar')}>
          Pengiriman Keluar
        </a>
        <a role="tab" className={`tab ${activeTab === 'masuk' ? 'tab-active' : ''}`} onClick={() => setActiveTab('masuk')}>
          Penerimaan Masuk
        </a>
      </div>

      <div className="bg-white p-6 rounded-b-lg rounded-tr-lg shadow-lg min-h-96">
        {activeTab === 'buat' && <BuatTransferTab userProfile={userProfile} />}
        {activeTab === 'keluar' && <PengirimanKeluarTab userProfile={userProfile} />}
        {activeTab === 'masuk' && <PenerimaanMasukTab userProfile={userProfile} />}
      </div>
    </div>
  );
}

export default TransferStok;