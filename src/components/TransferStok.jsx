import React, { useState, useEffect, useMemo } from 'react'
import {
  ref, onValue, get, push,
  serverTimestamp, runTransaction,
  update, query, orderByChild, equalTo
} from 'firebase/database'
import { db } from '../firebaseConfig'
import CameraBarcodeScanner from './CameraBarcodeScanner'
import toast from 'react-hot-toast'

function TransferStok({ userProfile }) {
  const [activeTab, setActiveTab] = useState('buat')
  const [loading, setLoading] = useState(true)

  const [allDepots, setAllDepots] = useState([])
  const [availableItems, setAvailableItems] = useState([])

  const [suratJalan, setSuratJalan] = useState('')
  const [destinationDepot, setDestinationDepot] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedItem, setSelectedItem] = useState(null)
  const [itemStock, setItemStock] = useState(0)
  const [dosQty, setDosQty] = useState(0)
  const [packQty, setPackQty] = useState(0)
  const [pcsQty, setPcsQty] = useState(0)
  const [transferItems, setTransferItems] = useState([])
  const [showScanner, setShowScanner] = useState(false)

  const [outgoingTransfers, setOutgoingTransfers] = useState([])
  const [incomingTransfers, setIncomingTransfers] = useState([])

  useEffect(() => {
    if (!userProfile?.depotId) {
      setLoading(false)
      return
    }

    const depotsRef = ref(db, 'depots')
    onValue(depotsRef, snap => {
      const data = snap.val() || {}
      const list = Object.keys(data).map(key => ({
        id: key,
        name: data[key]?.info?.name || key
      }))
      setAllDepots(list)
    })

    get(ref(db, 'master_items')).then(ms => {
      const master = ms.val() || {}
      const stockRef = ref(db, `depots/${userProfile.depotId}/stock`)
      onValue(stockRef, snap => {
        const stock = snap.val() || {}
        const items = Object.keys(stock).filter(id => (stock[id].totalStockInPcs || 0) > 0)
          .map(id => ({
            id,
            ...master[id],
            totalStockInPcs: stock[id].totalStockInPcs
          }))
        setAvailableItems(items)
      })
    })

    const outQ = query(ref(db, 'stock_transfers'), orderByChild('fromDepotId'), equalTo(userProfile.depotId))
    onValue(outQ, snap => {
      const data = snap.val() || {}
      const list = Object.keys(data).map(key => ({ id: key, ...data[key] }))
      setOutgoingTransfers(list.sort((a, b) => b.createdAt - a.createdAt))
    })

    const inQ = query(ref(db, 'stock_transfers'), orderByChild('toDepotId'), equalTo(userProfile.depotId))
    onValue(inQ, snap => {
      const data = snap.val() || {}
      const list = Object.keys(data).map(key => ({ id: key, ...data[key] }))
      setIncomingTransfers(list.sort((a, b) => b.createdAt - a.createdAt))
    })
  }, [userProfile])

  const destinationDepots = useMemo(() => {
    if (!userProfile?.depotId || allDepots.length === 0) return []
    return allDepots.filter(d => d.id.toLowerCase() !== userProfile.depotId.toLowerCase())
  }, [allDepots, userProfile?.depotId])
  const handleBarcodeDetected = (barcode) => {
    const found = availableItems.find(
      item => item.barcodePcs === barcode || item.barcodeDos === barcode
    )
    if (found) handleSelectItem(found)
    else toast.error('Barang tidak ditemukan.')
    setShowScanner(false)
  }

  const handleSelectItem = (item) => {
    setSelectedItem(item)
    setSearchTerm(item.name)
    setItemStock(item.totalStockInPcs)
  }

  const handleAddItemToList = () => {
    if (!selectedItem) return toast.error('Pilih barang dulu.')

    const totalPcs =
      dosQty * (selectedItem.conversions?.Dos?.inPcs || 1) +
      packQty * (selectedItem.conversions?.Pack?.inPcs || 1) +
      pcsQty

    if (totalPcs <= 0)
      return toast.error('Masukkan jumlah yang valid.')
    if (totalPcs > itemStock)
      return toast.error(`Stok tidak cukup. Sisa ${itemStock} Pcs.`)

    setTransferItems([
      ...transferItems,
      {
        id: selectedItem.id,
        name: selectedItem.name,
        quantityInPcs: totalPcs,
        displayQty: `${dosQty}.${packQty}.${pcsQty}`,
        conversions: selectedItem.conversions
      }
    ])

    setSelectedItem(null)
    setSearchTerm('')
    setDosQty(0)
    setPackQty(0)
    setPcsQty(0)
  }

  const handleRemoveFromList = (index) =>
    setTransferItems(transferItems.filter((_, i) => i !== index))

  const handleSaveDraft = async () => {
    if (!suratJalan || !destinationDepot || transferItems.length === 0)
      return toast.error('Lengkapi Surat Jalan, Depo Tujuan, dan minimal 1 barang.')

    try {
      for (const item of transferItems) {
        const stockRef = ref(db, `depots/${userProfile.depotId}/stock/${item.id}`)
        await runTransaction(stockRef, (currentStock) => {
          if (!currentStock || currentStock.totalStockInPcs < item.quantityInPcs)
            throw new Error(`Stok tidak cukup untuk ${item.name}`)

          currentStock.totalStockInPcs -= item.quantityInPcs
          currentStock.inTransitStock = (currentStock.inTransitStock || 0) + item.quantityInPcs
          return currentStock
        })
      }

      const targetDepot = allDepots.find(d => d.id === destinationDepot)
      await push(ref(db, 'stock_transfers'), {
        suratJalan,
        fromDepotId: userProfile.depotId,
        toDepotId: destinationDepot,
        toDepotName: targetDepot?.name || destinationDepot,
        items: transferItems,
        status: 'Dikirim',
        createdBy: userProfile.fullName,
        createdAt: serverTimestamp()
      })

      toast.success('Transfer berhasil disimpan.')
      setSuratJalan('')
      setDestinationDepot('')
      setTransferItems([])
    } catch (err) {
      toast.error(`Gagal simpan transfer: ${err.message}`)
    }
  }

  const handlePrint = () => {
    if (!transferItems.length) return toast.error('Tidak ada barang untuk dicetak.')
    window.print()
  }

  const handleConfirmReceipt = async (transfer) => {
    if (!window.confirm(`Konfirmasi penerimaan dari ${transfer.fromDepotId}?`)) return
    try {
      const updates = {
        [`stock_transfers/${transfer.id}/status`]: 'Diterima',
        [`stock_transfers/${transfer.id}/receivedAt`]: serverTimestamp(),
        [`stock_transfers/${transfer.id}/receivedBy`]: userProfile.fullName
      }

      for (const item of transfer.items) {
        const toRef = ref(db, `depots/${userProfile.depotId}/stock/${item.id}`)
        await runTransaction(toRef, (curr) => {
          curr = curr || { totalStockInPcs: 0, damagedStockInPcs: 0, inTransitStock: 0 }
          curr.totalStockInPcs += item.quantityInPcs
          return curr
        })

        const fromRef = ref(db, `depots/${transfer.fromDepotId}/stock/${item.id}`)
        await runTransaction(fromRef, (curr) => {
          if (curr) curr.inTransitStock -= item.quantityInPcs
          return curr
        })
      }

      await update(ref(db), updates)
      toast.success('Barang berhasil dikonfirmasi diterima.')
    } catch (err) {
      toast.error('Gagal konfirmasi penerimaan.')
    }
  }
  return (
    <div className="p-8">
      {showScanner && (
        <CameraBarcodeScanner
          onScan={handleBarcodeDetected}
          onClose={() => setShowScanner(false)}
        />
      )}

      <h1 className="text-3xl font-bold mb-6">Transfer Stok Antar Depo</h1>

      <div role="tablist" className="tabs tabs-lifted">
        <a role="tab" className={`tab ${activeTab === 'buat' ? 'tab-active' : ''}`} onClick={() => setActiveTab('buat')}>Buat Transfer Baru</a>
        <a role="tab" className={`tab ${activeTab === 'keluar' ? 'tab-active' : ''}`} onClick={() => setActiveTab('keluar')}>Pengiriman Keluar</a>
        <a role="tab" className={`tab ${activeTab === 'masuk' ? 'tab-active' : ''}`} onClick={() => setActiveTab('masuk')}>Penerimaan Masuk</a>
      </div>

      <div className="bg-white p-6 rounded-b-lg rounded-tr-lg shadow-lg">
        {activeTab === 'buat' && (
          <div className="print:hidden space-y-4">
            {/* Header Form */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label"><span className="label-text font-bold">No. Surat Jalan</span></label>
                <input type="text" className="input input-bordered" value={suratJalan} onChange={(e) => setSuratJalan(e.target.value)} />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text font-bold">Depo Tujuan</span></label>
                {destinationDepots.length === 0 ? (
                  <div className="py-2 px-3 bg-gray-100 rounded">Memuat daftar depo...</div>
                ) : (
                  <select className="select select-bordered" value={destinationDepot} onChange={(e) => setDestinationDepot(e.target.value)}>
                    <option value="">Pilih Depo Tujuan</option>
                    {destinationDepots.map(depot => (
                      <option key={depot.id} value={depot.id}>{depot.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Pencarian dan Scan Barang */}
            <div className="form-control">
              <label className="label"><span className="label-text font-bold">Cari / Scan Barang</span></label>
              <div className="join w-full">
                <input type="text" placeholder="Nama barang..." className="input input-bordered join-item w-full" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setSelectedItem(null); }} />
                <button className="btn btn-primary join-item" onClick={() => setShowScanner(true)}>Scan</button>
              </div>
              {searchTerm && !selectedItem && (
                <ul className="mt-1 menu bg-base-100 rounded-box shadow">
                  {availableItems
                    .filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()))
                    .slice(0, 5)
                    .map(item => (
                      <li key={item.id}><a onClick={() => handleSelectItem(item)}>{item.name} (Stok {item.totalStockInPcs})</a></li>
                    ))
                  }
                </ul>
              )}
            </div>

            {/* Input Jumlah dan Tambah Barang */}
            {selectedItem && (
              <div className="border p-4 rounded bg-base-200">
                <p className="font-bold mb-2">Barang: {selectedItem.name}</p>
                <p className="text-sm mb-2">Stok tersedia: <span className="font-bold">{itemStock}</span> Pcs</p>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-2 items-end">
                  <input type="number" placeholder="DOS" value={dosQty} onChange={(e) => setDosQty(e.target.valueAsNumber || 0)} className="input input-bordered" />
                  <input type="number" placeholder="PACK" value={packQty} onChange={(e) => setPackQty(e.target.valueAsNumber || 0)} className="input input-bordered" />
                  <input type="number" placeholder="PCS" value={pcsQty} onChange={(e) => setPcsQty(e.target.valueAsNumber || 0)} className="input input-bordered" />
                  <button className="btn btn-secondary" onClick={handleAddItemToList}>Tambah</button>
                </div>
              </div>
            )}

            {/* Tabel Barang */}
            <div className="overflow-x-auto">
              <table className="table w-full mt-4">
                <thead><tr><th>Nama Barang</th><th>Jumlah</th><th>Aksi</th></tr></thead>
                <tbody>
                  {transferItems.length === 0 ? (
                    <tr><td colSpan="3" className="text-center text-gray-500">Belum ada barang</td></tr>
                  ) : (
                    transferItems.map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.name}</td>
                        <td>{item.displayQty}</td>
                        <td><button className="btn btn-xs btn-error" onClick={() => handleRemoveFromList(idx)}>Hapus</button></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Tombol Simpan */}
            <div className="flex justify-between mt-6">
              <button className="btn btn-outline" onClick={handlePrint} disabled={!transferItems.length}>Cetak Surat Jalan</button>
              <button className="btn btn-primary" onClick={handleSaveDraft} disabled={!suratJalan || !destinationDepot || !transferItems.length}>Simpan & Kirim</button>
            </div>
          </div>
        )}

        {/* Tab 2: Pengiriman Keluar */}
        {activeTab === 'keluar' && (
          <div className="p-2">
            <h2 className="text-lg font-bold mb-2">Pengiriman Keluar</h2>
            <table className="table w-full table-zebra">
              <thead><tr><th>Tanggal</th><th>No. SJ</th><th>Tujuan</th><th>Status</th></tr></thead>
              <tbody>
                {outgoingTransfers.length === 0 ? (
                  <tr><td colSpan="4" className="text-center text-gray-500">Belum ada pengiriman.</td></tr>
                ) : (
                  outgoingTransfers.map(tr => (
                    <tr key={tr.id}>
                      <td>{new Date(tr.createdAt).toLocaleDateString('id-ID')}</td>
                      <td>{tr.suratJalan}</td>
                      <td>{tr.toDepotName}</td>
                      <td><span className={`badge ${tr.status === 'Diterima' ? 'badge-success' : 'badge-warning'}`}>{tr.status}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Penerimaan Masuk */}
        {activeTab === 'masuk' && (
          <div className="p-2">
            <h2 className="text-lg font-bold mb-2">Penerimaan Masuk</h2>
            <table className="table w-full table-zebra">
              <thead><tr><th>Tanggal</th><th>No. SJ</th><th>Dari Depo</th><th>Status</th><th>Aksi</th></tr></thead>
              <tbody>
                {incomingTransfers.length === 0 ? (
                  <tr><td colSpan="5" className="text-center text-gray-500">Belum ada penerimaan.</td></tr>
                ) : (
                  incomingTransfers.map(tr => (
                    <tr key={tr.id}>
                      <td>{new Date(tr.createdAt).toLocaleDateString('id-ID')}</td>
                      <td>{tr.suratJalan}</td>
                      <td>{allDepots.find(d => d.id === tr.fromDepotId)?.name || tr.fromDepotId}</td>
                      <td><span className={`badge ${tr.status === 'Diterima' ? 'badge-success' : 'badge-warning'}`}>{tr.status}</span></td>
                      <td>
                        {tr.status === 'Dikirim' && (
                          <button className="btn btn-xs btn-success" onClick={() => handleConfirmReceipt(tr)}>Konfirmasi Terima</button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

