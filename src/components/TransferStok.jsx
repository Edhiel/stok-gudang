import React, { useState, useEffect } from 'react';
import { ref, onValue, get } from 'firebase/database';
import { db } from '../firebaseConfig';
import CameraBarcodeScanner from './CameraBarcodeScanner';
import toast from 'react-hot-toast';

function TransferStok({ userProfile }) {
  const [loading, setLoading] = useState(true);
  const [allDepots, setAllDepots] = useState([]);
  const [availableItems, setAvailableItems] = useState([]);
  const [suratJalan, setSuratJalan] = useState('');
  const [destinationDepot, setDestinationDepot] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemStock, setItemStock] = useState(0);
  const [dosQty, setDosQty] = useState(0);
  const [packQty, setPackQty] = useState(0);
  const [pcsQty, setPcsQty] = useState(0);
  const [transferItems, setTransferItems] = useState([]);
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    if (!userProfile || !userProfile.depotId) return;

    const depotsRef = ref(db, 'depots');
    onValue(depotsRef, (snapshot) => {
      const data = snapshot.val() || {};
      const depotList = Object.keys(data)
        .filter(key => key !== userProfile.depotId)
        .map(key => ({ id: key, name: data[key].info.name }));
      setAllDepots(depotList);
    });

    const masterItemsRef = ref(db, 'master_items');
    get(masterItemsRef).then((masterSnapshot) => {
      const masterItems = masterSnapshot.val() || {};
      const stockRef = ref(db, `depots/${userProfile.depotId}/stock`);
      onValue(stockRef, (stockSnapshot) => {
        const stockData = stockSnapshot.val() || {};
        const available = Object.keys(stockData)
          .filter(itemId => (stockData[itemId].totalStockInPcs || 0) > 0)
          .map(itemId => ({ id: itemId, ...masterItems[itemId], totalStockInPcs: stockData[itemId].totalStockInPcs }));
        setAvailableItems(available);
        setLoading(false);
      });
    });
  }, [userProfile]);

  const handleBarcodeDetected = (scannedBarcode) => {
    const foundItem = availableItems.find(item => item.barcodePcs === scannedBarcode || item.barcodeDos === scannedBarcode);
    if (foundItem) handleSelectItem(foundItem); else toast.error("Barang tidak ditemukan atau stok kosong.");
    setShowScanner(false);
  };

  const handleSelectItem = (item) => {
    setSelectedItem(item);
    setSearchTerm(item.name);
    setItemStock(item.totalStockInPcs);
  };

  const handleAddItemToList = () => {
    if (!selectedItem) { toast.error("Pilih barang dulu."); return; }
    const totalPcs = (Number(dosQty) * (selectedItem.conversions.Dos?.inPcs || 1)) + (Number(packQty) * (selectedItem.conversions.Pack?.inPcs || 1)) + (Number(pcsQty));
    if (totalPcs <= 0) { toast.error("Masukkan jumlah yang valid."); return; }
    if (totalPcs > itemStock) {
      toast.error(`Stok tidak cukup! Sisa stok hanya ${itemStock} Pcs.`);
      return;
    }
    setTransferItems([...transferItems, { id: selectedItem.id, name: selectedItem.name, quantityInPcs: totalPcs, displayQty: `${dosQty}.${packQty}.${pcsQty}` }]);
    setSelectedItem(null); setSearchTerm(''); setDosQty(0); setPackQty(0); setPcsQty(0);
  };

  const handleRemoveFromList = (indexToRemove) => {
    setTransferItems(transferItems.filter((_, index) => index !== indexToRemove));
  };
  
  const handleSaveDraft = async () => {
    if (!suratJalan || !destinationDepot || transferItems.length === 0) {
      toast.error("No. Surat Jalan, Depo Tujuan, dan minimal 1 barang wajib diisi.");
      return;
    }
    toast.success("Draft transfer berhasil disimpan! (Fitur belum selesai)");
    console.log({ suratJalan, fromDepot: userProfile.depotId, toDepot: destinationDepot, items: transferItems });
  };
  
  const handlePrint = () => {
    if (transferItems.length === 0) {
      toast.error("Tidak ada barang dalam daftar untuk dicetak.");
      return;
    }
    window.print();
  };

  const filteredItems = searchTerm.length > 0 
    ? availableItems.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : [];

  return (
    <>
      {showScanner && <CameraBarcodeScanner onScan={handleBarcodeDetected} onClose={() => setShowScanner(false)} />}
      
      <div className="hidden print:block p-4">
        <div className="flex items-center justify-center mb-4 border-b-2 border-black pb-2">
          <img src="/logo_bulet_mhm.gif" alt="Logo Perusahaan" className="h-20 w-20 mr-4" />
          <div>
            <h1 className="text-2xl font-bold">PT. Mahameru Mitra Makmur</h1>
            <p className="text-center">Depo Asal: {userProfile.depotId}</p>
          </div>
        </div>
        <h2 className="text-xl font-semibold mt-4 text-center">SURAT JALAN TRANSFER</h2>
        <div className="flex justify-between text-sm my-4">
          <div>
            <p><strong>No. Surat Jalan:</strong> {suratJalan}</p>
            <p><strong>Depo Tujuan:</strong> {allDepots.find(d => d.id === destinationDepot)?.name || destinationDepot}</p>
          </div>
          <div>
            <p><strong>Tanggal:</strong> {new Date().toLocaleDateString('id-ID')}</p>
          </div>
        </div>
        <table className="table w-full table-compact">
          <thead><tr><th>No.</th><th>Nama Barang</th><th>Jumlah</th></tr></thead>
          <tbody>
            {transferItems.map((item, index) => (
              <tr key={index}>
                <td>{index + 1}</td>
                <td>{item.name}</td>
                <td>{item.displayQty}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-around mt-16 text-center text-sm">
          <div><p className="mb-16">(______________________)</p><p>Kepala Depo</p></div>
          <div><p className="mb-16">(______________________)</p><p>Admin</p></div>
          <div><p className="mb-16">(______________________)</p><p>Kepala Gudang</p></div>
        </div>
      </div>
      
      <div className="p-8 print:hidden">
        <div className="card bg-white shadow-lg w-full">
          <div className="card-body">
            <div className="flex justify-between items-center">
              <h2 className="card-title text-2xl">Buat Surat Jalan Transfer Antar Depo</h2>
              <button className="btn btn-info" onClick={handlePrint} disabled={transferItems.length === 0}>Cetak Surat Jalan</button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-4 border rounded-lg">
              <div className="form-control">
                <label className="label"><span className="label-text font-bold">No. Surat Jalan</span></label>
                <input type="text" value={suratJalan} onChange={(e) => setSuratJalan(e.target.value)} className="input input-bordered" />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text font-bold">Depo Tujuan</span></label>
                <select value={destinationDepot} onChange={(e) => setDestinationDepot(e.target.value)} className="select select-bordered">
                  <option value="">Pilih Depo Tujuan</option>
                  {allDepots.map(depot => <option key={depot.id} value={depot.id}>{depot.name}</option>)}
                </select>
              </div>
            </div>

            <div className="divider">Detail Barang</div>
            <div className="p-4 border rounded-lg bg-base-200">
              <div className="form-control dropdown">
                <label className="label"><span className="label-text">Cari Barang (Scan atau Ketik Nama)</span></label>
                <div className="join w-full">
                  <input type="text" placeholder="Hanya barang dengan stok tersedia akan muncul..." className="input input-bordered join-item w-full" value={searchTerm} onChange={(e) => {setSearchTerm(e.target.value); setSelectedItem(null);}}/>
                  <button type="button" onClick={() => setShowScanner(true)} className="btn btn-primary join-item">Scan</button>
                </div>
                {filteredItems.length > 0 && !selectedItem && (
                  <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-full max-h-60 overflow-y-auto">
                    {filteredItems.slice(0, 5).map(item => (
                      <li key={item.id}><a onClick={() => handleSelectItem(item)}>{item.name} (Stok: {item.totalStockInPcs})</a></li>
                    ))}
                  </ul>
                )}
              </div>
              {selectedItem && (
                <div className="mt-4">
                  <p className="font-bold">Barang Terpilih: {selectedItem.name}</p>
                  <p className="text-sm">Sisa Stok Tersedia: <span className='font-bold text-lg'>{itemStock}</span> Pcs</p>
                  <div className="mt-2 grid grid-cols-3 md:grid-cols-4 gap-4 items-end">
                    <div className="form-control"><label className="label-text">DOS</label><input type="number" value={dosQty} onChange={(e) => setDosQty(e.target.valueAsNumber || 0)} className="input input-bordered" /></div>
                    <div className="form-control"><label className="label-text">PACK</label><input type="number" value={packQty} onChange={(e) => setPackQty(e.target.valueAsNumber || 0)} className="input input-bordered" /></div>
                    <div className="form-control"><label className="label-text">PCS</label><input type="number" value={pcsQty} onChange={(e) => setPcsQty(e.target.valueAsNumber || 0)} className="input input-bordered" /></div>
                    <button type="button" onClick={handleAddItemToList} className="btn btn-secondary">Tambah ke Daftar</button>
                  </div>
                </div>
              )}
            </div>
            
            <div className="divider">Barang dalam Surat Jalan Ini</div>
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead><tr><th>Nama Barang</th><th>Jumlah Dikirim</th><th>Aksi</th></tr></thead>
                <tbody>
                  {transferItems.map((item, index) => (
                    <tr key={index}><td>{item.name}</td><td>{item.displayQty}</td><td><button onClick={() => handleRemoveFromList(index)} className="btn btn-xs btn-error">Hapus</button></td></tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="form-control mt-6">
              <button type="button" onClick={handleSaveDraft} className="btn btn-primary btn-lg" disabled={transferItems.length === 0}>Simpan & Kirim Barang</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
export default TransferStok;