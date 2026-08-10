import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteField } from 'firebase/firestore';
import { Store, Search, X } from 'lucide-react';
import { db } from '../firebase';

export default function Vendors() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  const [dutyTab, setDutyTab] = useState('All');
  const [selectedVendorId, setSelectedVendorId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [resolvingField, setResolvingField] = useState(null);

  const selectedVendor = vendors.find(v => v.id === selectedVendorId) || null;

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'vendors'), (snapshot) => {
      const vendorsList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setVendors(vendorsList);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching vendors:', error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleUpdateStatus = async (vendorId, newStatus) => {
    setUpdatingId(vendorId);
    try {
      await updateDoc(doc(db, 'vendors', vendorId), { status: newStatus });
      try {
        await updateDoc(doc(db, 'partnerProfiles', vendorId), { status: newStatus });
      } catch {
        // partnerProfiles may not exist for all vendors
      }
      setVendors(prev => prev.map(v => v.id === vendorId ? { ...v, status: newStatus } : v));
    } catch (error) {
      console.error('Error updating vendor status:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleDuty = async (vendorId, currentDuty) => {
    try {
      await updateDoc(doc(db, 'vendors', vendorId), { isOnDuty: !currentDuty });
      setVendors(prev => prev.map(v => v.id === vendorId ? { ...v, isOnDuty: !currentDuty } : v));
    } catch (error) {
      console.error('Error updating duty status:', error);
    }
  };

  const handleResolvePendingChange = async (vendorId, field, action) => {
    setResolvingField(`${vendorId}-${field}`);
    try {
      const vendor = vendors.find(v => v.id === vendorId);
      const pending = vendor?.pendingImageChanges?.[field];
      if (action === 'approve' && pending) {
        await updateDoc(doc(db, 'vendors', vendorId), {
          [field]: pending.url,
          [`pendingImageChanges.${field}`]: deleteField(),
        });
      } else {
        await updateDoc(doc(db, 'vendors', vendorId), {
          [`pendingImageChanges.${field}`]: deleteField(),
        });
      }
    } catch (error) {
      console.error('Error resolving pending change:', error);
    } finally {
      setResolvingField(null);
    }
  };

  const filteredVendors = vendors.filter(vendor => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      (vendor.name && vendor.name.toLowerCase().includes(searchLower)) ||
      (vendor.phone && vendor.phone.includes(searchLower));
    const vendorStatus = vendor.status || 'pending';
    const matchesTab = activeTab === 'All' || vendorStatus === activeTab;
    const matchesDuty =
      dutyTab === 'All' ||
      (dutyTab === 'On Duty' && vendor.isOnDuty === true) ||
      (dutyTab === 'Off Duty' && !vendor.isOnDuty);
    return matchesSearch && matchesTab && matchesDuty;
  });

  const getStatusBadge = (status) => {
    const s = status || 'pending';
    if (s === 'approved') return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">✓ Approved</span>;
    if (s === 'rejected') return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">✗ Rejected</span>;
    return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">⏳ Pending</span>;
  };

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendors / Stalls</h1>
          <p className="mt-1 text-sm text-gray-500">Click any row to view full details & documents.</p>
        </div>
        <span className="mt-3 sm:mt-0 text-xs text-green-600 font-medium bg-green-50 border border-green-200 px-3 py-2 rounded-lg">🟢 Live</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="relative max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm"
            placeholder="Search vendors by name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {['All', 'approved', 'pending', 'rejected'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm capitalize transition-colors ${
                activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex gap-2">
        {['All', 'On Duty', 'Off Duty'].map((tab) => (
          <button
            key={tab}
            onClick={() => setDutyTab(tab)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              dutyTab === tab
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-white text-gray-600 border-gray-300 hover:border-orange-400'
            }`}
          >
            {tab === 'On Duty' ? '🟢 On Duty' : tab === 'Off Duty' ? '🔴 Off Duty' : 'All'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredVendors.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stall Info</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duty</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredVendors.map((vendor) => (
                  <tr
                    key={vendor.id}
                    className="hover:bg-orange-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedVendorId(vendor.id)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        {vendor.stallImage ? (
                          <img className="h-10 w-10 rounded object-cover" src={vendor.stallImage} alt="" />
                        ) : (
                          <div className="h-10 w-10 rounded bg-orange-50 flex items-center justify-center">
                            <Store className="h-5 w-5 text-primary" />
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-medium text-gray-900">{vendor.stallName || vendor.name || 'Unnamed Stall'}</div>
                          <div className="text-xs text-gray-400">Owner: {vendor.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{vendor.phone || 'N/A'}</div>
                      <div className="text-xs text-gray-500">Age: {vendor.age || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleDuty(vendor.id, vendor.isOnDuty)}
                          className={`relative inline-flex flex-shrink-0 h-5 w-10 border-2 border-transparent rounded-full cursor-pointer transition-colors duration-200 ${vendor.isOnDuty ? 'bg-primary' : 'bg-gray-200'}`}
                        >
                          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition duration-200 ${vendor.isOnDuty ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                        {vendor.isOnDuty
                          ? <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">🟢 On Duty</span>
                          : <span className="text-xs font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">🔴 Off Duty</span>
                        }
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(vendor.status)}</td>
                    <td className="px-6 py-4 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-2">
                        {(vendor.status === 'pending' || vendor.status === 'rejected' || !vendor.status) && (
                          <button onClick={() => handleUpdateStatus(vendor.id, 'approved')} disabled={updatingId === vendor.id} className="px-3 py-1 bg-green-500 text-white text-xs rounded-lg hover:bg-green-600 disabled:opacity-50">✓ Approve</button>
                        )}
                        {(vendor.status === 'pending' || vendor.status === 'approved' || !vendor.status) && (
                          <button onClick={() => handleUpdateStatus(vendor.id, 'rejected')} disabled={updatingId === vendor.id} className="px-3 py-1 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 disabled:opacity-50">✗ Reject</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">No vendors found.</div>
        )}
      </div>

      {/* Vendor Details Modal */}
      {selectedVendor && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setSelectedVendorId(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Vendor Details</h2>
              <button onClick={() => setSelectedVendorId(null)} className="text-gray-400 hover:text-gray-600">
                <X size={22} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                {selectedVendor.stallImage ? (
                  <img src={selectedVendor.stallImage} alt="stall" className="h-20 w-20 rounded-xl object-cover border-2 border-orange-200" />
                ) : (
                  <div className="h-20 w-20 rounded-xl bg-orange-50 flex items-center justify-center">
                    <Store size={36} className="text-primary" />
                  </div>
                )}
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{selectedVendor.stallName || selectedVendor.name}</h3>
                  <p className="text-gray-500 text-sm">Owner: {selectedVendor.name}</p>
                  <div className="mt-1">{getStatusBadge(selectedVendor.status)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-xl p-4">
                {[
                  { label: 'Phone', value: selectedVendor.phone },
                  { label: 'Age', value: selectedVendor.age },
                  { label: 'Stall Open', value: selectedVendor.isOpen ? 'Yes' : 'No' },
                  { label: 'On Duty', value: selectedVendor.isOnDuty ? 'Yes' : 'No' },
                  { label: 'Payment Status', value: selectedVendor.paymentStatus || 'Pending' },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs text-gray-400 font-medium uppercase">{label}</p>
                    <p className="text-sm font-semibold text-gray-800 mt-0.5">{value || '—'}</p>
                  </div>
                ))}
              </div>

              <div>
                <h4 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Documents</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { label: '📋 FSSAI Certificate', field: 'fssaiImage' },
                    { label: '🪪 Aadhaar Card', field: 'aadhaarImage' },
                    { label: '🪪 PAN Card', field: 'panImage' },
                    { label: '🤳 Selfie', field: 'selfie' },
                    { label: '🏪 Selfie at Stall', field: 'selfieFrontStall' },
                    { label: '🏪 Stall Photo', field: 'stallImage' },
                  ].map(({ label, field }) => {
                    const img = selectedVendor[field];
                    const pending = selectedVendor.pendingImageChanges?.[field];
                    const isResolving = resolvingField === `${selectedVendor.id}-${field}`;
                    return (
                      <div key={field} className="border border-gray-200 rounded-xl overflow-hidden">
                        <div className="bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600">{label}</div>
                        {img ? (
                          <img src={img} alt={label} className="w-full h-36 object-cover cursor-pointer hover:opacity-90" onClick={() => window.open(img, '_blank')} />
                        ) : (
                          <div className="h-36 flex items-center justify-center text-gray-300 text-sm">Not uploaded</div>
                        )}
                        {pending && (
                          <div className="border-t border-yellow-200 bg-yellow-50 p-2">
                            <p className="text-[10px] font-semibold text-yellow-700 mb-1">⏳ New image pending approval</p>
                            <img
                              src={pending.url}
                              alt="pending change"
                              className="w-full h-24 object-cover rounded mb-2 cursor-pointer"
                              onClick={() => window.open(pending.url, '_blank')}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleResolvePendingChange(selectedVendor.id, field, 'approve')}
                                disabled={isResolving}
                                className="flex-1 bg-green-500 text-white text-xs py-1.5 rounded-lg hover:bg-green-600 disabled:opacity-50"
                              >
                                ✓ Approve
                              </button>
                              <button
                                onClick={() => handleResolvePendingChange(selectedVendor.id, field, 'reject')}
                                disabled={isResolving}
                                className="flex-1 bg-red-500 text-white text-xs py-1.5 rounded-lg hover:bg-red-600 disabled:opacity-50"
                              >
                                ✗ Reject
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {selectedVendor.paymentHistory && selectedVendor.paymentHistory.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Payment History</h4>
                  <ul className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                    {selectedVendor.paymentHistory.map((payment, idx) => (
                      <li key={idx} className="py-3 px-4 flex justify-between items-center">
                        <div>
                          <p className="text-sm font-medium text-gray-900">₹{payment.amount}</p>
                          <p className="text-xs text-gray-500">
                            {payment.date?.toDate ? new Date(payment.date.toDate()).toLocaleDateString() : payment.date}
                          </p>
                        </div>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${payment.status === 'Done' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {payment.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                {(selectedVendor.status === 'pending' || selectedVendor.status === 'rejected' || !selectedVendor.status) && (
                  <button onClick={() => handleUpdateStatus(selectedVendor.id, 'approved')} disabled={updatingId === selectedVendor.id} className="flex-1 bg-green-500 text-white py-2.5 rounded-xl font-semibold hover:bg-green-600 disabled:opacity-50">✓ Approve</button>
                )}
                {(selectedVendor.status === 'pending' || selectedVendor.status === 'approved' || !selectedVendor.status) && (
                  <button onClick={() => handleUpdateStatus(selectedVendor.id, 'rejected')} disabled={updatingId === selectedVendor.id} className="flex-1 bg-red-500 text-white py-2.5 rounded-xl font-semibold hover:bg-red-600 disabled:opacity-50">✗ Reject</button>
                )}
                <button onClick={() => setSelectedVendorId(null)} className="px-6 bg-gray-100 text-gray-600 py-2.5 rounded-xl font-semibold hover:bg-gray-200">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}