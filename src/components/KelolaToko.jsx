import React, { useState, useEffect, useRef } from 'react';
import { ref, onValue, set, get, update, remove } from 'firebase/database';
import { db } from '../firebaseConfig';
import toast from 'react-hot-toast';
import Papa from 'papaparse'; // Library untuk membaca CSV

function KelolaToko() {
  const [tokoList, setTokoList] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [filteredToko, setFilteredToko] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef(null); // Ref untuk input file

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
        {/* ... Form Tambah Toko tidak berubah ... */}
      </div>
      
      <div className="lg:col-span-2">
          <div className="card bg-white shadow-lg p-4 mb-6">
            <div className="form-control">
              <label className="label-text">Cari Toko (Nama atau ID)</label>
              <input type="text" placeholder="Ketik untuk mencari..." className="input input-bordered w-full" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
          </div>
          
          {/* --- TOMBOL-TOMBOL BARU ADA DI SINI --- */}
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
            {/* ... Tabel daftar toko tidak berubah ... */}
          </div>
        </div>

      {isEditModalOpen && editingToko && (
        <div className="modal modal-open">
          {/* ... Modal Edit tidak berubah ... */}
        </div>
      )}
    </>
  );
}

export default KelolaToko;
