import { Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Header({ setIsOpen }) {
  const { user } = useAuth();

  return (
    <header className="bg-white shadow-sm border-b border-gray-100 z-10 relative">
      <div className="flex items-center justify-between h-20 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <img src="/bayzo_logo.png" alt="BAYZO" className="h-8 w-auto sm:h-10" />
          <button
            type="button"
            className="p-2 text-gray-500 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
            onClick={() => setIsOpen(true)}
          >
            <span className="sr-only">Open sidebar</span>
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-gray-900">Admin User</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center border border-orange-200">
              <span className="text-primary font-bold text-sm">AD</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
