// TransferStok.jsx
import React, { useState, useEffect } from 'react';
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

function TransferStok({ userProfile }) {
  const [activeTab, setActiveTab] = useState('buat');
  const [loading, setLoading] = useState(true);

  /* ---------- DATA UMUM ---------- */
  const [allDepots, setAllDepots] = useState([]);

  /* ---------- TAB 1 : BUAT TRANSFER ---------- */
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

  /* ---------- TAB 2 & 3 ---------- */
  const [outgoingTransfers, setOutgoingTransfers] = useState([]);
  const [incomingTransfers, setIncomingTransfers] = useState([]);

  useEffect(() => {
    if (!userProfile?.depotId) return;

    /* --- ambil semua depo --- */
    const depotsRef = ref(db, 'depots');
    onValue(depotsRef, (snapshot) => {
      const data = snapshot.val() || {};
      const depotList = Object.keys(data).map(key => ({
        id: key,
        name: data[key].name || data[key].info?.name || key
      }));
      setAllDepots(depotList);
    });

    /* --- ambil barang dengan stok di depo saat ini --- */
    const masterItemsRef = ref(db, 'master_items');
    get(masterItemsRef).then((masterSnapshot) => {
      const masterItems = masterSnapshot.val() || {};
      const stockRef = ref(db, `depots/${userProfile.depotId}/stock`);
      onValue(stockRef, (stockSnapshot) => {
        const stockData = stockSnapshot.val() || {};
        const available = Object.keys(stockData)
          .filter(itemId => (stockData[itemId].totalStockInPcs || 0) > 0)
          .map(itemId => ({
            id: itemId,
            ...masterItems[itemId],
            totalStockInPcs: stockData[itemId].totalStockInPcs
          }));
        setAvailableItems(available);
        setLoading(false);
      });
    });

    /* --- pengiriman keluar --- */
    const outgoingQuery = query(ref(db, 'stock_transfers'), orderByChild('fromDepotId'), equalTo(userProfile.depotId));
    onValue(outgoingQuery, (snapshot) => {
      const data = snapshot.val() || {};
      const list = Object.keys(data).map(key => ({ id: key, ...data[key] }));
      setOutgoingTransfers(list.sort((a, b) => b.createdAt - a.createdAt));
    });

    /* --- penerimaan masuk --- */
    const incomingQuery = query(ref(db, 'stock_transfers'), orderByChild('toDepotId'), equalTo(userProfile.depotId));
    onValue(incomingQuery, (snapshot) => {
      const data = snapshot.val() || {};
      const list = Object.keys(data).map(key => ({ id: key, ...data[key] }));
      setIncomingTransfers(list.sort((a, b) => b.createdAt - a.createdAt));
    });
  }, [userProfile]);

  /* ---------- HANDLERS ---------- */
  const handleBarcodeDetected = (scannedBarcode) => {
    const foundItem = availableItems.find(item => item.barcodePcs === scannedBarcode || item.barcodeDos === scannedBarcode);
    if (foundItem) handleSelectItem(foundItem);
    else toast.error('Barang tidak ditemukan atau stok kosong.');
    setShowScanner(false);
  };

  const handleSelectItem = (item) => {
    setSelectedItem(item);
    setSearchTerm(item.name);
    setItemStock(item.totalStockInPcs);
  };

  const handleAddItemToList = () => {
    if (!selectedItem) { toast.error('Pilih barang dulu.'); return; }
    const totalPcs =
      Number(dosQty) * (selectedItem.conversions?.Dos?.inPcs || 1) +
      Number(packQty) * (selectedItem.conversions?.Pack?.inPcs || 1) +
      Number(pcsQty);
    if (totalPcs <= 0) { toast.error('Masukkan jumlah yang valid.'); return; }
    if (totalPcs > itemStock) { toast.error(`Stok tidak cukup! Sisa ${itemStock} Pcs.`); return; }
    setTransferItems([
      ...transferItems,
      {
        id: selectedItem.id,
        name: selectedItem.name,
        quantityInPcs: totalPcs,
        displayQty: `${dosQty}.${packQty}.${pcsQty}`,
        conversions: selectedItem.conversions
      }
    ]);
    setSelectedItem(null); setSearchTerm(''); setDosQty(0); setPackQty(0); setPcsQty(0);
  };

  const handleRemoveFromList = (indexToRemove) => {
    setTransferItems(transferItems.filter((_, index) => index !== indexToRemove));
  };

  const handleSaveDraft = async () => {
    if (!suratJalan || !destinationDepot || transferItems.length === 0) {
      toast.error('No. Surat Jalan, Depo Tujuan, dan minimal 1 barang wajib diisi.');
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
      const depotData = allDepots.find(d => d.id === destinationDepot);
      await push(transfersRef, {
        suratJalan,
        fromDepotId: userProfile.depotId,
        toDepotId: destinationDepot,
        toDepotName: depotData?.name || destinationDepot,
        items: transferItems,
        status: 'Dikirim',
        createdBy: userProfile.fullName,
        createdAt: serverTimestamp()
      });
      toast.success('Surat jalan transfer berhasil dibuat dan stok telah dialokasikan.');
      setSuratJalan(''); setDestinationDepot(''); setTransferItems([]);
    } catch (err) {
      toast.error(`Gagal membuat transfer: ${err.message}`);
    }
  };

  const handlePrint = () => {
    if (!transferItems.length) { toast.error('Tidak ada barang untuk dicetak.'); return; }
    window.print();
  };

  const handleConfirmReceipt = async (transfer) => {
    if (!window.confirm(`Konfirmasi penerimaan dari ${transfer.fromDepotId} – No. SJ ${transfer.suratJalan}?`)) return;
    try {
      const updates = {};
      updates[`/stock_transfers/${transfer.id}/status`] = 'Diterima';
      updates[`/stock_transfers/${transfer.id}/receivedAt`] = serverTimestamp();
      updates[`/stock_transfers/${transfer.id}/receivedBy`] = userProfile.fullName;
      for (const item of transfer.items) {
        const toStockRef = ref(db, `depots/${userProfile.depotId}/stock/${item.id}`);
        await runTransaction(toStockRef, (currentStock) => {
          if (!currentStock) return { totalStockInPcs: item.quantityInPcs, damagedStockInPcs: 0, inTransitStock: 0 };
          currentStock.totalStockInPcs = (currentStock.totalStockInPcs || 0) + item.quantityInPcs;
          return currentStock;
        });
        const fromStockRef = ref(db, `depots/${transfer.fromDepotId}/stock/${item.id}`);
        await runTransaction(fromStockRef, (currentStock) => {
          if (currentStock) currentStock.inTransitStock = (currentStock.inTransitStock || 0) - item.quantityInPcs;
          return currentStock;
        });
      }
      await update(ref(db), updates);
      toast.success('Penerimaan barang berhasil dikonfirmasi.');
    } catch (err) {
      toast.error('Gagal mengonfirmasi penerimaan.');
    }
  };

  /* ---------- RENDER ---------- */
  const filteredItems = searchTerm
    ? availableItems.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : [];

  // filter depo tujuan (case-insensitive)
  const destinationDepots = allDepots.filter(
    d => d.id.toLowerCase() !== userProfile.depotId.toLowerCase()
  );

  if (loading) return <div className="p-8">Loading barang & depo...</div>;

  return (
    <div className="p-8">
      {showScanner && <CameraBarcodeScanner onScan={handleBarcodeDetected} onClose={() => setShowScanner(false)} />}
      <h1 className="text-3xl font-bold mb-6">Transfer Stok Antar Depo</h1>

      {/* --- TAB NAV --- */}
      <div role="tablist" className="tabs tabs-lifted">
        <a role="tab" className={`tab ${activeTab === 'buat' ? 'tab-active' : ''}`} onClick={() => setActiveTab('buat')}>Buat Transfer Baru</a>
        <a role="tab" className={`tab ${activeTab === 'keluar' ? 'tab-active' : ''}`} onClick={() => setActiveTab('keluar')}>Pengiriman Keluar</a>
        <a role="tab" className={`tab ${activeTab === 'masuk' ? 'tab-active' : ''}`} onClick={() => setActiveTab('masuk')}>Penerimaan Masuk</a>
      </div>

      <div className="bg-white p-6 rounded-b-lg rounded-tr-lg shadow-lg min-h-96">
        {/* ===== TAB 1 : BUAT TRANSFER ===== */}
        {activeTab === 'buat' && (
          <>
            {/* AREA CETAK */}
            <div className="hidden print:block p-4">
              <div className="flex items-center justify-center mb-4 border-b-2 border-black pb-2">
                <img src="/logo_bulet_mhm.gif" alt="Logo" className="h-20 w-20 mr-4" />
                <div>
                  <h1 className="text-2xl font-bold">PT. Mahameru Mitra Makmur</h1>
                  <p className="text-center">Depo Asal: {userProfile.depotId}</p>
                </div>
              </div>
              <h2 className="text-xl font-semibold mt-4 text-center">SURAT JALAN TRANSFER</h2>
              <div className="flex justify-between my-4 text-sm">
                <div>
                  <p><strong>No. Surat Jalan:</strong> {suratJalan}</p>
                  <p><strong>Depo Tujuan:</strong> {destinationDepots.find(d => d.id === destinationDepot)?.name}</p>
                </div>
                <div>
                  <p><strong>Tanggal:</strong> {new Date().toLocaleDateString('id-ID')}</p>
                </div>
              </div>
              <table className="table w-full table-compact">
                <thead>
                  <tr><th>No.</th><th>Nama Barang</th><th>Jumlah</th></tr>
                </thead>
                <tbody>
                  {transferItems.map((it, idx) => (
                    <tr key={idx}><td>{idx + 1}</td><td>{it.name}</td><td>{it.displayQty}</td></tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-around mt-16 text-center text-sm">
                <div><p className="mb-16">(________________)</p><p>Kepala Depo</p></div>
                <div><p className="mb-16">(________________)</p><p>Admin</p></div>
                <div><p className="mb-16">(________________)</p><p>Kepala Gudang</p></div>
              </div>
            </div>

            {/* FORM */}
            <div className="print:hidden">
              <div className="flex justify-end mb-4">
                <button className="btn btn-info" onClick={handlePrint} disabled={!transferItems.length}>Cetak Surat Jalan</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-4 border rounded-lg">
                <div className="form-control">
                  <label className="label"><span className="label-text font-bold">No. Surat Jalan</span></label>
                  <input type="text" className="input input-bordered" value={suratJalan} onChange={e => setSuratJalan(e.target.value)} />
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text font-bold">Depo Tujuan</span></label>
                  <select className="select select-bordered" value={destinationDepot} onChange={e => setDestinationDepot(e.target.value)}>
                    <option value="">Pilih Depo Tujuan</option>
                    {destinationDepots.map(depot => (
                      <option key={depot.id} value={depot.id}>{depot.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="divider">Detail Barang</div>
              <div className="p-4 border rounded-lg bg-base-200">
                <label className="label"><span className="label-text">Cari / Scan Barang</span></label>
                <div className="join w-full">
                  <input type="text" placeholder="Cari nama barang..." className="input input-bordered join-item w-full" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setSelectedItem(null); }} />
                  <button className="btn btn-primary join-item" onClick={() => setShowScanner(true)}>Scan</button>
                </div>
                {filteredItems.length > 0 && !selectedItem && (
                  <ul className="mt-1 menu menu-compact bg-base-100 shadow rounded-box">
                    {filteredItems.slice(0, 5).map(item => (
                      <li key={item.id}>
                        <a onClick={() => handleSelectItem(item)}>{item.name} (Stok {item.totalStockInPcs} Pcs)</a>
                      </li>
                    ))}
                  </ul>
                )}

                {selectedItem && (
                  <div className="mt-4">
                    <p className="font-bold">Barang: {selectedItem.name}</p>
                    <p className="text-sm">Sisa stok: <span className="font-bold">{itemStock}</span> Pcs</p>
                    <div className="grid grid-cols-3 md:grid-cols-4 gap-2 items-end mt-2">
                      <input type="number" placeholder="DOS" value={dosQty} onChange={e => setDosQty(e.target.valueAsNumber || 0)} className="input input-bordered" />
                      <input type="number" placeholder="PACK" value={packQty} onChange={e => setPackQty(e.target.valueAsNumber || 0)} className="input input-bordered" />
                      <input type="number" placeholder="PCS" value={pcsQty} onChange={e => setPcsQty(e.target.valueAsNumber || 0)} className="input input-bordered" />
                      <button className="btn btn-secondary" onClick={handleAddItemToList}>Tambah</button>
                    </div>
                  </div>
                )}
              </div>

              <div className="divider">Barang dalam Surat Jalan Ini</div>
              <div className="overflow-x-auto">
                <table className="table w-full">
                  <thead>
                    <tr><th>Nama Barang</th><th>Jumlah (DOS.PACK.PCS)</th><th>Aksi</th></tr>
                  </thead>
                  <tbody>
                    {transferItems.map((it, idx) => (
                      <tr key={idx}>
                        <td>{it.name}</td>
                        <td>{it.displayQty}</td>
                        <td>
                          <button className="btn btn-xs btn-error" onClick={() => handleRemoveFromList(idx)}>Hapus</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="form-control mt-6">
                <button className="btn btn-primary btn-lg" onClick={handleSaveDraft} disabled={!suratJalan || !destinationDepot || !transferItems.length}>
                  Simpan & Kirim Barang
                </button>
              </div>
            </div>
          </>
        )}

        {/* ===== TAB 2 : PENGIRIMAN KELUAR ===== */}
        {activeTab === 'keluar' && (
          <div className="p-4">
            <h3 className="text-xl font-semibold mb-4">Daftar Pengiriman Keluar</h3>
            <div className="overflow-x-auto">
              <table className="table table-zebra w-full">
                <thead className="bg-gray-200">
                  <tr><th>Tanggal</th><th>No. Surat Jalan</th><th>Tujuan</th><th>Status</th><th>Detail</th></tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="5" className="text-center"><span className="loading loading-dots"></span></td></tr>
                  ) : outgoingTransfers.length === 0 ? (
                    <tr><td colSpan="5" className="text-center">Belum ada pengiriman keluar.</td></tr>
                  ) : outgoingTransfers.map(t => (
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
        )}

        {/* ===== TAB 3 : PENERIMAAN MASUK ===== */}
        {activeTab === 'masuk' && (
          <div className="p-4">
            <h3 className="text-xl font-semibold mb-4">Daftar Penerimaan Masuk</h3>
            <div className="overflow-x-auto">
              <table className="table table-zebra w-full">
                <thead className="bg-gray-200">
                  <tr><th>Tanggal Kirim</th><th>No. Surat Jalan</th><th>Dari Depo</th><th>Status</th><th>Aksi</th></tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="5" className="text-center"><span className="loading loading-dots"></span></td></tr>
                  ) : incomingTransfers.length === 0 ? (
                    <tr><td colSpan="5" className="text-center">Belum ada penerimaan masuk.</td></tr>
                  ) : incomingTransfers.map(t => (
                    <tr key={t.id}>
                      <td>{new Date(t.createdAt).toLocaleDateString('id-ID')}</td>
                      <td>{t.suratJalan}</td>
                      <td>{allDepots.find(d => d.id === t.fromDepotId)?.name || t.fromDepotId}</td>
                      <td><span className={`badge ${t.status === 'Diterima' ? 'badge-success' : 'badge-warning'}`}>{t.status}</span></td>
                      <td>
                        {t.status === 'Dikirim' && (
                          <button className="btn btn-xs btn-success" onClick={() => handleConfirmReceipt(t)}>Konfirmasi Terima</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TransferStok;