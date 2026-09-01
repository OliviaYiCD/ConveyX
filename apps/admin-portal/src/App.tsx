import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProductsPage } from "./pages/ProductsPage";
import { ProductFormPage } from "./pages/ProductFormPage";
import { ProvidersPage } from "./pages/ProvidersPage";
import { RequiredDataPage } from "./pages/RequiredDataPage";
import { PackagesPage } from "./pages/PackagesPage";
import { PackageFormPage } from "./pages/PackageFormPage";
import { CouncilsPage } from "./pages/CouncilsPage";
import { ImportPage } from "./pages/ImportPage";
import { OrdersPage } from "./pages/OrdersPage";
import { InvoicesPage } from "./pages/InvoicesPage";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/products" replace />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="products/new" element={<ProductFormPage />} />
        <Route path="products/:productId/edit" element={<ProductFormPage />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="packages" element={<PackagesPage />} />
        <Route path="packages/new" element={<PackageFormPage />} />
        <Route path="packages/:packageId" element={<PackageFormPage />} />
        <Route path="providers" element={<ProvidersPage />} />
        <Route path="required-data" element={<RequiredDataPage />} />
        <Route path="councils" element={<CouncilsPage />} />
      </Route>
    </Routes>
  );
}
