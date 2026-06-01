import { useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Search, CreditCard } from 'lucide-react';
import { db } from '../firebase';

export default function Payments() {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setLoading(true);
    setHasSearched(true);
    setSearchResults([]);

    try {
      const clean = searchTerm.replace(/^\+91/, '').replace(/^91/, '').trim();
      const variants = [clean, `91${clean}`, `+91${clean}`];

      let allOrders = [];

      for (const variant of variants) {
        const q1 = query(collection(db, 'orders'), where('customerPhone', '==', variant));
        const snap1 = await getDocs(q1);
        snap1.docs.forEach(d => {
          if (!allOrders.find(o => o.id === d.id)) {
            allOrders.push({ id: d.id, ...d.data() });
          }
        });

        const q2 = query(collection(db, 'orders'), where('userId', '==', variant));
        const snap2 = await getDocs(q2);
        snap2.docs.forEach(d => {
          if (!allOrders.find(o => o.id === d.id)) {
            allOrders.push({ id: d.id, ...d.data() });
          }
        });
      }

      allOrders.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.() || new Date(0);
        const bTime = b.createdAt?.toDate?.() || new Date(0);
        return bTime - aTime;
      });

      setSearchResults(allOrders);
    } catch (error) {
      console.error("Error searching payments:", error);
    } finally {
      setLoading(false);
    }
  };

  const totalRevenue = searchResults
    .filter(o => o.paymentStatus === 'paid')
    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
          <p className="mt-1 text-sm text-gray-500">Search payment history by mobile number.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <form onSubmit={handleSearch} className="max-w-xl">
          <label className="block text-sm font-medium text-gray-700 mb-2">Search by Mobile Number</label>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                required
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary sm:text-sm"
                placeholder="e.g. 9876543210"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-primary text-white px-6 py-2 rounded-lg font-medium text-sm hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : hasSearched && searchResults.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <CreditCard className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No orders found</h3>
          <p className="mt-1 text-sm text-gray-500">No orders found for this mobile number.</p>
        </div>
      ) : searchResults.length > 0 ? (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Customer</p>
              <p className="text-lg font-bold text-gray-900">{searchResults[0]?.customerName || 'Unknown'}</p>
              <p className="text-sm text-gray-400">{searchResults[0]?.customerPhone}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Total Paid</p>
              <p className="text-2xl font-black text-green-600">₹{totalRevenue}</p>
              <p className="text-xs text-gray-400">{searchResults.length} orders</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h4 className="text-sm font-semibold text-gray-900">Order History</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {searchResults.map((order) => (
                    <tr key={order.id}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-orange-600">
                        #{order.id.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {order.createdAt?.toDate
                          ? order.createdAt.toDate().toLocaleDateString('en-IN')
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                        {order.itemsSummary || '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900">
                        ₹{order.totalAmount || 0}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-400 font-mono">
                        {order.paymentId ? order.paymentId.slice(0, 16) + '…' : '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          order.paymentStatus === 'paid'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {order.paymentStatus === 'paid' ? 'Paid' : 'Failed'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}