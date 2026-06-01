import { Plus, Image as ImageIcon } from 'lucide-react';

export default function Banners() {
  const banners = [
    { id: 1, title: 'Summer Sale', image: 'https://via.placeholder.com/800x400?text=Summer+Sale+Banner', status: 'Active' },
    { id: 2, title: 'Free Delivery', image: 'https://via.placeholder.com/800x400?text=Free+Delivery+Banner', status: 'Inactive' },
  ];

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Banners</h1>
          <p className="mt-1 text-sm text-gray-500">Manage promotional banners shown on the user app homepage.</p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-orange-600 transition-colors">
            <Plus className="w-4 h-4" /> Add Banner
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {banners.map((banner) => (
          <div key={banner.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden group">
            <div className="relative h-48 bg-gray-100 flex items-center justify-center overflow-hidden">
              {banner.image ? (
                <img src={banner.image} alt={banner.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              ) : (
                <ImageIcon className="w-12 h-12 text-gray-300" />
              )}
              <div className="absolute top-2 right-2">
                <span className={`px-2 py-1 text-xs font-semibold rounded-md shadow-sm ${
                  banner.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {banner.status}
                </span>
              </div>
            </div>
            <div className="p-4 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">{banner.title}</h3>
              <div className="flex gap-3 text-sm">
                <button className="text-primary hover:text-orange-700 font-medium">Edit</button>
                <button className="text-red-600 hover:text-red-800 font-medium">Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
