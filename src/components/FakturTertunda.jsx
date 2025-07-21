import React, { useState, useEffect } from 'react';
import { ref, onValue, get, push, serverTimestamp } from 'firebase/database';
import { db } from '../firebaseConfig';
import CameraBarcodeScanner from './CameraBarcodeScanner';
import toast from 'react-hot-toast';

function FakturTertunda({ userProfile }) {
  const [salesName, setSalesName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [driverName, setDriverName] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [availableItems, setAvailableItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemStock, setItemStock] = useState(0);
  const [dosQty, setDosQty] = useState(0);
  const [packQty, setPackQty] = useState(0);
  const [pcsQty, setPcsQty] = useState(0);
  const [transactionItems, setTransactionItems] = useState([]);
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    if (!userProfile.depotId) return;
    const masterItemsRef = ref(db, 'master_items');
    onValue(masterItemsRef, (snapshot) => {
        const data = snapshot.val();
        const itemList = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
        setAvailableItems(itemList);
    });
  }, [userProfile.depotId]);

  const handleBarcodeDetected = (scannedBarcode) => {
    const foundItem = availableItems.find(item => item.barcodePcs === scannedBarcode || item.barcodeDos === scannedBarcode);
    if (foundItem) {
      handleSelectItem(foundItem);
    } else {
      toast.error("Barang tidak ditemukan.");
    }
    setShowScanner(false);
  };

  const handleSelectItem = async (item) => {
    setSelectedItem(item);
    setSearchTerm(item.name);
    const stockRef = ref(db, `depots/${userProfile.depotId}/stock/${item.id}/totalStockInPcs`);
    const snapshot = await get(stockRef);
    setItemStock(snapshot.exists() ? snapshot.val() : 0);
  };
  
  const handleAddItemToList = (isBonus = false) => {
    if (!selectedItem) { toast.error("Pilih barang dulu."); return; }
    const totalPcs = (Number(dosQty) * (selectedItem.conversions.Dos?.inPcs || 1)) + (Number(packQty) * (selectedItem.conversions.Pack?.inPcs || 1)) + (Number(pcsQty));
    if (totalPcs <= 0) { toast.error("Masukkan jumlah yang valid."); return; }
    if (totalPcs > itemStock) {
        toast.error(`Stok tidak cukup! Sisa stok ${selectedItem.name} hanya ${itemStock} Pcs.`);
        return;
    }
    const newItem = {
      id: selectedItem.id, name: selectedItem.name, quantityInPcs: totalPcs,
      displayQty: `${dosQty}.${packQty}.${pcsQty}`, isBonus: isBonus
    };
    setTransactionItems([...transactionItems, newItem]);
    setSelectedItem(null); setSearchTerm(''); setDosQty(0); setPackQty(0); setPcsQty(0);
  };

  const handleRemoveFromList = (indexToRemove) => {
    setTransactionItems(transactionItems.filter((_, index) => index !== indexToRemove));
  };

  const handleSavePendingInvoice = async () => {
    if (!salesName || !storeName || transactionItems.length === 0) {
      toast.error("Nama Sales, Nama Toko, dan minimal 1 barang wajib diisi.");
      return;
    }

    try {
      const pendingInvoicesRef = ref(db, `depots/${userProfile.depotId}/pendingInvoices`);
      await push(pendingInvoicesRef, {
        status: 'Menunggu Faktur',
        salesName, storeName, driverName, licensePlate,
        items: transactionItems,
        createdBy: userProfile.fullName,
        createdAt: serverTimestamp()
      });

      toast.success("Tanda terima berhasil disimpan sebagai 'Faktur Tertunda'.");
      setSalesName(''); setStoreName(''); setDriverName(''); setLicensePlate('');
      setTransactionItems([]);

    } catch (err) {
      toast.error(`Gagal menyimpan: ${err.message}`);
      console.error(err);
    }
  };
  
  const filteredItems = searchTerm.length > 0 
    ? availableItems.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : [];

  return (
    <>
      {showScanner && <CameraBarcodeScanner onScan={handleBarcodeDetected} onClose={() => setShowScanner(false)} />}
      <div className="p-8">
        <div className="card bg-white shadow-lg w-full">
          <div className="card-body">
            <h2 className="card-title text-2xl">Buat Tanda Terima (Faktur Tertunda)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-4 border rounded-lg">
              <div className="form-control">
                <label className="label"><span className="label-text font-bold">Nama Sales</span></label>
                <input type="text" value={salesName} onChange={(e) => setSalesName(e.target.value)} className="input input-bordered" />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text font-bold">Nama Toko Tujuan</span></label>
                <input type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)} className="input input-bordered" />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Nama Sopir</span></label>
                <input type="text" value={driverName} onChange={(e) => setDriverName(e.target.value)} className="input input-bordered" />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">No. Polisi Kendaraan</span></label>
                <input type="text" value={licensePlate} onChange={(e) => setLicensePlate(e.target.value)} className="input input-bordered" />
              </div>
            </div>
            <div className="divider">Tambah Barang ke Daftar</div>
            <div className="p-4 border rounded-lg bg-base-200">
              <div className="form-control dropdown">
                <label className="label"><span className="label-text">Cari Barang (Scan atau Ketik Nama)</span></label>
                <div className="join w-full">
                  <input type="text" placeholder="Cari dari master barang..." className="input input-bordered join-item w-full" value={searchTerm} onChange={(e) => {setSearchTerm(e.target.value); setSelectedItem(null);}}/>
                  <button type="button" onClick={() => setShowScanner(true)} className="btn btn-primary join-item">Scan</button>
                </div>
                {filteredItems.length > 0 && !selectedItem && (
                  <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-full max-h-60 overflow-y-auto">
                    {filteredItems.slice(0, 5).map(item => (
                      <li key={item.id}><a onClick={() => handleSelectItem(item)}>{item.name}</a></li>
                    ))}
                  </ul>
                )}
              </div>
              {selectedItem && (
                <div className="mt-4">
                    <p className="font-bold">Barang Terpilih: {selectedItem.name}</p>
                    <p className="text-sm">Sisa Stok: <span className='font-bold text-lg'>{itemStock}</span> Pcs</p>
                    <div className="mt-2 grid grid-cols-3 md:grid-cols-4 gap-4 items-end">
                        <div className="form-control"><label className="label-text">DOS</label><input type="number" value={dosQty} onChange={(e) => setDosQty(e.target.valueAsNumber || 0)} className="input input-bordered" /></div>
                        <div className="form-control"><label className="label-text">PACK</label><input type="number" value={packQty} onChange={(e) => setPackQty(e.target.valueAsNumber || 0)} className="input input-bordered" /></div>
                        <div className="form-control"><label className="label-text">PCS</label><input type="number" value={pcsQty} onChange={(e) => setPcsQty(e.target.valueAsNumber || 0)} className="input input-bordered" /></div>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => handleAddItemToList(false)} className="btn btn-secondary">Tambah</button>
                            <button type="button" onClick={() => handleAddItemToList(true)} className="btn btn-accent">Bonus</button>
                        </div>
                    </div>
                </div>
              )}
            </div>
            <div className="divider">Barang dalam Tanda Terima Ini</div>
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead><tr><th>Nama Barang</th><th>Jumlah Pesanan</th><th>Aksi</th></tr></thead>
                <tbody>
                  {transactionItems.map((item, index) => (
                    <tr key={index}>
                      <td>
                        {item.name}
                        {item.isBonus && <span className="badge badge-info badge-sm ml-2">Bonus</span>}
                      </td>
                      <td>{item.displayQty}</td>
                      <td><button onClick={() => handleRemoveFromList(index)} className="btn btn-xs btn-error">Hapus</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="form-control mt-6">
              <button type="button" onClick={handleSavePendingInvoice} className="btn btn-warning btn-lg" disabled={transactionItems.length === 0}>Simpan Tanda Terima</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
export default FakturTertunda;