import { useState, useEffect, useRef } from 'react';
import { Users, ShoppingBag, DollarSign, Store, Bike, CheckCircle } from 'lucide-react';
import { collection, query, onSnapshot, where, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  const [nonFilterableStats, setNonFilterableStats] = useState({
    users: 0,
    vendors: 0,
    totalPartners: 0,
    activePartners: 0,
  });

  const [cardStates, setCardStates] = useState({
    totalRevenue: { filter: 'all-time', customStart: null, customEnd: null, value: 0, noOrders: false, dateLabel: '', loading: true },
    todayRevenue: { filter: 'today', customStart: null, customEnd: null, value: 0, noOrders: false, dateLabel: '', loading: true },
    foodRevenue: { filter: 'all-time', customStart: null, customEnd: null, value: 0, noOrders: false, dateLabel: '', loading: true },
    deliveryProfit: { filter: 'all-time', customStart: null, customEnd: null, value: 0, noOrders: false, dateLabel: '', loading: true },
    totalOrders: { filter: 'all-time', customStart: null, customEnd: null, value: 0, noOrders: false, dateLabel: '', loading: true },
    todayOrders: { filter: 'today', customStart: null, customEnd: null, value: 0, noOrders: false, dateLabel: '', loading: true },
  });

  const [settlementStats, setSettlementStats] = useState({
    today: { value: 0, loading: true },
    tomorrow: { value: 0, loading: true },
  });

  const [recentOrders, setRecentOrders] = useState([]);
  const [copiedOrderId, setCopiedOrderId] = useState(null);

  const [activeFilterCard, setActiveFilterCard] = useState(null);
  const [tempFilterType, setTempFilterType] = useState('all-time');
  const [tempCustomStart, setTempCustomStart] = useState('');
  const [tempCustomEnd, setTempCustomEnd] = useState('');

  const unsubscribesRef = useRef({
    totalRevenue: null,
    todayRevenue: null,
    foodRevenue: null,
    deliveryProfit: null,
    totalOrders: null,
    todayOrders: null,
  });

  // ✅ NEW: Bank holiday check — Razorpay doesn't settle on Saturday (6) or Sunday (0)
  const isBankHoliday = (date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  const parseLocalDate = (dateString, isEnd = false) => {
    if (!dateString) return new Date();
    const [year, month, day] = dateString.split('-').map(Number);
    if (isEnd) {
      return new Date(year, month - 1, day, 23, 59, 59, 999);
    }
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  };

  const getDateRange = (filterType, customStart = null, customEnd = null) => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    let start, end;

    switch (filterType) {
      case 'today':
        start = todayStart;
        end = todayEnd;
        break;
      case 'yesterday':
        start = new Date(todayStart);
        start.setDate(start.getDate() - 1);
        end = new Date(todayEnd);
        end.setDate(end.getDate() - 1);
        break;
      case 'last-7-days':
        start = new Date(todayStart);
        start.setDate(start.getDate() - 6);
        end = todayEnd;
        break;
      case 'last-30-days':
        start = new Date(todayStart);
        start.setDate(start.getDate() - 29);
        end = todayEnd;
        break;
      case 'all-time':
        start = new Date(2026, 4, 31, 0, 0, 0);
        end = todayEnd;
        break;
      case 'custom':
        start = customStart ? parseLocalDate(customStart, false) : new Date(2026, 4, 31, 0, 0, 0);
        end = customEnd ? parseLocalDate(customEnd, true) : todayEnd;
        break;
      default:
        start = new Date(2026, 4, 31, 0, 0, 0);
        end = todayEnd;
    }

    return {
      startTimestamp: Timestamp.fromDate(start),
      endTimestamp: Timestamp.fromDate(end),
      startJS: start,
      endJS: end,
    };
  };

  const getDayRange = (daysAgo) => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - daysAgo);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setDate(end.getDate() - daysAgo);
    end.setHours(23, 59, 59, 999);
    return { startTimestamp: Timestamp.fromDate(start), endTimestamp: Timestamp.fromDate(end) };
  };

  const formatDateLabel = (startJS, endJS) => {
    const formatSingle = (date) => {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };
    if (startJS.toDateString() === endJS.toDateString()) {
      return formatSingle(startJS);
    }
    return `${formatSingle(startJS)} – ${formatSingle(endJS)}`;
  };

  const startCardListener = (cardKey, filterType, customStart, customEnd, onFirstLoad = null) => {
    if (unsubscribesRef.current[cardKey]) {
      unsubscribesRef.current[cardKey]();
    }

    setCardStates(prev => ({
      ...prev,
      [cardKey]: {
        ...prev[cardKey],
        filter: filterType,
        customStart,
        customEnd,
        loading: true,
      }
    }));

    const { startTimestamp, endTimestamp, startJS, endJS } = getDateRange(filterType, customStart, customEnd);

    const q = query(
      collection(db, 'orders'),
      where('createdAt', '>=', startTimestamp),
      where('createdAt', '<=', endTimestamp)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      let ordersCount = 0;
      let totalRevenue = 0;
      let foodRevenue = 0;
      let deliveryRevenue = 0;

      snap.docs.forEach((doc) => {
        const data = doc.data();

        const status = (data.orderStatus || data.status || '').toLowerCase();
        const paymentStatus = (data.paymentStatus || '').toLowerCase();
        if (status === 'cancelled' || status === 'failed' || paymentStatus !== 'paid') {
          return;
        }

        ordersCount += 1;
        const orderTotal = Number(data.totalAmount) || Number(data.total) || 0;
        const deliveryFee = Number(data.deliveryFee) || 0;

        totalRevenue += orderTotal;
        foodRevenue += (orderTotal - deliveryFee);
        deliveryRevenue += deliveryFee;
      });

      let finalValue = 0;
      if (cardKey === 'totalRevenue' || cardKey === 'todayRevenue') {
        finalValue = totalRevenue;
      } else if (cardKey === 'foodRevenue') {
        finalValue = foodRevenue;
      } else if (cardKey === 'deliveryProfit') {
        finalValue = deliveryRevenue;
      } else if (cardKey === 'totalOrders' || cardKey === 'todayOrders') {
        finalValue = ordersCount;
      }

      setCardStates(prev => ({
        ...prev,
        [cardKey]: {
          ...prev[cardKey],
          value: finalValue,
          noOrders: ordersCount === 0,
          dateLabel: formatDateLabel(startJS, endJS),
          loading: false,
        }
      }));

      if (onFirstLoad) {
        onFirstLoad();
      }
    }, (err) => {
      console.error(`Error in snapshot listener for ${cardKey}:`, err);
      setCardStates(prev => ({
        ...prev,
        [cardKey]: {
          ...prev[cardKey],
          value: 0,
          noOrders: true,
          dateLabel: formatDateLabel(startJS, endJS),
          loading: false,
        }
      }));
      if (onFirstLoad) {
        onFirstLoad();
      }
    });

    unsubscribesRef.current[cardKey] = unsubscribe;
  };

  const startSettlementListener = (key, daysAgo) => {
    const { startTimestamp, endTimestamp } = getDayRange(daysAgo);
    const q = query(
      collection(db, 'orders'),
      where('createdAt', '>=', startTimestamp),
      where('createdAt', '<=', endTimestamp)
    );
    return onSnapshot(q, (snap) => {
      let total = 0;
      snap.docs.forEach((doc) => {
        const data = doc.data();
        const status = (data.orderStatus || data.status || '').toLowerCase();
        const paymentStatus = (data.paymentStatus || '').toLowerCase();
        if (status === 'cancelled' || status === 'failed' || paymentStatus !== 'paid') return;
        total += Number(data.totalAmount) || Number(data.total) || 0;
      });
      setSettlementStats(prev => ({ ...prev, [key]: { value: total, loading: false } }));
    }, (err) => {
      console.error(`Settlement listener error (${key}):`, err);
      setSettlementStats(prev => ({ ...prev, [key]: { value: 0, loading: false } }));
    });
  };

  useEffect(() => {
    let usersLoaded = false;
    let vendorsLoaded = false;
    let partnersLoaded = false;
    let recentLoaded = false;
    let ordersLoaded = false;

    const loadedCards = {
      totalRevenue: false,
      todayRevenue: false,
      foodRevenue: false,
      deliveryProfit: false,
      totalOrders: false,
      todayOrders: false,
    };

    const checkLoading = () => {
      if (usersLoaded && vendorsLoaded && partnersLoaded && recentLoaded && ordersLoaded) {
        setLoading(false);
      }
    };

    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setNonFilterableStats(prev => ({ ...prev, users: snap.size }));
      usersLoaded = true;
      checkLoading();
    }, (err) => {
      console.error("Users listener error:", err);
      usersLoaded = true;
      checkLoading();
    });

    const unsubscribeVendors = onSnapshot(collection(db, 'vendors'), (snap) => {
      setNonFilterableStats(prev => ({ ...prev, vendors: snap.size }));
      vendorsLoaded = true;
      checkLoading();
    }, (err) => {
      console.error("Vendors listener error:", err);
      vendorsLoaded = true;
      checkLoading();
    });

    const unsubscribePartners = onSnapshot(collection(db, 'deliveryPartners'), (snap) => {
      const totalPartners = snap.size;
      const activePartners = snap.docs.filter(d => d.data().status === 'approved').length;
      setNonFilterableStats(prev => ({ ...prev, totalPartners, activePartners }));
      partnersLoaded = true;
      checkLoading();
    }, (err) => {
      console.error("Partners listener error:", err);
      partnersLoaded = true;
      checkLoading();
    });

    const handleCardFirstLoad = (cardKey) => {
      loadedCards[cardKey] = true;
      if (Object.values(loadedCards).every(Boolean)) {
        ordersLoaded = true;
        checkLoading();
      }
    };

    // eslint-disable-next-line react-hooks/set-state-in-effect -- imperative one-time kickoff of real-time listeners on mount, not derived state
    startCardListener('totalRevenue', 'all-time', null, null, () => handleCardFirstLoad('totalRevenue'));
    startCardListener('todayRevenue', 'today', null, null, () => handleCardFirstLoad('todayRevenue'));
    startCardListener('foodRevenue', 'all-time', null, null, () => handleCardFirstLoad('foodRevenue'));
    startCardListener('deliveryProfit', 'all-time', null, null, () => handleCardFirstLoad('deliveryProfit'));
    startCardListener('totalOrders', 'all-time', null, null, () => handleCardFirstLoad('totalOrders'));
    startCardListener('todayOrders', 'today', null, null, () => handleCardFirstLoad('todayOrders'));

    const unsubTodaySettlement = startSettlementListener('today', 2);
    const unsubTomorrowSettlement = startSettlementListener('tomorrow', 1);

    const startOfBusiness = new Date(2026, 4, 31, 0, 0, 0);
    const qRecent = query(
      collection(db, 'orders'),
      where('createdAt', '>=', Timestamp.fromDate(startOfBusiness)),
      orderBy('createdAt', 'desc')
    );

    let activeUnsubscribeRecent = null;

    const unsubscribeRecent = onSnapshot(qRecent, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecentOrders(list);
      recentLoaded = true;
      checkLoading();
    }, (err) => {
      console.warn("Recent orders query failed, falling back to in-memory filter:", err);
      const unsubscribeFallback = onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc')), (fallbackSnap) => {
        const list = fallbackSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(order => {
            let orderTimestamp = null;
            if (order.createdAt && typeof order.createdAt.toDate === 'function') {
              orderTimestamp = order.createdAt;
            } else if (order.createdAt && order.createdAt.seconds !== undefined) {
              orderTimestamp = new Timestamp(order.createdAt.seconds, order.createdAt.nanoseconds || 0);
            } else if (order.createdAt) {
              orderTimestamp = Timestamp.fromDate(new Date(order.createdAt));
            }
            return orderTimestamp && orderTimestamp.seconds >= Timestamp.fromDate(startOfBusiness).seconds;
          });
        setRecentOrders(list);
        recentLoaded = true;
        checkLoading();
      }, (fallbackErr) => {
        console.error("Fallback recent orders listener failed:", fallbackErr);
        recentLoaded = true;
        checkLoading();
      });

      activeUnsubscribeRecent = unsubscribeFallback;
    });

    activeUnsubscribeRecent = unsubscribeRecent;

    return () => {
      unsubscribeUsers();
      unsubscribeVendors();
      unsubscribePartners();
      unsubTodaySettlement();
      unsubTomorrowSettlement();
      if (activeUnsubscribeRecent) activeUnsubscribeRecent();

      const unsubscribesSnapshot = unsubscribesRef.current;
      Object.values(unsubscribesSnapshot).forEach((unsub) => {
        if (unsub) unsub();
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- startCardListener/startSettlementListener intentionally omitted: one-time mount setup, adding them would cause an infinite resubscribe loop
  }, []);

  const formatCardValue = (key, val) => {
    if (key === 'totalOrders' || key === 'todayOrders') {
      return val;
    }
    return `₹${val.toLocaleString('en-IN')}`;
  };

  const getShortOrderId = (id) => {
    if (!id) return 'N/A';
    return id.length > 8 ? id.substring(0, 8) + '...' : id;
  };

  const formatDateTime = (createdAt) => {
    let d = null;
    if (createdAt && typeof createdAt.toDate === 'function') {
      d = createdAt.toDate();
    } else if (createdAt && createdAt.seconds !== undefined) {
      d = new Date(createdAt.seconds * 1000);
    } else if (createdAt) {
      d = new Date(createdAt);
    }

    if (!d || isNaN(d.getTime())) return '—';

    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }) + ' ' + d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatFoodItems = (order) => {
    if (Array.isArray(order.items) && order.items.length > 0) {
      return order.items.map(item => {
        const name = item.name || 'Unknown Item';
        const qty = item.quantity || item.qty || 1;
        const stall = item.stallName || item.vendorName || '';
        return `${name} x ${qty}${stall ? ` (${stall})` : ''}`;
      }).join(', ');
    }
    return order.itemsSummary || '—';
  };

  const copyToClipboard = (text, e) => {
    e.stopPropagation();
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedOrderId(text);
      setTimeout(() => setCopiedOrderId(null), 2000);
    }).catch(err => {
      console.error("Failed to copy text: ", err);
    });
  };

  const handleCardClick = (item) => {
    if (item.isFilterable) {
      setActiveFilterCard(item.key);
      setTempFilterType(item.filterState.filter);
      setTempCustomStart(item.filterState.customStart || '');
      setTempCustomEnd(item.filterState.customEnd || '');
    } else if (item.path) {
      navigate(item.path);
    }
  };

  const applyFilter = (filterType, start = null, end = null) => {
    if (filterType === 'custom') {
      if (!start || !end) {
        alert("Please select both from and to dates.");
        return;
      }
    }
    startCardListener(activeFilterCard, filterType, start, end);
    setActiveFilterCard(null);
  };

  const statCards = [
    {
      key: 'users',
      name: 'Total Users',
      value: nonFilterableStats.users,
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      path: '/users',
      isFilterable: false,
    },
    {
      key: 'totalOrders',
      name: 'Total Orders',
      value: cardStates.totalOrders.loading ? '...' : formatCardValue('totalOrders', cardStates.totalOrders.value),
      icon: ShoppingBag,
      color: 'text-green-600',
      bg: 'bg-green-50',
      path: null,
      isFilterable: true,
      filterState: cardStates.totalOrders,
    },
    {
      key: 'todayOrders',
      name: 'Today Orders',
      value: cardStates.todayOrders.loading ? '...' : formatCardValue('todayOrders', cardStates.todayOrders.value),
      icon: ShoppingBag,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      path: null,
      isFilterable: true,
      filterState: cardStates.todayOrders,
    },
    {
      key: 'totalRevenue',
      name: 'Total Revenue (₹)',
      value: cardStates.totalRevenue.loading ? '...' : formatCardValue('totalRevenue', cardStates.totalRevenue.value),
      icon: DollarSign,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      path: null,
      isFilterable: true,
      filterState: cardStates.totalRevenue,
    },
    {
      key: 'todayRevenue',
      name: 'Today Revenue (₹)',
      value: cardStates.todayRevenue.loading ? '...' : formatCardValue('todayRevenue', cardStates.todayRevenue.value),
      icon: DollarSign,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      path: null,
      isFilterable: true,
      filterState: cardStates.todayRevenue,
    },
    {
      key: 'foodRevenue',
      name: 'Revenue (Food) (₹)',
      value: cardStates.foodRevenue.loading ? '...' : formatCardValue('foodRevenue', cardStates.foodRevenue.value),
      icon: DollarSign,
      color: 'text-rose-600',
      bg: 'bg-rose-50',
      path: null,
      isFilterable: true,
      filterState: cardStates.foodRevenue,
    },
    {
      key: 'deliveryProfit',
      name: 'Profit (Delivery) (₹)',
      value: cardStates.deliveryProfit.loading ? '...' : formatCardValue('deliveryProfit', cardStates.deliveryProfit.value),
      icon: DollarSign,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      path: null,
      isFilterable: true,
      filterState: cardStates.deliveryProfit,
    },
    {
      key: 'vendors',
      name: 'Active Vendors',
      value: nonFilterableStats.vendors,
      icon: Store,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      path: '/vendors',
      isFilterable: false,
    },
    {
      key: 'totalPartners',
      name: 'Total Delivery Partners',
      value: nonFilterableStats.totalPartners,
      icon: Bike,
      color: 'text-pink-600',
      bg: 'bg-pink-50',
      path: '/delivery-partners',
      isFilterable: false,
    },
    {
      key: 'activePartners',
      name: 'Active Partners',
      value: nonFilterableStats.activePartners,
      icon: CheckCircle,
      color: 'text-teal-600',
      bg: 'bg-teal-50',
      path: '/delivery-partners',
      isFilterable: false,
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

  // ✅ NEW: Precompute whether today/tomorrow fall on a bank holiday (Sat/Sun)
  const todayIsHoliday = isBankHoliday(new Date());
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowIsHoliday = isBankHoliday(tomorrowDate);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Overview of VAYRA platform performance.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {statCards.map((item) => (
          <div
            key={item.name}
            onClick={() => handleCardClick(item)}
            className={`bg-white overflow-hidden rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow cursor-pointer ${item.isFilterable ? 'hover:border-orange-200' : 'hover:border-blue-200'
              }`}
          >
            <div className="flex flex-col gap-3">
              <div className={`p-2 rounded-xl ${item.bg} w-fit`}>
                <item.icon className={`h-5 w-5 ${item.color}`} />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">{item.name}</p>
                <p className="text-2xl font-bold text-gray-900">{item.value}</p>

                {item.isFilterable && (
                  <div className="mt-2 flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-gray-400 bg-gray-50 px-2 py-0.5 rounded border border-gray-100 w-fit">
                      {item.filterState.dateLabel || 'Loading...'}
                    </span>
                    {item.filterState.noOrders && !item.filterState.loading && (
                      <span className="text-[10px] text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-100 w-fit">
                        No orders on this day
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Settlement Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs font-medium text-gray-500">Today's Settlement</p>
          {todayIsHoliday ? (
            <>
              <p className="text-2xl font-bold text-gray-900 mt-1">₹0</p>
              <p className="text-[11px] text-orange-600 font-semibold mt-1">No settlement today (bank holiday)</p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {settlementStats.today.loading ? '...' : `₹${settlementStats.today.value.toLocaleString('en-IN')}`}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">Orders from 2 days ago (T+2 cycle)</p>
            </>
          )}
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs font-medium text-gray-500">Tomorrow's Settlement</p>
          {tomorrowIsHoliday ? (
            <>
              <p className="text-2xl font-bold text-gray-900 mt-1">₹0</p>
              <p className="text-[11px] text-orange-600 font-semibold mt-1">No settlement tomorrow (bank holiday)</p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {settlementStats.tomorrow.loading ? '...' : `₹${settlementStats.tomorrow.value.toLocaleString('en-IN')}`}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">Orders from yesterday · Final amount may vary</p>
            </>
          )}
        </div>
      </div>

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
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Order ID</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Payment ID</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date & Time</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Food Items</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Delivery Fee</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Payment Method</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentOrders.map((order) => {
                  const fullId = order.orderId || order.id || 'N/A';
                  const payId = order.paymentId || '—';
                  const customerName = order.customerName || order.userName || 'Unknown';
                  const customerPhone = order.customerPhone || order.phone || '—';
                  const totalAmt = Number(order.totalAmount) || Number(order.total) || 0;
                  const delFee = Number(order.deliveryFee) || 0;
                  const payMethod = order.paymentMethod || '—';
                  const orderStatus = order.orderStatus || order.status || 'Pending';

                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate('/orders')}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div
                          onClick={(e) => copyToClipboard(fullId, e)}
                          className="cursor-pointer hover:text-orange-600 flex items-center gap-1.5 font-mono text-xs font-bold text-orange-500 w-fit"
                          title="Click to copy full ID"
                        >
                          #{getShortOrderId(fullId)}
                          {copiedOrderId === fullId ? (
                            <span className="text-[10px] text-green-600 bg-green-50 px-1 py-0.5 rounded">Copied!</span>
                          ) : (
                            <svg className="h-3.5 w-3.5 text-gray-400 hover:text-orange-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                            </svg>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {payId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDateTime(order.createdAt || order.date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="font-semibold text-gray-800">{customerName}</div>
                        <div className="text-xs text-gray-500">{customerPhone}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={formatFoodItems(order)}>
                        {formatFoodItems(order)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                        ₹{totalAmt.toLocaleString('en-IN')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        ₹{delFee.toLocaleString('en-IN')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 uppercase font-medium">
                        {payMethod}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 inline-flex text-xs font-semibold rounded-full capitalize ${orderStatus === 'delivered' ? 'bg-green-50 text-green-700 border border-green-200' :
                          orderStatus === 'cancelled' ? 'bg-red-50 text-red-700 border border-red-200' :
                            orderStatus === 'failed' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                              'bg-yellow-50 text-yellow-700 border border-yellow-250'
                          }`}>
                          {orderStatus}
                        </span>
                      </td>
                    </tr>
                  );
                })}
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

      {activeFilterCard && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-gray-100 transform transition-all scale-100">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-950">
                Filter {statCards.find(c => c.key === activeFilterCard)?.name}
              </h3>
              <button
                onClick={() => setActiveFilterCard(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors text-2xl leading-none font-bold"
              >
                &times;
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Today', value: 'today' },
                  { label: 'Yesterday', value: 'yesterday' },
                  { label: 'Last 7 Days', value: 'last-7-days' },
                  { label: 'Last 30 Days', value: 'last-30-days' },
                  { label: 'All Time', value: 'all-time' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => applyFilter(opt.value)}
                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold border text-center transition-all ${tempFilterType === opt.value
                      ? 'bg-orange-500 border-orange-500 text-white shadow-sm'
                      : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                      }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setTempFilterType('custom')}
                  className={`w-full px-4 py-2.5 rounded-xl text-sm font-semibold border text-center transition-all ${tempFilterType === 'custom'
                    ? 'bg-orange-500 border-orange-500 text-white shadow-sm'
                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                >
                  Custom Date Range
                </button>

                {tempFilterType === 'custom' && (
                  <div className="mt-4 space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-150 animate-slide-down">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">From</label>
                        <input
                          type="date"
                          value={tempCustomStart}
                          onChange={(e) => setTempCustomStart(e.target.value)}
                          max={tempCustomEnd || undefined}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">To</label>
                        <input
                          type="date"
                          value={tempCustomEnd}
                          onChange={(e) => setTempCustomEnd(e.target.value)}
                          min={tempCustomStart || undefined}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => applyFilter('custom', tempCustomStart, tempCustomEnd)}
                      className="w-full mt-2 bg-gray-900 text-white py-2 rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors shadow-sm"
                    >
                      Apply Custom Range
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setActiveFilterCard(null)}
                className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors bg-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}