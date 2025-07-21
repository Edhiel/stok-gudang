import React, { useState, useEffect } from 'react';
import { ref, set, get, onValue } from 'firebase/database';
import { db } from '../firebaseConfig';
import CameraBarcodeScanner from './CameraBarcodeScanner';

const categories = ['Makanan', 'Minuman', 'Bumbu Dapur', 'Margarin', 'Snack', 'Biskuit', 'Minyak Goreng'];

function TambahBarang({ userProfile }) {
  // State untuk form
  const [barcodePcs, setBarcodePcs] = useState('');
  const [barcodeDos, setBarcodeDos] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [supplier, setSupplier] = useState(''); // <-- Tambahan
  const [pcsPerPack, setPcsPerPack] = useState('');
  const [packPerDos, setPackPerDos] = useState('');
  
  // State untuk stok awal
  const [initialDos, setInitialDos] = useState(0);
  const [initialPack, setInitialPack] = useState(0);
  const [initialPcs, setInitialPcs] = useState(0);

  // State untuk UI
  const [suppliers, setSuppliers] = useState([]); // <-- Tambahan
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [scanningFor, setScanningFor] = useState(null);

  // Mengambil daftar supplier dari data master (jika ada)
  useEffect(() => {
    const suppliersRef = ref(db, 'suppliers'); // Asumsi data supplier ada di root/suppliers
    onValue(suppliersRef, (snapshot) => {
        const data = snapshot.val();
        const supplierList = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
        setSuppliers(supplierList);
    });
  }, []);

  const handleBarcodeDetected = (scannedBarcode) => {
    if (scanningFor === 'pcs') setBarcodePcs(scannedBarcode);
    else if (scanningFor === 'dos') setBarcodeDos(scannedBarcode);
    setShowScanner(false);
  };

  const openScanner = (type) => {
    setScanningFor(type);
    setShowScanner(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (!barcodePcs || !name || !category || !supplier) {
      setError("Barcode Pcs, Nama, Kategori, dan Supplier wajib diisi!");
      return;
    }
    
    if (!userProfile.depotId) {
      setError("Anda belum ditugaskan ke depo. Hubungi Super Admin.");
      return;
    }

    try {
      const itemRef = ref(db, `depots/${userProfile.depotId}/items/${barcodePcs}`);
      
      const snapshot = await get(itemRef);
      if (snapshot.exists()) {
        setError("Barcode Pcs ini sudah terdaftar di depo Anda.");
        return;
      }

      // Hitung total stok awal dalam Pcs
      const pcsPerPackNum = Number(pcsPerPack) || 1;
      const packPerDosNum = Number(packPerDos) || 1;
      const dosInPcs = pcsPerPackNum * packPerDosNum;
      const totalInitialStock = (Number(initialDos) * dosInPcs) + 
                                (Number(initialPack) * pcsPerPackNum) + 
                                Number(initialPcs);

      await set(itemRef, {
        name: name,
        category: category,
        supplier: supplier, // <-- Simpan supplier
        barcodePcs: barcodePcs,
        barcodeDos: barcodeDos || null,
        baseUnit: 'Pcs',
        totalStockInPcs: totalInitialStock, // <-- Simpan stok awal
        conversions: {
          Pack: { inPcs: pcsPerPackNum },
          Dos: { inPcs: dosInPcs }
        }
      });

      setMessage(`Barang "${name}" berhasil ditambahkan dengan stok awal ${totalInitialStock} Pcs.`);
      // Reset form
      setBarcodePcs(''); setBarcodeDos(''); setName(''); setCategory(''); setSupplier('');
      setPcsPerPack(''); setPackPerDos('');
      setInitialDos(0); setInitialPack(0); setInitialPcs(0);

    } catch (err) {
      setError("Gagal menambahkan barang.");
      console.error(err);
    }
  };

  return (
    <>
      {showScanner && <CameraBarcodeScanner onDetected={handleBarcodeDetected} onClose={() => setShowScanner(false)} />}
      <div className="p-8 flex justify-center">
        <div className="card w-full max-w-3xl bg-white shadow-lg">
          <form className="card-body" onSubmit={handleSubmit}>
            <h2 className="card-title text-2xl">Tambah Master Barang Baru</h2>
            {message && <div role="alert" className="alert alert-success mt-4"><span>{message}</span></div>}
            {error && <div role="alert" className="alert alert-error mt-4"><span>{error}</span></div>}

            {/* Informasi Dasar */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="form-control">
                <label className="label"><span className="label-text font-bold">Barcode PCS (Wajib)</span></label>
                <div className="join w-full"><input type="text" value={barcodePcs} onChange={(e) => setBarcodePcs(e.target.value)} className="input input-bordered join-item w-full" /><button type="button" onClick={() => openScanner('pcs')} className="btn btn-primary join-item">Scan</button></div>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Barcode DOS (Opsional)</span></label>
                <div className="join w-full"><input type="text" value={barcodeDos} onChange={(e) => setBarcodeDos(e.target.value)} className="input input-bordered join-item w-full" /><button type="button" onClick={() => openScanner('dos')} className="btn btn-primary join-item">Scan</button></div>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Nama Barang</span></label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input input-bordered" />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Kategori</span></label>
                <select className="select select-bordered" value={category} onChange={(e) => setCategory(e.target.value)}><option value="" disabled>Pilih Kategori</option>{categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select>
              </div>
            </div>
            
            {/* Informasi Supplier */}
            <div className="form-control">
                <label className="label"><span className="label-text font-bold">Supplier</span></label>
                <select className="select select-bordered" value={supplier} onChange={(e) => setSupplier(e.target.value)}><option value="" disabled>Pilih Supplier</option>{suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</select>
            </div>

            {/* Pengaturan Satuan */}
            <div className="divider">Pengaturan Satuan</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-control"><label className="label"><span className="label-text">Jumlah Pcs per PACK</span></label><input type="number" value={pcsPerPack} onChange={(e) => setPcsPerPack(e.target.value)} className="input input-bordered" /></div>
              <div className="form-control"><label className="label"><span className="label-text">Jumlah Pack per DOS</span></label><input type="number" value={packPerDos} onChange={(e) => setPackPerDos(e.target.value)} className="input input-bordered" /></div>
            </div>

            {/* Stok Awal */}
            <div className="divider">Input Stok Awal</div>
            <div className="grid grid-cols-3 gap-4">
              <div className="form-control"><label className="label-text">DOS</label><input type="number" value={initialDos} onChange={(e) => setInitialDos(e.target.valueAsNumber || 0)} className="input input-bordered" /></div>
              <div className="form-control"><label className="label-text">PACK</label><input type="number" value={initialPack} onChange={(e) => setInitialPack(e.target.valueAsNumber || 0)} className="input input-bordered" /></div>
              <div className="form-control"><label className="label-text">PCS</label><input type="number" value={initialPcs} onChange={(e) => setInitialPcs(e.target.valueAsNumber || 0)} className="input input-bordered" /></div>
            </div>
            
            <div className="form-control mt-6">
              <button type="submit" className="btn btn-primary">Simpan Master Barang</button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

export default TambahBarang;