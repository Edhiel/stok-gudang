import React, { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebaseConfig';

const formatToDPP = (totalPcs, conversions) => {
  if (!totalPcs || !conversions) return '0.0.0';
  const dosInPcs = conversions.Dos?.inPcs || (conversions.Pack?.inPcs || 1);
  const packInPcs = conversions.Pack?.inPcs || 1;
  return `${Math.floor(totalPcs / dosInPcs)}.${Math.floor((totalPcs % dosInPcs) / packInPcs)}.${totalPcs % packInPcs}`;
};

function KantorPusat({ userProfile, setPage }) {
  const [loading, setLoading] = useState(true);
  const [allDepots, setAllDepots] = useState([]);
  const [masterItems, setMasterItems] = useState({});
  const [consolidatedStock, setConsolidatedStock] = useState([]);
  const [selectedDepot, setSelectedDepot] = useState('semua');

  useEffect(() => {
    const depotsRef = ref(db, 'depots');
    onValue(depotsRef, (snapshot) => {
      const data = snapshot.val() || {};
      const depotList = Object.keys(data).map(key => ({ id: key, name: data[key].info.name }));
      setAllDepots(depotList);
    });

    const masterItemsRef = ref(db, 'master_items');
    onValue(masterItemsRef, (snapshot) => {
      setMasterItems(snapshot.val() || {});
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    const stockRef = ref(db, 'depots');
    onValue(stockRef, (snapshot) => {
      const allDepotData = snapshot.val() || {};
      const stockSummary = {};

      Object.keys(allDepotData).forEach(depotId => {
        if (selectedDepot !== 'semua' && depotId !== selectedDepot) return;
        const stockItems = allDepotData[depotId].stock || {};
        Object.keys(stockItems).forEach(itemId => {
          if (!stockSummary[itemId]) {
            stockSummary[itemId] = { total: 0, damaged: 0 };
          }
          stockSummary[itemId].total += stockItems[itemId].totalStockInPcs || 0;
          stockSummary[itemId].damaged += stockItems[itemId].damagedStockInPcs || 0;
        });
      });

      const finalData = Object.keys(stockSummary).map(itemId => ({
        id: itemId,
        ...masterItems[itemId],
        totalStock: stockSummary[itemId].total,
        damagedStock: stockSummary[itemId].damaged,
      })).filter(item => item.name); // Hanya tampilkan jika ada data master
      
      setConsolidatedStock(finalData);
      setLoading(false);
    }, { onlyOnce: true });
  }, [selectedDepot, masterItems]);
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Dasbor Kantor Pusat</h1>
      
      <div className="card bg-white shadow-lg w-full">
        <div className="card-body">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <h2 className="card-title">Laporan Stok Gabungan</h2>
            <div className="form-control">
              <label className="label"><span className="label-text">Filter per Depo</span></label>
              <select 
                className="select select-bordered" 
                value={selectedDepot} 
                onChange={(e) => setSelectedDepot(e.target.value)}
              >
                <option value="semua">Semua Depo</option>
                {allDepots.map(depot => (
                  <option key={depot.id} value={depot.id}>{depot.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto mt-4">
            <table className="table table-zebra w-full">
              <thead className="bg-gray-200">
                <tr>
                  <th>Nama Barang</th>
                  <th>Kategori</th>
                  <th>Supplier</th>
                  <th>Total Stok Baik (D.P.P)</th>
                  <th>Total Stok Rusak (D.P.P)</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="5" className="text-center"><span className="loading loading-dots"></span></td></tr>
                ) : consolidatedStock.length === 0 ? (
                  <tr><td colSpan="5" className="text-center p-4">Tidak ada data stok untuk ditampilkan.</td></tr>
                ) : (
                  consolidatedStock.map(item => (
                    <tr key={item.id}>
                      <td className="font-bold">{item.name}</td>
                      <td>{item.category}</td>
                      <td>{item.supplierName}</td>
                      <td>{formatToDPP(item.totalStock, item.conversions)}</td>
                      <td className='text-red-600'>{formatToDPP(item.damagedStock, item.conversions)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
export default KantorPusat;