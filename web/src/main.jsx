import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import '@fontsource-variable/readex-pro';
import './styles.css';
import { ToastProvider, Loader } from './ui/kit';
import DevData from './ui/DevData';

const Site = lazy(() => import('./pages/site/Site'));
const CustomerApp = lazy(() => import('./pages/app/CustomerApp'));
const BranchApp = lazy(() => import('./pages/branch/BranchApp'));
const MerchantApp = lazy(() => import('./pages/merchant/MerchantApp'));
const AdminApp = lazy(() => import('./pages/admin/AdminApp'));

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <Suspense fallback={<Loader />}>
          <Routes>
            <Route path="/app/*" element={<CustomerApp />} />
            <Route path="/branch/*" element={<BranchApp />} />
            <Route path="/merchant/*" element={<MerchantApp />} />
            <Route path="/admin/*" element={<AdminApp />} />
            <Route path="/*" element={<Site />} />
          </Routes>
        </Suspense>
        <DevData />
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
