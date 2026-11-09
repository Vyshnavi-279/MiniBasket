import "@/App.css";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import ClerkAuthProvider from "@/components/auth/ClerkAuthProvider";
import { MeProvider } from "@/context/MeContext";
import { CartProvider } from "@/context/CartContext";
import { Toaster } from "@/components/ui/sonner";
import SiteLayout from "@/components/layout/SiteLayout";
import RoleGate from "@/components/RoleGate";
import Home from "@/pages/Home";
import Shop from "@/pages/Shop";
import ProductDetail from "@/pages/ProductDetail";
import Checkout from "@/pages/Checkout";
import Orders from "@/pages/Orders";
import OrderDetail from "@/pages/OrderDetail";
import Partner from "@/pages/Partner";
import DeliveryDashboard from "@/pages/DeliveryDashboard";
import { SignInPage, SignUpPage } from "@/pages/AuthPages";
import AdminLayout from "@/pages/admin/AdminLayout";
import AdminOverview from "@/pages/admin/AdminOverview";
import AdminOrders from "@/pages/admin/AdminOrders";
import AdminProducts from "@/pages/admin/AdminProducts";
import AdminRiders from "@/pages/admin/AdminRiders";
import AdminUsers from "@/pages/admin/AdminUsers";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <ClerkAuthProvider>
          <MeProvider>
            <CartProvider>
              <Routes>
                <Route element={<SiteLayout />}>
                  <Route path="/" element={<Home />} />
                  <Route path="/shop" element={<Shop />} />
                  <Route path="/product/:id" element={<ProductDetail />} />
                  <Route path="/cart" element={<Checkout />} />
                  <Route path="/orders" element={<RoleGate><Orders /></RoleGate>} />
                  <Route path="/orders/:id" element={<RoleGate><OrderDetail /></RoleGate>} />
                  <Route path="/partner" element={<Partner />} />
                  <Route path="/delivery" element={<RoleGate roles={["delivery"]}><DeliveryDashboard /></RoleGate>} />
                  <Route path="/admin" element={<RoleGate roles={["admin"]}><AdminLayout /></RoleGate>}>
                    <Route index element={<AdminOverview />} />
                    <Route path="orders" element={<AdminOrders />} />
                    <Route path="products" element={<AdminProducts />} />
                    <Route path="partners" element={<AdminRiders />} />
                    <Route path="users" element={<AdminUsers />} />
                  </Route>
                </Route>
                <Route path="/sign-in/*" element={<SignInPage />} />
                <Route path="/sign-up/*" element={<SignUpPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              <Toaster position="top-center" richColors />
            </CartProvider>
          </MeProvider>
        </ClerkAuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
