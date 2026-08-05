import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Bike, 
  Store, 
  CreditCard, 
  ListTree, 
  Map, 
  UtensilsCrossed, 
  Ticket, 
  ShoppingBag, 
  Star, 
  Image as ImageIcon, 
  Settings, 
  LogOut 
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import clsx from 'clsx';

const menuItems = [
  { path: '/dashboard', name: 'Dashboard', icon: LayoutDashboard },
  { path: '/users', name: 'User Management', icon: Users },
  { path: '/delivery-partners', name: 'Delivery Partners', icon: Bike },
  { path: '/vendors', name: 'Vendors / Stalls', icon: Store },
  { path: '/payments', name: 'Payments', icon: CreditCard },
  { path: '/categories', name: 'Categories', icon: ListTree },
  { path: '/beach-zone', name: 'Beach & Zone', icon: Map },
  { path: '/food', name: 'Food Management', icon: UtensilsCrossed },
  { path: '/coupons', name: 'Coupons', icon: Ticket },
  { path: '/orders', name: 'Orders', icon: ShoppingBag },
  { path: '/ratings', name: 'Ratings & Reviews', icon: Star },
  { path: '/banners', name: 'Banners', icon: ImageIcon },
  { path: '/settings', name: 'Settings', icon: Settings },
];

export default function Sidebar({ isOpen, setIsOpen }) {
  const { logout } = useAuth();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-gray-900/50 z-20 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <div className={clsx(
        "fixed inset-y-0 left-0 z-30 w-64 bg-white shadow-xl transform transition-transform duration-300 ease-in-out flex flex-col",
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="flex items-center justify-center h-20 border-b border-gray-100">
          <span className="text-primary font-black tracking-wider text-2xl">VAYRA</span>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4 no-scrollbar">
          <nav className="space-y-1 px-3">
            {menuItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => clsx(
                  "flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group",
                  isActive 
                    ? "bg-orange-50 text-primary font-bold shadow-sm" 
                    : "text-gray-600 hover:bg-orange-50/50 hover:text-gray-900 hover:translate-x-1"
                )}
              >
                <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                {item.name}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="p-4 border-t border-gray-100">
          <button
            onClick={logout}
            className="flex items-center w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="mr-3 h-5 w-5 flex-shrink-0" />
            Logout
          </button>
        </div>
      </div>
    </>
  );
}