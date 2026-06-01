import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, orderBy, query, doc, updateDoc } from 'firebase/firestore';

const tabs = ['All', 'Pending', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled'];

const STATUS_OPTIONS = ['placed', 'preparing', 'out for delivery', 'delivered', 'cancelled'];

const statusColors = {
  placed:              'bg-yellow-100 text-yellow-800',
  pending:             'bg-yellow-100 text-yellow-800',
  preparing:           'bg-blue-100 text-blue-800',
  'out for delivery':  'bg-purple-100 text-purple-800',
  delivered:           'bg-green-100 text-green-800',
  cancelled:           'bg-red-100 text-red-800',
  failed:              'bg-red-100 text-red-800',
};

export default function Orders() {
  const [activeTab, setActiveTab] = useState('All');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [sendingOtpId, setSendingOtpId] = useState(null);
  const [otpMessage, setOtpMessage] = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setOrders(fetched);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleStatusChange = async (orderId, newStatus) => {
    setUpdatingId(orderId);
    try {
      await updateDoc(doc(db, 'orders', orderId), { orderStatus: newStatus });
    } catch (e) {
      console.error('Status update error:', e);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSendDeliveryOtp = async (orderId) => {
    setSendingOtpId(orderId);
    setOtpMessage(null);
    try {
      const res = await fetch('/api/send-delivery-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      setOtpMessage({ id: orderId, msg: data.message || 'OTP sent!', ok: data.success });
      setTimeout(() => setOtpMessage(null), 4000);
    } catch {
      setOtpMessage({ id: orderId, msg: 'Failed to send OTP', ok: false });
    } finally {
      setSendingOtpId(null);
    }
  };

  const formatDate = (ts) => {
    if (!ts) return '—';
    try {
      const date = ts.toDate ? ts.toDate() : new Date(ts);
      return new Intl.DateTimeFormat('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      }).format(date);
    } catch { return '—'; }
  };

  const getItemsSummary = (order) => {
    if (order.itemsSummary) return order.itemsSummary;
    if (order.items && order.items.length > 0) {
      return order.items.map(i => `${i.quantity}x ${i.name}`).join(', ');
    }
    return '—';
  };

  const filteredOrders = orders.filter(order => {
    if (activeTab === 'All') return true;
    return order.orderStatus?.toLowerCase() === activeTab.toLowerCase();
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <p className="mt-1 text-sm text-gray-500">Monitor and manage all customer orders.</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-4 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={[
                "whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors",
                activeTab === tab
                  ? "border-orange-500 text-orange-500"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              ].join(' ')}
            >
              {tab}
              <span className="ml-1 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                {tab === 'All'
                  ? orders.length
                  : orders.filter(o => o.orderStatus?.toLowerCase() === tab.toLowerCase()).length}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order ID & Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor & Items</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-orange-500">#{order.id.slice(0, 8).toUpperCase()}</div>
                    <div className="text-xs text-gray-500">{formatDate(order.createdAt)}</div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{order.customerName || 'Unknown'}</div>
                    <div className="text-xs text-gray-500">{order.customerPhone ? '📱 ' + order.customerPhone : '—'}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm font-medium text-gray-900">{order.vendorName || '—'}</div>
                    <div className="text-xs text-gray-500 max-w-xs truncate">{getItemsSummary(order)}</div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    {/* ✅ FIX: totalAmount use பண்றோம் */}
                    <div className="text-sm font-bold text-gray-900">₹{order.totalAmount || order.total || 0}</div>
                    <div className={['text-xs font-medium mt-0.5', order.paymentStatus === 'paid' ? 'text-green-600' : 'text-yellow-600'].join(' ')}>
                      {order.paymentStatus === 'paid' ? '✓ Paid' : '⏳ Pending'}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <select
                      value={order.orderStatus?.toLowerCase() || 'placed'}
                      onChange={(e) => handleStatusChange(order.id, e.target.value)}
                      disabled={updatingId === order.id}
                      className={[
                        "text-xs font-semibold rounded-full px-2 py-1 border-0 cursor-pointer focus:outline-none",
                        statusColors[order.orderStatus?.toLowerCase()] || 'bg-yellow-100 text-yellow-800'
                      ].join(' ')}
                    >
                      {STATUS_OPTIONS.map(s => (
                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                      ))}
                    </select>
                    {updatingId === order.id && (
                      <div className="text-xs text-gray-400 mt-1">Updating...</div>
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    {order.orderStatus?.toLowerCase() === 'out for delivery' && (
                      <div>
                        <button
                          onClick={() => handleSendDeliveryOtp(order.id)}
                          disabled={sendingOtpId === order.id}
                          className="text-xs bg-orange-500 text-white px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50 hover:bg-orange-600 transition-colors"
                        >
                          {sendingOtpId === order.id ? 'Sending...' : '📱 Send OTP'}
                        </button>
                        {otpMessage && otpMessage.id === order.id && (
                          <div className={['text-xs mt-1 font-medium', otpMessage.ok ? 'text-green-600' : 'text-red-500'].join(' ')}>
                            {otpMessage.msg}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500">
                    No orders found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}