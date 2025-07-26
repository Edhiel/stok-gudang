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
  const [kodeInternal, setKodeInternal] = useState('');
  const [category, setCategory] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedSubSupplierName, setSelectedSubSupplierName] = useState('');
  const [barcodePcs, setBarcodePcs] = useState('');
  const [barcodeDos, setBarcodeDos] = useState('');
  const [pcsPerPack, setPcsPerPack] = useState('');
  const [packPerDos, setPackPerDos] = useState('');
  
  // State untuk modal edit
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editedItemData, setEditedItemData] = useState({});
  
  // State untuk notifikasi dan scanner
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [scanningFor, setScanningFor] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const masterItemsRef = ref(db, 'master_items/');
    onValue(masterItemsRef, (snapshot) => {
      const data = snapshot.val() || {};
      const itemList = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
      setMasterItems(itemList);
    });
    const suppliersRef = ref(db, 'suppliers/');
    onValue(suppliersRef, (snapshot) => {
      const data = snapshot.val() || {};
      setSuppliers(data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : []);
    });
    const categoriesRef = ref(db, 'categories/');
    onValue(categoriesRef, (snapshot) => {
      const data = snapshot.val() || {};
      const loadedCategories = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
      setCategories(loadedCategories);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    let items = [...masterItems];
    if (searchTerm) {
      items = items.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
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
    if (scanningFor === 'pcs') setBarcodePcs(scannedCode);
    else if (scanningFor === 'dos') setBarcodeDos(scannedCode);
    setShowScanner(false);
  };
  
  const resetForm = () => { 
    setName(''); setKodeInternal(''); setCategory(''); setSelectedSupplierId(''); 
    setSelectedSubSupplierName(''); setBarcodePcs(''); setBarcodeDos(''); 
    setPcsPerPack(''); setPackPerDos(''); 
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!name || !kodeInternal || !category || !selectedSupplierId) {
      setError("Nama Barang, Kode Internal, Kategori, dan Supplier wajib diisi!");
      return;
    }
    const itemId = barcodePcs || kodeInternal.toUpperCase();
    const itemRef = ref(db, `master_items/${itemId}`);
    
    const snapshot = await get(itemRef);
    if (snapshot.exists()) {
        setError("Barcode PCS atau Kode Internal ini sudah terdaftar.");
        return;
    }

    const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);
    const pcsPerPackNum = Number(pcsPerPack) || 1;
    const packPerDosNum = Number(packPerDos) || 1;

    try {
      await set(itemRef, {
        name, kodeInternal: kodeInternal.toUpperCase(), category,
        supplierId: selectedSupplier.id, supplierName: selectedSupplier.name,
        subSupplierName: selectedSubSupplierName || null,
        barcodePcs: barcodePcs || null, barcodeDos: barcodeDos || null,
        baseUnit: 'Pcs',
        conversions: { Pack: { inPcs: pcsPerPackNum }, Dos: { inPcs: pcsPerPackNum * packPerDosNum } }
      });
      setSuccess(`Barang "${name}" berhasil ditambahkan.`);
      resetForm();
    } catch(err) { setError("Gagal menambahkan barang."); }
  };
  
  const handleDownloadTemplate = () => {
    const csvHeader = "kodeInternal,barcodePcs,barcodeDos,namaBarang,kategori,idSupplier,namaSubSupplier,pcsPerPack,packPerDos\n";
    const exampleRow = "M411158,899123,1899123,Indomie Goreng,Makanan,SUP-INDFOOD,,40,1\n";
    const csvContent = csvHeader + exampleRow;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "template_master_barang.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportAll = () => {
    if (masterItems.length === 0) {
        return toast.error("Tidak ada data master barang untuk diekspor.");
    }
    const dataToExport = masterItems.map(item => ({
        kodeInternal: item.kodeInternal || '',
        barcodePcs: item.barcodePcs || '',
        barcodeDos: item.barcodeDos || '',
        namaBarang: item.name || '',
        kategori: item.category || '',
        idSupplier: item.supplierId || '',
        namaSubSupplier: item.subSupplierName || '',
        pcsPerPack: item.conversions?.Pack?.inPcs || '',
        packPerDos: item.conversions?.Dos?.inPcs ? (item.conversions.Dos.inPcs / (item.conversions.Pack?.inPcs || 1)) : '',
    }));
    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", "master_barang_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Master Barang berhasil diekspor!");
  };
  
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: async (results) => {
        const itemsToImport = results.data;
        let successCount = 0; let errorCount = 0; let errorMessages = [];
        let lastSupplierId = ''; let lastCategory = '';

        for (const item of itemsToImport) {
          if (item.idSupplier) lastSupplierId = item.idSupplier;
          else item.idSupplier = lastSupplierId;

          if (item.kategori) lastCategory = item.kategori;
          else item.kategori = lastCategory;
          
          const itemId = item.barcodePcs || item.kodeInternal?.toUpperCase();
          if (!item.namaBarang || !item.kategori || !item.idSupplier || !item.kodeInternal) {
            errorCount++; errorMessages.push(`Data tidak lengkap: ${item.namaBarang || item.kodeInternal || 'Tanpa Nama'}`);
            continue;
          }
          const itemRef = ref(db, `master_items/${itemId}`);
          const supplierData = suppliers.find(s => s.id === item.idSupplier);
          if (!supplierData) {
            errorCount++; errorMessages.push(`Supplier ID tidak valid: ${item.idSupplier} untuk ${item.namaBarang}`);
            continue;
          }

          const pcsPerPackNum = Number(item.pcsPerPack) || 1;
          const packPerDosNum = Number(item.packPerDos) || 1;
          const dataToSave = {
              name: item.namaBarang, kodeInternal: item.kodeInternal.toUpperCase(), category: item.kategori,
              supplierId: item.idSupplier, supplierName: supplierData.name, subSupplierName: item.namaSubSupplier || null,
              barcodePcs: item.barcodePcs || null, barcodeDos: item.barcodeDos || null, baseUnit: 'Pcs',
              conversions: { Pack: { inPcs: pcsPerPackNum }, Dos: { inPcs: pcsPerPackNum * packPerDosNum } }
          };
          try {
            await set(itemRef, dataToSave);
            successCount++;
          } catch (err) {
            errorCount++; errorMessages.push(`Gagal menyimpan: ${item.namaBarang}`);
          }
        }
        alert(`Impor selesai.\nBerhasil Ditambah/Diperbarui: ${successCount}\nGagal: ${errorCount}\n\nDetail Kegagalan:\n${errorMessages.slice(0,10).join('\n')}`);
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
      packPerDos: item.conversions?.Dos?.inPcs ? (item.conversions.Dos.inPcs / (item.conversions.Pack?.inPcs || 1)) : '',
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateItem = async () => {
    if (!editedItemData.name) {
      alert("Nama barang tidak boleh kosong."); return;
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
      toast.success(`Barang "${editedItemData.name}" berhasil diperbarui.`);
      setIsEditModalOpen(false);
    } catch (err) { alert("Gagal memperbarui barang."); }
  };

  const handleEditFormChange = (e) => {
    const { name, value } = e.target;
    setEditedItemData(prev => ({ ...prev, [name]: value }));
  };

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
            <div className="form-control"><label className="label"><span className="label-text font-bold">Nama Barang</span></label><input type="text" placeholder="Nama produk" value={name} onChange={e => setName(e.target.value)} className="input input-bordered" /></div>
            <div className="form-control"><label className="label"><span className="label-text font-bold">Kode Internal (ND6)</span></label><input type="text" placeholder="Kode produk dari ND6" value={kodeInternal} onChange={e => setKodeInternal(e.target.value)} className="input input-bordered" /></div>
            <div className="form-control"><label className="label"><span className="label-text font-bold">Kategori</span></label><select className="select select-bordered" value={category} onChange={e => setCategory(e.target.value)}><option value="">Pilih Kategori</option>{categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}</select></div>
            <div className="form-control"><label className="label"><span className="label-text font-bold">Supplier Utama</span></label><select className="select select-bordered" value={selectedSupplierId} onChange={e => setSelectedSupplierId(e.target.value)}><option value="">Pilih Supplier</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            {Object.keys(subSuppliers).length > 0 && <div className="form-control"><label className="label"><span className="label-text">Sub-supplier (Opsional)</span></label><select className="select select-bordered" value={selectedSubSupplierName} onChange={e => setSelectedSubSupplierName(e.target.value)}><option value="">Pilih Sub-supplier</option>{Object.values(subSuppliers).map(sub=><option key={sub.name} value={sub.name}>{sub.name}</option>)}</select></div>}
            <div className="divider text-xs">Info Tambahan (Opsional)</div>
            <div className="form-control"><label className="label"><span className="label-text">Barcode PCS</span></label><div className="join"><input type="text" placeholder="Scan atau ketik manual" value={barcodePcs} onChange={e => setBarcodePcs(e.target.value)} className="input input-bordered join-item w-full" /><button type="button" onClick={() => openScanner('pcs')} className="btn join-item btn-primary"><ScanIcon /></button></div></div>
            <div className="form-control"><label className="label"><span className="label-text">Barcode DOS</span></label><div className="join"><input type="text" placeholder="Scan atau ketik manual" value={barcodeDos} onChange={e => setBarcodeDos(e.target.value)} className="input input-bordered join-item w-full" /><button type="button" onClick={() => openScanner('dos')} className="btn join-item btn-primary"><ScanIcon /></button></div></div>
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
              <button onClick={handleDownloadTemplate} className="btn btn-sm btn-outline btn-info">Unduh Template</button>
              <button onClick={() => fileInputRef.current.click()} className="btn btn-sm btn-outline btn-success">Impor dari CSV</button>
              <button onClick={handleExportAll} className="btn btn-sm btn-outline btn-primary">Ekspor Semua ke CSV</button>
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept=".csv"/>
          </div>
          <div className="overflow-x-auto bg-white rounded-lg shadow-lg">
            <table className="table w-full">
              <thead className="bg-gray-200">
                <tr><th>Nama Barang</th><th>Kode Internal</th><th>Kategori</th><th>Supplier</th><th>Aksi</th></tr>
              </thead>
              <tbody>
                {loading ? (<tr><td colSpan="5" className="text-center"><span className="loading loading-dots"></span></td></tr>) 
                : (filteredItems.map(item => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td className="font-mono text-xs">{item.kodeInternal}</td>
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
          <div className="modal-box w-11/2 max-w-2xl">
            <h3 className="font-bold text-lg">Edit Master Barang: {editingItem.name}</h3>
            <div className="py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="form-control"><label className="label"><span className="label-text">Kode Internal (ND6) - Tidak bisa diubah</span></label><input type="text" readOnly value={editingItem.kodeInternal || ''} className="input input-bordered bg-gray-200 cursor-not-allowed" /></div>
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
