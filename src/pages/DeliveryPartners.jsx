import { useState, useEffect } from 'react';
import { Bike, Search, CheckCircle, XCircle, Clock, X, User } from 'lucide-react';
import { collection, onSnapshot, doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';

export default function DeliveryPartners() {
  const [searchTerm, setSearchTerm] = useState('');
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [onlineTab, setOnlineTab] = useState('All');
  // ✅ ADDED: surfaces a real error to the admin instead of failing silently in console
  const [updateError, setUpdateError] = useState('');

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'deliveryPartners'), (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setPartners(data);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching delivery partners:', err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const updateStatus = async (uid, newStatus) => {
    setUpdatingId(uid);
    setUpdateError('');
    try {
      // ✅ FIXED: previously these were two separate updateDoc calls.
      // If the first succeeded and the second failed (network blip, rule
      // mismatch, etc.), deliveryPartners.status and partnerProfiles.status
      // went out of sync — admin panel showed "Approved" while the partner
      // app (which listens to partnerProfiles) never left the Pending screen.
      // A batch write makes both updates succeed or fail together.
      const batch = writeBatch(db);
      batch.update(doc(db, 'deliveryPartners', uid), { status: newStatus });
      batch.update(doc(db, 'partnerProfiles', uid), { status: newStatus });
      await batch.commit();

      setPartners(prev => prev.map(p => p.id === uid ? { ...p, status: newStatus } : p));
      if (selectedPartner?.id === uid) {
        setSelectedPartner(prev => ({ ...prev, status: newStatus }));
      }
    } catch (err) {
      console.error('Error updating status:', err);
      // ✅ ADDED: previously this failure was invisible to the admin —
      // the button just did nothing and the UI didn't change, so it looked
      // like a broken button rather than a permissions/network error.
      setUpdateError('Failed to update status. Please check your connection and try again.');
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = partners.filter(p => {
    const matchesSearch =
      (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.phone || '').includes(searchTerm) ||
      (p.area || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesOnline =
      onlineTab === 'All' ||
      (onlineTab === 'Online' && p.isOnline === true) ||
      (onlineTab === 'Offline' && !p.isOnline);
    return matchesSearch && matchesOnline;
  });

  const getStatusBadge = (status) => {
    if (status === 'approved') return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
        <CheckCircle size={12} /> Approved
      </span>
    );
    if (status === 'rejected') return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
        <XCircle size={12} /> Rejected
      </span>
    );
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
        <Clock size={12} /> Pending
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Delivery Partners</h1>
          <p className="mt-1 text-sm text-gray-500">Click any row to view full details & documents.</p>
        </div>
        <span className="mt-3 sm:mt-0 text-xs text-green-600 font-medium bg-green-50 border border-green-200 px-3 py-2 rounded-lg">🟢 Live</span>
      </div>

      {/* ✅ ADDED: visible error banner, only shows when an update actually fails */}
      {updateError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex justify-between items-center">
          <span>{updateError}</span>
          <button onClick={() => setUpdateError('')} className="text-red-400 hover:text-red-600">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="relative max-w-md w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm"
            placeholder="Search by name, phone, or area..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-2">
        {['All', 'Online', 'Offline'].map((tab) => (
          <button
            key={tab}
            onClick={() => setOnlineTab(tab)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              onlineTab === tab
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-white text-gray-600 border-gray-300 hover:border-orange-400'
            }`}
          >
            {tab === 'Online' ? '🟢 Online' : tab === 'Offline' ? '⚫ Offline' : 'All'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-3 text-gray-500">Loading partners...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="h-16 w-16 bg-orange-50 rounded-full flex items-center justify-center mb-4">
              <Bike className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">No delivery partners found</h3>
            <p className="mt-1 text-sm text-gray-500">{searchTerm ? 'No results match your search.' : 'No partners have registered yet.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Partner</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Area</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Age / Gender</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filtered.map((partner) => (
                  <tr
                    key={partner.id}
                    className="hover:bg-orange-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedPartner(partner)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        {partner.selfie ? (
                          <img src={partner.selfie} alt="selfie" className="h-9 w-9 rounded-full object-cover" />
                        ) : (
                          <div className="h-9 w-9 rounded-full bg-orange-100 flex items-center justify-center text-primary font-bold text-sm">
                            {(partner.name || '?')[0].toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-medium text-gray-900">{partner.name || '—'}</div>
                          <div className="text-xs text-gray-400">{partner.email || ''}</div>
                          {partner.isOnline
                            ? <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">🟢 Online</span>
                            : <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">⚫ Offline</span>
                          }
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{partner.phone || '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{partner.area || '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{partner.age || '—'} / {partner.gender || '—'}</td>
                    <td className="px-6 py-4">{getStatusBadge(partner.status)}</td>
                    <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                      {partner.status === 'pending' && (
                        <div className="flex gap-2">
                          <button onClick={() => updateStatus(partner.id, 'approved')} disabled={updatingId === partner.id} className="px-3 py-1 bg-green-500 text-white text-xs rounded-lg hover:bg-green-600 disabled:opacity-50">✓ Approve</button>
                          <button onClick={() => updateStatus(partner.id, 'rejected')} disabled={updatingId === partner.id} className="px-3 py-1 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 disabled:opacity-50">✗ Reject</button>
                        </div>
                      )}
                      {partner.status === 'approved' && (
                        <button onClick={() => updateStatus(partner.id, 'rejected')} disabled={updatingId === partner.id} className="px-3 py-1 bg-red-100 text-red-600 text-xs rounded-lg hover:bg-red-200 disabled:opacity-50">Revoke</button>
                      )}
                      {partner.status === 'rejected' && (
                        <button onClick={() => updateStatus(partner.id, 'approved')} disabled={updatingId === partner.id} className="px-3 py-1 bg-green-100 text-green-600 text-xs rounded-lg hover:bg-green-200 disabled:opacity-50">Re-approve</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedPartner && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setSelectedPartner(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Partner Details</h2>
              <button onClick={() => setSelectedPartner(null)} className="text-gray-400 hover:text-gray-600">
                <X size={22} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                {selectedPartner.selfie ? (
                  <img src={selectedPartner.selfie} alt="selfie" className="h-20 w-20 rounded-full object-cover border-2 border-orange-200" />
                ) : (
                  <div className="h-20 w-20 rounded-full bg-orange-100 flex items-center justify-center">
                    <User size={36} className="text-primary" />
                  </div>
                )}
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{selectedPartner.name}</h3>
                  <p className="text-gray-500 text-sm">{selectedPartner.email || 'No email'}</p>
                  <div className="mt-1">{getStatusBadge(selectedPartner.status)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-xl p-4">
                {[
                  { label: 'Phone', value: selectedPartner.phone },
                  { label: 'Age', value: selectedPartner.age },
                  { label: 'Gender', value: selectedPartner.gender },
                  { label: 'Area', value: selectedPartner.area },
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
                    { label: '🪪 Aadhaar Card', img: selectedPartner.aadhaar },
                    { label: '🚗 Driving License', img: selectedPartner.drivingLicense },
                    { label: '🤳 Selfie', img: selectedPartner.selfie },
                  ].map(({ label, img }) => (
                    <div key={label} className="border border-gray-200 rounded-xl overflow-hidden">
                      <div className="bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600">{label}</div>
                      {img ? (
                        <img src={img} alt={label} className="w-full h-36 object-cover cursor-pointer hover:opacity-90" onClick={() => window.open(img, '_blank')} />
                      ) : (
                        <div className="h-36 flex items-center justify-center text-gray-300 text-sm">Not uploaded</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                {selectedPartner.status === 'pending' && (
                  <>
                    <button onClick={() => updateStatus(selectedPartner.id, 'approved')} disabled={updatingId === selectedPartner.id} className="flex-1 bg-green-500 text-white py-2.5 rounded-xl font-semibold hover:bg-green-600 disabled:opacity-50">✓ Approve</button>
                    <button onClick={() => updateStatus(selectedPartner.id, 'rejected')} disabled={updatingId === selectedPartner.id} className="flex-1 bg-red-500 text-white py-2.5 rounded-xl font-semibold hover:bg-red-600 disabled:opacity-50">✗ Reject</button>
                  </>
                )}
                {selectedPartner.status === 'approved' && (
                  <button onClick={() => updateStatus(selectedPartner.id, 'rejected')} disabled={updatingId === selectedPartner.id} className="flex-1 bg-red-100 text-red-600 py-2.5 rounded-xl font-semibold hover:bg-red-200 disabled:opacity-50">Revoke Approval</button>
                )}
                {selectedPartner.status === 'rejected' && (
                  <button onClick={() => updateStatus(selectedPartner.id, 'approved')} disabled={updatingId === selectedPartner.id} className="flex-1 bg-green-100 text-green-600 py-2.5 rounded-xl font-semibold hover:bg-green-200 disabled:opacity-50">Re-approve</button>
                )}
                <button onClick={() => setSelectedPartner(null)} className="px-6 bg-gray-100 text-gray-600 py-2.5 rounded-xl font-semibold hover:bg-gray-200">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
