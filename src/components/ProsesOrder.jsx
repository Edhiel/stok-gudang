import React, { useState, useEffect } from 'react';
// --- 1. IMPORT BARU DARI FIRESTORE ---
import { collection, query, where, onSnapshot, doc, updateDoc, runTransaction } from 'firebase/firestore';
import { firestoreDb } from '../firebaseConfig';
import toast from 'react-hot-toast';

function ProsesOrder({ userProfile }) {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('menunggu');
    
    // State untuk filter
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    
    // State untuk modal
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
    const [invoiceNumberInput, setInvoiceNumberInput] = useState('');

    // --- 2. LOGIKA BARU MENGAMBIL DATA ORDER DARI FIRESTORE ---
    useEffect(() => {
        if (!userProfile.depotId) return;
        
        const ordersRef = collection(firestoreDb, `depots/${userProfile.depotId}/salesOrders`);
        const q = query(ordersRef, where('status', 'in', ['Menunggu Approval Admin', 'Siap Dikirim']));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const orderList = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
            setOrders(orderList);
            setLoading(false);
        });
        
        return () => unsubscribe();
    }, [userProfile.depotId]);

    const filteredOrders = orders.filter(order => {
        const orderDate = order.createdAt.toDate();
        const start = startDate ? new Date(startDate).setHours(0,0,0,0) : null;
        const end = endDate ? new Date(endDate).setHours(23,59,59,999) : null;

        const isAfterStartDate = start ? orderDate >= start : true;
        const isBeforeEndDate = end ? orderDate <= end : true;
        
        const matchesSearch = searchTerm ? 
            (order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
             order.storeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
             order.salesName.toLowerCase().includes(searchTerm.toLowerCase()))
            : true;
        
        const matchesTab = activeTab === 'menunggu' 
            ? order.status === 'Menunggu Approval Admin' 
            : order.status === 'Siap Dikirim';

        return isAfterStartDate && isBeforeEndDate && matchesSearch && matchesTab;
    });

    const handleApprove = async (orderId) => {
        if (!window.confirm("Apakah Anda yakin ingin menyetujui order ini?")) return;
        const orderDocRef = doc(firestoreDb, `depots/${userProfile.depotId}/salesOrders/${orderId}`);
        try {
            await updateDoc(orderDocRef, { status: 'Siap Dikirim' });
            toast.success("Order berhasil disetujui.");
        } catch (error) { toast.error("Gagal menyetujui order."); }
    };

    // --- 3. LOGIKA BARU MENGEMBALIKAN STOK DENGAN TRANSAKSI FIRESTORE ---
    const handleReject = async (order) => {
        if (!window.confirm("Apakah Anda yakin ingin MEMBATALKAN order ini? Stok akan dikembalikan.")) return;
        
        try {
            await runTransaction(firestoreDb, async (transaction) => {
                for (const item of order.items) {
                    const stockDocRef = doc(firestoreDb, `depots/${userProfile.depotId}/stock/${item.id}`);
                    const stockDoc = await transaction.get(stockDocRef);
                    if (stockDoc.exists()) {
                        const newTotal = (stockDoc.data().totalStockInPcs || 0) + item.quantityInPcs;
                        const newAllocated = (stockDoc.data().allocatedStockInPcs || 0) - item.quantityInPcs;
                        transaction.update(stockDocRef, { 
                            totalStockInPcs: newTotal, 
                            allocatedStockInPcs: newAllocated < 0 ? 0 : newAllocated 
                        });
                    }
                }
                const orderDocRef = doc(firestoreDb, `depots/${userProfile.depotId}/salesOrders/${order.id}`);
                transaction.update(orderDocRef, { status: 'Dibatalkan' });
            });
            toast.success("Order berhasil dibatalkan dan stok telah dikembalikan.");
        } catch (error) { 
            toast.error(`Gagal membatalkan order: ${error.message}`); 
            console.error(error);
        }
    };

    const handleSaveInvoiceNumber = async () => {
        if (!invoiceNumberInput) {
            return toast.error("Nomor faktur tidak boleh kosong.");
        }
        const orderDocRef = doc(firestoreDb, `depots/${userProfile.depotId}/salesOrders/${selectedOrder.id}`);
        try {
            await updateDoc(orderDocRef, { 
                status: 'Siap Dikirim (Sudah Difakturkan)',
                invoiceNumber: invoiceNumberInput,
                processedBy: userProfile.fullName
            });
            toast.success("Nomor faktur berhasil disimpan. Order siap dikeluarkan gudang.");
            setIsInvoiceModalOpen(false);
            setSelectedOrder(null);
        } catch (error) {
            toast.error("Gagal menyimpan nomor faktur.");
        }
    };

    const handleExportTxt = (order) => {
        let content = '';
        order.items.forEach(item => {
            const [dos, pack, pcs] = item.displayQty.split('.');
            // Kita butuh Kode Internal (ND6) untuk ekspor ini
            content += `${item.kodeInternal || item.id} ${dos} ${pack} ${pcs}\n`;
        });
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `${order.orderNumber}.txt`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`File ${order.orderNumber}.txt berhasil diunduh.`);
    };

    const openDetailModal = (order) => {
        setSelectedOrder(order);
        setIsDetailModalOpen(true);
    };
    
    const openInvoiceModal = (order) => {
        setSelectedOrder(order);
        setInvoiceNumberInput(order.invoiceNumber || '');
        setIsInvoiceModalOpen(true);
    };

    return (
        <div className="p-4 md:p-8">
            <h1 className="text-3xl font-bold mb-6">Proses Order Penjualan</h1>
            
            <div role="tablist" className="tabs tabs-lifted">
                <a role="tab" className={`tab ${activeTab === 'menunggu' ? 'tab-active' : ''}`} onClick={() => setActiveTab('menunggu')}>
                    Menunggu Persetujuan
                    <div className="badge badge-warning ml-2">{orders.filter(o => o.status === 'Menunggu Approval Admin').length}</div>
                </a>
                <a role="tab" className={`tab ${activeTab === 'disetujui' ? 'tab-active' : ''}`} onClick={() => setActiveTab('disetujui')}>
                    Siap Dikirim / Faktur
                    <div className="badge badge-success ml-2">{orders.filter(o => o.status === 'Siap Dikirim').length}</div>
                </a>
            </div>

            <div className="bg-white p-6 rounded-b-lg rounded-tr-lg shadow-lg">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="form-control"><label className="label-text">Cari (No. Order / Toko / Sales)</label><input type="text" placeholder="Ketik untuk mencari..." className="input input-bordered w-full" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
                    <div className="form-control"><label className="label-text">Dari Tanggal</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input input-bordered w-full" /></div>
                    <div className="form-control"><label className="label-text">Sampai Tanggal</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input input-bordered w-full" /></div>
                </div>

                <div className="overflow-x-auto">
                    <table className="table w-full">
                        <thead className="bg-gray-200">
                            <tr><th>Tanggal</th><th>No. Order</th><th>Nama Toko</th><th>Sales</th><th className="text-center">Aksi</th></tr>
                        </thead>
                        <tbody>
                            {loading ?
                            (<tr><td colSpan="5" className="text-center"><span className="loading loading-dots"></span></td></tr>)
                            : filteredOrders.length === 0 ?
                            (<tr><td colSpan="5" className="text-center">Tidak ada data untuk ditampilkan.</td></tr>)
                            : (filteredOrders.map(order => (
                                <tr key={order.id} className="hover">
                                    <td>{order.createdAt.toDate().toLocaleDateString('id-ID')}</td>
                                    <td className="font-semibold">{order.orderNumber}</td>
                                    <td>{order.storeName}</td>
                                    <td>{order.salesName}</td>
                                    <td className="flex gap-2 justify-center flex-wrap">
                                        <button onClick={() => openDetailModal(order)} className="btn btn-xs btn-outline btn-info">Detail</button>
                                        {activeTab === 'menunggu' && (
                                            <>
                                                <button onClick={() => handleApprove(order.id)} className="btn btn-xs btn-outline btn-success">Setujui</button>
                                                <button onClick={() => handleReject(order)} className="btn btn-xs btn-outline btn-error">Tolak</button>
                                            </>
                                        )}
                                        {activeTab === 'disetujui' && (
                                            <>
                                                <button onClick={() => handleExportTxt(order)} className="btn btn-xs btn-outline btn-primary">Ekspor TXT</button>
                                                <button onClick={() => openInvoiceModal(order)} className="btn btn-xs btn-outline btn-accent">Input No. Faktur</button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            )))}
                        </tbody>
                    </table>
                </div>
            </div>

            {isDetailModalOpen && selectedOrder && (
                <div className="modal modal-open">
                    <div className="modal-box">
                        <h3 className="font-bold text-lg">Detail Order: {selectedOrder.orderNumber}</h3>
                        <p className="py-2 text-sm">Toko: {selectedOrder.storeName}</p>
                        <div className="divider"></div>
                        <ul className="list-disc list-inside">
                            {selectedOrder.items.map(item => (
                                <li key={item.id}>{item.name} - <strong>{item.displayQty}</strong></li>
                            ))}
                        </ul>
                        <div className="modal-action">
                            <button onClick={() => setIsDetailModalOpen(false)} className="btn">Tutup</button>
                        </div>
                    </div>
                </div>
            )}

            {isInvoiceModalOpen && (
                <div className="modal modal-open">
                    <div className="modal-box">
                        <h3 className="font-bold text-lg">Masukkan Nomor Faktur</h3>
                        <p className="py-2 text-sm">Untuk Order: <strong>{selectedOrder.orderNumber}</strong></p>
                        <div className="form-control mt-4">
                            <input type="text" value={invoiceNumberInput} onChange={(e) => setInvoiceNumberInput(e.target.value)} placeholder="Ketik No. Faktur dari ND6" className="input input-bordered w-full" />
                        </div>
                        <div className="modal-action">
                            <button onClick={handleSaveInvoiceNumber} className="btn btn-primary">Simpan</button>
                            <button onClick={() => setIsInvoiceModalOpen(false)} className="btn">Batal</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ProsesOrder;
