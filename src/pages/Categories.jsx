import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { Plus, XCircle, Image as ImageIcon, Camera, Trash2, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { db } from '../firebase';
import clsx from 'clsx';

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

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [areas, setAreas] = useState(['All']);
  const [loading, setLoading] = useState(true);
  const [activeArea, setActiveArea] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '', area: '' });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null); // ✅ NEW

  const fetchData = async () => {
    try {
      const beachSnap = await getDocs(collection(db, 'beaches'));
      const uniqueAreas = [...new Set(beachSnap.docs.map(d => d.data().area).filter(Boolean))];
      setAreas(['All', ...uniqueAreas]);
      if (uniqueAreas.length > 0) {
        setFormData(prev => ({ ...prev, area: uniqueAreas[0] }));
      }
      const snap = await getDocs(collection(db, 'categories'));
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeArea]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let imageUrl = editingCategory?.image || "";
      if (imageFile) {
        imageUrl = await uploadToCloudinary(imageFile);
      }
      const categoryData = {
        name: formData.name,
        description: formData.description,
        area: formData.area,
        image: imageUrl,
        createdAt: editingCategory?.createdAt || new Date()
      };

      if (editingCategory) {
        // ✅ NEW: Edit mode — update existing doc
        await updateDoc(doc(db, 'categories', editingCategory.id), categoryData);
        setCategories(prev => prev.map(c => c.id === editingCategory.id ? { id: editingCategory.id, ...categoryData } : c));
      } else {
        // Add new
        const docRef = await addDoc(collection(db, 'categories'), categoryData);
        setCategories(prev => [...prev, { id: docRef.id, ...categoryData }]);
      }
      closeModal();
    } catch (error) {
      console.error("Error saving category:", error);
      alert("Failed to save category. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCategory = async (id) => {
    if (window.confirm("Delete this category?")) {
      try {
        await deleteDoc(doc(db, 'categories', id));
        setCategories(prev => prev.filter(c => c.id !== id));
      } catch (error) {
        console.error("Error deleting:", error);
      }
    }
  };

  // ✅ NEW: Open modal pre-filled for editing
  const handleEditCategory = (category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name || '',
      description: category.description || '',
      area: category.area || areas[1] || '',
    });
    setImagePreview(category.image || '');
    setImageFile(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCategory(null); // ✅ NEW
    setFormData({ name: '', description: '', area: areas[1] || '' });
    setImagePreview('');
    setImageFile(null);
  };

  const filteredCategories = categories.filter(cat =>
    activeArea === 'All' || cat.area === activeArea || cat.area === 'Both'
  );
  const totalPages = Math.ceil(filteredCategories.length / itemsPerPage);
  const paginatedCategories = filteredCategories.slice(
    (currentPage - 1) * itemsPerPage, currentPage * itemsPerPage
  );

  const areaColors = {
    'Thiruvanmiyur': 'bg-orange-100 text-orange-800',
    'Palavakkam': 'bg-blue-100 text-blue-800',
    'Both': 'bg-purple-100 text-purple-800',
  };

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
          <p className="mt-1 text-sm text-gray-500">Manage food categories across different beach areas.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)}
          className="mt-4 sm:mt-0 flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-orange-600 transition-colors">
          <Plus className="w-4 h-4" /> Add Category
        </button>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {areas.map((area) => (
            <button key={area} onClick={() => setActiveArea(area)}
              className={clsx(
                activeArea === area
                  ? "border-orange-500 text-orange-500"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
                "whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors"
              )}>
              {area}
            </button>
          ))}
        </nav>
      </div>

      {loading ? (
        <div className="flex justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        </div>
      ) : filteredCategories.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {paginatedCategories.map((category) => (
              <div key={category.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:shadow-md transition-all duration-200">
                <div className="aspect-video bg-gray-100 flex items-center justify-center overflow-hidden">
                  {category.image ? (
                    <img src={category.image} alt={category.name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <ImageIcon className="w-12 h-12 text-gray-300" />
                  )}
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-bold text-gray-900 line-clamp-1">{category.name}</h3>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${areaColors[category.area] || 'bg-gray-100 text-gray-700'}`}>
                      {category.area}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 flex-1 line-clamp-2 mb-4">{category.description}</p>
                  {/* ✅ NEW: Edit + Delete buttons */}
                  <div className="flex justify-end gap-2 pt-4 border-t border-gray-50">
                    <button onClick={() => handleEditCategory(category)}
                      className="p-2 text-gray-400 hover:text-blue-500 bg-gray-50 hover:bg-blue-50 rounded-lg transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeleteCategory(category.id)}
                      className="p-2 text-gray-400 hover:text-red-500 bg-gray-50 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-8">
              <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1}
                className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
                <ChevronLeft className="w-5 h-5" />
              </button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button key={i} onClick={() => setCurrentPage(i + 1)}
                  className={`w-10 h-10 rounded-lg text-sm font-medium ${currentPage === i + 1 ? 'bg-orange-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                  {i + 1}
                </button>
              ))}
              <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <ImageIcon className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No categories</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by creating a new category.</p>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              {/* ✅ NEW: Dynamic title */}
              <h3 className="text-lg font-bold text-gray-900">{editingCategory ? 'Edit Category' : 'Add New Category'}</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleAddCategory} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input type="text" required placeholder="e.g. Ice Cream"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <textarea required rows={3} placeholder="Short description..."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Image</label>
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
                        <p className="text-sm text-gray-600"><span className="font-medium text-orange-500">Click to upload</span> or drag and drop</p>
                        <p className="text-xs text-gray-400 mt-1">PNG, JPG up to 5MB</p>
                      </>
                    )}
                  </div>
                  <input type="file" accept="image/*"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={handleImageChange} />
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Area *</label>
                <select
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                  value={formData.area}
                  onChange={(e) => setFormData({ ...formData, area: e.target.value })}>
                  {areas.filter(a => a !== 'All').map(area => (
                    <option key={area} value={area}>{area}</option>
                  ))}
                  <option value="Both">Both Areas</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={isSubmitting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 disabled:opacity-60">
                  {isSubmitting
                    ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Uploading & Saving...</>
                    : editingCategory ? 'Update Category' : 'Save Category' /* ✅ NEW: dynamic label */}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}