import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, addDoc, doc, updateDoc, arrayUnion, deleteDoc, arrayRemove } from 'firebase/firestore';
import { Plus, XCircle, MapPin, Layers, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { db } from '../firebase';

export default function BeachZone() {
  const [beaches, setBeaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isBeachModalOpen, setIsBeachModalOpen] = useState(false);
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
  const [selectedBeachId, setSelectedBeachId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  const [beachForm, setBeachForm] = useState({ name: '', area: 'Thiruvanmiyur' });
  // ✅ FIX: fee field add பண்ணோம்
  const [zoneForm, setZoneForm] = useState({ name: '', minDistance: '', maxDistance: '', fee: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchBeaches = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, 'beaches'));
      setBeaches(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error("Error fetching beaches:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBeaches(); }, [fetchBeaches]);

  const handleAddBeach = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const docRef = await addDoc(collection(db, 'beaches'), {
        name: beachForm.name,
        area: beachForm.area,
        zones: []
      });
      setBeaches(prev => [...prev, { id: docRef.id, name: beachForm.name, area: beachForm.area, zones: [] }]);
      setIsBeachModalOpen(false);
      setBeachForm({ name: '', area: 'Thiruvanmiyur' });
    } catch (error) {
      console.error("Error adding beach:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddZone = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const newZone = {
        name: zoneForm.name,
        minDistance: Number(zoneForm.minDistance),
        maxDistance: Number(zoneForm.maxDistance),
        // ✅ FIX: manual fee save பண்றோம்
        fee: Number(zoneForm.fee)
      };
      await updateDoc(doc(db, 'beaches', selectedBeachId), { zones: arrayUnion(newZone) });
      setBeaches(prev => prev.map(b =>
        b.id === selectedBeachId ? { ...b, zones: [...(b.zones || []), newZone] } : b
      ));
      setIsZoneModalOpen(false);
      setZoneForm({ name: '', minDistance: '', maxDistance: '', fee: '' });
    } catch (error) {
      console.error("Error adding zone:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBeach = async (id) => {
    if (window.confirm("Delete this beach and all its zones?")) {
      try {
        await deleteDoc(doc(db, 'beaches', id));
        setBeaches(prev => prev.filter(b => b.id !== id));
      } catch (error) {
        console.error("Error deleting beach:", error);
      }
    }
  };

  const handleDeleteZone = async (beachId, zone) => {
    if (window.confirm(`Delete ${zone.name}?`)) {
      try {
        await updateDoc(doc(db, 'beaches', beachId), { zones: arrayRemove(zone) });
        setBeaches(prev => prev.map(b =>
          b.id === beachId ? { ...b, zones: b.zones.filter(z => z.name !== zone.name) } : b
        ));
      } catch (error) {
        console.error("Error deleting zone:", error);
      }
    }
  };

  const totalPages = Math.ceil(beaches.length / itemsPerPage);
  const paginatedBeaches = beaches.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Beach & Zones</h1>
          <p className="mt-1 text-sm text-gray-500">Manage delivery beaches and distance-based zones.</p>
        </div>
        <button
          onClick={() => setIsBeachModalOpen(true)}
          className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-xl font-medium text-sm hover:bg-orange-600 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add Beach
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        </div>
      ) : beaches.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {paginatedBeaches.map(beach => (
              <div key={beach.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-amber-50 flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-orange-500" /> {beach.name}
                    </h3>
                    <span className={`mt-2 inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${beach.area === 'Thiruvanmiyur' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                      {beach.area}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteBeach(beach.id)}
                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-600 flex items-center gap-1.5">
                      <Layers className="w-4 h-4" /> Zones ({beach.zones?.length || 0})
                    </h4>
                  </div>

                  {beach.zones && beach.zones.length > 0 ? (
                    <div className="space-y-2 flex-1 overflow-y-auto max-h-48 mb-3">
                      {beach.zones.map((zone, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
                          <div>
                            <div className="font-semibold text-sm text-gray-900">{zone.name}</div>
                            <div className="text-xs text-gray-500">{zone.minDistance}m – {zone.maxDistance}m</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${zone.fee <= 20 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                              }`}>
                              ₹{zone.fee}
                            </span>
                            <button
                              onClick={() => handleDeleteZone(beach.id, zone)}
                              className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-sm text-gray-400 italic mb-3 py-4">
                      No zones yet
                    </div>
                  )}

                  <button
                    onClick={() => { setSelectedBeachId(beach.id); setIsZoneModalOpen(true); }}
                    className="w-full text-orange-500 border border-orange-200 hover:bg-orange-50 px-3 py-2 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> Add Zone
                  </button>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-6">
              <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1}
                className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button key={i} onClick={() => setCurrentPage(i + 1)}
                  className={`w-9 h-9 rounded-lg text-sm font-medium ${currentPage === i + 1 ? 'bg-orange-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                  {i + 1}
                </button>
              ))}
              <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <MapPin className="w-8 h-8 text-gray-300" />
          </div>
          <h3 className="text-sm font-semibold text-gray-700">No beaches found</h3>
          <p className="mt-1 text-sm text-gray-400">Add a beach to configure delivery zones.</p>
        </div>
      )}

      {/* Add Beach Modal */}
      {isBeachModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">Add New Beach</h3>
              <button onClick={() => setIsBeachModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Beach Name</label>
                <input
                  type="text" required placeholder="e.g. Besant Nagar Beach"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                  value={beachForm.name}
                  onChange={(e) => setBeachForm({ ...beachForm, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Area</label>
                <select
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                  value={beachForm.area}
                  onChange={(e) => setBeachForm({ ...beachForm, area: e.target.value })}
                >
                  <option value="Thiruvanmiyur">Thiruvanmiyur</option>
                  <option value="Palavakkam">Palavakkam</option>
                  <option value="Besant Nagar">Besant Nagar</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setIsBeachModalOpen(false)} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600">Cancel</button>
                <button onClick={handleAddBeach} disabled={isSubmitting || !beachForm.name}
                  className="px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
                  {isSubmitting ? "Saving..." : "Save Beach"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✅ FIX: Add Zone Modal - Fee field add பண்ணோம் */}
      {isZoneModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">Add New Zone</h3>
              <button onClick={() => setIsZoneModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zone Name</label>
                <input
                  type="text" placeholder="e.g. Zone 1"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                  value={zoneForm.name}
                  onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Distance (m)</label>
                  <input
                    type="number" min="0" placeholder="0"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                    value={zoneForm.minDistance}
                    onChange={(e) => setZoneForm({ ...zoneForm, minDistance: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Distance (m)</label>
                  <input
                    type="number" min="0" placeholder="100"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                    value={zoneForm.maxDistance}
                    onChange={(e) => setZoneForm({ ...zoneForm, maxDistance: e.target.value })}
                  />
                </div>
              </div>

              {/* ✅ NEW: Manual fee input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delivery Fee (₹) *
                </label>
                <input
                  type="number" min="0" placeholder="e.g. 20"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                  value={zoneForm.fee}
                  onChange={(e) => setZoneForm({ ...zoneForm, fee: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setIsZoneModalOpen(false)} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600">Cancel</button>
                <button
                  onClick={handleAddZone}
                  disabled={isSubmitting || !zoneForm.name || !zoneForm.minDistance || !zoneForm.maxDistance || !zoneForm.fee}
                  className="px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : "Save Zone"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}