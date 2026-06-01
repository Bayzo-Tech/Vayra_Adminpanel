import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Vendors from './pages/Vendors';
import DeliveryPartners from './pages/DeliveryPartners';
import Categories from './pages/Categories';
import BeachZone from './pages/BeachZone';
import Food from './pages/Food';
import Payments from './pages/Payments';
import Coupons from './pages/Coupons';
import Orders from './pages/Orders';
import Ratings from './pages/Ratings';
import Banners from './pages/Banners';
import Settings from './pages/Settings';
import AdminLayout from './components/Layout/AdminLayout';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/users" element={<Users />} />
          <Route path="/delivery-partners" element={<DeliveryPartners />} />
          <Route path="/vendors" element={<Vendors />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/beach-zone" element={<BeachZone />} />
          <Route path="/food" element={<Food />} />
          <Route path="/coupons" element={<Coupons />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/ratings" element={<Ratings />} />
          <Route path="/banners" element={<Banners />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Route>
      
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
