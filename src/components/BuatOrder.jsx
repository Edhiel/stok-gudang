import React, { useState, useEffect } from 'react';
import { ref, onValue, get, runTransaction, push, serverTimestamp } from 'firebase/database';
import { db } from '../firebaseConfig';
import CameraBarcodeScanner from './CameraBarcodeScanner';
// TombolKembali sudah dihapus dari sini

function BuatOrder({ userProfile, setPage }) { // setPage tetap ada jika nanti diperlukan
  // State untuk data header
  const [orderNumber, setOrderNumber] = useState('');
  const [storeName, setStoreName] = useState('');

  // State untuk item
  const [availableItems, setAvailableItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemStock, setItemStock] = useState(0);

  // State untuk kuantitas
  const [dosQty, setDosQty] = useState(0);
  const [packQty, setPackQty] = useState(0);
  const [pcsQty, setPcsQty] = useState(0);
  
  const [orderItems, setOrderItems] = useState([]); // Daftar barang di keranjang order
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showScanner, setShowScanner] = useState(false);

  // Mengambil daftar barang yang stoknya tersedia
  useEffect(() => {
    if (!userProfile.depotId) return;

    const masterItemsRef = ref(db, 'master_items');
    get(masterItemsRef).then((masterSnapshot) => {
      const masterItems = masterSnapshot.val() || {};
      
      const stockRef = ref(db, `depots/${userProfile.depotId}/stock`);
      onValue(stockRef, (stockSnapshot) => {
        const stockData = stockSnapshot.val() || {};
        const available = Object.keys(stockData)
          .filter(itemId => (stockData[itemId].totalStockInPcs || 0) > 0)
          .map(itemId => ({
            id: itemId,
            ...masterItems[itemId],
            totalStockInPcs: stockData[itemId].totalStockInPcs
          }));
        setAvailableItems(available);
      });
    });
  }, [userProfile.depotId]);

  const handleBarcodeDetected = (scannedBarcode) => {
    const foundItem = availableItems.find(item => item.barcodePcs === scannedBarcode || item.barcodeDos === scannedBarcode);
    if (foundItem) {
      handleSelectItem(foundItem);
    } else {
      alert("Barang tidak ditemukan atau stok kosong.");
    }
    setShowScanner(false);
  };
  
  const handleSelectItem = (item) => {
    setSelectedItem(item);
    setSearchTerm(item.name);
    setItemStock(item.totalStockInPcs);
  };
  
  const handleAddItemToList = () => {
    if (!selectedItem) { alert("Pilih barang dulu."); return; }
    const totalPcs = (Number(dosQty) * (selectedItem.conversions.Dos?.inPcs || 1)) + (Number(packQty) * (selectedItem.conversions.Pack?.inPcs || 1)) + (Number(pcsQty));
    if (totalPcs <= 0) { alert("Masukkan jumlah yang valid."); return; }
    if (totalPcs > itemStock) { alert(`Stok tidak cukup! Sisa stok hanya ${itemStock} Pcs.`); return; }
    
    setOrderItems([...orderItems, { id: selectedItem.id, name: selectedItem.name, quantityInPcs: totalPcs, displayQty: `${dosQty}.${packQty}.${pcsQty}` }]);
    setSelectedItem(null); setSearchTerm(''); setDosQty(0); setPackQty(0); setPcsQty(0);
  };

  const handleRemoveFromList = (indexToRemove) => {
    setOrderItems(orderItems.filter((_, index) => index !== indexToRemove));
  };
  
  const handleSaveOrder = async () => {
    if (!orderNumber || !storeName || orderItems.length === 0) {
      setError("No. Order, Nama Toko, dan minimal 1 barang wajib diisi.");
      return;
    }
    setError(''); setSuccess('');

    try {
      // "Booking" stok untuk setiap barang
      for (const orderItem of orderItems) {
        const stockRef = ref(db, `depots/${userProfile.depotId}/stock/${orderItem.id}`);
        await runTransaction(stockRef, (currentStock) => {
          if (currentStock) {
            const availableStock = currentStock.totalStockInPcs || 0;
            if (availableStock < orderItem.quantityInPcs) { throw new Error(`Stok untuk ${orderItem.name} sudah dipesan orang lain.`); }
            currentStock.totalStockInPcs -= orderItem.quantityInPcs;
            currentStock.allocatedStockInPcs = (currentStock.allocatedStockInPcs || 0) + orderItem.quantityInPcs;
          }
          return currentStock;
        });
      }

      // Simpan data order
      const salesOrdersRef = ref(db, `depots/${userProfile.depotId}/salesOrders`);
      await push(salesOrdersRef, {
        orderNumber: orderNumber,
        storeName: storeName,
        items: orderItems,
        status: 'Menunggu Approval Admin',
        salesName: userProfile.fullName,
        createdAt: serverTimestamp()
      });

      setSuccess("Order berhasil disimpan dan stok telah dibooking.");
      setOrderNumber(''); setStoreName(''); setOrderItems([]);
    } catch (err) {
      setError(`Gagal menyimpan order: ${err.message}`);
      console.error(err);
    }
  };

  const filteredItems = searchTerm.length > 0 
    ? availableItems.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : [];

  return (
    <>
      {showScanner && <CameraBarcodeScanner onDetected={handleBarcodeDetected} onClose={() => setShowScanner(false)} />}
      <div className="p-4 md:p-8">
        <div className="card bg-white shadow-lg w-full">
          <div className="card-body">
            <h2 className="card-title text-2xl">Buat Order Penjualan</h2>
            {success && <div role="alert" className="alert alert-success"><span>{success}</span></div>}
            {error && <div role="alert" className="alert alert-error"><span>{error}</span></div>}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-4 border rounded-lg">
              <div className="form-control"><label className="label"><span className="label-text font-bold">No. Order / PO</span></label><input type="text" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} className="input input-bordered" /></div>
              <div className="form-control"><label className="label"><span className="label-text font-bold">Nama Toko</span></label><input type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)} className="input input-bordered" /></div>
            </div>

            <div className="divider">Detail Barang</div>
            <div className="p-4 border rounded-lg bg-base-200">
              <div className="form-control dropdown"><label className="label"><span className="label-text">Cari Barang (Scan atau Ketik Nama)</span></label><div className="join w-full"><input type="text" placeholder="Hanya barang dengan stok tersedia akan muncul" className="input input-bordered join-item w-full" value={searchTerm} onChange={(e) => {setSearchTerm(e.target.value); setSelectedItem(null);}}/><button type="button" onClick={() => setShowScanner(true)} className="btn btn-primary join-item">Scan</button></div>
                {filteredItems.length > 0 && !selectedItem && (
                  <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-full max-h-60 overflow-y-auto">
                    {filteredItems.slice(0, 5).map(item => ( <li key={item.id}><a onClick={() => handleSelectItem(item)}>{item.name} (Stok: {item.totalStockInPcs})</a></li> ))}
                  </ul>
                )}
              </div>
              {selectedItem && (
                <div className="mt-4"><p className="font-bold">Barang Terpilih: {selectedItem.name}</p><p className="text-sm">Sisa Stok Tersedia: <span className='font-bold text-lg'>{itemStock}</span> Pcs</p><div className="mt-2 grid grid-cols-3 md:grid-cols-4 gap-4 items-end"><div className="form-control"><label className="label-text">DOS</label><input type="number" value={dosQty} onChange={(e) => setDosQty(e.target.valueAsNumber || 0)} className="input input-bordered" /></div><div className="form-control"><label className="label-text">PACK</label><input type="number" value={packQty} onChange={(e) => setPackQty(e.target.valueAsNumber || 0)} className="input input-bordered" /></div><div className="form-control"><label className="label-text">PCS</label><input type="number" value={pcsQty} onChange={(e) => setPcsQty(e.target.valueAsNumber || 0)} className="input input-bordered" /></div><button type="button" onClick={handleAddItemToList} className="btn btn-secondary">Tambah ke Order</button></div></div>
              )}
            </div>

            <div className="divider">Barang dalam Order Ini</div>
            <div className="overflow-x-auto"><table className="table w-full"><thead><tr><th>Nama Barang</th><th>Jumlah Dipesan</th><th>Aksi</th></tr></thead><tbody>{orderItems.map((item, index) => (<tr key={index}><td>{item.name}</td><td>{item.displayQty}</td><td><button onClick={() => handleRemoveFromList(index)} className="btn btn-xs btn-error">Hapus</button></td></tr>))}</tbody></table></div>
            <div className="form-control mt-6"><button type="button" onClick={handleSaveOrder} className="btn btn-primary btn-lg" disabled={orderItems.length === 0}>Simpan Order</button></div>
          </div>
        </div>
      </div>
    </>
  );
}
export default BuatOrder;