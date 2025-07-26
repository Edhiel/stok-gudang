import React, 'useState', useEffect, useRef } from 'react';
import { ref, onValue, set, get, update, remove } from 'firebase/database';
import { db } from '../firebaseConfig';
import toast from 'react-hot-toast';
import Papa from 'papaparse';

function KelolaToko() {
  const [tokoList, setTokoList] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [filteredToko, setFilteredToko] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef(null);

  // State untuk form tambah
  const [idToko, setIdToko] = useState('');
  const [namaToko, setNamaToko] = useState('');
  const [alamat, setAlamat] = useState('');
  const [telepon, setTelepon] = useState('');
  const [pemilik, setPemilik] = useState('');
  const [selectedDivisi, setSelectedDivisi] = useState('');
  const [selectedProductGroup, setSelectedProductGroup] = useState('');
  
  // State untuk modal edit
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingToko, setEditingToko] = useState(null);
  const [editedData, setEditedData] = useState({});

  useEffect(() => {
    const tokoRef = ref(db, 'master_toko');
    const suppliersRef = ref(db, 'suppliers');

    onValue(tokoRef, (snapshot) => {
      const data = snapshot.val() || {};
      const loadedToko = Object.keys(data).map(key => ({ id: key, ...data[key] }));
      setTokoList(loadedToko);
    });

    onValue(suppliersRef, (snapshot) => {
      const data = snapshot.val() || {};
      const loadedSuppliers = Object.keys(data).map(key => ({ id: key, ...data[key] }));
      setSuppliers(loadedSuppliers);
    });

    setLoading(false);
  }, []);

  useEffect(() => {
    let filtered = [...tokoList];
    if (searchTerm) {
      filtered = filtered.filter(toko =>
        toko.namaToko.toLowerCase().includes(searchTerm.toLowerCase()) ||
        toko.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    setFilteredToko(filtered.sort((a, b) => a.namaToko.localeCompare(b.namaToko)));
  }, [searchTerm, tokoList]);

  const resetForm = () => {
    setIdToko(''); setNamaToko(''); setAlamat('');
    setTelepon(''); setPemilik(''); setSelectedDivisi('');
    setSelectedProductGroup('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!idToko || !namaToko || !alamat || !selectedDivisi) {
      return toast.error("ID Toko, Nama Toko, Alamat, dan Divisi wajib diisi.");
    }
    const newTokoRef = ref(db, `master_toko/${idToko.toUpperCase()}`);
    const snapshot = await get(newTokoRef);
    if (snapshot.exists()) {
      return toast.error(`ID Toko "${idToko.toUpperCase()}" sudah terdaftar.`);
    }
    try {
      const divisiData = suppliers.find(s => s.id === selectedDivisi);
      await set(newTokoRef, { 
        namaToko, alamat, telepon, pemilik, 
        divisiId: selectedDivisi,
        divisiName: divisiData.name,
        productGroup: selectedProductGroup
      });
      toast.success("Toko baru berhasil ditambahkan.");
      resetForm();
    } catch (error) { toast.error("Gagal menambahkan toko."); }
  };
  
  const handleDelete = (toko) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus "${toko.namaToko}"?`)) {
        const tokoRef = ref(db, `master_toko/${toko.id}`);
        remove(tokoRef)
            .then(() => toast.success("Toko berhasil dihapus."))
            .catch(() => toast.error("Gagal menghapus toko."));
    }
  };
  
  const openEditModal = (toko) => {
    setEditingToko(toko);
    setEditedData({
        namaToko: toko.namaToko, alamat: toko.alamat,
        telepon: toko.telepon || '', pemilik: toko.pemilik || '',
        divisiId: toko.divisiId || '', productGroup: toko.productGroup || ''
    });
    setIsEditModalOpen(true);
  };

  const handleUpdate = async () => {
    if (!editedData.namaToko || !editedData.alamat || !editedData.divisiId) {
        return toast.error("Nama Toko, Alamat, dan Divisi wajib diisi.");
    }
    const tokoRef = ref(db, `master_toko/${editingToko.id}`);
    try {
        const divisiData = suppliers.find(s => s.id === editedData.divisiId);
        await update(tokoRef, { ...editedData, divisiName: divisiData.name });
        toast.success("Data toko berhasil diperbarui.");
        setIsEditModalOpen(false);
        setEditingToko(null);
    } catch (error) { toast.error("Gagal memperbarui data toko."); }
  };

  const handleDownloadTemplate = () => {
    const csvHeader = "idToko,namaToko,alamat,telepon,pemilik,divisiId,productGroup\n";
    const exampleRow = "T-SLY-001,TOKO MAJU JAYA,JLN. KEMERDEKAAN NO. 10 SELAYAR,08123456789,Bapak Jaya,DIV001,GROUP1\n";
    const blob = new Blob([csvHeader + exampleRow], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", "template_master_toko.csv");
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
          const tokoId = item.idToko?.toUpperCase();
          if (!tokoId || !item.namaToko || !item.alamat) {
            errorCount++; errorMessages.push(`Data tidak lengkap untuk ID: ${tokoId || 'Kosong'}`);
            continue;
          }
          
          const divisiData = suppliers.find(s => s.id === item.divisiId);
          if (!divisiData) {
            errorCount++; errorMessages.push(`Divisi ID tidak valid: ${item.divisiId} untuk toko ${item.namaToko}`);
            continue;
          }

          const tokoRef = ref(db, `master_toko/${tokoId}`);
          const dataToSave = {
            namaToko: item.namaToko, alamat: item.alamat,
            telepon: item.telepon || '', pemilik: item.pemilik || '',
            divisiId: item.divisiId, divisiName: divisiData.name,
            productGroup: item.productGroup || ''
          };

          try {
            await set(tokoRef, dataToSave); // set akan membuat baru atau menimpa (update)
            successCount++;
          } catch (err) {
            errorCount++; errorMessages.push(`Gagal menyimpan ke DB: ${tokoId}`);
          }
        }
        alert(`Proses impor selesai.\nBerhasil Ditambah/Diperbarui: ${successCount}\nGagal: ${errorCount}\n\nDetail Kegagalan:\n${errorMessages.join('\n')}`);
      }
    });
    event.target.value = null;
  };


  const selectedSupplierForForm = suppliers.find(s => s.id === selectedDivisi);
  const subSuppliersForForm = selectedSupplierForForm?.subSuppliers || {};
  const selectedSupplierForEdit = suppliers.find(s => s.id === editedData.divisiId);
  const subSuppliersForEdit = selectedSupplierForEdit?.subSuppliers || {};

  return (
    <>
      <div className="p-4 sm:p-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <form onSubmit={handleSubmit} className="card bg-white shadow-lg p-6 space-y-2">
            <h2 className="card-title">Tambah Toko Baru</h2>
            <div className="form-control"><label className="label"><span className="label-text font-bold">ID Toko</span></label><input type="text" value={idToko} onChange={e => setIdToko(e.target.value)} placeholder="Contoh: T-BKM-001" className="input input-bordered" /></div>
            <div className="form-control"><label className="label"><span className="label-text font-bold">Nama Toko</span></label><input type="text" value={namaToko} onChange={e => setNamaToko(e.target.value)} placeholder="Nama lengkap toko" className="input input-bordered" /></div>
            <div className="form-control"><label className="label"><span className="label-text font-bold">Alamat</span></label><textarea value={alamat} onChange={e => setAlamat(e.target.value)} className="textarea textarea-bordered" placeholder="Alamat lengkap"></textarea></div>
            <div className="form-control"><label className="label"><span className="label-text font-bold">Divisi (Supplier)</span></label><select className="select select-bordered" value={selectedDivisi} onChange={e => {setSelectedDivisi(e.target.value); setSelectedProductGroup('');}}><option value="">Pilih Divisi</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            {Object.keys(subSuppliersForForm).length > 0 && <div className="form-control"><label className="label"><span className="label-text font-bold">Product Group (Sub-Supplier)</span></label><select className="select select-bordered" value={selectedProductGroup} onChange={e => setSelectedProductGroup(e.target.value)}><option value="">Pilih Product Group</option>{Object.values(subSuppliersForForm).map(sub => <option key={sub.name} value={sub.name}>{sub.name}</option>)}</select></div>}
            <div className="divider text-xs">Info Tambahan (Opsional)</div>
            <div className="form-control"><label className="label"><span className="label-text">No. Telepon</span></label><input type="text" value={telepon} onChange={e => setTelepon(e.target.value)} placeholder="Nomor telepon/HP" className="input input-bordered" /></div>
            <div className="form-control"><label className="label"><span className="label-text">Nama Pemilik</span></label><input type="text" value={pemilik} onChange={e => setPemilik(e.target.value)} placeholder="Nama pemilik toko" className="input input-bordered" /></div>
            <div className="form-control mt-4"><button type="submit" className="btn btn-primary">Simpan Toko</button></div>
          </form>
        </div>

        <div className="lg:col-span-2">
          <div className="card bg-white shadow-lg p-4 mb-6"><div className="form-control"><label className="label-text">Cari Toko (Nama atau ID)</label><input type="text" placeholder="Ketik untuk mencari..." className="input input-bordered w-full" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div></div>
          
          <div className="flex flex-wrap gap-2 mb-4">
              <button onClick={handleDownloadTemplate} className="btn btn-sm btn-outline btn-info">
                Unduh Template CSV
              </button>
              <button onClick={() => fileInputRef.current.click()} className="btn btn-sm btn-outline btn-success">
                Impor dari CSV
              </button>
              <input 
                type="file" 
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileUpload}
                accept=".csv"
              />
          </div>

          <div className="overflow-x-auto bg-white rounded-lg shadow-lg">
            <table className="table w-full">
              <thead className="bg-gray-200"><tr><th>ID Toko</th><th>Nama Toko</th><th>Divisi</th><th>Product Group</th><th>Aksi</th></tr></thead>
              <tbody>
                {loading ? (<tr><td colSpan="5" className="text-center"><span className="loading loading-dots"></span></td></tr>) 
                : (filteredToko.map(toko => (
                    <tr key={toko.id} className="hover">
                      <td className="font-bold">{toko.id}</td>
                      <td>{toko.namaToko}</td>
                      <td>{toko.divisiName}</td>
                      <td>{toko.productGroup}</td>
                      <td className="flex gap-2"><button onClick={() => openEditModal(toko)} className="btn btn-xs btn-info">Edit</button><button onClick={() => handleDelete(toko)} className="btn btn-xs btn-error">Hapus</button></td>
                    </tr>
                  )))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      {isEditModalOpen && editingToko && (
        <div className="modal modal-open">
          <div className="modal-box"><h3 className="font-bold text-lg">Edit Toko: {editingToko.namaToko}</h3>
            <div className="py-4 space-y-4">
                <div className="form-control"><label className="label-text">Nama Toko</label><input type="text" value={editedData.namaToko} onChange={e => setEditedData({...editedData, namaToko: e.target.value})} className="input input-bordered" /></div>
                <div className="form-control"><label className="label-text">Alamat</label><textarea value={editedData.alamat} onChange={e => setEditedData({...editedData, alamat: e.target.value})} className="textarea textarea-bordered"></textarea></div>
                <div className="form-control"><label className="label-text">Divisi (Supplier)</label><select className="select select-bordered" value={editedData.divisiId} onChange={e => setEditedData({...editedData, divisiId: e.target.value, productGroup: ''})}><option value="">Pilih Divisi</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                {Object.keys(subSuppliersForEdit).length > 0 && <div className="form-control"><label className="label-text">Product Group (Sub-Supplier)</label><select className="select select-bordered" value={editedData.productGroup} onChange={e => setEditedData({...editedData, productGroup: e.target.value})}><option value="">Pilih Product Group</option>{Object.values(subSuppliersForEdit).map(sub => <option key={sub.name} value={sub.name}>{sub.name}</option>)}</select></div>}
                <div className="form-control"><label className="label-text">No. Telepon</label><input type="text" value={editedData.telepon} onChange={e => setEditedData({...editedData, telepon: e.target.value})} className="input input-bordered" /></div>
                <div className="form-control"><label className="label-text">Nama Pemilik</label><input type="text" value={editedData.pemilik} onChange={e => setEditedData({...editedData, pemilik: e.target.value})} className="input input-bordered" /></div>
            </div>
            <div className="modal-action"><button onClick={handleUpdate} className="btn btn-primary">Simpan</button><button onClick={() => setIsEditModalOpen(false)} className="btn">Batal</button></div>
          </div>
        </div>
      )}
    </>
  );
}

export default KelolaToko;
