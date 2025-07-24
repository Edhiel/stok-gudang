import React, { useState, useEffect, useRef } from 'react';
import { ref, onValue, get, set, push, serverTimestamp, runTransaction } from 'firebase/database';
import { db } from '../firebaseConfig';
import toast from 'react-hot-toast';

// Komponen untuk Tampilan Cetak
const CetakDokumenPenerimaan = ({ data, userProfile }) => {
    if (!data) return null;

    const isDiscrepancy = data.itemsFisik.some(fisik => {
        const sjItem = data.itemsSJ.find(sj => sj.id === fisik.id);
        return !sjItem || sjItem.qty !== fisik.qty || fisik.isBonus;
    });

    const docTitle = isDiscrepancy ? "BERITA ACARA SELISIH PENERIMAAN BARANG" : "TANDA TERIMA BARANG";

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
                </div>
                <div>
                    <p><strong>No. Dokumen:</strong> {data.id}</p>
                    <p><strong>Tanggal Terima:</strong> {new Date(data.validatedAt).toLocaleDateString('id-ID')}</p>
                </div>
            </div>

            <table className="table w-full table-compact">
                <thead>
                    <tr>
                        <th>Nama Barang</th>
                        <th>Qty (SJ)</th>
                        <th>Qty (Fisik)</th>
                        <th>Selisih</th>
                        <th>Keterangan</th>
                    </tr>
                </thead>
                <tbody>
                    {data.itemsFisik.map(fisik => {
                        const sjItem = data.itemsSJ.find(sj => sj.id === fisik.id);
                        const qtySJ = sjItem ? sjItem.qty : 0;
                        const selisih = fisik.qty - qtySJ;
                        return (
                            <tr key={fisik.id}>
                                <td>{fisik.name}</td>
                                <td>{qtySJ}</td>
                                <td>{fisik.qty}</td>
                                <td>{selisih !== 0 ? selisih : '-'}</td>
                                <td>{fisik.catatan || (fisik.isBonus ? 'Barang Bonus' : '-')}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            
            <div className="flex justify-around mt-16 pt-8 text-center text-sm">
                <div>
                    <p className="mb-16">(______________________)</p>
                    <p>Penerima / Staf Gudang</p>
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
                            <th>Tanggal</th>
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
const FormPenerimaan = ({ receiptId, setView, userProfile }) => {
    const [masterItems, setMasterItems] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Form State
    const [receiptData, setReceiptData] = useState({
        supplierId: '',
        suratJalan: '',
        itemsSJ: [], // Item sesuai surat jalan
        itemsFisik: [], // Item hasil pengecekan fisik
    });
    
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItem, setSelectedItem] = useState(null);
    const [itemQty, setItemQty] = useState(1);

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
                        // Inisialisasi itemsFisik dari itemsSJ untuk form validasi
                        const initialFisik = data.itemsSJ.map(item => ({...item, qtyFisik: item.qty, catatan: ''}));
                        setReceiptData({ ...data, itemsFisik: initialFisik });
                    }
                }).finally(() => setLoading(false));
            } else {
                setLoading(false);
            }
        });
    }, [receiptId, userProfile.depotId]);


    const handleAddItem = (item, qty) => {
        if (!item || qty <= 0) return;
        const newItem = { id: item.id, name: item.name, qty: Number(qty) };
        setReceiptData(prev => ({ ...prev, itemsSJ: [...prev.itemsSJ, newItem] }));
        setSearchTerm('');
        setSelectedItem(null);
        setItemQty(1);
    };

    const handleAddBonusItem = (item, qty, catatan) => {
        if (!item || qty <= 0) return;
        const newBonusItem = { id: item.id, name: item.name, qtyFisik: Number(qty), isBonus: true, catatan };
        setReceiptData(prev => ({ ...prev, itemsFisik: [...prev.itemsFisik, newBonusItem] }));
        setSearchTerm('');
        setSelectedItem(null);
        setItemQty(1);
    }
    
    const handleSaveInitial = async () => {
        if (!receiptData.supplierId || !receiptData.suratJalan || receiptData.itemsSJ.length === 0) {
            return toast.error("Supplier, No. Surat Jalan, dan minimal 1 barang wajib diisi.");
        }
        setIsSubmitting(true);
        try {
            const newReceiptRef = push(ref(db, `depots/${userProfile.depotId}/penerimaanBarang`));
            const supplier = suppliers.find(s => s.id === receiptData.supplierId);
            await set(newReceiptRef, {
                supplierId: receiptData.supplierId,
                supplierName: supplier.name,
                suratJalan: receiptData.suratJalan,
                itemsSJ: receiptData.itemsSJ,
                status: 'menunggu_validasi',
                createdAt: serverTimestamp(),
                createdBy: userProfile.fullName
            });
            toast.success("Penerimaan awal berhasil disimpan. Lanjutkan ke validasi fisik.");
            setView('list');
        } catch(err) {
            toast.error("Gagal menyimpan data awal.");
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleConfirmValidation = async () => {
        setIsSubmitting(true);
        let hasDiscrepancy = false;
        
        // Cek selisih
        receiptData.itemsFisik.forEach(fisik => {
            const sjItem = receiptData.itemsSJ.find(sj => sj.id === fisik.id);
            if(fisik.isBonus || !sjItem || sjItem.qty !== fisik.qtyFisik) {
                hasDiscrepancy = true;
            }
        });
        
        try {
            // 1. Update stok di gudang
            for (const item of receiptData.itemsFisik) {
                if (item.qtyFisik > 0) {
                    const stockRef = ref(db, `depots/${userProfile.depotId}/stock/${item.id}`);
                    await runTransaction(stockRef, (currentStock) => {
                        if (!currentStock) return { totalStockInPcs: item.qtyFisik, damagedStockInPcs: 0 };
                        currentStock.totalStockInPcs = (currentStock.totalStockInPcs || 0) + item.qtyFisik;
                        return currentStock;
                    });
                }
            }

            // 2. Buat transaksi log
            const transactionItems = receiptData.itemsFisik.map(item => ({
                id: item.id, name: item.name, qtyInPcs: item.qtyFisik, displayQty: item.qtyFisik, // Sederhanakan displayQty
            }));
            const transactionsRef = ref(db, `depots/${userProfile.depotId}/transactions`);
            await push(transactionsRef, {
                type: 'Stok Masuk',
                items: transactionItems,
                user: userProfile.fullName,
                timestamp: serverTimestamp(),
                refDoc: receiptId
            });

            // 3. Finalisasi dokumen penerimaan
            const receiptRef = ref(db, `depots/${userProfile.depotId}/penerimaanBarang/${receiptId}`);
            const finalFisikData = receiptData.itemsFisik.map(i => ({ id: i.id, name: i.name, qty: i.qtyFisik, catatan: i.catatan, isBonus: !!i.isBonus }));
            await set(receiptRef, {
                ...receiptData,
                status: hasDiscrepancy ? 'selesai_selisih' : 'selesai',
                itemsFisik: finalFisikData,
                validatedAt: serverTimestamp(),
                validatedBy: userProfile.fullName
            });

            toast.success("Validasi berhasil! Stok telah diperbarui.");
            setView('list');

        } catch(err) {
            toast.error("Gagal saat konfirmasi validasi.");
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    // Render form...
    if (loading) return <div className="text-center"><span className="loading loading-spinner"></span></div>;

    if (!isValidationMode) {
        // Tampilan untuk TAHAP 1: INPUT SURAT JALAN
        return (
            <div>
                {/* JSX untuk form input awal */}
            </div>
        );
    } else {
        // Tampilan untuk TAHAP 2: VALIDASI FISIK
        return (
            <div>
                {/* JSX untuk form validasi */}
            </div>
        );
    }
};

// Komponen Utama
function StokMasuk({ userProfile }) {
  const [view, setView] = useState('list'); // 'list' or 'form'
  const [selectedReceiptId, setSelectedReceiptId] = useState(null);
  const printableDataRef = useRef(null);

  const handleSetView = (viewName) => {
      if(viewName === 'list') {
          setSelectedReceiptId(null);
      }
      setView(viewName);
  }

  return (
    <div className="p-8">
        <h1 className="text-3xl font-bold mb-6 print:hidden">Penerimaan Barang</h1>
        {view === 'list' ? (
            <DaftarPenerimaan setView={handleSetView} setSelectedReceiptId={setSelectedReceiptId} userProfile={userProfile} />
        ) : (
            <FormPenerimaan receiptId={selectedReceiptId} setView={handleSetView} userProfile={userProfile} />
        )}
        <CetakDokumenPenerimaan data={printableDataRef.current} userProfile={userProfile} />
    </div>
  );
}

export default StokMasuk;
