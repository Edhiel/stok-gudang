import React, { useState, useEffect } from 'react';
import { ref, onValue, query, orderByChild, equalTo, update, runTransaction } from 'firebase/database';
import { db } from '../firebaseConfig';
import toast from 'react-hot-toast';

function ProsesOrder({ userProfile }) {
    const [orders, setOrders] = useState([]);
    const [filteredOrders, setFilteredOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        if (!userProfile.depotId) return;
        
        const ordersRef = ref(db, `depots/${userProfile.depotId}/salesOrders`);
        const pendingOrdersQuery = query(ordersRef, orderByChild('status'), equalTo('Menunggu Approval Admin'));

        const unsubscribe = onValue(pendingOrdersQuery, (snapshot) => {
            const data = snapshot.val() || {};
            const orderList = Object.keys(data)
                .map(key => ({ id: key, ...data[key] }))
                .sort((a, b) => b.createdAt - a.createdAt);
            setOrders(orderList);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userProfile.depotId]);

    useEffect(() => {
        let items = [...orders];
        if (searchTerm) {
            items = items.filter(o => 
                o.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                o.storeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                o.salesName.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        if (startDate) {
            const start = new Date(startDate).setHours(0, 0, 0, 0);
            items = items.filter(o => o.createdAt >= start);
        }
        if (endDate) {
            const end = new Date(endDate).setHours(23, 59, 59, 999);
            items = items.filter(o => o.createdAt <= end);
        }
        setFilteredOrders(items);
    }, [searchTerm, startDate, endDate, orders]);

    const handleApprove = async (orderId) => {
        if (!window.confirm("Apakah Anda yakin ingin menyetujui order ini?")) return;

        const orderRef = ref(db, `depots/${userProfile.depotId}/salesOrders/${orderId}`);
        try {
            await update(orderRef, { status: 'Siap Dikirim' });
            toast.success("Order berhasil disetujui.");
        } catch (error) {
            toast.error("Gagal menyetujui order.");
            console.error(error);
        }
    };

    const handleReject = async (order) => {
        if (!window.confirm("Apakah Anda yakin ingin MEMBATALKAN order ini? Stok akan dikembalikan.")) return;

        try {
            // Kembalikan stok yang dialokasikan
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

            // Ubah status order
            const orderRef = ref(db, `depots/${userProfile.depotId}/salesOrders/${order.id}`);
            await update(orderRef, { status: 'Dibatalkan' });
            toast.success("Order berhasil dibatalkan dan stok telah dikembalikan.");
        } catch (error) {
            toast.error(`Gagal membatalkan order: ${error.message}`);
            console.error(error);
        }
    };

    const openDetailModal = (order) => {
        setSelectedOrder(order);
        setIsModalOpen(true);
    };

    return (
        <div className="p-4 md:p-8">
            <h1 className="text-3xl font-bold mb-6">Proses Order Penjualan</h1>
            
            <div className="card bg-white shadow-lg p-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            </div>

            <div className="overflow-x-auto bg-white rounded-lg shadow">
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
                        : filteredOrders.length === 0 ? (<tr><td colSpan="5" className="text-center">Tidak ada order yang menunggu persetujuan.</td></tr>)
                        : (filteredOrders.map(order => (
                            <tr key={order.id} className="hover">
                                <td>{new Date(order.createdAt).toLocaleDateString('id-ID')}</td>
                                <td className="font-semibold">{order.orderNumber}</td>
                                <td>{order.storeName}</td>
                                <td>{order.salesName}</td>
                                <td className="flex gap-2 justify-center">
                                    <button onClick={() => openDetailModal(order)} className="btn btn-xs btn-outline btn-info">Detail</button>
                                    <button onClick={() => handleApprove(order.id)} className="btn btn-xs btn-outline btn-success">Setujui</button>
                                    <button onClick={() => handleReject(order)} className="btn btn-xs btn-outline btn-error">Tolak</button>
                                </td>
                            </tr>
                        )))}
                    </tbody>
                </table>
            </div>

            {isModalOpen && selectedOrder && (
                <div className="modal modal-open">
                    <div className="modal-box w-11/12 max-w-2xl">
                        <h3 className="font-bold text-lg">Detail Order: {selectedOrder.orderNumber}</h3>
                        <p className="py-2 text-sm"><strong>Toko:</strong> {selectedOrder.storeName}</p>
                        <p className="text-sm"><strong>Sales:</strong> {selectedOrder.salesName}</p>
                        <div className="divider">Barang Dipesan</div>
                        <div className="overflow-x-auto max-h-60">
                            <table className="table table-compact w-full">
                                <thead><tr><th>Nama Barang</th><th>Jumlah (D.P.P)</th></tr></thead>
                                <tbody>
                                    {selectedOrder.items.map((item, index) => (
                                        <tr key={index}>
                                            <td>{item.name}</td>
                                            <td>{item.displayQty}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="modal-action">
                            <button onClick={() => setIsModalOpen(false)} className="btn">Tutup</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ProsesOrder;
