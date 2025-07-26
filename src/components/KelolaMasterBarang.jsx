import React, { useState, useEffect, useRef } from 'react';
import { ref, onValue, set, push, get, update, remove } from 'firebase/database';
import { db } from '../firebaseConfig';
import Papa from 'papaparse';
import CameraBarcodeScanner from './CameraBarcodeScanner';
import toast from 'react-hot-toast';

function KelolaMasterBarang() {
  const [masterItems, setMasterItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filteredItems, setFilteredItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  
  // State untuk form tambah
  const [name, setName] = useState('');
  const [kodeInternal, setKodeInternal] = useState(''); // <-- STATE BARU
  const [category, setCategory] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedSubSupplierName, setSelectedSubSupplierName] = useState('');
  const [barcodePcs, setBarcodePcs] = useState('');
  const [barcodeDos, setBarcodeDos] = useState('');
  const [pcsPerPack, setPcsPerPack] = useState('');
  const [packPerDos, setPackPerDos] = useState('');
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editedItemData, setEditedItemData] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [scanningFor, setScanningFor] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    // ... (useEffect untuk mengambil data tidak berubah)
  }, []);

  useEffect(() => {
    // ... (useEffect untuk filtering tidak berubah)
  }, [searchTerm, filterCategory, filterSupplier, masterItems]);

  const openScanner = (type) => { setScanningFor(type); setShowScanner(true); };
  const handleScanResult = (scannedCode) => { /* ... (tidak berubah) ... */ };
  
  const resetForm = () => { 
    setName(''); 
    setKodeInternal(''); // <-- RESET STATE BARU
    setCategory(''); 
    setSelectedSupplierId(''); 
    setSelectedSubSupplierName('');
    setBarcodePcs(''); 
    setBarcodeDos(''); 
    setPcsPerPack(''); 
    setPackPerDos(''); 
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!name || !kodeInternal || !category || !selectedSupplierId) {
      setError("Nama Barang, Kode Internal, Kategori, dan Supplier wajib diisi!");
      return;
    }
    const itemId = barcodePcs || push(ref(db, 'master_items')).key;
    const itemRef = ref(db, `master_items/${itemId}`);
    
    // Cek duplikasi
    const snapshot = await get(itemRef);
    if (snapshot.exists()) {
        setError("Barcode PCS ini sudah terdaftar di master barang.");
        return;
    }

    const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);
    const pcsPerPackNum = Number(pcsPerPack) || 1;
    const packPerDosNum = Number(packPerDos) || 1;

    try {
      await set(itemRef, {
        name,
        kodeInternal: kodeInternal.toUpperCase(), // <-- SIMPAN DATA BARU
        category,
        supplierId: selectedSupplier.id,
        supplierName: selectedSupplier.name,
        subSupplierName: selectedSubSupplierName || null,
        barcodePcs: barcodePcs || null,
        barcodeDos: barcodeDos || null,
        baseUnit: 'Pcs',
        conversions: { Pack: { inPcs: pcsPerPackNum }, Dos: { inPcs: pcsPerPackNum * packPerDosNum } }
      });
      setSuccess(`Barang "${name}" berhasil ditambahkan.`);
      resetForm();
    } catch(err) {
      setError("Gagal menambahkan barang.");
      console.error(err);
    }
  };
  
  const handleDownloadTemplate = () => { /* ... (tidak berubah) ... */ };
  const handleFileUpload = (event) => { /* ... (tidak berubah) ... */ };
  const handleOpenEditModal = (item) => { /* ... (tidak berubah) ... */ };
  const handleUpdateItem = async () => { /* ... (tidak berubah) ... */ };
  const handleEditFormChange = (e) => { /* ... (tidak berubah) ... */ };

  const subSuppliers = suppliers.find(s => s.id === selectedSupplierId)?.subSuppliers || {};
  const ScanIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg> );

  return (
    <>
      {showScanner && ( <CameraBarcodeScanner onScan={handleScanResult} onClose={() => setShowScanner(false)} /> )}
      <div className="p-4 sm:p-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <form onSubmit={handleSubmit} className="card bg-white shadow-lg p-6 space-y-2">
             <h2 className="card-title">Tambah Master Barang</h2>
            {success && <div role="alert" className="alert alert-success text-sm p-2"><span>{success}</span></div>}
            {error && <div role="alert" className="alert alert-error text-sm p-2"><span>{error}</span></div>}
            
            <div className="form-control">
              <label className="label"><span className="label-text font-bold">Nama Barang</span></label>
              <input type="text" placeholder="Nama produk" value={name} onChange={e => setName(e.target.value)} className="input input-bordered" />
            </div>

            {/* --- FIELD BARU DITAMBAHKAN DI SINI --- */}
            <div className="form-control">
              <label className="label"><span className="label-text font-bold">Kode Internal (ND6)</span></label>
              <input type="text" placeholder="Kode produk dari ND6" value={kodeInternal} onChange={e => setKodeInternal(e.target.value)} className="input input-bordered" />
            </div>

            <div className="form-control">
              <label className="label"><span className="label-text font-bold">Kategori</span></label>
              <select className="select select-bordered" value={category} onChange={e => setCategory(e.target.value)}>
                <option value="">Pilih Kategori</option>
                {categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
              </select>
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text font-bold">Supplier Utama</span></label>
              <select className="select select-bordered" value={selectedSupplierId} onChange={e => setSelectedSupplierId(e.target.value)}>
                <option value="">Pilih Supplier</option>
                {suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            {Object.keys(subSuppliers).length > 0 && <div className="form-control"><label className="label"><span className="label-text">Sub-supplier (Opsional)</span></label><select className="select select-bordered" value={selectedSubSupplierName} onChange={e => setSelectedSubSupplierName(e.target.value)}><option value="">Pilih Sub-supplier</option>{Object.values(subSuppliers).map(sub=><option key={sub.name} value={sub.name}>{sub.name}</option>)}</select></div>}
            <div className="divider text-xs">Info Tambahan (Opsional)</div>
            <div className="form-control">
              <label className="label"><span className="label-text">Barcode PCS</span></label>
              <div className="join"><input type="text" placeholder="Scan atau ketik manual" value={barcodePcs} onChange={e => setBarcodePcs(e.target.value)} className="input input-bordered join-item w-full" /><button type="button" onClick={() => openScanner('pcs')} className="btn join-item btn-primary"><ScanIcon /></button></div>
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Barcode DOS</span></label>
              <div className="join"><input type="text" placeholder="Scan atau ketik manual" value={barcodeDos} onChange={e => setBarcodeDos(e.target.value)} className="input input-bordered join-item w-full" /><button type="button" onClick={() => openScanner('dos')} className="btn join-item btn-primary"><ScanIcon /></button></div>
            </div>
            <div className="divider text-xs">Rasio Konversi Satuan</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="form-control"><label className="label-text">Pcs/Pack</label><input type="number" placeholder="Contoh: 10" value={pcsPerPack} onChange={e => setPcsPerPack(e.target.value)} className="input input-bordered" /></div>
              <div className="form-control"><label className="label-text">Pack/Dos</label><input type="number" placeholder="Contoh: 4" value={packPerDos} onChange={e => setPackPerDos(e.target.value)} className="input input-bordered" /></div>
            </div>
            <div className="form-control mt-4"><button type="submit" className="btn btn-primary">Simpan ke Master</button></div>
          </form>
        </div>
        <div className="lg:col-span-2">
          <div className="card bg-white shadow-lg p-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label className="label-text">Cari Nama Barang</label><input type="text" placeholder="Ketik untuk mencari..." className="input input-bordered w-full" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
                <div><label className="label-text">Filter Kategori</label><select className="select select-bordered w-full" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}><option value="">Semua Kategori</option>{categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}</select></div>
                <div><label className="label-text">Filter Supplier</label><select className="select select-bordered w-full" value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)}><option value="">Semua Supplier</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
              <button onClick={handleDownloadTemplate} className="btn btn-sm btn-outline btn-info">Unduh Contoh CSV</button>
              <button onClick={() => fileInputRef.current.click()} className="btn btn-sm btn-outline btn-success">Impor dari CSV</button>
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept=".csv" />
          </div>
          <div className="overflow-x-auto bg-white rounded-lg shadow-lg">
            <table className="table w-full">
              <thead className="bg-gray-200">
                <tr>
                    <th>Nama Barang</th>
                    <th>Kode Internal</th> {/* <-- KOLOM BARU */}
                    <th>Kategori</th>
                    <th>Supplier</th>
                    <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (<tr><td colSpan="5" className="text-center"><span className="loading loading-dots"></span></td></tr>) 
                : (filteredItems.map(item => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td className="font-mono text-xs">{item.kodeInternal}</td> {/* <-- DATA BARU */}
                      <td>{item.category}</td>
                      <td>{item.supplierName}</td>
                      <td><button onClick={() => handleOpenEditModal(item)} className="btn btn-xs btn-info">Edit</button></td>
                    </tr>
                  )))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {isEditModalOpen && editingItem && (
        <div className="modal modal-open">
          <div className="modal-box w-11/12 max-w-2xl">
            <h3 className="font-bold text-lg">Edit Master Barang: {editingItem.name}</h3>
            <div className="py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="form-control">
                  <label className="label"><span className="label-text">Kode Internal (ND6) - Tidak bisa diubah</span></label>
                  <input type="text" readOnly value={editingItem.kodeInternal || ''} className="input input-bordered bg-gray-200 cursor-not-allowed" />
                </div>
                <div className="form-control"><label className="label"><span className="label-text">Nama Barang</span></label><input type="text" name="name" value={editedItemData.name} onChange={handleEditFormChange} className="input input-bordered" /></div>
                <div className="form-control"><label className="label"><span className="label-text">Kategori</span></label><select name="category" value={editedItemData.category} onChange={handleEditFormChange} className="select select-bordered">{categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}</select></div>
                <div className="form-control"><label className="label"><span className="label-text">Supplier</span></label><select name="supplierId" value={editedItemData.supplierId} onChange={handleEditFormChange} className="select select-bordered">{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              </div>
              <div className="space-y-4">
                <div className="form-control"><label className="label"><span className="label-text">Barcode PCS</span></label><input type="text" name="barcodePcs" placeholder="Input manual barcode" value={editedItemData.barcodePcs} onChange={handleEditFormChange} className="input input-bordered" /></div>
                <div className="form-control"><label className="label"><span className="label-text">Barcode DOS</span></label><input type="text" name="barcodeDos" placeholder="Input manual barcode" value={editedItemData.barcodeDos} onChange={handleEditFormChange} className="input input-bordered" /></div>
                <div className="grid grid-cols-2 gap-2 pt-2">
                    <div className="form-control"><label className="label-text">Pcs/Pack</label><input type="number" name="pcsPerPack" value={editedItemData.pcsPerPack} onChange={handleEditFormChange} className="input input-bordered" /></div>
                    <div className="form-control"><label className="label-text">Pack/Dos</label><input type="number" name="packPerDos" value={editedItemData.packPerDos} onChange={handleEditFormChange} className="input input-bordered" /></div>
                </div>
              </div>
            </div>
            <div className="modal-action">
              <button onClick={handleUpdateItem} className="btn btn-primary">Simpan Perubahan</button>
              <button onClick={() => setIsEditModalOpen(false)} className="btn">Batal</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
export default KelolaMasterBarang;
