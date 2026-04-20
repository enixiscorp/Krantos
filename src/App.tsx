import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';

const Home = lazy(() => import('./pages/Home'));
const CalculatePower = lazy(() => import('./pages/CalculatePower'));
const Results = lazy(() => import('./pages/Results'));
const Vendors = lazy(() => import('./pages/Vendors'));
const VendorDetail = lazy(() => import('./pages/VendorDetail'));
const BusinessLogin = lazy(() => import('./pages/BusinessLogin'));
const BusinessDashboard = lazy(() => import('./pages/BusinessDashboard'));
const AddProduct = lazy(() => import('./pages/AddProduct'));
const Leads = lazy(() => import('./pages/Leads'));
const Admin = lazy(() => import('./pages/Admin'));
const AdminVendors = lazy(() => import('./pages/AdminVendors'));
const AdminLeads = lazy(() => import('./pages/AdminLeads'));
const AdminCommissions = lazy(() => import('./pages/AdminCommissions'));
const AdminBilling = lazy(() => import('./pages/AdminBilling'));
const AdminContracts = lazy(() => import('./pages/AdminContracts'));
const AdminUsers = lazy(() => import('./pages/AdminUsers'));

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-yellow-400 font-bold">Chargement...</div>}>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/calculate-power" element={<CalculatePower />} />
            <Route path="/results" element={<Results />} />
            <Route path="/vendors" element={<Vendors />} />
            <Route path="/vendor/:id" element={<VendorDetail />} />
            <Route path="/business-login" element={<BusinessLogin />} />
            <Route path="/business-dashboard" element={<BusinessDashboard />} />
            <Route path="/add-product" element={<AddProduct />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/vendors" element={<AdminVendors />} />
            <Route path="/admin/leads" element={<AdminLeads />} />
            <Route path="/admin/commissions" element={<AdminCommissions />} />
            <Route path="/admin/billing" element={<AdminBilling />} />
            <Route path="/admin/contracts" element={<AdminContracts />} />
            <Route path="/admin/users" element={<AdminUsers />} />
          </Routes>
        </Layout>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
