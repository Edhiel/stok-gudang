import React, { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { collection, getDocs, onSnapshot, addDoc, doc, runTransaction, updateDoc, query, where, orderBy } from 'firebase/firestore';
import { firestoreDb } from '../firebaseConfig';
import CameraBarcodeScanner from './CameraBarcodeScanner';
import { toast } from 'react-hot-toast';

const formatToDPP = (totalPcs, conversions) => {
  if (!totalPcs || !conversions) return '0.0.0';
  const dosInPcs = conversions.Dos?.inPcs || (conversions.Pack?.inPcs || 1);
  const packInPcs = conversions.Pack?.inPcs || 1;
  return `${Math.floor(totalPcs / dosInPcs)}.${Math.floor((totalPcs % dosInPcs) / packInPcs)}.${totalPcs % packInPcs}`;
};

function TransferStok({ userProfile }) {
  const [activeTab, setActiveTab] = useState('buat');
  const [loading, setLoading] = useState(true);
  const [allDepots, setAllDepots] = useState([]);
  const [locations, setLocations] = useState([]);
  const [availableItems, setAvailableItems] = useState([]);
  const [suratJalan, setSuratJalan] = useState('');
  const [destinationDepot, setDestinationDepot] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemStockLocations, setItemStockLocations] = useState({});
  const [selectedLocation, setSelectedLocation] = useState('');
  const [dosQty, setDosQty] = useState(0);
  const [packQty, setPackQty] = useState(0);
  const [pcsQty, setPcsQty] = useState(0);
  const [transferItems, setTransferItems] = useState([]);
  const [showScanner, setShowScanner] = useState(false);
  const [outgoingTransfers, setOutgoingTransfers] = useState([]);
  const [incomingTransfers, setIncomingTransfers] = useState([]);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptDetails, setReceiptDetails] = useState(null);
  const [destinationLocations, setDestinationLocations] = useState({});

  useEffect(() => {
    if (!userProfile || !userProfile.depotId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const fetchInitialData = async () => {
      try {
        // Ambil data depots
        const depotsSnapshot = await getDocs(collection(firestoreDb, 'depots'));
        const depotList = depotsSnapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().info?.name || doc.id,
        }));
        setAllDepots(depotList);

        // Ambil data lokasi di depo pengguna
        const locationsSnapshot = await getDocs(collection(firestoreDb, `depots/${userProfile.depotId}/locations`));
        const locationsData = locationsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setLocations(locationsData);

        // Ambil data master_items
        const masterItemsSnapshot = await getDocs(collection(firestoreDb, 'master_items'));
        const masterData = {};
        masterItemsSnapshot.forEach((doc) => {
          masterData[doc.id] = doc.data();
        });

        // Dengarkan stok di depo pengguna
        const stockQuery = collection(firestoreDb, `depots/${userProfile.depotId}/stock`);
        const unsubscribeStock = onSnapshot(stockQuery, (snapshot) => {
          const stockData = {};
          snapshot.forEach((doc) => {
            stockData[doc.id] = doc.data();
          });
          const available = Object.keys(stockData)
            .filter((itemId) => (stockData[itemId].totalStockInPcs || 0) > 0)
            .map((itemId) => ({
              id: itemId,
              ...masterData[itemId],
              totalStockInPcs: stockData[itemId].totalStockInPcs,
              locations: stockData[itemId].locations || {},
            }));
          setAvailableItems(available);
        }, (error) => {
          console.error('Gagal memuat stok:', error);
          toast.error('Gagal memuat data stok!');
        });

        // Dengarkan transfer keluar
        const outgoingQuery = query(
          collection(firestoreDb, 'stock_transfers'),
          where('fromDepotId', '==', userProfile.depotId),
          orderBy('createdAt', 'desc')
        );
        const unsubscribeOutgoing = onSnapshot(outgoingQuery, (snapshot) => {
          const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
          setOutgoingTransfers(data);
        }, (error) => {
          console.error('Gagal memuat transfer keluar:', error);
          toast.error('Gagal memuat transfer keluar!');
        });

        // Dengarkan transfer masuk
        const incomingQuery = query(
          collection(firestoreDb, 'stock_transfers'),
          where('toDepotId', '==', userProfile.depotId),
          orderBy('createdAt', 'desc')
        );
        const unsubscribeIncoming = onSnapshot(incomingQuery, (snapshot) => {
          const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
          setIncomingTransfers(data);
        }, (error) => {
          console.error('Gagal memuat transfer masuk:', error);
          toast.error('Gagal memuat transfer masuk!');
        });

        setLoading(false);

        return () => {
          unsubscribeStock();
          unsubscribeOutgoing();
          unsubscribeIncoming();
        };
      } catch (err) {
        console.error('Gagal mengambil data awal:', err);
        toast.error('Gagal mengambil data awal: ' + err.message);
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [userProfile]);

  const handleBarcodeDetected = (scannedBarcode) => {
    const foundItem = availableItems.find(
      (item) => item.barcodePcs === scannedBarcode || item.barcodeDos === scannedBarcode
    );
    if (foundItem) {
      handleSelectItem(foundItem);
    } else {
      toast.error('Barang tidak ditemukan atau stok kosong.');
    }
    setShowScanner(false);
  };

  const handleSelectItem = (item) => {
    setSelectedItem(item);
    setSearchTerm(item.name);
    setItemStockLocations(item.locations || {});
    setSelectedLocation('');
  };

  const handleAddItemToList = () => {
    if (!selectedItem) {
      toast.error('Pilih barang dulu.');
      return;
    }
    if (!selectedLocation) {
      toast.error('Pilih lokasi pengambilan barang.');
      return;
    }

    const stockDiLokasi = itemStockLocations[selectedLocation] || 0;
    const totalPcs =
      Number(dosQty) * (selectedItem.conversions.Dos?.inPcs || 1) +
      Number(packQty) * (selectedItem.conversions.Pack?.inPcs || 1) +
      Number(pcsQty);

    if (totalPcs <= 0) {
      toast.error('Masukkan jumlah yang valid.');
      return;
    }
    if (totalPcs > stockDiLokasi) {
      toast.error(`Stok di lokasi ${selectedLocation} tidak cukup! Hanya ada ${stockDiLokasi} Pcs.`);
      return;
    }

    setTransferItems([
      ...transferItems,
      {
        id: selectedItem.id,
        name: selectedItem.name,
        quantityInPcs: totalPcs,
        displayQty: `${dosQty}.${packQty}.${pcsQty}`,
        conversions: selectedItem.conversions,
        sourceLocationId: selectedLocation,
      },
    ]);

    setSelectedItem(null);
    setSearchTerm('');
    setDosQty(0);
    setPackQty(0);
    setPcsQty(0);
    setSelectedLocation('');
    setItemStockLocations({});
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
      await runTransaction(firestoreDb, async (transaction) => {
        for (const item of transferItems) {
          const stockRef = doc(firestoreDb, `depots/${userProfile.depotId}/stock`, item.id);
          const stockDoc = await transaction.get(stockRef);
          const currentStock = stockDoc.data();

          if (currentStock) {
            if ((currentStock.locations?.[item.sourceLocationId] || 0) < item.quantityInPcs) {
              throw new Error(`Stok untuk ${item.name} di lokasi ${item.sourceLocationId} tidak cukup.`);
            }
            transaction.update(stockRef, {
              totalStockInPcs: currentStock.totalStockInPcs - item.quantityInPcs,
              [`locations.${item.sourceLocationId}`]: currentStock.locations[item.sourceLocationId] - item.quantityInPcs,
              inTransitStock: (currentStock.inTransitStock || 0) + item.quantityInPcs,
            });
          }
        }
      });

      const depotData = allDepots.find((d) => d.id === destinationDepot);
      await addDoc(collection(firestoreDb, 'stock_transfers'), {
        suratJalan,
        fromDepotId: userProfile.depotId,
        toDepotId: destinationDepot,
        toDepotName: depotData ? depotData.name : destinationDepot,
        items: transferItems,
        status: 'Dikirim',
        createdBy: userProfile.fullName,
        createdAt: new Date(),
      });

      toast.success('Surat jalan transfer berhasil dibuat dan stok telah dialokasikan.');
      setSuratJalan('');
      setDestinationDepot('');
      setTransferItems([]);
    } catch (err) {
      toast.error(`Gagal membuat transfer: ${err.message}`);
      console.error('Error saving transfer:', err);
    }
  };

  const handlePrint = () => {
    if (transferItems.length === 0) {
      toast.error('Tidak ada barang dalam daftar untuk dicetak.');
      return;
    }
    window.print();
  };

  const openReceiptModal = (transfer) => {
    setReceiptDetails(transfer);
    setDestinationLocations({});
    setIsReceiptModalOpen(true);
  };

  const handleDestLocationChange = (itemId, locationId) => {
    setDestinationLocations((prev) => ({
      ...prev,
      [itemId]: locationId,
    }));
  };

  const handleConfirmReceipt = async () => {
    const { fromDepotId, items } = receiptDetails;

    for (const item of items) {
      if (!destinationLocations[item.id]) {
        toast.error(`Pilih lokasi penyimpanan untuk ${item.name}.`);
        return;
      }
    }

    if (!window.confirm('Konfirmasi penerimaan barang? Stok akan diperbarui.')) return;

    try {
      await runTransaction(firestoreDb, async (transaction) => {
        const updates = {
          status: 'Diterima',
          receivedAt: new Date(),
          receivedBy: userProfile.fullName,
        };

        const transferRef = doc(firestoreDb, 'stock_transfers', receiptDetails.id);
        transaction.update(transferRef, updates);

        for (const item of items) {
          const toStockRef = doc(firestoreDb, `depots/${userProfile.depotId}/stock`, item.id);
          const toStockDoc = await transaction.get(toStockRef);
          let toStockData = toStockDoc.data() || {
            totalStockInPcs: 0,
            damagedStockInPcs: 0,
            inTransitStock: 0,
            locations: {},
          };

          const destLocationId = destinationLocations[item.id];
          transaction.set(toStockRef, {
            ...toStockData,
            totalStockInPcs: (toStockData.totalStockInPcs || 0) + item.quantityInPcs,
            locations: {
              ...toStockData.locations,
              [destLocationId]: (toStockData.locations?.[destLocationId] || 0) + item.quantityInPcs,
            },
          });

          const fromStockRef = doc(firestoreDb, `depots/${fromDepotId}/stock`, item.id);
          const fromStockDoc = await transaction.get(fromStockRef);
          const fromStockData = fromStockDoc.data();

          if (fromStockData) {
            transaction.update(fromStockRef, {
              inTransitStock: (fromStockData.inTransitStock || 0) - item.quantityInPcs,
            });
          }
        }
      });

      toast.success('Penerimaan barang berhasil dikonfirmasi.');
      setIsReceiptModalOpen(false);
    } catch (err) {
      toast.error('Gagal mengonfirmasi penerimaan: ' + err.message);
      console.error('Error confirming receipt:', err);
    }
  };

  const filteredItems =
    searchTerm.length > 0
      ? availableItems.filter((item) => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
      : [];

  const destinationDepots = userProfile?.depotId
    ? allDepots.filter((depot) => depot.id.toUpperCase() !== userProfile.depotId.toUpperCase())
    : [];

  if (loading) {
    return (
      <div className="p-8 text-center">
        <span className="loading loading-lg"></span>
        <p>Memuat data transfer stok...</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      {showScanner && <CameraBarcodeScanner onScan={handleBarcodeDetected} onClose={() => setShowScanner(false)} />}
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
        {activeTab === 'buat' && (
          <>
            <div className="print:hidden">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-4 border rounded-lg">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-bold">No. Surat Jalan</span>
                  </label>
                  <input
                    type="text"
                    value={suratJalan}
                    onChange={(e) => setSuratJalan(e.target.value)}
                    className="input input-bordered"
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-bold">Depo Tujuan</span>
                  </label>
                  <select
                    value={destinationDepot}
                    onChange={(e) => setDestinationDepot(e.target.value)}
                    className="select select-bordered"
                  >
                    <option value="">Pilih Depo Tujuan</option>
                    {destinationDepots.map((depot) => (
                      <option key={depot.id} value={depot.id}>
                        {depot.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="divider">Detail Barang</div>
              <div className="p-4 border rounded-lg bg-base-200">
                <div className="form-control dropdown">
                  <label className="label">
                    <span className="label-text">Cari Barang (Scan atau Ketik Nama)</span>
                  </label>
                  <div className="join w-full">
                    <input
                      type="text"
                      placeholder="Hanya barang dengan stok tersedia akan muncul"
                      className="input input-bordered join-item w-full"
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setSelectedItem(null);
                      }}
                    />
                    <button type="button" onClick={() => setShowScanner(true)} className="btn btn-primary join-item">
                      Scan
                    </button>
                  </div>
                  {filteredItems.length > 0 && !selectedItem && (
                    <ul
                      tabIndex={0}
                      className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-full max-h-60 overflow-y-auto"
                    >
                      {filteredItems.slice(0, 5).map((item) => (
                        <li key={item.id}>
                          <a onClick={() => handleSelectItem(item)}>{item.name}</a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {selectedItem && (
                  <div className="mt-4 p-2 border rounded-md">
                    <p className="font-bold">Barang Terpilih: {selectedItem.name}</p>
                    <div className="form-control w-full mt-2">
                      <label className="label-text font-bold">Pilih Lokasi Pengambilan</label>
                      <select
                        value={selectedLocation}
                        onChange={(e) => setSelectedLocation(e.target.value)}
                        className="select select-bordered select-sm"
                      >
                        <option value="">Pilih Lokasi...</option>
                        {Object.entries(itemStockLocations).map(([locId, qty]) =>
                          qty > 0 ? (
                            <option key={locId} value={locId}>
                              {locId} (Stok: {qty})
                            </option>
                          ) : null
                        )}
                      </select>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-4 items-end">
                      <div className="form-control">
                        <label className="label-text">DOS</label>
                        <input
                          type="number"
                          value={dosQty}
                          onChange={(e) => setDosQty(e.target.valueAsNumber || 0)}
                          className="input input-sm input-bordered"
                        />
                      </div>
                      <div className="form-control">
                        <label className="label-text">PACK</label>
                        <input
                          type="number"
                          value={packQty}
                          onChange={(e) => setPackQty(e.target.valueAsNumber || 0)}
                          className="input input-sm input-bordered"
                        />
                      </div>
                      <div className="form-control">
                        <label className="label-text">PCS</label>
                        <input
                          type="number"
                          value={pcsQty}
                          onChange={(e) => setPcsQty(e.target.valueAsNumber || 0)}
                          className="input input-sm input-bordered"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddItemToList}
                      className="btn btn-secondary btn-sm mt-4 w-full"
                    >
                      Tambah ke Daftar
                    </button>
                  </div>
                )}
              </div>
              <div className="divider">Barang dalam Surat Jalan Ini</div>
              <div className="overflow-x-auto">
                <table className="table w-full">
                  <thead>
                    <tr>
                      <th>Nama Barang</th>
                      <th>Jumlah</th>
                      <th>Dari Lokasi</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transferItems.map((item, index) => (
                      <tr key={index}>
                        <td>{item.name}</td>
                        <td>{item.displayQty}</td>
                        <td>
                          <span className="badge badge-ghost">{item.sourceLocationId}</span>
                        </td>
                        <td>
                          <button
                            onClick={() => handleRemoveFromList(index)}
                            className="btn btn-xs btn-error"
                          >
                            Hapus
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="form-control mt-6">
                <button type="button" onClick={handleSaveDraft} className="btn btn-primary btn-lg">
                  Simpan & Kirim Barang
                </button>
                <button type="button" onClick={handlePrint} className="btn btn-secondary btn-lg mt-2">
                  Cetak Surat Jalan
                </button>
              </div>
            </div>
          </>
        )}
        {activeTab === 'keluar' && (
          <div className="p-4">
            <h3 className="text-xl font-semibold mb-4">Daftar Pengiriman Keluar</h3>
            <div className="overflow-x-auto">
              <table className="table table-zebra w-full">
                <thead className="bg-gray-200">
                  <tr>
                    <th>Tanggal</th>
                    <th>No. Surat Jalan</th>
                    <th>Tujuan</th>
                    <th>Status</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="5">
                        <span className="loading loading-dots"></span>
                      </td>
                    </tr>
                  ) : (
                    outgoingTransfers.map((t) => (
                      <tr key={t.id}>
                        <td>{new Date(t.createdAt).toLocaleDateString('id-ID')}</td>
                        <td>{t.suratJalan}</td>
                        <td>{t.toDepotName}</td>
                        <td>
                          <span className={`badge ${t.status === 'Diterima' ? 'badge-success' : 'badge-warning'}`}>
                            {t.status}
                          </span>
                        </td>
                        <td>
                          <button className="btn btn-xs btn-info">Lihat</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {activeTab === 'masuk' && (
          <div className="p-4">
            <h3 className="text-xl font-semibold mb-4">Daftar Penerimaan Masuk</h3>
            <div className="overflow-x-auto">
              <table className="table table-zebra w-full">
                <thead className="bg-gray-200">
                  <tr>
                    <th>Tanggal Kirim</th>
                    <th>No. SJ</th>
                    <th>Dari Depo</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="5">
                        <span className="loading loading-dots"></span>
                      </td>
                    </tr>
                  ) : (
                    incomingTransfers.map((t) => (
                      <tr key={t.id}>
                        <td>{new Date(t.createdAt).toLocaleDateString('id-ID')}</td>
                        <td>{t.suratJalan}</td>
                        <td>{allDepots.find((d) => d.id === t.fromDepotId)?.name || t.fromDepotId}</td>
                        <td>
                          <span className={`badge ${t.status === 'Diterima' ? 'badge-success' : 'badge-warning'}`}>
                            {t.status}
                          </span>
                        </td>
                        <td>
                          {t.status === 'Dikirim' && (
                            <button
                              onClick={() => openReceiptModal(t)}
                              className="btn btn-xs btn-success"
                            >
                              Konfirmasi Terima
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {isReceiptModalOpen && receiptDetails && (
        <div className="modal modal-open">
          <div className="modal-box w-11/12 max-w-2xl">
            <h3 className="font-bold text-lg">Konfirmasi Penerimaan Barang</h3>
            <p className="text-sm">No. SJ: {receiptDetails.suratJalan}</p>
            <div className="divider">Pilih Lokasi Penyimpanan</div>
            <div className="space-y-4 max-h-80 overflow-y-auto">
              {receiptDetails.items.map((item) => (
                <div key={item.id} className="form-control">
                  <label className="label">
                    <span className="label-text font-bold">
                      {item.name} ({item.displayQty})
                    </span>
                  </label>
                  <select
                    value={destinationLocations[item.id] || ''}
                    onChange={(e) => handleDestLocationChange(item.id, e.target.value)}
                    className="select select-bordered"
                  >
                    <option value="">Pilih Lokasi Tujuan...</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.namaLokasi}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="modal-action">
              <button onClick={() => setIsReceiptModalOpen(false)} className="btn">
                Batal
              </button>
              <button onClick={handleConfirmReceipt} className="btn btn-primary">
                Simpan Penerimaan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TransferStok;
