import { useState, useEffect } from 'react';
import { Users, ShoppingBag, DollarSign, Store, Bike, CheckCircle } from 'lucide-react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    users: 0,
    orders: 0,
    revenue: 0,
    vendors: 0,
    totalPartners: 0,
    activePartners: 0,
  });
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Users
        const usersSnap = await getDocs(collection(db, 'users'));
        const usersCount = usersSnap.size;

        // Orders + Revenue
        let ordersCount = 0;
        let totalRevenue = 0;
        let recentOrdersList = [];
        try {
          const ordersSnap = await getDocs(collection(db, 'orders'));
          ordersCount = ordersSnap.size;
          ordersSnap.docs.forEach(doc => {
            const data = doc.data();
            // ✅ FIX: totalAmount field use பண்றோம்
            totalRevenue += Number(data.totalAmount) || Number(data.total) || 0;
          });
          try {
            const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
            const recentSnap = await getDocs(q);
            recentOrdersList = recentSnap.docs.slice(0, 5).map(doc => ({ id: doc.id, ...doc.data() }));
          } catch {
            recentOrdersList = ordersSnap.docs.slice(0, 5).map(doc => ({ id: doc.id, ...doc.data() }));
          }
        } catch (e) {
          console.warn('Orders error:', e.message);
        }

        // Vendors
        let vendorsCount = 0;
        try {
          const vendorsSnap = await getDocs(collection(db, 'vendors'));
          vendorsCount = vendorsSnap.size;
        } catch (e) {
          console.warn('Vendors error:', e.message);
        }

        // ✅ Delivery Partners
        let totalPartners = 0;
        let activePartners = 0;
        try {
          const partnersSnap = await getDocs(collection(db, 'deliveryPartners'));
          totalPartners = partnersSnap.size;
          activePartners = partnersSnap.docs.filter(d => d.data().status === 'approved').length;
        } catch (e) {
          console.warn('DeliveryPartners error:', e.message);
        }

        setStats({ users: usersCount, orders: ordersCount, revenue: totalRevenue, vendors: vendorsCount, totalPartners, activePartners });
        setRecentOrders(recentOrdersList);
      } catch (error) {
        console.error('Dashboard fetch error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const statCards = [
    {
      name: 'Total Users',
      value: stats.users,
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      path: '/users',
    },
    {
      name: 'Total Orders',
      value: stats.orders,
      icon: ShoppingBag,
      color: 'text-green-600',
      bg: 'bg-green-50',
      path: '/orders',
    },
    {
      name: 'Total Revenue (₹)',
      value: `₹${stats.revenue.toLocaleString('en-IN')}`,
      icon: DollarSign,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      path: null,
    },
    {
      name: 'Active Vendors',
      value: stats.vendors,
      icon: Store,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      path: '/vendors',
    },
    {
      name: 'Total Delivery Partners',
      value: stats.totalPartners,
      icon: Bike,
      color: 'text-pink-600',
      bg: 'bg-pink-50',
      path: '/delivery-partners',
    },
    {
      name: 'Active Partners',
      value: stats.activePartners,
      icon: CheckCircle,
      color: 'text-teal-600',
      bg: 'bg-teal-50',
      path: '/delivery-partners',
    },
  ];

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center min-h-[300px]">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500"></div>
          <p className="text-sm text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Overview of VAYRA platform performance.</p>
      </div>

      {/* ✅ 6 stat cards - clickable */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {statCards.map((item) => (
          <div
            key={item.name}
            onClick={() => item.path && navigate(item.path)}
            className={`bg-white overflow-hidden rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow ${item.path ? 'cursor-pointer hover:border-orange-200' : ''}`}
          >
            <div className="flex flex-col gap-3">
              <div className={`p-2 rounded-xl ${item.bg} w-fit`}>
                <item.icon className={`h-5 w-5 ${item.color}`} />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">{item.name}</p>
                <p className="text-2xl font-bold text-gray-900">{item.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Orders Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Recent Orders</h3>
          <button
            onClick={() => navigate('/orders')}
            className="text-sm text-orange-500 hover:text-orange-700 font-medium"
          >
            View All →
          </button>
        </div>

        {recentOrders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate('/orders')}
                  >
                    <td className="px-6 py-4 text-sm font-medium text-orange-500">
                      #{order.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {order.createdAt?.toDate
                        ? order.createdAt.toDate().toLocaleDateString('en-IN')
                        : order.date?.toDate
                        ? order.date.toDate().toLocaleDateString('en-IN')
                        : 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {order.customerName || order.userName || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900">
                      ₹{order.totalAmount || order.total || 0}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 inline-flex text-xs font-semibold rounded-full ${
                        order.orderStatus === 'delivered' ? 'bg-green-100 text-green-700' :
                        order.orderStatus === 'cancelled' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {order.orderStatus || order.status || 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-10 text-center">
            <div className="text-4xl mb-3">📦</div>
            <p className="text-gray-500">No recent orders found.</p>
          </div>
        )}
      </div>
    </div>
  );
}