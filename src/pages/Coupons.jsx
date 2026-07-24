import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, doc, deleteDoc } from 'firebase/firestore';
import { Plus, XCircle, Ticket, Trash2, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { db } from '../firebase';

export default function Coupons() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    discount: '',
    minOrder: '',
    expiry: '',
    status: 'Active',
    usageLimit: '',      // ✅ NEW: total number of times this coupon can be used (across all customers)
    oneTimePerUser: true // ✅ NEW: restrict each customer to using this coupon only once
  });

  const fetchCoupons = async () => {
    try {
      const col = collection(db, 'coupons');
      const snap = await getDocs(col);
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCoupons(list);
    } catch (error) {
      console.error("Error fetching coupons:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch; state updates happen after the awaited firestore call, not synchronously
    fetchCoupons();
  }, []);

  const handleAddCoupon = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const couponData = {
        name: formData.name,
        code: formData.code.toUpperCase(),
        discount: Number(formData.discount),
        minOrder: Number(formData.minOrder),
        expiry: formData.expiry,
        status: formData.status,
        usageLimit: formData.usageLimit ? Number(formData.usageLimit) : null, // ✅ NEW: null means unlimited
        usageCount: 0, // ✅ NEW: tracks how many times this coupon has been used so far
        oneTimePerUser: formData.oneTimePerUser, // ✅ NEW
        createdAt: new Date()
      };
      const docRef = await addDoc(collection(db, 'coupons'), couponData);
      setCoupons([...coupons, { id: docRef.id, ...couponData }]);
      setIsModalOpen(false);
      setFormData({ name: '', code: '', discount: '', minOrder: '', expiry: '', status: 'Active', usageLimit: '', oneTimePerUser: true });
    } catch (error) {
      console.error("Error adding coupon:", error);
      alert("Failed to add coupon");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCoupon = async (id) => {
    if (window.confirm("Are you sure you want to delete this coupon?")) {
      try {
        await deleteDoc(doc(db, 'coupons', id));
        setCoupons(coupons.filter(c => c.id !== id));
      } catch (error) {
        console.error("Error deleting coupon:", error);
        alert("Failed to delete coupon");
      }
    }
  };

  const getAutoStatus = (coupon) => {
    if (coupon.status === 'Inactive') return 'Inactive';
    const today = new Date().toISOString().split('T')[0];
    if (coupon.expiry && coupon.expiry < today) return 'Expired';
    // ✅ NEW: if usage limit reached, show as "Limit Reached" instead of Active
    if (coupon.usageLimit && (coupon.usageCount || 0) >= coupon.usageLimit) return 'Limit Reached';
    return 'Active';
  };

  // Pagination logic
  const totalPages = Math.ceil(coupons.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCoupons = coupons.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Coupons</h1>
          <p className="mt-1 text-sm text-gray-500">Manage promotional codes and discounts.</p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-orange-600 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Coupon
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : coupons.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedCoupons.map((coupon) => {
              const currentStatus = getAutoStatus(coupon);
              return (
                <div key={coupon.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:shadow-md transition-all duration-200 relative">
                  <div className="p-6 flex-1 flex flex-col border-b border-dashed border-gray-200">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-2 bg-orange-50 text-primary px-3 py-1.5 rounded-lg border border-orange-100">
                        <Ticket className="w-5 h-5" />
                        <span className="font-mono font-bold tracking-wider text-lg">{coupon.code}</span>
                      </div>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        currentStatus === 'Active' ? 'bg-green-100 text-green-800' :
                        currentStatus === 'Expired' ? 'bg-red-100 text-red-800' :
                        currentStatus === 'Limit Reached' ? 'bg-orange-100 text-orange-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {currentStatus}
                      </span>
                    </div>
                    
                    <h3 className="text-sm font-medium text-gray-500 mb-1">{coupon.name}</h3>
                    <div className="flex items-baseline gap-1 mb-4">
                      <span className="text-3xl font-bold text-gray-900">{coupon.discount}%</span>
                      <span className="text-sm font-medium text-gray-500">OFF</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mt-auto">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Min Order</p>
                        <p className="text-sm font-semibold text-gray-900">₹{coupon.minOrder}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Expires On</p>
                        <p className="text-sm font-semibold text-gray-900">{coupon.expiry}</p>
                      </div>
                    </div>

                    {/* ✅ NEW: usage stats row */}
                    <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-gray-100">
                      <div>
                        <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                          <Users className="w-3 h-3" /> Usage
                        </p>
                        <p className="text-sm font-semibold text-gray-900">
                          {coupon.usageCount || 0}{coupon.usageLimit ? ` / ${coupon.usageLimit}` : ' (unlimited)'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Per User</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {coupon.oneTimePerUser ? 'Once only' : 'Unlimited'}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-3 flex justify-end">
                    <button 
                      onClick={() => handleDeleteCoupon(coupon.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
                    >
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  </div>
                  
                  {/* Decorative ticket cutouts */}
                  <div className="absolute left-0 top-2/3 -translate-y-1/2 -ml-3 w-6 h-6 bg-background rounded-full border-r border-gray-100"></div>
                  <div className="absolute right-0 top-2/3 -translate-y-1/2 -mr-3 w-6 h-6 bg-background rounded-full border-l border-gray-100"></div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-8">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-gray-200 text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              
              <div className="flex gap-1">
                {Array.from({ length: totalPages }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentPage(idx + 1)}
                    className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === idx + 1 
                        ? 'bg-primary text-white' 
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>

              <button 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-gray-200 text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <Ticket className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No coupons</h3>
          <p className="mt-1 text-sm text-gray-500">Create a coupon to offer discounts to customers.</p>
        </div>
      )}

      {/* Add Coupon Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">Add New Coupon</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500 transition-colors">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleAddCoupon} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto no-scrollbar">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Coupon Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Welcome Offer"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary sm:text-sm"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. WELCOME50"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary sm:text-sm font-mono uppercase"
                  value={formData.code}
                  onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Discount (%)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="100"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary sm:text-sm"
                    value={formData.discount}
                    onChange={(e) => setFormData({...formData, discount: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Order (₹)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary sm:text-sm"
                    value={formData.minOrder}
                    onChange={(e) => setFormData({...formData, minOrder: e.target.value})}
                  />
                </div>
              </div>

              {/* ✅ NEW: Usage limit + one-time-per-user fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Usage Limit <span className="text-xs text-gray-400 font-normal">(total)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Leave empty = unlimited"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary sm:text-sm"
                    value={formData.usageLimit}
                    onChange={(e) => setFormData({...formData, usageLimit: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Per Customer</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary sm:text-sm"
                    value={formData.oneTimePerUser ? 'once' : 'unlimited'}
                    onChange={(e) => setFormData({...formData, oneTimePerUser: e.target.value === 'once'})}
                  >
                    <option value="once">Once only</option>
                    <option value="unlimited">Unlimited</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                <input
                  type="date"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary sm:text-sm"
                  value={formData.expiry}
                  onChange={(e) => setFormData({...formData, expiry: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary sm:text-sm"
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="flex items-center justify-center min-w-[120px] px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-70 transition-colors">
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Saving...</span>
                    </div>
                  ) : 'Save Coupon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}