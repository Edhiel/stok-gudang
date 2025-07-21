import React, { useState, useEffect } from 'react';
import { ref, onValue, set, push, get, update } from 'firebase/database';
import { db } from '../firebaseConfig';
import Papa from 'papaparse';
import CameraBarcodeScanner from './CameraBarcodeScanner';

function KelolaMasterBarang() {
  const [masterItems, setMasterItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filteredItems, setFilteredItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [barcodePcs, setBarcodePcs] = useState('');
  const [barcodeDos, setBarcodeDos] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedSubSupplierName, setSelectedSubSupplierName] = useState('');
  const [pcsPerPack, setPcsPerPack] = useState('');
  const [packPerDos, setPackPerDos] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editedItemData, setEditedItemData] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [scanningFor, setScanningFor] = useState(null);

  useEffect(() => {
    const masterItemsRef = ref(db, 'master_items/');
    onValue(masterItemsRef, (snapshot) => {
      const data = snapshot.val();
      const itemList = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
      setMasterItems(itemList);
    });
    const suppliersRef = ref(db, 'suppliers/');
    onValue(suppliersRef, (snapshot) => {
      const data = snapshot.val();
      setSuppliers(data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : []);
    });
    const categoriesRef = ref(db, 'categories/');
    onValue(categoriesRef, (snapshot) => {
      const data = snapshot.val();
      const loadedCategories = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
      setCategories(loadedCategories);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    let items = [...masterItems];
    if (searchTerm) {
      items = items.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (filterCategory) {
      items = items.filter(item => item.category === filterCategory);
    }
    if (filterSupplier) {
      items = items.filter(item => item.supplierId === filterSupplier);
    }
    setFilteredItems(items);
  }, [searchTerm, filterCategory, filterSupplier, masterItems]);

  const openScanner = (type) => { setScanningFor(type); setShowScanner(true); };
  const handleScanResult = (scannedCode) => {
    if (scanningFor === 'pcs') {
      setBarcodePcs(scannedCode);
    } else if (scanningFor === 'dos') {
      setBarcodeDos(scannedCode);
    }
    setShowScanner(false);
  };
  const resetForm = () => { setBarcodePcs(''); setBarcodeDos(''); setName(''); setCategory(''); setSelectedSupplierId(''); setSelectedSubSupplierName(''); setPcsPerPack(''); setPackPerDos(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!name || !category || !selectedSupplierId) {
      setError("Nama Barang, Kategori, dan Supplier wajib diisi!");
      return;
    }
    const itemId = barcodePcs || push(ref(db, 'master_items')).key;
    const itemRef = ref(db, `master_items/${itemId}`);
    if (barcodePcs) {
        const snapshot = await get(itemRef);
        if (snapshot.exists()) {
            setError("Barcode PCS ini sudah terdaftar di master barang.");
            return;
        }
    }
    const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);
    const pcsPerPackNum = Number(pcsPerPack) || 1;
    const packPerDosNum = Number(packPerDos) || 1;
    try {
      await set(itemRef, {
        name, category, supplierId: selectedSupplier.id, supplierName: selectedSupplier.name,
        subSupplierName: selectedSubSupplierName || null, barcodePcs: barcodePcs || null,
        barcodeDos: barcodeDos || null, baseUnit: 'Pcs',
        conversions: { Pack: { inPcs: pcsPerPackNum }, Dos: { inPcs: pcsPerPackNum * packPerDosNum } }
      });
      setSuccess(`Barang "${name}" berhasil ditambahkan ke master.`);
      resetForm();
    } catch(err) {
      setError("Gagal menambahkan barang.");
      console.error(err);
    }
  };
  
  const handleDownloadTemplate = () => {
    const csvHeader = "barcodePcs,barcodeDos,namaBarang,kategori,idSupplier,namaSubSupplier,pcsPerPack,packPerDos\n";
    const exampleRow = "899123,1899123,Indomie Goreng,Makanan,SUP-INDFOOD,,40,1\n";
    const csvContent = csvHeader + exampleRow;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "contoh_master_barang.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: async (results) => {
        const itemsToImport = results.data;
        let successCount = 0; let errorCount = 0; let errorMessages = [];
        for (const item of itemsToImport) {
          if (!item.namaBarang || !item.kategori || !item.idSupplier) {
            errorCount++; errorMessages.push(`Data tidak lengkap untuk: ${item.namaBarang || 'Tanpa Nama'}`);
            continue;
          }
          const itemId = item.barcodePcs || push(ref(db, 'master_items')).key;
          const itemRef = ref(db, `master_items/${itemId}`);
          const snapshot = await get(itemRef);
          if (snapshot.exists()) {
            errorCount++; errorMessages.push(`Duplikat Barcode PCS: ${item.barcodePcs}`);
            continue;
          }
          const supplierData = suppliers.find(s => s.id === item.idSupplier);
          if (!supplierData) {
            errorCount++; errorMessages.push(`Supplier ID tidak ditemukan: ${item.idSupplier} untuk barang ${item.namaBarang}`);
            continue;
          }
          const pcsPerPackNum = Number(item.pcsPerPack) || 1;
          const packPerDosNum = Number(item.packPerDos) || 1;
          try {
            await set(itemRef, {
              name: item.namaBarang, category: item.kategori, supplierId: item.idSupplier,
              supplierName: supplierData.name, subSupplierName: item.namaSubSupplier || null,
              barcodePcs: item.barcodePcs || null, barcodeDos: item.barcodeDos || null,
              baseUnit: 'Pcs', conversions: { Pack: { inPcs: pcsPerPackNum }, Dos: { inPcs: pcsPerPackNum * packPerDosNum } }
            });
            successCount++;
          } catch (err) {
            errorCount++; errorMessages.push(`Gagal menyimpan ke DB: ${item.namaBarang}`);
            console.error("Gagal impor item:", item.namaBarang, err);
          }
        }
        alert(`Proses impor selesai.\nBerhasil: ${successCount}\nGagal/Duplikat: ${errorCount}\n\nDetail Kegagalan:\n${errorMessages.join('\n')}`);
      }
    });
    event.target.value = null;
  };

  const handleOpenEditModal = (item) => {
    setEditingItem(item);
    setEditedItemData({
      name: item.name || '', category: item.category || '', supplierId: item.supplierId || '',
      barcodePcs: item.barcodePcs || '', barcodeDos: item.barcodeDos || '',
      pcsPerPack: item.conversions?.Pack?.inPcs || '',
      packPerDos: item.conversions?.Dos?.inPcs ? (item.conversions.Dos.inPcs / (item.conversions.Pack.inPcs || 1)) : '',
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateItem = async () => {
    if (!editedItemData.name) {
      alert("Nama barang tidak boleh kosong.");
      return;
    }
    const itemRef = ref(db, `master_items/${editingItem.id}`);
    const pcsPerPackNum = Number(editedItemData.pcsPerPack) || 1;
    const packPerDosNum = Number(editedItemData.packPerDos) || 1;
    const selectedSupplier = suppliers.find(s => s.id === editedItemData.supplierId);
    const updatedData = {
      name: editedItemData.name, category: editedItemData.category,
      supplierId: editedItemData.supplierId, supplierName: selectedSupplier.name,
      barcodePcs: editedItemData.barcodePcs || null, barcodeDos: editedItemData.barcodeDos || null,
      conversions: { Pack: { inPcs: pcsPerPackNum }, Dos: { inPcs: pcsPerPackNum * packPerDosNum } }
    };
    try {
      await update(itemRef, updatedData);
      alert(`Barang "${editedItemData.name}" berhasil diperbarui.`);
      setIsEditModalOpen(false);
    } catch (err) {
      alert("Gagal memperbarui barang.");
      console.error(err);
    }
  };

  const handleEditFormChange = (e) => {
    const { name, value } = e.target;
    setEditedItemData(prev => ({ ...prev, [name]: value }));
  };

  const subSuppliers = suppliers.find(s => s.id === selectedSupplierId)?.subSuppliers || {};
  const ScanIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
  );
  return (
    <>
      {showScanner && (
        <CameraBarcodeScanner onScan={handleScanResult} onClose={() => setShowScanner(false)} />
      )}
      <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <form onSubmit={handleSubmit} className="card bg-white shadow-lg p-6 space-y-2">
             <h2 className="card-title">Tambah Master Barang</h2>
            {success && <div role="alert" className="alert alert-success text-sm p-2"><span>{success}</span></div>}
            {error && <div role="alert" className="alert alert-error text-sm p-2"><span>{error}</span></div>}
            <div className="form-control"><label className="label"><span className="label-text font-bold">Nama Barang</span></label><input type="text" placeholder="Nama produk" value={name} onChange={e => setName(e.target.value)} className="input input-bordered" /></div>
            <div className="form-control">
              <label className="label"><span className="label-text font-bold">Kategori</span></label>
              <select className="select select-bordered" value={category} onChange={e => setCategory(e.target.value)}>
                <option value="">Pilih Kategori</option>
                {categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
              </select>
            </div>
            <div className="form-control"><label className="label"><span className="label-text font-bold">Supplier Utama</span></label><select className="select select-bordered" value={selectedSupplierId} onChange={e => setSelectedSupplierId(e.target.value)}><option value="">Pilih Supplier</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            {Object.keys(subSuppliers).length > 0 && <div className="form-control"><label className="label"><span className="label-text">Sub-supplier (Opsional)</span></label><select className="select select-bordered" value={selectedSubSupplierName} onChange={e => setSelectedSubSupplierName(e.target.value)}><option value="">Pilih Sub-supplier</option>{Object.values(subSuppliers).map(sub=><option key={sub.name} value={sub.name}>{sub.name}</option>)}</select></div>}
            <div className="divider text-xs">Info Tambahan (Opsional)</div>
            <div className="form-control">
              <label className="label"><span className="label-text">Barcode PCS</span></label>
              <div className="join">
                <input type="text" placeholder="Scan atau ketik manual" value={barcodePcs} onChange={e => setBarcodePcs(e.target.value)} className="input input-bordered join-item w-full" />
                <button type="button" onClick={() => openScanner('pcs')} className="btn join-item btn-primary"><ScanIcon /></button>
              </div>
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Barcode DOS</span></label>
              <div className="join">
                <input type="text" placeholder="Scan atau ketik manual" value={barcodeDos} onChange={e => setBarcodeDos(e.target.value)} className="input input-bordered join-item w-full" />
                <button type="button" onClick={() => openScanner('dos')} className="btn join-item btn-primary"><ScanIcon /></button>
              </div>
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
                <div>
                  <label className="label-text">Cari Nama Barang</label>
                  <input type="text" placeholder="Ketik untuk mencari..." className="input input-bordered w-full" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <div>
                  <label className="label-text">Filter Kategori</label>
                  <select className="select select-bordered w-full" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                    <option value="">Semua Kategori</option>
                    {categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label-text">Filter Supplier</label>
                  <select className="select select-bordered w-full" value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)}>
                    <option value="">Semua Supplier</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
          </div>
          <div className="overflow-x-auto bg-white rounded-lg shadow-lg">
            <table className="table w-full">
              <thead className="bg-gray-200">
                <tr><th>Nama Barang</th><th>Kategori</th><th>Supplier</th><th>Aksi</th></tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="4" className="text-center"><span className="loading loading-dots"></span></td></tr>
                ) : (
                  filteredItems.map(item => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>{item.category}</td>
                      <td>{item.supplierName}</td>
                      <td>
                        <button onClick={() => handleOpenEditModal(item)} className="btn btn-xs btn-info">Edit</button>
                      </td>
                    </tr>
                  ))
                )}
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