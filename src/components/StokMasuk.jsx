import React, { useState, useEffect, useRef } from 'react';
import { ref, onValue, get, set, push, serverTimestamp, runTransaction } from 'firebase/database';
import { db } from '../firebaseConfig';
import toast from 'react-hot-toast';
import CameraBarcodeScanner from './CameraBarcodeScanner';

// Komponen untuk Tampilan Cetak
const CetakDokumenPenerimaan = ({ data, userProfile }) => {
    if (!data) return null;

    const isDiscrepancy = data.itemsFisik.some(fisik => {
        const sjItem = data.itemsSJ.find(sj => sj.id === fisik.id);
        return !sjItem || sjItem.qty !== fisik.qty || fisik.isBonus;
    });

    const docTitle = isDiscrepancy ? "BERITA ACARA SELISIH PENERIMAAN BARANG" : "TANDA TERIMA BARANG";

    // Helper untuk format DPP
    const formatToDPP = (totalPcs, conversions) => {
        if (!totalPcs || !conversions) return totalPcs; // Fallback
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
                    <p><strong>Tanggal Divalidasi:</strong> {new Date(data.validatedAt).toLocaleDateString('id-ID')}</p>
                </div>
            </div>

            <table className="table w-full table-compact border border-black">
                <thead>
                    <tr className="border border-black">
                        <th className="border border-black">Nama Barang</th>
                        <th className="border border-black">Qty (SJ)</th>
                        <th className="border border-black">Qty (Fisik)</th>
                        <th className="border border-black">Selisih</th>
                        <th className="border border-black">Keterangan</th>
                    </tr>
                </thead>
                <tbody>
                    {data.itemsFisik.map(fisik => {
                        const sjItem = data.itemsSJ.find(sj => sj.id === fisik.id);
                        const qtySJ = sjItem ? sjItem.displayQty : '0.0.0';
                        const qtyFisik = fisik.displayQty || formatToDPP(fisik.qty, fisik.conversions);
                        const selisih = (fisik.qty || 0) - (sjItem?.qty || 0);
                        return (
                            <tr key={fisik.id} className="border border-black">
                                <td className="border border-black">{fisik.name}</td>
                                <td className="border border-black text-center">{qtySJ}</td>
                                <td className="border border-black text-center">{qtyFisik}</td>
                                <td className="border border-black text-center">{selisih !== 0 ? selisih + ' Pcs' : '-'}</td>
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

// Komponen untuk Daftar Tampilan Penerimaan
const DaftarPenerimaan = ({ setView, setSelectedReceiptId, userProfile }) => {
    const [receipts, setReceipts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const receiptsRef = ref(db, `depots/${userProfile.depotId}/penerimaanBarang`);
        onValue(receiptsRef, (snapshot) => {
            const data = snapshot.val() || {};
            const receiptList = Object.keys(data)
                .map(key => ({ id: key, ...data[key] }))
                .sort((a, b) => b.createdAt - a.createdAt);
            setReceipts(receiptList);
            setLoading(false);
        });
    }, [userProfile.depotId]);

    const getStatusBadge = (status) => {
        switch (status) {
            case 'menunggu_validasi': return <span className="badge badge-warning">Menunggu Validasi</span>;
            case 'selesai': return <span className="badge badge-success">Selesai</span>;
            case 'selesai_selisih': return <span className="badge badge-info">Selesai (Ada Selisih)</span>;
            default: return <span className="badge badge-ghost">{status}</span>;
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
                        {loading ? (<tr><td colSpan="5" className="text-center"><span className="loading loading-dots"></span></td></tr>)
                        : receipts.length === 0 ? (<tr><td colSpan="5" className="text-center">Belum ada data penerimaan.</td></tr>)
                        : (receipts.map(receipt => (
                            <tr key={receipt.id} className="hover">
                                <td>{new Date(receipt.createdAt).toLocaleDateString('id-ID')}</td>
                                <td className="font-semibold">{receipt.suratJalan}</td>
                                <td>{receipt.supplierName}</td>
                                <td>{getStatusBadge(receipt.status)}</td>
                                <td>
                                    <button 
                                        onClick={() => { setSelectedReceiptId(receipt.id); setView('form'); }} 
                                        className="btn btn-xs btn-outline"
                                    >
                                        {receipt.status === 'menunggu_validasi' ? 'Validasi Sekarang' : 'Lihat Detail'}
                                    </button>
                                </td>
                            </tr>
                        )))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
// Komponen untuk Form Input dan Validasi
const FormPenerimaan = ({ receiptId, setView, userProfile, setPrintableData }) => {
    const [masterItems, setMasterItems] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [receiptData, setReceiptData] = useState({ 
        supplierId: '', suratJalan: '', namaSupir: '', noPolisi: '',
        itemsSJ: [], itemsFisik: [] 
    });
    
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItem, setSelectedItem] = useState(null);
    const [dosQty, setDosQty] = useState(0);
    const [packQty, setPackQty] = useState(0);
    const [pcsQty, setPcsQty] = useState(0);
    const [bonusCatatan, setBonusCatatan] = useState('');
    const [showScanner, setShowScanner] = useState(false);

    const isValidationMode = !!receiptId;

    useEffect(() => {
        const masterItemsPromise = get(ref(db, 'master_items'));
        const suppliersPromise = get(ref(db, 'suppliers'));

        Promise.all([masterItemsPromise, suppliersPromise]).then(([masterSnapshot, supplierSnapshot]) => {
            const masterData = masterSnapshot.val() || {};
            setMasterItems(Object.keys(masterData).map(key => ({ id: key, ...masterData[key] })));
            
            const supplierData = supplierSnapshot.val() || {};
            setSuppliers(Object.keys(supplierData).map(key => ({ id: key, ...supplierData[key] })));

            if (isValidationMode) {
                get(ref(db, `depots/${userProfile.depotId}/penerimaanBarang/${receiptId}`)).then(snapshot => {
                    if (snapshot.exists()) {
                        const data = snapshot.val();
                        const initialFisik = data.itemsSJ.map(item => ({...item, qtyFisik: item.qty, catatan: ''}));
                        setReceiptData({ ...data, itemsFisik: initialFisik });
                    }
                }).finally(() => setLoading(false));
            } else {
                setLoading(false);
            }
        });
    }, [receiptId, userProfile.depotId]);

    const handleBarcodeDetected = (scannedCode) => {
        const foundItem = masterItems.find(item => item.barcodePcs === scannedCode || item.barcodeDos === scannedCode);
        if (foundItem) {
            setSelectedItem(foundItem);
            setSearchTerm(foundItem.name);
        } else {
            toast.error("Barang tidak ditemukan di master.");
        }
        setShowScanner(false);
    };

    const handleAddItem = (item) => {
        if (!item) return;
        if (receiptData.itemsSJ.some(i => i.id === item.id)) {
            return toast.error("Barang sudah ada di daftar.");
        }

        const dosInPcs = item.conversions?.Dos?.inPcs || (item.conversions?.Pack?.inPcs || 1);
        const packInPcs = item.conversions?.Pack?.inPcs || 1;
        const totalPcs = (Number(dosQty) * dosInPcs) + (Number(packQty) * packInPcs) + (Number(pcsQty));
        
        if (totalPcs <= 0) return toast.error("Jumlah tidak boleh nol.");

        const displayQty = `${dosQty}.${packQty}.${pcsQty}`;
        const newItem = { id: item.id, name: item.name, qty: totalPcs, displayQty, conversions: item.conversions };
        
        setReceiptData(prev => ({ ...prev, itemsSJ: [...prev.itemsSJ, newItem] }));
        setSearchTerm('');
        setSelectedItem(null);
        setDosQty(0); setPackQty(0); setPcsQty(0);
    };

    const handleAddBonusItem = (item, catatan) => {
        if (!item) return;
        if (receiptData.itemsFisik.some(i => i.id === item.id)) {
            return toast.error("Barang sudah ada di daftar. Edit jumlah fisiknya jika perlu.");
        }

        const dosInPcs = item.conversions?.Dos?.inPcs || (item.conversions?.Pack?.inPcs || 1);
        const packInPcs = item.conversions?.Pack?.inPcs || 1;
        const totalPcs = (Number(dosQty) * dosInPcs) + (Number(packQty) * packInPcs) + (Number(pcsQty));
        
        if (totalPcs <= 0) return toast.error("Jumlah tidak boleh nol.");

        const displayQty = `${dosQty}.${packQty}.${pcsQty}`;
        const newBonusItem = { id: item.id, name: item.name, qtyFisik: totalPcs, displayQty, isBonus: true, catatan, conversions: item.conversions };

        setReceiptData(prev => ({ ...prev, itemsFisik: [...prev.itemsFisik, newBonusItem] }));
        setSearchTerm('');
        setSelectedItem(null);
        setDosQty(0); setPackQty(0); setPcsQty(0);
        setBonusCatatan('');
    };
    
    const handleFisikChange = (itemId, field, value) => {
        setReceiptData(prev => ({
            ...prev,
            itemsFisik: prev.itemsFisik.map(item => 
                item.id === itemId ? { ...item, [field]: value } : item
            )
        }));
    };

    const handleSaveInitial = async () => {
        // ... (logika handleSaveInitial tidak berubah) ...
    };
    
    const handleConfirmValidation = async () => {
        // ... (logika handleConfirmValidation tidak berubah) ...
    };
    
    if (loading) return <div className="text-center p-10"><span className="loading loading-spinner"></span></div>;

    if (!isValidationMode) {
        return (
            <div className="space-y-6">
                {showScanner && <CameraBarcodeScanner onScan={handleBarcodeDetected} onClose={() => setShowScanner(false)} />}
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold">Buat Dokumen Penerimaan Baru</h2>
                    <button onClick={() => setView('list')} className="btn btn-ghost">Kembali ke Daftar</button>
                </div>
                <div className="card bg-base-200 p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="form-control"><label className="label-text font-bold">Supplier</label><select value={receiptData.supplierId} onChange={e => setReceiptData(p => ({...p, supplierId: e.target.value}))} className="select select-bordered"><option value="">Pilih Supplier</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                        <div className="form-control"><label className="label-text font-bold">No. Surat Jalan</label><input type="text" value={receiptData.suratJalan} onChange={e => setReceiptData(p => ({...p, suratJalan: e.target.value}))} className="input input-bordered" /></div>
                        <div className="form-control"><label className="label-text font-bold">Nama Supir</label><input type="text" value={receiptData.namaSupir} onChange={e => setReceiptData(p => ({...p, namaSupir: e.target.value}))} className="input input-bordered w-full" /></div>
                        <div className="form-control"><label className="label-text font-bold">No. Polisi</label><input type="text" value={receiptData.noPolisi} onChange={e => setReceiptData(p => ({...p, noPolisi: e.target.value}))} className="input input-bordered w-full" /></div>
                    </div>
                </div>
                <div className="card bg-base-200 p-4 space-y-2">
                    <h3 className="font-bold">Tambah Barang Sesuai Surat Jalan</h3>
                    <div className="form-control dropdown">
                        <div className="join w-full">
                            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Cari barang atau scan barcode..." className="input input-bordered join-item w-full" />
                            <button onClick={() => setShowScanner(true)} className="btn btn-primary join-item">Scan</button>
                        </div>
                        {searchTerm && !selectedItem &&
                            <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-full max-h-60 overflow-y-auto">
                                {masterItems.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase())).map(item => (
                                    <li key={item.id}><a onClick={() => setSelectedItem(item)}>{item.name}</a></li>
                                ))}
                            </ul>
                        }
                    </div>
                    {selectedItem && 
                        <div className="p-2 border rounded-md mt-2 space-y-2">
                            <p className="font-semibold">{selectedItem.name}</p>
                            <div className="flex items-end gap-2">
                                <div className="form-control"><label className="label-text text-xs">DOS</label><input type="number" value={dosQty} onChange={e => setDosQty(e.target.valueAsNumber || 0)} className="input input-sm input-bordered w-20" /></div>
                                <div className="form-control"><label className="label-text text-xs">PACK</label><input type="number" value={packQty} onChange={e => setPackQty(e.target.valueAsNumber || 0)} className="input input-sm input-bordered w-20" /></div>
                                <div className="form-control"><label className="label-text text-xs">PCS</label><input type="number" value={pcsQty} onChange={e => setPcsQty(e.target.valueAsNumber || 0)} className="input input-sm input-bordered w-20" /></div>
                                <button onClick={() => handleAddItem(selectedItem)} className="btn btn-secondary btn-sm">Tambah</button>
                            </div>
                        </div>
                    }
                </div>
                <div className="overflow-x-auto">
                    <table className="table w-full">
                        <thead><tr><th>Nama Barang</th><th>Qty (D.P.P)</th><th>Aksi</th></tr></thead>
                        <tbody>
                            {receiptData.itemsSJ.map((item, index) => (<tr key={index}><td>{item.name}</td><td>{item.displayQty}</td><td><button onClick={() => setReceiptData(p => ({...p, itemsSJ: p.itemsSJ.filter((_, i) => i !== index)}))} className="btn btn-xs btn-error">Hapus</button></td></tr>))}
                        </tbody>
                    </table>
                </div>
                <div className="flex justify-end"><button onClick={handleSaveInitial} disabled={isSubmitting} className="btn btn-primary btn-lg">{isSubmitting ? <span className="loading loading-spinner"></span> : "Simpan Penerimaan Awal"}</button></div>
            </div>
        );
    } else {
        return (
            <div className="space-y-6">
                 {/* ... (tampilan validasi tidak berubah) ... */}
            </div>
        );
    }
};

// Komponen Utama
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
      if(viewName === 'list') { setSelectedReceiptId(null); }
      setView(viewName);
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="print:hidden">
        <h1 className="text-3xl font-bold mb-6">Penerimaan Barang</h1>
        {view === 'list' ? (
            <DaftarPenerimaan setView={handleSetView} setSelectedReceiptId={setSelectedReceiptId} userProfile={userProfile} />
        ) : (
            <FormPenerimaan receiptId={selectedReceiptId} setView={handleSetView} userProfile={userProfile} setPrintableData={setPrintableData} />
        )}
      </div>
      <CetakDokumenPenerimaan data={printableData} userProfile={userProfile} />
    </div>
  );
}
const FormPenerimaan = ({ receiptId, setView, userProfile, setPrintableData, syncOfflineReceipts }) => {
    const [masterItems, setMasterItems] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [receiptData, setReceiptData] = useState({ 
        supplierId: '', suratJalan: '', namaSupir: '', noPolisi: '',
        itemsSJ: [], itemsFisik: [] 
    });
    
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItem, setSelectedItem] = useState(null);
    const [dosQty, setDosQty] = useState(0);
    const [packQty, setPackQty] = useState(0);
    const [pcsQty, setPcsQty] = useState(0);
    const [bonusCatatan, setBonusCatatan] = useState('');
    const [showScanner, setShowScanner] = useState(false);

    const isValidationMode = !!receiptId;

    useEffect(() => {
        const masterItemsPromise = get(ref(firebaseDb, 'master_items'));
        const suppliersPromise = get(ref(firebaseDb, 'suppliers'));

        Promise.all([masterItemsPromise, suppliersPromise]).then(([masterSnapshot, supplierSnapshot]) => {
            const masterData = masterSnapshot.val() || {};
            setMasterItems(Object.keys(masterData).map(key => ({ id: key, ...masterData[key] })));
            
            const supplierData = supplierSnapshot.val() || {};
            setSuppliers(Object.keys(supplierData).map(key => ({ id: key, ...supplierData[key] })));

            if (isValidationMode) {
                get(ref(firebaseDb, `depots/${userProfile.depotId}/penerimaanBarang/${receiptId}`)).then(snapshot => {
                    if (snapshot.exists()) {
                        const data = snapshot.val();
                        const initialFisik = data.itemsSJ.map(item => ({...item, qtyFisik: item.qty, catatan: ''}));
                        setReceiptData({ ...data, itemsFisik: initialFisik });
                    }
                }).finally(() => setLoading(false));
            } else {
                setLoading(false);
            }
        });
    }, [receiptId, userProfile.depotId]);

    const handleBarcodeDetected = (scannedCode) => {
        const foundItem = masterItems.find(item => item.barcodePcs === scannedCode || item.barcodeDos === scannedCode);
        if (foundItem) {
            setSelectedItem(foundItem);
            setSearchTerm(foundItem.name);
        } else {
            toast.error("Barang tidak ditemukan di master.");
        }
        setShowScanner(false);
    };

    const handleAddItem = (item) => {
        if (!item) return;
        if (receiptData.itemsSJ.some(i => i.id === item.id)) {
            return toast.error("Barang sudah ada di daftar.");
        }
        const dosInPcs = item.conversions?.Dos?.inPcs || (item.conversions?.Pack?.inPcs || 1);
        const packInPcs = item.conversions?.Pack?.inPcs || 1;
        const totalPcs = (Number(dosQty) * dosInPcs) + (Number(packQty) * packInPcs) + (Number(pcsQty));
        if (totalPcs <= 0) return toast.error("Jumlah tidak boleh nol.");
        const displayQty = `${dosQty}.${packQty}.${pcsQty}`;
        const newItem = { id: item.id, name: item.name, qty: totalPcs, displayQty, conversions: item.conversions };
        setReceiptData(prev => ({ ...prev, itemsSJ: [...prev.itemsSJ, newItem] }));
        setSearchTerm('');
        setSelectedItem(null);
        setDosQty(0); setPackQty(0); setPcsQty(0);
    };

    const handleAddBonusItem = (item, catatan) => {
        if (!item) return;
        if (receiptData.itemsFisik.some(i => i.id === item.id)) {
            return toast.error("Barang sudah ada di daftar. Edit jumlah fisiknya jika perlu.");
        }
        const dosInPcs = item.conversions?.Dos?.inPcs || (item.conversions?.Pack?.inPcs || 1);
        const packInPcs = item.conversions?.Pack?.inPcs || 1;
        const totalPcs = (Number(dosQty) * dosInPcs) + (Number(packQty) * packInPcs) + (Number(pcsQty));
        if (totalPcs <= 0) return toast.error("Jumlah tidak boleh nol.");
        const displayQty = `${dosQty}.${packQty}.${pcsQty}`;
        const newBonusItem = { id: item.id, name: item.name, qtyFisik: totalPcs, displayQty, isBonus: true, catatan, conversions: item.conversions };
        setReceiptData(prev => ({ ...prev, itemsFisik: [...prev.itemsFisik, newBonusItem] }));
        setSearchTerm('');
        setSelectedItem(null);
        setDosQty(0); setPackQty(0); setPcsQty(0);
        setBonusCatatan('');
    };
    
    const handleFisikChange = (itemId, field, value) => {
        setReceiptData(prev => ({
            ...prev,
            itemsFisik: prev.itemsFisik.map(item => 
                item.id === itemId ? { ...item, [field]: value } : item
            )
        }));
    };

    const handleSaveInitial = async () => {
        if (!receiptData.supplierId || !receiptData.suratJalan || receiptData.itemsSJ.length === 0) {
            return toast.error("Supplier, No. Surat Jalan, dan minimal 1 barang wajib diisi.");
        }
        setIsSubmitting(true);
        const supplier = suppliers.find(s => s.id === receiptData.supplierId);
        const receiptForQueue = {
            supplierId: receiptData.supplierId, supplierName: supplier.name,
            suratJalan: receiptData.suratJalan, namaSupir: receiptData.namaSupir,
            noPolisi: receiptData.noPolisi, itemsSJ: receiptData.itemsSJ,
            status: 'menunggu_validasi', depotId: userProfile.depotId,
            createdBy: userProfile.fullName
        };

        if (navigator.onLine) {
            await syncOfflineReceipts([receiptForQueue], true);
        } else {
            const success = await addReceiptToQueue(receiptForQueue);
            if (success) {
                toast.success("Koneksi offline. Data disimpan lokal & akan disinkronkan.");
                setView('list');
            } else {
                toast.error("Gagal menyimpan data di penyimpanan lokal.");
            }
        }
        setIsSubmitting(false);
    };
    
    const handleConfirmValidation = async () => {
        setIsSubmitting(true);
        let hasDiscrepancy = false;
        
        const finalFisikData = receiptData.itemsFisik.map(i => ({ id: i.id, name: i.name, qty: i.qtyFisik, displayQty: i.displayQty, catatan: i.catatan, isBonus: !!i.isBonus, conversions: i.conversions }));
        finalFisikData.forEach(fisik => {
            const sjItem = receiptData.itemsSJ.find(sj => sj.id === fisik.id);
            if(fisik.isBonus || !sjItem || sjItem.qty !== fisik.qty) { hasDiscrepancy = true; }
        });
        
        try {
            for (const item of finalFisikData) {
                if (item.qty > 0) {
                    const stockRef = ref(firebaseDb, `depots/${userProfile.depotId}/stock/${item.id}`);
                    await runTransaction(stockRef, (currentStock) => {
                        if (!currentStock) return { totalStockInPcs: item.qty, damagedStockInPcs: 0 };
                        currentStock.totalStockInPcs = (currentStock.totalStockInPcs || 0) + item.qty;
                        return currentStock;
                    });
                }
            }
            const transactionItems = finalFisikData.map(item => ({ id: item.id, name: item.name, qtyInPcs: item.qty, displayQty: item.displayQty }));
            const transactionsRef = ref(firebaseDb, `depots/${userProfile.depotId}/transactions`);
            await push(transactionsRef, {
                type: 'Stok Masuk', items: transactionItems, user: userProfile.fullName,
                timestamp: serverTimestamp(), refDoc: receiptId
            });
            const receiptRef = ref(firebaseDb, `depots/${userProfile.depotId}/penerimaanBarang/${receiptId}`);
            const now = serverTimestamp();
            const finalDataForDB = { ...receiptData, status: hasDiscrepancy ? 'selesai_selisih' : 'selesai', itemsFisik: finalFisikData, validatedAt: now, validatedBy: userProfile.fullName };
            await set(receiptRef, finalDataForDB);
            toast.success("Validasi berhasil! Stok telah diperbarui.");
            setPrintableData({id: receiptId, ...finalDataForDB, validatedAt: Date.now() });
            setView('list');
        } catch(err) {
            toast.error(`Gagal saat konfirmasi validasi: ${err.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    if (loading) return <div className="text-center p-10"><span className="loading loading-spinner"></span></div>;

    if (!isValidationMode) {
        return (
            <div className="space-y-6">
                {showScanner && <CameraBarcodeScanner onScan={handleBarcodeDetected} onClose={() => setShowScanner(false)} />}
                <div className="flex justify-between items-center"><h2 className="text-2xl font-bold">Buat Dokumen Penerimaan Baru</h2><button onClick={() => setView('list')} className="btn btn-ghost">Kembali ke Daftar</button></div>
                <div className="card bg-base-200 p-4"><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="form-control"><label className="label-text font-bold">Supplier</label><select value={receiptData.supplierId} onChange={e => setReceiptData(p => ({...p, supplierId: e.target.value}))} className="select select-bordered"><option value="">Pilih Supplier</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div><div className="form-control"><label className="label-text font-bold">No. Surat Jalan</label><input type="text" value={receiptData.suratJalan} onChange={e => setReceiptData(p => ({...p, suratJalan: e.target.value}))} className="input input-bordered" /></div><div className="form-control"><label className="label-text font-bold">Nama Supir</label><input type="text" value={receiptData.namaSupir} onChange={e => setReceiptData(p => ({...p, namaSupir: e.target.value}))} className="input input-bordered w-full" /></div><div className="form-control"><label className="label-text font-bold">No. Polisi</label><input type="text" value={receiptData.noPolisi} onChange={e => setReceiptData(p => ({...p, noPolisi: e.target.value}))} className="input input-bordered w-full" /></div></div></div>
                <div className="card bg-base-200 p-4 space-y-2"><h3 className="font-bold">Tambah Barang Sesuai Surat Jalan</h3><div className="form-control dropdown"><div className="join w-full"><input type="text" value={searchTerm} onChange={e => {setSearchTerm(e.target.value); setSelectedItem(null);}} placeholder="Cari barang atau scan barcode..." className="input input-bordered join-item w-full" /><button onClick={() => setShowScanner(true)} className="btn btn-primary join-item">Scan</button></div>{searchTerm && !selectedItem && <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-full max-h-60 overflow-y-auto">{masterItems.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase())).map(item => (<li key={item.id}><a onClick={() => setSelectedItem(item)}>{item.name}</a></li>))}</ul>}</div>
                    {selectedItem && <div className="p-2 border rounded-md mt-2 space-y-2"><p className="font-semibold">{selectedItem.name}</p><div className="flex items-end gap-2 flex-wrap"><div className="form-control"><label className="label-text text-xs">DOS</label><input type="number" value={dosQty} onChange={e => setDosQty(e.target.valueAsNumber || 0)} className="input input-sm input-bordered w-20" /></div><div className="form-control"><label className="label-text text-xs">PACK</label><input type="number" value={packQty} onChange={e => setPackQty(e.target.valueAsNumber || 0)} className="input input-sm input-bordered w-20" /></div><div className="form-control"><label className="label-text text-xs">PCS</label><input type="number" value={pcsQty} onChange={e => setPcsQty(e.target.valueAsNumber || 0)} className="input input-sm input-bordered w-20" /></div><button onClick={() => handleAddItem(selectedItem)} className="btn btn-secondary btn-sm">Tambah</button></div></div>}
                </div>
                <div className="overflow-x-auto"><table className="table w-full"><thead><tr><th>Nama Barang</th><th>Qty (D.P.P)</th><th>Aksi</th></tr></thead><tbody>{receiptData.itemsSJ.map((item, index) => (<tr key={index}><td>{item.name}</td><td>{item.displayQty}</td><td><button onClick={() => setReceiptData(p => ({...p, itemsSJ: p.itemsSJ.filter((_, i) => i !== index)}))} className="btn btn-xs btn-error">Hapus</button></td></tr>))}</tbody></table></div>
                <div className="flex justify-end"><button onClick={handleSaveInitial} disabled={isSubmitting} className="btn btn-primary btn-lg">{isSubmitting ? <span className="loading loading-spinner"></span> : "Simpan Penerimaan Awal"}</button></div>
            </div>
        );
    } else {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center"><h2 className="text-2xl font-bold">Validasi Pengecekan Fisik</h2><button onClick={() => setView('list')} className="btn btn-ghost">Kembali ke Daftar</button></div>
                <div className="card bg-base-200 p-4 text-sm"><p><strong>Supplier:</strong> {receiptData.supplierName}</p><p><strong>No. Surat Jalan:</strong> {receiptData.suratJalan}</p></div>
                <div className="overflow-x-auto"><table className="table w-full"><thead><tr><th>Nama Barang</th><th>Qty (SJ)</th><th>Qty (Fisik)</th><th>Catatan</th></tr></thead>
                    <tbody>{receiptData.itemsFisik.map((item, index) => (<tr key={index}><td>{item.name}{item.isBonus && <span className="badge badge-success badge-sm ml-2">BONUS</span>}</td><td>{receiptData.itemsSJ.find(sj => sj.id === item.id)?.displayQty || '0.0.0'}</td><td><input type="number" value={item.qtyFisik} onChange={e => handleFisikChange(item.id, 'qtyFisik', Number(e.target.value))} className="input input-bordered input-sm w-24" /></td><td><input type="text" value={item.catatan} onChange={e => handleFisikChange(item.id, 'catatan', e.target.value)} placeholder="Mis: Rusak, lebih..." className="input input-bordered input-sm w-full" /></td></tr>))}</tbody>
                </table></div>
                <div className="card bg-base-200 p-4 space-y-2"><h3 className="font-bold">Tambah Barang Bonus / Tidak Terduga</h3><div className="form-control dropdown"><input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Cari barang..." className="input input-bordered w-full" />{searchTerm && <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-full max-h-60 overflow-y-auto">{masterItems.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase())).map(item => (<li key={item.id}><a onClick={() => setSelectedItem(item)}>{item.name}</a></li>))}</ul>}</div>
                    {selectedItem && <div className="flex items-end gap-2 flex-wrap"><div className="form-control flex-grow"><label className="label-text">Nama Barang</label><input type="text" readOnly value={selectedItem.name} className="input input-bordered bg-gray-200" /></div><div className="form-control"><label className="label-text text-xs">DOS</label><input type="number" value={dosQty} onChange={e => setDosQty(e.target.valueAsNumber || 0)} className="input input-sm input-bordered w-20" /></div><div className="form-control"><label className="label-text text-xs">PACK</label><input type="number" value={packQty} onChange={e => setPackQty(e.target.valueAsNumber || 0)} className="input input-sm input-bordered w-20" /></div><div className="form-control"><label className="label-text text-xs">PCS</label><input type="number" value={pcsQty} onChange={e => setPcsQty(e.target.valueAsNumber || 0)} className="input input-sm input-bordered w-20" /></div><div className="form-control flex-grow"><label className="label-text">Catatan</label><input type="text" value={bonusCatatan} onChange={e => setBonusCatatan(e.target.value)} placeholder="Mis: Bonus promo" className="input input-bordered input-sm" /></div><button onClick={() => handleAddBonusItem(selectedItem, bonusCatatan)} className="btn btn-accent btn-sm">+ Tambah Bonus</button></div>}
                </div>
                <div className="flex justify-end"><button onClick={handleConfirmValidation} disabled={isSubmitting} className="btn btn-success btn-lg">{isSubmitting ? <span className="loading loading-spinner"></span> : "Konfirmasi & Selesaikan Penerimaan"}</button></div>
            </div>
        );
    }
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
      if(viewName === 'list') { setSelectedReceiptId(null); }
      setView(viewName);
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="print:hidden">
        <h1 className="text-3xl font-bold mb-6">Penerimaan Barang</h1>
        {view === 'list' ? (
            <DaftarPenerimaan setView={handleSetView} setSelectedReceiptId={setSelectedReceiptId} userProfile={userProfile} />
        ) : (
            <FormPenerimaan receiptId={selectedReceiptId} setView={handleSetView} userProfile={userProfile} setPrintableData={setPrintableData} />
        )}
      </div>
      <CetakDokumenPenerimaan data={printableData} userProfile={userProfile} />
    </div>
  );
}

export default StokMasuk;
