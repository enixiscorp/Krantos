import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
import SuperAdminRoute from './components/SuperAdminRoute';
import AdminRoute from './components/AdminRoute';

const Home = lazy(() => import('./pages/Home'));
const CalculatePower = lazy(() => import('./pages/CalculatePower'));
const Results = lazy(() => import('./pages/Results'));
const Vendors = lazy(() => import('./pages/Vendors'));
const VendorDetail = lazy(() => import('./pages/VendorDetail'));
const BusinessLogin = lazy(() => import('./pages/BusinessLogin'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const BusinessDashboard = lazy(() => import('./pages/BusinessDashboard'));
const AddProduct = lazy(() => import('./pages/AddProduct'));
const Leads = lazy(() => import('./pages/Leads'));
const Admin = lazy(() => import('./pages/Admin'));
const AdminVendors = lazy(() => import('./pages/AdminVendors'));
const AdminLeads = lazy(() => import('./pages/AdminLeads'));
const AdminCommissions = lazy(() => import('./pages/AdminCommissions'));
const AdminProducts = lazy(() => import('./pages/AdminProducts'));
const AdminBilling = lazy(() => import('./pages/AdminBilling'));
const AdminContracts = lazy(() => import('./pages/AdminContracts'));
const AdminUsers = lazy(() => import('./pages/AdminUsers'));
const AdminOrders = lazy(() => import('./pages/AdminOrders'));
const AdminChatbot = lazy(() => import('./pages/AdminChatbot'));

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-yellow-400 font-bold">Chargement...</div>}>
        <Routes>
          {/* Front/public site (avec Header) */}
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/calculate-power" element={<CalculatePower />} />
            <Route path="/results" element={<Results />} />
            <Route path="/vendors" element={<Vendors />} />
            <Route path="/vendor/:id" element={<VendorDetail />} />
            <Route path="/business-login" element={<BusinessLogin />} />
            <Route path="/business-dashboard" element={<BusinessDashboard />} />
            <Route path="/add-product" element={<AddProduct />} />
            <Route path="/leads" element={<Leads />} />
          </Route>

          {/* Back-office admin (sans Header) */}
          <Route element={<AdminLayout />}>
            <Route path="/admin-login" element={<AdminLogin />} />
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <Admin />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/vendors"
              element={
                <AdminRoute>
                  <AdminVendors />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/leads"
              element={
                <AdminRoute>
                  <AdminLeads />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/commissions"
              element={
                <AdminRoute>
                  <AdminCommissions />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/products"
              element={
                <AdminRoute>
                  <AdminProducts />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/billing"
              element={
                <AdminRoute>
                  <AdminBilling />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/contracts"
              element={
                <AdminRoute>
                  <AdminContracts />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/orders"
              element={
                <AdminRoute>
                  <AdminOrders />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/chatbot"
              element={
                <AdminRoute>
                  <AdminChatbot />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <SuperAdminRoute>
                  <AdminUsers />
                </SuperAdminRoute>
              }
            />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
