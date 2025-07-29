import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, getDocs, doc, getDoc, setDoc, addDoc, updateDoc, serverTimestamp, runTransaction, Timestamp } from 'firebase/firestore';
import { firestoreDb } from '../firebaseConfig';
import toast from 'react-hot-toast';
import CameraBarcodeScanner from './CameraBarcodeScanner';

const CetakDokumenPenerimaan = ({ data, userProfile }) => {
  if (!data) return null;

  const isDiscrepancy = data.itemsFisik.some((fisik) => {
    const sjItem = data.itemsSJ.find((sj) => sj.id === fisik.id);
    return !sjItem || sjItem.qty !== fisik.qty || fisik.isBonus;
  });

  const docTitle = isDiscrepancy ? 'BERITA ACARA SELISIH PENERIMAAN BARANG' : 'TANDA TERIMA BARANG';

  const formatToDPP = (totalPcs, conversions) => {
    if (totalPcs === undefined || !conversions) return totalPcs;
    const dosInPcs = conversions.Dos?.inPcs || (conversions.Pack?.inPcs || 1);
    const packInPcs = conversions.Pack?.inPcs || 1;
    if (dosInPcs === 0 || packInPcs === 0) return totalPcs;
    const dos = Math.floor(totalPcs / dosInPcs);
    const pack = Math.floor((totalPcs % dosInPcs) / packInPcs);
    const pcs = totalPcs % packInPcs;
    return `${dos}.${pack}.${pcs}`;
  };

  return (
    <div className="hidden print:block p-4">
      <div className="flex items-center justify-center mb-4 border-b-2 border-black pb-2">
        <img src="/logo_bulet_mhm.gif" alt="Logo Perusahaan" className="h-20 w-20 mr-4" />
        <div>
          <h1 className="text-2xl font-bold">PT. Mahameru Mitra Makmur</h1>
          <p className="text-center">Depo: {userProfile.depotId}</p>
        </div>
      </div>
      <h2 className="text-xl font-semibold mt-4 text-center">{docTitle}</h2>
      <div className="flex justify-between text-sm my-4">
        <div>
          <p><strong>Supplier:</strong> {data.supplierName}</p>
          <p><strong>No. Surat Jalan:</strong> {data.suratJalan}</p>
          <p><strong>Supir:</strong> {data.namaSupir || '-'}</p>
          <p><strong>No. Polisi:</strong> {data.noPolisi || '-'}</p>
        </div>
        <div>
          <p><strong>No. Dokumen Internal:</strong> {data.id}</p>
          <p>
            <strong>Tanggal Divalidasi:</strong>{' '}
            {data.validatedAt ? data.validatedAt.toDate().toLocaleDateString('id-ID') : '-'}
          </p>
        </div>
      </div>
      <table className="table w-full table-compact border border-black">
        <thead>
          <tr className="border border-black">
            <th className="border border-black">Nama Barang</th>
            <th className="border border-black">Qty (SJ)</th>
            <th className="border border-black">Qty (Fisik)</th>
            <th className="border border-black">Lokasi</th>
            <th className="border border-black">Keterangan</th>
          </tr>
        </thead>
        <tbody>
          {data.itemsFisik.map((fisik) => {
            const sjItem = data.itemsSJ.find((sj) => sj.id === fisik.id);
            const qtySJ = sjItem ? sjItem.displayQty : '0.0.0';
            const qtyFisik = fisik.displayQty || formatToDPP(fisik.qty, fisik.conversions);
            return (
              <tr key={fisik.id} className="border border-black">
                <td className="border border-black">{fisik.name}</td>
                <td className="border border-black text-center">{qtySJ}</td>
                <td className="border border-black text-center">{qtyFisik}</td>
                <td className="border border-black text-center">{sjItem?.locationId || '-'}</td>
                <td className="border border-black">{fisik.catatan || (fisik.isBonus ? 'Barang Bonus' : '-')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex justify-around mt-16 pt-8 text-center text-sm">
        <div>
          <p className="mb-16">(______________________)</p>
          <p>Penerima / Staf Gudang</p>
          <p>{data.validatedBy}</p>
        </div>
        <div>
          <p className="mb-16">(______________________)</p>
          <p>Mengetahui / Kepala Gudang</p>
        </div>
      </div>
    </div>
  );
};

const DaftarPenerimaan = ({ setView, setSelectedReceiptId, userProfile }) => {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const receiptsRef = collection(firestoreDb, `depots/${userProfile.depotId}/penerimaanBarang`);
    const q = query(receiptsRef, where('status', 'in', ['menunggu_validasi', 'selesai', 'selesai_selisih']));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const receiptList = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
        setReceipts(receiptList);
        setLoading(false);
      },
      (error) => {
        console.error('Gagal memuat daftar penerimaan:', error);
        toast.error('Gagal memuat daftar penerimaan: ' + error.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userProfile.depotId]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'menunggu_validasi':
        return <span className="badge badge-warning">Menunggu Validasi</span>;
      case 'selesai':
        return <span className="badge badge-success">Selesai</span>;
      case 'selesai_selisih':
        return <span className="badge badge-info">Selesai (Ada Selisih)</span>;
      default:
        return <span className="badge badge-ghost">{status}</span>;
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Daftar Penerimaan Barang</h2>
        <button onClick={() => setView('form')} className="btn btn-primary">
          + Buat Penerimaan Baru
        </button>
      </div>
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="table w-full">
          <thead>
            <tr>
              <th>Tanggal Dibuat</th>
              <th>No. Surat Jalan</th>
              <th>Supplier</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" className="text-center">
                  <span className="loading loading-dots"></span> Memuat daftar penerimaan...
                </td>
              </tr>
            ) : receipts.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center">
                  Belum ada data penerimaan.
                </td>
              </tr>
            ) : (
              receipts.map((receipt) => (
                <tr key={receipt.id} className="hover">
                  <td>{receipt.createdAt?.toDate().toLocaleDateString('id-ID')}</td>
                  <td className="font-semibold">{receipt.suratJalan}</td>
                  <td>{receipt.supplierName}</td>
                  <td>{getStatusBadge(receipt.status)}</td>
                  <td>
                    <button
                      onClick={() => {
                        setSelectedReceiptId(receipt.id);
                        setView('form');
                      }}
                      className="btn btn-xs btn-outline"
                    >
                      {receipt.status === 'menunggu_validasi' ? 'Validasi Sekarang' : 'Lihat Detail'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const FormPenerimaan = ({ receiptId, setView, userProfile, setPrintableData }) => {
  const [masterItems, setMasterItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptData, setReceiptData] = useState({
    supplierId: '',
    suratJalan: '',
    namaSupir: '',
    noPolisi: '',
    itemsSJ: [],
    itemsFisik: [],
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [dosQty, setDosQty] = useState(0);
  const [packQty, setPackQty] = useState(0);
  const [pcsQty, setPcsQty] = useState(0);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [expireDate, setExpireDate] = useState('');
  const [bonusCatatan, setBonusCatatan] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const isValidationMode = !!receiptId;

  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const masterItemsSnap = await getDocs(collection(firestoreDb, 'master_items'));
        setMasterItems(masterItemsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));

        const suppliersSnap = await getDocs(collection(firestoreDb, 'suppliers'));
        setSuppliers(suppliersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));

        const locationsSnap = await getDocs(collection(firestoreDb, `depots/${userProfile.depotId}/locations`));
        setLocations(locationsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));

        if (isValidationMode) {
          const receiptSnap = await getDoc(doc(firestoreDb, `depots/${userProfile.depotId}/penerimaanBarang/${receiptId}`));
          if (receiptSnap.exists()) {
            const data = receiptSnap.data();
            const initialFisik = data.itemsSJ.map((item) => ({ ...item, qtyFisik: item.qty, catatan: '' }));
            setReceiptData({ ...data, itemsFisik: initialFisik });
          } else {
            toast.error('Data penerimaan tidak ditemukan.');
            setView('list');
          }
        }
      } catch (error) {
        console.error('Gagal memuat data master:', error);
        toast.error('Gagal memuat data master: ' + error.message);
      } finally {
        setLoading(false);
      }
    };
    fetchMasterData();
  }, [receiptId, userProfile.depotId, setView]);

  const handleBarcodeDetected = (scannedCode) => {
    const foundItem = masterItems.find(
      (item) => item.barcodePcs === scannedCode || item.barcodeDos === scannedCode
    );
    if (foundItem) {
      setSelectedItem(foundItem);
      setSearchTerm(foundItem.name);
    } else {
      toast.error('Barang tidak ditemukan di master.');
    }
    setShowScanner(false);
  };

  const handleAddItem = (item) => {
    if (!item || !selectedLocation || !expireDate) {
      toast.error('Barang, Lokasi, dan Tgl. Kedaluwarsa wajib diisi.');
      return;
    }
    if (
      receiptData.itemsSJ.some(
        (i) => i.id === item.id && i.locationId === selectedLocation && i.expireDate === expireDate
      )
    ) {
      toast.error('Barang dengan lokasi & Tgl. ED yang sama sudah ada.');
      return;
    }
    const dosInPcs = item.conversions?.Dos?.inPcs || (item.conversions?.Pack?.inPcs || 1);
    const packInPcs = item.conversions?.Pack?.inPcs || 1;
    const totalPcs = Number(dosQty) * dosInPcs + Number(packQty) * packInPcs + Number(pcsQty);
    if (totalPcs <= 0) {
      toast.error('Jumlah tidak boleh nol.');
      return;
    }
    const displayQty = `${dosQty}.${packQty}.${pcsQty}`;

    const newItem = {
      id: item.id,
      name: item.name,
      qty: totalPcs,
      displayQty,
      conversions: item.conversions,
      locationId: selectedLocation,
      expireDate: expireDate,
    };

    setReceiptData((prev) => ({ ...prev, itemsSJ: [...prev.itemsSJ, newItem] }));
    setSearchTerm('');
    setSelectedItem(null);
    setDosQty(0);
    setPackQty(0);
    setPcsQty(0);
    setSelectedLocation('');
    setExpireDate('');
  };

  const handleAddBonusItem = (item, catatan) => {
    if (!item || !selectedLocation || !expireDate) {
      toast.error('Barang, Lokasi, dan Tgl. Kedaluwarsa wajib diisi.');
      return;
    }
    const dosInPcs = item.conversions?.Dos?.inPcs || (item.conversions?.Pack?.inPcs || 1);
    const packInPcs = item.conversions?.Pack?.inPcs || 1;
    const totalPcs = Number(dosQty) * dosInPcs + Number(packQty) * packInPcs + Number(pcsQty);
    if (totalPcs <= 0) {
      toast.error('Jumlah tidak boleh nol.');
      return;
    }
    const displayQty = `${dosQty}.${packQty}.${pcsQty}`;

    const newBonusItem = {
      id: item.id,
      name: item.name,
      qtyFisik: totalPcs,
      displayQty,
      isBonus: true,
      catatan,
      conversions: item.conversions,
      locationId: selectedLocation,
      expireDate: expireDate,
    };
    setReceiptData((prev) => ({ ...prev, itemsFisik: [...prev.itemsFisik, newBonusItem] }));
    setSearchTerm('');
    setSelectedItem(null);
    setDosQty(0);
    setPackQty(0);
    setPcsQty(0);
    setBonusCatatan('');
    setSelectedLocation('');
    setExpireDate('');
  };

  const handleFisikChange = (itemIndex, field, value) => {
    setReceiptData((prev) => ({
      ...prev,
      itemsFisik: prev.itemsFisik.map((item, index) =>
        index === itemIndex ? { ...item, [field]: value } : item
      ),
    }));
  };

  const handleSaveInitial = async () => {
    if (!receiptData.supplierId || !receiptData.suratJalan || receiptData.itemsSJ.length === 0) {
      toast.error('Supplier, No. Surat Jalan, dan minimal 1 barang wajib diisi.');
      return;
    }
    if (receiptData.noPolisi && !/^[A-Z]{1,2}\s?\d{1,4}\s?[A-Z]{1,3}$/.test(receiptData.noPolisi)) {
      toast.error('Nomor polisi tidak valid (contoh: B 1234 XYZ).');
      return;
    }
    if (receiptData.namaSupir && !/^[a-zA-Z\s]+$/.test(receiptData.namaSupir)) {
      toast.error('Nama supir hanya boleh berisi huruf dan spasi.');
      return;
    }
    setIsSubmitting(true);
    try {
      const supplier = suppliers.find((s) => s.id === receiptData.supplierId);
      await addDoc(collection(firestoreDb, `depots/${userProfile.depotId}/penerimaanBarang`), {
        supplierId: receiptData.supplierId,
        supplierName: supplier.name,
        suratJalan: receiptData.suratJalan,
        namaSupir: receiptData.namaSupir || '',
        noPolisi: receiptData.noPolisi || '',
        itemsSJ: receiptData.itemsSJ,
        status: 'menunggu_validasi',
        createdAt: serverTimestamp(),
        createdBy: userProfile.fullName,
      });
      toast.success('Penerimaan awal berhasil. Silakan validasi fisik.');
      setView('list');
    } catch (err) {
      console.error('Gagal menyimpan data awal:', err);
      toast.error(`Gagal menyimpan data awal: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmValidation = async () => {
    setIsSubmitting(true);
    let hasDiscrepancy = false;
    const finalFisikData = receiptData.itemsFisik.map((i) => ({ ...i, qty: i.qtyFisik }));

    finalFisikData.forEach((fisik) => {
      const sjItem = receiptData.itemsSJ.find(
        (sj) => sj.id === fisik.id && sj.locationId === fisik.locationId && sj.expireDate === fisik.expireDate
      );
      if (fisik.isBonus || !sjItem || sjItem.qty !== fisik.qty) {
        hasDiscrepancy = true;
      }
    });

    try {
      for (const item of finalFisikData) {
        if (item.qty > 0) {
          const stockDocRef = doc(firestoreDb, `depots/${userProfile.depotId}/stock`, item.id);

          await runTransaction(firestoreDb, async (transaction) => {
            const stockDoc = await transaction.get(stockDocRef);
            let currentStock = stockDoc.exists()
              ? stockDoc.data()
              : { totalStockInPcs: 0, batches: {} };

            const newTotal = (currentStock.totalStockInPcs || 0) + item.qty;
            const batchKey = doc(collection(firestoreDb, 'temp')).id; // Firestore auto-ID

            const newBatch = {
              quantity: item.qty,
              expireDate: item.expireDate,
              locationId: item.locationId,
              receivedAt: serverTimestamp(),
              receiptId: receiptId,
            };

            transaction.set(
              stockDocRef,
              {
                totalStockInPcs: newTotal,
                batches: { ...currentStock.batches, [batchKey]: newBatch },
              },
              { merge: true }
            );
          });
        }
      }

      await addDoc(collection(firestoreDb, `depots/${userProfile.depotId}/transactions`), {
        type: 'Stok Masuk',
        items: finalFisikData.map((item) => ({
          id: item.id,
          name: item.name,
          qtyInPcs: item.qty,
          displayQty: item.displayQty,
          expireDate: item.expireDate,
          locationId: item.locationId,
        })),
        user: userProfile.fullName,
        timestamp: serverTimestamp(),
        refDoc: receiptId,
      });

      const receiptDocRef = doc(firestoreDb, `depots/${userProfile.depotId}/penerimaanBarang`, receiptId);
      const finalDataForDB = {
        ...receiptData,
        status: hasDiscrepancy ? 'selesai_selisih' : 'selesai',
        itemsFisik: finalFisikData,
        validatedAt: serverTimestamp(),
        validatedBy: userProfile.fullName,
      };
      await updateDoc(receiptDocRef, finalDataForDB);

      toast.success('Validasi berhasil! Stok telah diperbarui di Firestore.');
      setPrintableData({ id: receiptId, ...finalDataForDB, validatedAt: Timestamp.now() });
      setView('list');
    } catch (err) {
      console.error('Gagal saat konfirmasi validasi:', err);
      toast.error(`Gagal saat konfirmasi validasi: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredItems = searchTerm
    ? masterItems.filter((item) => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : [];

  return (
    <div className="space-y-6">
      {showScanner && (
        <CameraBarcodeScanner onScan={handleBarcodeDetected} onClose={() => setShowScanner(false)} />
      )}
      <h2 className="text-2xl font-bold">
        {isValidationMode ? 'Validasi Penerimaan Barang' : 'Buat Penerimaan Barang Baru'}
      </h2>
      {loading ? (
        <div className="text-center">
          <span className="loading loading-spinner loading-lg"></span>
          <p>Memuat data master...</p>
        </div>
      ) : (
        <>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-bold">Supplier</span>
                </label>
                <select
                  value={receiptData.supplierId}
                  onChange={(e) => setReceiptData({ ...receiptData, supplierId: e.target.value })}
                  className="select select-bordered"
                  disabled={isValidationMode}
                >
                  <option value="">Pilih Supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-bold">No. Surat Jalan</span>
                </label>
                <input
                  type="text"
                  value={receiptData.suratJalan}
                  onChange={(e) => setReceiptData({ ...receiptData, suratJalan: e.target.value })}
                  className="input input-bordered"
                  disabled={isValidationMode}
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-bold">Nama Supir</span>
                </label>
                <input
                  type="text"
                  value={receiptData.namaSupir}
                  onChange={(e) => setReceiptData({ ...receiptData, namaSupir: e.target.value })}
                  className="input input-bordered"
                  disabled={isValidationMode}
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-bold">No. Polisi</span>
                </label>
                <input
                  type="text"
                  value={receiptData.noPolisi}
                  onChange={(e) => setReceiptData({ ...receiptData, noPolisi: e.target.value })}
                  className="input input-bordered"
                  disabled={isValidationMode}
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Data Barang</h3>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Cari Barang (Scan atau Ketik Nama)</span>
              </label>
              <div className="join w-full">
                <input
                  type="text"
                  placeholder="Ketik nama barang"
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
                <ul className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-full max-h-60 overflow-y-auto">
                  {filteredItems.slice(0, 5).map((item) => (
                    <li key={item.id}>
                      <a onClick={() => setSelectedItem(item)}>{item.name}</a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {selectedItem && (
              <div className="mt-4 p-4 border rounded-md bg-base-200">
                <p className="font-bold">Barang Terpilih: {selectedItem.name}</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
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
                <div className="form-control mt-2">
                  <label className="label-text font-bold">Lokasi Penyimpanan</label>
                  <select
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    className="select select-bordered select-sm"
                  >
                    <option value="">Pilih Lokasi...</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.namaLokasi}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-control mt-2">
                  <label className="label-text font-bold">Tanggal Kedaluwarsa</label>
                  <input
                    type="date"
                    value={expireDate}
                    onChange={(e) => setExpireDate(e.target.value)}
                    className="input input-bordered"
                  />
                </div>
                {!isValidationMode && (
                  <div className="form-control mt-2">
                    <label className="label-text font-bold">Catatan (untuk Barang Bonus)</label>
                    <input
                      type="text"
                      value={bonusCatatan}
                      onChange={(e) => setBonusCatatan(e.target.value)}
                      className="input input-bordered"
                    />
                  </div>
                )}
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => handleAddItem(selectedItem)}
                    className="btn btn-secondary btn-sm mr-2"
                    disabled={isValidationMode}
                  >
                    Tambah ke Surat Jalan
                  </button>
                  {!isValidationMode && (
                    <button
                      type="button"
                      onClick={() => handleAddBonusItem(selectedItem, bonusCatatan)}
                      className="btn btn-accent btn-sm"
                    >
                      Tambah sebagai Bonus
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Daftar Barang (Surat Jalan)</h3>
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Nama Barang</th>
                    <th>Jumlah</th>
                    <th>Lokasi</th>
                    <th>Tgl. ED</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {receiptData.itemsSJ.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="text-center">
                        Belum ada barang di surat jalan.
                      </td>
                    </tr>
                  ) : (
                    receiptData.itemsSJ.map((item, index) => (
                      <tr key={index}>
                        <td>{item.name}</td>
                        <td>{item.displayQty}</td>
                        <td>{locations.find((loc) => loc.id === item.locationId)?.namaLokasi || '-'}</td>
                        <td>{item.expireDate}</td>
                        <td>
                          {!isValidationMode && (
                            <button
                              onClick={() =>
                                setReceiptData((prev) => ({
                                  ...prev,
                                  itemsSJ: prev.itemsSJ.filter((_, i) => i !== index),
                                }))
                              }
                              className="btn btn-xs btn-error"
                            >
                              Hapus
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

          {isValidationMode && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">Validasi Fisik</h3>
              <div className="overflow-x-auto">
                <table className="table w-full">
                  <thead>
                    <tr>
                      <th>Nama Barang</th>
                      <th>Jumlah (SJ)</th>
                      <th>Jumlah Fisik</th>
                      <th>Catatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receiptData.itemsFisik.map((item, index) => (
                      <tr key={index}>
                        <td>{item.name}</td>
                        <td>{item.displayQty}</td>
                        <td>
                          <input
                            type="number"
                            value={item.qtyFisik}
                            onChange={(e) => handleFisikChange(index, 'qtyFisik', Number(e.target.value))}
                            className="input input-bordered input-sm w-24"
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={item.catatan || ''}
                            onChange={(e) => handleFisikChange(index, 'catatan', e.target.value)}
                            className="input input-bordered input-sm w-full"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-4">
            <button onClick={() => setView('list')} className="btn btn-ghost">
              Batal
            </button>
            {!isValidationMode ? (
              <button
                onClick={handleSaveInitial}
                className="btn btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? <span className="loading loading-spinner"></span> : 'Simpan Penerimaan Awal'}
              </button>
            ) : (
              <button
                onClick={handleConfirmValidation}
                className="btn btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? <span className="loading loading-spinner"></span> : 'Konfirmasi Validasi'}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

function StokMasuk({ userProfile }) {
  const [view, setView] = useState('list');
  const [selectedReceiptId, setSelectedReceiptId] = useState(null);
  const [printableData, setPrintableData] = useState(null);

  useEffect(() => {
    if (printableData) {
      setTimeout(() => {
        window.print();
        setPrintableData(null);
      }, 500);
    }
  }, [printableData]);

  const handleSetView = (viewName) => {
    if (viewName === 'list') {
      setSelectedReceiptId(null);
    }
    setView(viewName);
  };

  return (
    <div className="p-4 sm:p-8">
      <div className="print:hidden">
        <h1 className="text-3xl font-bold mb-6">Penerimaan Barang</h1>
        {view === 'list' ? (
          <DaftarPenerimaan
            setView={handleSetView}
            setSelectedReceiptId={setSelectedReceiptId}
            userProfile={userProfile}
          />
        ) : (
          <FormPenerimaan
            receiptId={selectedReceiptId}
            setView={handleSetView}
            userProfile={userProfile}
            setPrintableData={setPrintableData}
          />
        )}
      </div>
      <CetakDokumenPenerimaan data={printableData} userProfile={userProfile} />
    </div>
  );
}

export default StokMasuk;
