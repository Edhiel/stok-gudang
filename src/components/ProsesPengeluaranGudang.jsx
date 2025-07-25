import React, { useState, useEffect } from 'react';
import { ref, onValue, query, orderByChild, equalTo, update, runTransaction } from 'firebase/database';
import { db } from '../firebaseConfig';
import toast from 'react-hot-toast';

function ProsesOrder({ userProfile }) {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('menunggu'); // 'menunggu' atau 'disetujui'
    
    // State untuk filter
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // State untuk modal detail
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        if (!userProfile.depotId) return;
        
        const ordersRef = ref(db, `depots/${userProfile.depotId}/salesOrders`);
        // Ambil semua order yang belum selesai (menunggu atau siap kirim)
        const allPendingOrdersQuery = query(ordersRef, orderByChild('status'));

        const unsubscribe = onValue(allPendingOrdersQuery, (snapshot) => {
            const data = snapshot.val() || {};
            const orderList = Object.keys(data)
                .map(key => ({ id: key, ...data[key] }))
                .filter(o => o.status === 'Menunggu Approval Admin' || o.status === 'Siap Dikirim')
                .sort((a, b) => b.createdAt - a.createdAt);
            setOrders(orderList);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userProfile.depotId]);

    // Logika Filtering
    const filteredOrders = orders.filter(order => {
        const orderDate = new Date(order.createdAt);
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
        const orderRef = ref(db, `depots/${userProfile.depotId}/salesOrders/${orderId}`);
        try {
            await update(orderRef, { status: 'Siap Dikirim' });
            toast.success("Order berhasil disetujui.");
        } catch (error) { toast.error("Gagal menyetujui order."); }
    };

    const handleReject = async (order) => {
        if (!window.confirm("Apakah Anda yakin ingin MEMBATALKAN order ini? Stok akan dikembalikan.")) return;
        try {
            for (const item of order.items) {
                const stockRef = ref(db, `depots/${userProfile.depotId}/stock/${item.id}`);
                await runTransaction(stockRef, (currentStock) => {
                    if (currentStock) {
                        currentStock.totalStockInPcs = (currentStock.totalStockInPcs || 0) + item.quantityInPcs;
                        currentStock.allocatedStockInPcs = (currentStock.allocatedStockInPcs || 0) - item.quantityInPcs;
                    }
                    return currentStock;
                });
            }
            const orderRef = ref(db, `depots/${userProfile.depotId}/salesOrders/${order.id}`);
            await update(orderRef, { status: 'Dibatalkan' });
            toast.success("Order berhasil dibatalkan dan stok telah dikembalikan.");
        } catch (error) { toast.error(`Gagal membatalkan order: ${error.message}`); }
    };

    const handleExportTxt = (order) => {
        let content = '';
        order.items.forEach(item => {
            const [dos, pack, pcs] = item.displayQty.split('.');
            // Format: [Kode Barang] [spasi] [DOS] [spasi] [PACK] [spasi] [PCS]
            content += `${item.id} ${dos} ${pack} ${pcs}\n`;
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
        setIsModalOpen(true);
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
                    Siap Dikirim / Ekspor
                    <div className="badge badge-success ml-2">{orders.filter(o => o.status === 'Siap Dikirim').length}</div>
                </a>
            </div>

            <div className="bg-white p-6 rounded-b-lg rounded-tr-lg shadow-lg">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="form-control">
                        <label className="label-text">Cari (No. Order / Toko / Sales)</label>
                        <input type="text" placeholder="Ketik untuk mencari..." className="input input-bordered w-full" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                    <div className="form-control">
                        <label className="label-text">Dari Tanggal</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input input-bordered w-full" />
                    </div>
                    <div className="form-control">
                        <label className="label-text">Sampai Tanggal</label>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input input-bordered w-full" />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="table w-full">
                        <thead className="bg-gray-200">
                            <tr>
                                <th>Tanggal</th>
                                <th>No. Order</th>
                                <th>Nama Toko</th>
                                <th>Sales</th>
                                <th className="text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (<tr><td colSpan="5" className="text-center"><span className="loading loading-dots"></span></td></tr>)
                            : filteredOrders.length === 0 ? (<tr><td colSpan="5" className="text-center">Tidak ada data untuk ditampilkan.</td></tr>)
                            : (filteredOrders.map(order => (
                                <tr key={order.id} className="hover">
                                    <td>{new Date(order.createdAt).toLocaleDateString('id-ID')}</td>
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
                                            <button onClick={() => handleExportTxt(order)} className="btn btn-xs btn-outline btn-primary">
                                                Ekspor TXT (ND6)
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            )))}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && selectedOrder && (
                <div className="modal modal-open">
                    {/* ... (Kode modal tidak berubah) ... */}
                </div>
            )}
        </div>
    );
}

export default ProsesOrder;
