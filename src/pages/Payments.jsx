import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { Search, CreditCard, Calendar, X } from 'lucide-react';
import { db } from '../firebase';

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [mobileSearch, setMobileSearch] = useState('');

  useEffect(() => {
    const fetchPayments = async () => {
      try {
        setLoading(true);
        const querySnapshot = await getDocs(collection(db, 'orders'));
        const allOrders = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Sort locally by date (latest first)
        allOrders.sort((a, b) => {
          const aTime = a.createdAt?.toDate?.() || (a.createdAt ? new Date(a.createdAt) : null) || a.date?.toDate?.() || (a.date ? new Date(a.date) : null) || new Date(0);
          const bTime = b.createdAt?.toDate?.() || (b.createdAt ? new Date(b.createdAt) : null) || b.date?.toDate?.() || (b.date ? new Date(b.date) : null) || new Date(0);
          return bTime - aTime;
        });

        setPayments(allOrders);
      } catch (error) {
        console.error("Error fetching payments:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchPayments();
  }, []);

  const filteredPayments = payments.filter(order => {
    // 1. Date Filter
    if (selectedDate) {
      const orderDate = order.createdAt?.toDate?.() || (order.createdAt ? new Date(order.createdAt) : null) || order.date?.toDate?.() || (order.date ? new Date(order.date) : null);
      if (!orderDate) return false;

      const [year, month, day] = selectedDate.split('-').map(Number);
      const isSameDate = orderDate.getFullYear() === year &&
                         orderDate.getMonth() === month - 1 &&
                         orderDate.getDate() === day;
      if (!isSameDate) return false;
    }

    // 2. Mobile Filter
    if (mobileSearch.trim()) {
      const search = mobileSearch.trim().toLowerCase();
      const phone = (order.customerPhone || order.customerMobile || order.userId || '').toString().toLowerCase();
      if (!phone.includes(search)) return false;
    }

    return true;
  });

  const totalRevenue = filteredPayments
    .filter(o => o.paymentStatus === 'paid')
    .reduce((sum, o) => sum + (Number(o.totalAmount) || Number(o.total) || 0), 0);

  const formatOrderDate = (order) => {
    const dateObj = order.createdAt?.toDate?.() || (order.createdAt ? new Date(order.createdAt) : null) || order.date?.toDate?.() || (order.date ? new Date(order.date) : null);
    if (!dateObj) return '—';
    return dateObj.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }) + ' ' + dateObj.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStatusBadge = (status) => {
    const cleanStatus = (status || '').toLowerCase();
    if (cleanStatus === 'paid' || cleanStatus === 'success') {
      return (
        <span className="px-3 py-1 inline-flex text-xs font-semibold rounded-full bg-green-50 text-green-700 border border-green-200 shadow-sm animate-fade-in">
          Paid
        </span>
      );
    } else if (cleanStatus === 'pending' || cleanStatus === 'processing') {
      return (
        <span className="px-3 py-1 inline-flex text-xs font-semibold rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200 shadow-sm animate-fade-in">
          Pending
        </span>
      );
    } else {
      return (
        <span className="px-3 py-1 inline-flex text-xs font-semibold rounded-full bg-red-50 text-red-700 border border-red-200 shadow-sm animate-fade-in">
          Failed
        </span>
      );
    }
  };

  const formatDateLabel = (dateStr) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
          <p className="mt-1 text-sm text-gray-500">Track and filter payment records dynamically.</p>
        </div>
      </div>

      {/* Filters Panel */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Date Picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Date</label>
            <div className="relative flex gap-2">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="date"
                  className="block w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary sm:text-sm text-gray-700 bg-white shadow-sm"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
                {selectedDate && (
                  <button
                    onClick={() => setSelectedDate('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Search by Mobile */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Customer Mobile</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary sm:text-sm text-gray-700 bg-white shadow-sm"
                placeholder="Search mobile, e.g. 9876543210"
                value={mobileSearch}
                onChange={(e) => setMobileSearch(e.target.value)}
              />
              {mobileSearch && (
                <button
                  onClick={() => setMobileSearch('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Banner */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500">
                {selectedDate ? `Date Filter: ${formatDateLabel(selectedDate)}` : 'Showing All Payments'}
              </p>
              <h2 className="text-xl font-bold text-gray-900 mt-1">
                {filteredPayments.length} order{filteredPayments.length !== 1 ? 's' : ''} found
              </h2>
            </div>
            <div className="bg-green-50 rounded-xl p-4 border border-green-100 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500 text-white">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-green-800 uppercase tracking-wider">Total Paid Revenue</p>
                <p className="text-2xl font-black text-green-700">₹{totalRevenue.toLocaleString('en-IN')}</p>
              </div>
            </div>
          </div>

          {/* Payments Table */}
          {filteredPayments.length > 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Order ID</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer Mobile</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date & Time</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredPayments.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold font-mono text-orange-600">
                          #{order.id.slice(0, 8).toUpperCase()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {order.customerPhone || order.customerMobile || order.userId || '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                          ₹{(Number(order.totalAmount) || Number(order.total) || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatOrderDate(order)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(order.paymentStatus)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
              <CreditCard className="mx-auto h-12 w-12 text-gray-300" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No transactions found</h3>
              <p className="mt-1 text-sm text-gray-500">No payment records match your filters.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}