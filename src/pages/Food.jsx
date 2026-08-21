import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, doc, deleteDoc, updateDoc, query, where } from 'firebase/firestore';
import { Plus, XCircle, Search, Image as ImageIcon, Camera, Trash2, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { db } from '../firebase';

const CLOUD_NAME = "dvkjhuzdr";
const UPLOAD_PRESET = "bayzo_upload";

const uploadToCloudinary = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("cloud_name", CLOUD_NAME);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData }
  );
  const data = await res.json();
  if (!data.secure_url) throw new Error("Upload failed");
  return data.secure_url;
};

export default function Food() {
  const [foods, setFoods] = useState([]);
  const [categories, setCategories] = useState([]);
  const [areas, setAreas] = useState([]);
  const [approvedVendors, setApprovedVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeArea, setActiveArea] = useState('All');
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingFood, setEditingFood] = useState(null);
  const [formData, setFormData] = useState({
    name: '', description: '', price: '', offer: '0',
    area: '', categoryId: '', stallName: '', foodType: 'veg',
    vendorId: '',
    packingFee: '5'
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');

  const fetchData = async () => {
    try {
      const beachSnap = await getDocs(collection(db, 'beaches'));
      const uniqueAreas = [...new Set(beachSnap.docs.map(d => d.data().area).filter(Boolean))];
      setAreas(uniqueAreas);

      const foodsSnap = await getDocs(collection(db, 'foods'));
      setFoods(foodsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const catSnap = await getDocs(collection(db, 'categories'));
      const catList = catSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCategories(catList);

      const vendorSnap = await getDocs(
        query(collection(db, 'vendors'), where('status', '==', 'approved'))
      );
      // ✅ FIXED: vendor.area was compared with strict `===` against the
      // dropdown's canonical area names, but the raw Firestore value could
      // differ in case or spacing (e.g. "besant nagar", "Besant  Nagar")
      // depending on how it was entered at registration. That silently
      // dropped approved vendors from the "Vendor / Stall" dropdown even
      // though they were correctly approved — showing "No approved vendors
      // for this area" for areas that actually had vendors.
      // This normalizes each vendor's area to match the canonical area name
      // from the beaches collection (case/whitespace-insensitive), same
      // idea as the normalizeArea() used for display grouping in
      // Vendors.jsx, but applied here so the actual filtering works too.
      const normalizeVendorArea = (rawArea) => {
        if (!rawArea) return '';
        const cleaned = rawArea.trim().toLowerCase().replace(/\s+/g, ' ');
        const match = uniqueAreas.find(a => a.trim().toLowerCase().replace(/\s+/g, ' ') === cleaned);
        return match || rawArea; // fallback: keep original if no canonical match found
      };
      const vendorList = vendorSnap.docs.map(d => ({
        id: d.id,
        stallName: d.data().stallName || d.data().name || 'Unknown Stall',
        area: normalizeVendorArea(d.data().area || ''),
      }));
      setApprovedVendors(vendorList);

      const firstArea = uniqueAreas[0] || '';
      const firstVendor = vendorList.find(v => v.area === firstArea || v.area === 'Both') || vendorList[0];
      const firstCat = catList.find(c => c.area === firstArea || c.area === 'Both') || catList[0];

      setFormData(prev => ({
        ...prev,
        area: firstArea,
        categoryId: firstCat?.id || '',
        stallName: firstVendor?.stallName || '',
        vendorId: firstVendor?.id || '',
      }));
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch; state updates happen after the awaited firestore calls, not synchronously
    fetchData();
  }, []);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  // ✅ Vendors filtered by selected area
  const filteredVendorsByArea = approvedVendors.filter(
    v => !formData.area || v.area === formData.area || v.area === 'Both' || formData.area === 'Both'
  );

  // ✅ Categories filtered by selected area
  const filteredModalCategories = categories.filter(
    c => c.area === formData.area || c.area === 'Both'
  );

  const handleVendorChange = (vendorId) => {
    const vendor = approvedVendors.find(v => v.id === vendorId);
    setFormData(prev => ({
      ...prev,
      vendorId,
      stallName: vendor?.stallName || '',
    }));
  };

  // ✅ When area changes: reset vendor AND category to first matching ones
  const handleAreaChange = (newArea) => {
    const matchingVendors = approvedVendors.filter(
      v => v.area === newArea || v.area === 'Both' || newArea === 'Both'
    );
    const matchingCategories = categories.filter(
      c => c.area === newArea || c.area === 'Both'
    );
    const firstVendor = matchingVendors[0];
    const firstCat = matchingCategories[0];
    setFormData(prev => ({
      ...prev,
      area: newArea,
      vendorId: firstVendor?.id || '',
      stallName: firstVendor?.stallName || '',
      categoryId: firstCat?.id || '', // ✅ FIX: reset category to match new area
    }));
  };

  const handleAddFood = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let imageUrl = editingFood?.image || "";
      if (imageFile) {
        imageUrl = await uploadToCloudinary(imageFile);
      }
      const foodData = {
        name: formData.name,
        description: formData.description,
        price: Number(formData.price),
        offer: Number(formData.offer),
        image: imageUrl,
        area: formData.area,
        categoryId: formData.categoryId,
        stallName: formData.stallName,
        vendorId: formData.vendorId,
        foodType: formData.foodType,
        packingFee: Number(formData.packingFee),
        createdAt: editingFood?.createdAt || new Date()
      };

      if (editingFood) {
        await updateDoc(doc(db, 'foods', editingFood.id), foodData);
        setFoods(prev => prev.map(f => f.id === editingFood.id ? { id: editingFood.id, ...foodData } : f));
      } else {
        const docRef = await addDoc(collection(db, 'foods'), foodData);
        setFoods(prev => [...prev, { id: docRef.id, ...foodData }]);
      }
      closeModal();
    } catch (error) {
      console.error('Error saving food:', error);
      alert("Failed to save. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteFood = async (id) => {
    if (window.confirm('Delete this food item?')) {
      try {
        await deleteDoc(doc(db, 'foods', id));
        setFoods(prev => prev.filter(f => f.id !== id));
      } catch (error) {
        console.error('Error:', error);
      }
    }
  };

  const handleEditFood = (food) => {
    setEditingFood(food);
    setFormData({
      name: food.name || '',
      description: food.description || '',
      price: food.price?.toString() || '',
      offer: food.offer?.toString() || '0',
      area: food.area || areas[0] || '',
      categoryId: food.categoryId || categories[0]?.id || '',
      stallName: food.stallName || '',
      vendorId: food.vendorId || '',
      foodType: food.foodType || 'veg',
      packingFee: food.packingFee?.toString() || '5',
    });
    setImagePreview(food.image || '');
    setImageFile(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingFood(null);
    const firstArea = areas[0] || '';
    const firstVendor = approvedVendors.find(v => v.area === firstArea || v.area === 'Both') || approvedVendors[0];
    const firstCat = categories.find(c => c.area === firstArea || c.area === 'Both') || categories[0];
    setFormData({
      name: '', description: '', price: '', offer: '0',
      area: firstArea,
      categoryId: firstCat?.id || '',
      stallName: firstVendor?.stallName || '',
      vendorId: firstVendor?.id || '',
      foodType: 'veg',
      packingFee: '5'
    });
    setImagePreview('');
    setImageFile(null);
  };

  // ✅ REMOVED the useEffect that was incorrectly overriding categoryId on area change
  // handleAreaChange now does this correctly and atomically

  const getCategoryName = (catId) => categories.find(c => c.id === catId)?.name || 'Unknown';

  const filteredFoods = foods.filter(food => {
    const matchesSearch = food.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesArea = activeArea === 'All' || food.area === activeArea || food.area === 'Both';
    const matchesCategory = activeCategory === 'All' || food.categoryId === activeCategory;
    return matchesSearch && matchesArea && matchesCategory;
  });

  const totalPages = Math.ceil(filteredFoods.length / itemsPerPage);
  const paginatedFoods = filteredFoods.slice(
    (currentPage - 1) * itemsPerPage, currentPage * itemsPerPage
  );

  // Reset pagination when filters change (adjusting state during render, per React's guidance for derived state)
  const [prevFilters, setPrevFilters] = useState({ activeArea, activeCategory, searchTerm });
  if (
    prevFilters.activeArea !== activeArea ||
    prevFilters.activeCategory !== activeCategory ||
    prevFilters.searchTerm !== searchTerm
  ) {
    setPrevFilters({ activeArea, activeCategory, searchTerm });
    setCurrentPage(1);
  }

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Food Management</h1>
          <p className="mt-1 text-sm text-gray-500">Manage all food items, prices, and stalls.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="mt-4 sm:mt-0 flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-orange-600 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Food
        </button>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="Search food items..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <select
            className="block w-44 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            value={activeArea}
            onChange={(e) => { setActiveArea(e.target.value); setActiveCategory('All'); }}
          >
            <option value="All">All Areas</option>
            {areas.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select
            className="block w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            value={activeCategory}
            onChange={(e) => setActiveCategory(e.target.value)}
          >
            <option value="All">All Categories</option>
            {categories
              .filter(cat => activeArea === 'All' || cat.area === activeArea || cat.area === 'Both')
              .map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
          </select>
        </div>
      </div>

      {/* Food Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
          </div>
        ) : filteredFoods.length === 0 ? (
          <div className="py-12 text-center">
            <ImageIcon className="mx-auto h-12 w-12 text-gray-300 mb-3" />
            <h3 className="text-sm font-medium text-gray-900">No foods found</h3>
            <button
              onClick={() => setIsModalOpen(true)}
              className="mt-4 inline-flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600"
            >
              <Plus className="w-4 h-4" /> Add First Food
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedFoods.map((food) => (
                <div key={food.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition-all flex flex-col">
                  <div className="aspect-video bg-gray-100 relative overflow-hidden">
                    {food.image ? (
                      <img src={food.image} alt={food.name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-10 h-10 text-gray-300" />
                      </div>
                    )}
                    {food.offer > 0 && (
                      <span className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-md">{food.offer}% OFF</span>
                    )}
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-3.5 h-3.5 rounded-sm border-2 flex items-center justify-center flex-shrink-0 ${food.foodType === 'nonveg' ? 'border-red-500' : 'border-green-500'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${food.foodType === 'nonveg' ? 'bg-red-500' : 'bg-green-500'}`}></span>
                        </span>
                        <h3 className="font-bold text-gray-900 line-clamp-1">{food.name}</h3>
                      </div>
                      <span className="font-bold text-orange-500 ml-2">₹{food.price}</span>
                    </div>
                    {food.stallName && <p className="text-xs text-gray-400 mb-2">🏪 {food.stallName}</p>}
                    <div className="flex gap-1 flex-wrap mb-2">
                      <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">{food.area}</span>
                      <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">{getCategoryName(food.categoryId)}</span>
                      {food.packingFee > 0 && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-orange-50 text-orange-500">📦 ₹{food.packingFee} packing</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 line-clamp-2 flex-1 mb-3">{food.description}</p>
                    <div className="flex justify-end gap-2 pt-3 border-t border-gray-50">
                      <button
                        onClick={() => handleEditFood(food)}
                        className="p-2 text-gray-400 hover:text-blue-500 bg-gray-50 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteFood(food.id)}
                        className="p-2 text-gray-400 hover:text-red-500 bg-gray-50 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-8">
                <button
                  onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button key={i} onClick={() => setCurrentPage(i + 1)}
                    className={`w-10 h-10 rounded-lg text-sm font-medium ${currentPage === i + 1 ? 'bg-orange-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add / Edit Food Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">{editingFood ? 'Edit Food Item' : 'Add New Food Item'}</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleAddFood} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">

              {/* Food Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Food Type *</label>
                <div className="flex gap-3">
                  <button type="button"
                    onClick={() => setFormData({ ...formData, foodType: 'veg' })}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${formData.foodType === 'veg' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500'}`}>
                    <span className="w-4 h-4 rounded-sm border-2 border-green-500 flex items-center justify-center">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    </span>Veg
                  </button>
                  <button type="button"
                    onClick={() => setFormData({ ...formData, foodType: 'nonveg' })}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${formData.foodType === 'nonveg' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500'}`}>
                    <span className="w-4 h-4 rounded-sm border-2 border-red-500 flex items-center justify-center">
                      <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    </span>Non-Veg
                  </button>
                </div>
              </div>

              {/* Area first — so vendor & category filter correctly */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Area *</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                    value={formData.area}
                    onChange={(e) => handleAreaChange(e.target.value)}
                  >
                    {areas.map(a => <option key={a} value={a}>{a}</option>)}
                    <option value="Both">Both</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                  <select required
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  >
                    {filteredModalCategories.length === 0
                      ? <option value="">No categories for this area</option>
                      : filteredModalCategories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Vendor Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vendor / Stall *
                  <span className="ml-2 text-xs text-green-600 font-normal">✓ Approved vendors only</span>
                </label>
                {filteredVendorsByArea.length === 0 ? (
                  <div className="w-full px-3 py-2.5 border border-orange-200 bg-orange-50 rounded-xl text-sm text-orange-600">
                    ⚠️ No approved vendors for this area. Change area or approve vendors first.
                  </div>
                ) : (
                  <select
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                    value={formData.vendorId}
                    onChange={(e) => handleVendorChange(e.target.value)}
                  >
                    <option value="">Select Vendor</option>
                    {filteredVendorsByArea.map(v => (
                      <option key={v.id} value={v.id}>{v.stallName}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Food Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Food Name *</label>
                <input type="text" required placeholder="e.g. Vennila Cone Ice"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <textarea required rows={2} placeholder="Short description..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
              </div>

              {/* Price, Offer & Packing Fee */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹) *</label>
                  <input type="number" required min="0" placeholder="0"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Offer (%)</label>
                  <input type="number" min="0" max="100" placeholder="0"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                    value={formData.offer}
                    onChange={(e) => setFormData({ ...formData, offer: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Packing (₹)</label>
                  <input type="number" min="0" placeholder="5"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                    value={formData.packingFee}
                    onChange={(e) => setFormData({ ...formData, packingFee: e.target.value })} />
                </div>
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Food Image</label>
                <label className="flex justify-center px-6 pt-5 pb-6 border-2 border-gray-200 border-dashed rounded-xl cursor-pointer hover:bg-gray-50 relative transition-colors">
                  <div className="text-center">
                    {imagePreview ? (
                      <div className="flex flex-col items-center gap-2">
                        <img src={imagePreview} alt="Preview" className="h-28 object-contain rounded-xl" />
                        <span className="text-xs text-orange-500 font-medium">Click to change</span>
                      </div>
                    ) : (
                      <>
                        <Camera className="mx-auto h-10 w-10 text-gray-400 mb-2" />
                        <p className="text-sm text-gray-600">
                          <span className="font-medium text-orange-500">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-gray-400">PNG, JPG up to 5MB</p>
                      </>
                    )}
                  </div>
                  <input type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleImageChange} />
                </label>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={closeModal}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting || filteredVendorsByArea.length === 0}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 disabled:opacity-60">
                  {isSubmitting
                    ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Uploading...</>
                    : editingFood ? 'Update Food' : 'Save Food'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
