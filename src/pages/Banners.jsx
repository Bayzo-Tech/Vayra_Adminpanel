import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { Plus, XCircle, Image as ImageIcon, Camera, Trash2, Pencil, X, Check } from 'lucide-react';
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

export default function Banners() {
  const [banners, setBanners] = useState([]);
  const [categories, setCategories] = useState([]);
  const [foods, setFoods] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);

  const [formData, setFormData] = useState({
    title: '',
    categoryIds: [],
    foodIds: [],
    discountPercent: '0',
    status: 'Active',
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');

  // ✅ NEW: dropdown selector state
  const [areaFilter, setAreaFilter] = useState('');
  const [browseCategoryId, setBrowseCategoryId] = useState(''); // which category's foods are shown below the dropdown

  const fetchData = useCallback(async () => {
    try {
      const bannerSnap = await getDocs(query(collection(db, 'banners'), orderBy('orderIndex', 'asc')));
      setBanners(bannerSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error('Error fetching banners (orderBy failed, trying without):', error);
      try {
        const fallbackSnap = await getDocs(collection(db, 'banners'));
        setBanners(fallbackSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (fallbackError) {
        console.error('Fallback banner fetch also failed:', fallbackError);
      }
    }

    try {
      const catSnap = await getDocs(collection(db, 'categories'));
      setCategories(catSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error('Error fetching categories:', error);
    }

    try {
      const foodSnap = await getDocs(collection(db, 'foods'));
      setFoods(foodSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error('Error fetching foods:', error);
    }

    try {
      const beachSnap = await getDocs(collection(db, 'beaches'));
      const uniqueAreas = [...new Set(beachSnap.docs.map(d => d.data().area).filter(Boolean))];
      setAreas(uniqueAreas);
    } catch (error) {
      console.error('Error fetching areas:', error);
    }

    setLoading(false);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch inside effect; setState after await is safe here
    fetchData();
  }, [fetchData]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  // Categories filtered by selected area
  const filteredCategories = categories.filter(cat => {
    if (!areaFilter) return true;
    if (!cat.area) return true;
    return cat.area === areaFilter || cat.area === 'Both';
  });

  const browseCategoryFoods = browseCategoryId ? foods.filter(f => f.categoryId === browseCategoryId) : [];
  const browseCategorySelected = browseCategoryId ? formData.categoryIds.includes(browseCategoryId) : false;

  // ✅ Toggle whole category — adding it clears any individually-selected foods from it
  const toggleWholeCategory = (catId) => {
    setFormData(prev => {
      const exists = prev.categoryIds.includes(catId);
      const catFoodIds = foods.filter(f => f.categoryId === catId).map(f => f.id);
      return {
        ...prev,
        categoryIds: exists
          ? prev.categoryIds.filter(id => id !== catId)
          : [...prev.categoryIds, catId],
        foodIds: prev.foodIds.filter(fid => !catFoodIds.includes(fid)),
      };
    });
  };

  // ✅ Toggle a single food within the browsed category
  const toggleFood = (foodId) => {
    setFormData(prev => {
      const exists = prev.foodIds.includes(foodId);
      return {
        ...prev,
        foodIds: exists
          ? prev.foodIds.filter(id => id !== foodId)
          : [...prev.foodIds, foodId],
      };
    });
  };

  const handleRemoveCategory = (catId) => {
    setFormData(prev => ({ ...prev, categoryIds: prev.categoryIds.filter(id => id !== catId) }));
  };

  const handleRemoveFood = (foodId) => {
    setFormData(prev => ({ ...prev, foodIds: prev.foodIds.filter(id => id !== foodId) }));
  };

  const handleAddBanner = async (e) => {
    e.preventDefault();
    if (formData.categoryIds.length === 0 && formData.foodIds.length === 0) {
      alert('Please select at least one category or food item');
      return;
    }
    if (!editingBanner && !imageFile) {
      alert('Please upload a banner image');
      return;
    }
    setIsSubmitting(true);
    try {
      let imageUrl = editingBanner?.imageUrl || "";
      if (imageFile) {
        imageUrl = await uploadToCloudinary(imageFile);
      }
      const bannerData = {
        title: formData.title,
        imageUrl,
        categoryIds: formData.categoryIds,
        foodIds: formData.foodIds,
        discountPercent: Number(formData.discountPercent),
        status: formData.status,
        orderIndex: editingBanner?.orderIndex ?? banners.length,
      };

      if (editingBanner) {
        await updateDoc(doc(db, 'banners', editingBanner.id), bannerData);
        setBanners(prev => prev.map(b => b.id === editingBanner.id ? { id: editingBanner.id, ...bannerData } : b));
      } else {
        const docRef = await addDoc(collection(db, 'banners'), bannerData);
        setBanners(prev => [...prev, { id: docRef.id, ...bannerData }]);
      }
      closeModal();
    } catch (error) {
      console.error('Error saving banner:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBanner = async (id) => {
    if (window.confirm('Delete this banner?')) {
      try {
        await deleteDoc(doc(db, 'banners', id));
        setBanners(prev => prev.filter(b => b.id !== id));
      } catch (error) {
        console.error('Error deleting banner:', error);
      }
    }
  };

  const handleEditBanner = (banner) => {
    setEditingBanner(banner);
    setFormData({
      title: banner.title || '',
      categoryIds: banner.categoryIds || [],
      foodIds: banner.foodIds || [],
      discountPercent: banner.discountPercent?.toString() || '0',
      status: banner.status || 'Active',
    });
    setImagePreview(banner.imageUrl || '');
    setImageFile(null);
    setAreaFilter('');
    setBrowseCategoryId('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingBanner(null);
    setFormData({ title: '', categoryIds: [], foodIds: [], discountPercent: '0', status: 'Active' });
    setImagePreview('');
    setImageFile(null);
    setAreaFilter('');
    setBrowseCategoryId('');
  };

  const getCategoryName = (id) => categories.find(c => c.id === id)?.name || 'Unknown';
  const getFoodName = (id) => foods.find(f => f.id === id)?.name || 'Unknown';

  const getCategoryNames = (ids) => {
    return (ids || [])
      .map(id => categories.find(c => c.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  };

  const getSelectionSummary = (banner) => {
    const catCount = (banner.categoryIds || []).length;
    const foodCount = (banner.foodIds || []).length;
    const parts = [];
    if (catCount > 0) parts.push(`${catCount} categor${catCount > 1 ? 'ies' : 'y'}`);
    if (foodCount > 0) parts.push(`${foodCount} food item${foodCount > 1 ? 's' : ''}`);
    return parts.length > 0 ? parts.join(' + ') : 'No selection';
  };

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Banners</h1>
          <p className="mt-1 text-sm text-gray-500">Manage promotional banners with category-based discounts, shown on the user app homepage.</p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-orange-600 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Banner
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        </div>
      ) : banners.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-16 text-center">
          <ImageIcon className="mx-auto h-12 w-12 text-gray-300 mb-3" />
          <h3 className="text-sm font-medium text-gray-900">No banners found</h3>
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-4 inline-flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600"
          >
            <Plus className="w-4 h-4" /> Add First Banner
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {banners.map((banner) => (
            <div key={banner.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden group">
              <div className="relative h-48 bg-gray-100 flex items-center justify-center overflow-hidden">
                {banner.imageUrl ? (
                  <img src={banner.imageUrl} alt={banner.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <ImageIcon className="w-12 h-12 text-gray-300" />
                )}
                <div className="absolute top-2 right-2 flex gap-2">
                  {banner.discountPercent > 0 && (
                    <span className="px-2 py-1 text-xs font-bold rounded-md shadow-sm bg-green-500 text-white">
                      {banner.discountPercent}% OFF
                    </span>
                  )}
                  <span className={`px-2 py-1 text-xs font-semibold rounded-md shadow-sm ${
                    banner.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {banner.status}
                  </span>
                </div>
              </div>
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-bold text-gray-900">{banner.title || 'Untitled'}</h3>
                  <div className="flex gap-3 text-sm flex-shrink-0 ml-2">
                    <button onClick={() => handleEditBanner(banner)} className="text-primary hover:text-orange-700">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeleteBanner(banner.id)} className="text-red-600 hover:text-red-800">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  📂 {getSelectionSummary(banner)}
                </p>
                {banner.categoryIds?.length > 0 && (
                  <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1">{getCategoryNames(banner.categoryIds)}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Banner Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">{editingBanner ? 'Edit Banner' : 'Add New Banner'}</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleAddBanner} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Banner Title</label>
                <input type="text" placeholder="e.g. Summer Sale"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
              </div>

              {/* Area dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Area *</label>
                <select
                  className="w-full px-3 py-2.5 border border-orange-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                  value={areaFilter}
                  onChange={(e) => {
                    setAreaFilter(e.target.value);
                    setBrowseCategoryId('');
                  }}
                >
                  <option value="">Select an area</option>
                  {areas.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>

              {/* ✅ Category dropdown — selecting it shows the whole-category checkbox + food checklist right below */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Browse Category</label>
                <select
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                  value={browseCategoryId}
                  onChange={(e) => setBrowseCategoryId(e.target.value)}
                  disabled={!areaFilter}
                >
                  <option value="">{areaFilter ? 'Select a category' : 'Select an area first'}</option>
                  {filteredCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>

                {/* ✅ Foods of the browsed category — appear right here as checkboxes */}
                {browseCategoryId && (
                  <div className="mt-3 border border-gray-200 rounded-xl overflow-hidden">
                    <label className={`flex items-center gap-2 px-3 py-2.5 border-b border-gray-200 cursor-pointer transition-colors ${
                      browseCategorySelected ? 'bg-orange-50' : 'bg-gray-50 hover:bg-gray-100'
                    }`}>
                      <span
                        onClick={(e) => { e.preventDefault(); toggleWholeCategory(browseCategoryId); }}
                        className={`w-4 h-4 rounded flex items-center justify-center border-2 flex-shrink-0 ${
                          browseCategorySelected ? 'bg-orange-500 border-orange-500' : 'border-gray-300 bg-white'
                        }`}
                      >
                        {browseCategorySelected && <Check className="w-3 h-3 text-white" />}
                      </span>
                      <span className="text-sm font-semibold text-gray-700">
                        Select entire "{getCategoryName(browseCategoryId)}" category ({browseCategoryFoods.length} items)
                      </span>
                    </label>

                    <div className="max-h-52 overflow-y-auto p-2">
                      {browseCategoryFoods.length === 0 ? (
                        <p className="text-xs text-gray-400 py-2 px-1">No food items in this category yet.</p>
                      ) : (
                        browseCategoryFoods.map(food => {
                          const foodSelected = browseCategorySelected || formData.foodIds.includes(food.id);
                          return (
                            <button
                              type="button"
                              key={food.id}
                              onClick={() => !browseCategorySelected && toggleFood(food.id)}
                              disabled={browseCategorySelected}
                              className={`w-full flex items-center justify-between text-sm py-2 px-2 rounded-lg ${
                                browseCategorySelected ? 'opacity-60 cursor-not-allowed' : 'hover:bg-gray-50'
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                <span className={`w-3.5 h-3.5 rounded flex items-center justify-center border-2 flex-shrink-0 ${
                                  foodSelected ? 'bg-orange-500 border-orange-500' : 'border-gray-300'
                                }`}>
                                  {foodSelected && <Check className="w-2.5 h-2.5 text-white" />}
                                </span>
                                <span className="text-gray-600">🍽️ {food.name}</span>
                              </span>
                              <span className="text-gray-400 text-xs">₹{food.price}</span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ✅ Separate summary box — shows everything selected so far (categories + foods) */}
              {(formData.categoryIds.length > 0 || formData.foodIds.length > 0) && (
                <div className="border border-gray-200 rounded-xl p-3 bg-gray-50">
                  <p className="text-xs font-semibold text-gray-500 mb-2">Selected for this banner</p>
                  <div className="flex flex-wrap gap-2">
                    {formData.categoryIds.map(catId => (
                      <span key={catId} className="flex items-center gap-1.5 bg-orange-100 text-orange-700 text-xs font-medium px-2.5 py-1 rounded-full">
                        📂 {getCategoryName(catId)} (whole)
                        <button type="button" onClick={() => handleRemoveCategory(catId)} className="hover:text-orange-900">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    {formData.foodIds.map(foodId => (
                      <span key={foodId} className="flex items-center gap-1.5 bg-white text-gray-700 text-xs font-medium px-2.5 py-1 rounded-full border border-gray-200">
                        🍽️ {getFoodName(foodId)}
                        <button type="button" onClick={() => handleRemoveFood(foodId)} className="hover:text-gray-900">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Discount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Discount (%)</label>
                <input type="number" min="0" max="100" placeholder="e.g. 20"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                  value={formData.discountPercent}
                  onChange={(e) => setFormData({ ...formData, discountPercent: e.target.value })} />
                <p className="text-xs text-gray-400 mt-1">Applied to all selected categories and food items when customer opens this banner.</p>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Banner Image *</label>
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
                        <p className="text-xs text-gray-400">PNG, JPG up to 5MB (recommended 800x400)</p>
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
                <button type="submit" disabled={isSubmitting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 disabled:opacity-60">
                  {isSubmitting
                    ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</>
                    : editingBanner ? 'Update Banner' : 'Save Banner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}