import { Outlet, useLocation, Link } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CartSheet } from "@/components/store/CartSheet";
import { AssistantWidget } from "@/components/ai/AssistantWidget";
import { useCart } from "@/context/CartContext";
import { inr } from "@/lib/format";

const MobileCartBar = () => {
  const { count, subtotal } = useCart();
  const { pathname } = useLocation();
  if (!count || pathname === "/cart" || pathname.startsWith("/admin") || pathname.startsWith("/delivery")) return null;
  return (
    <Link
      to="/cart"
      data-testid="mobile-cart-bar"
      className="md:hidden fixed bottom-3 left-3 right-3 z-30 h-14 rounded-xl bg-primary text-white px-4 flex items-center justify-between shadow-lg"
    >
      <span className="flex items-center gap-2 text-sm font-medium"><ShoppingCart className="h-4 w-4" /> {count} item{count > 1 ? "s" : ""} · <span className="tnum">{inr(subtotal)}</span></span>
      <span className="text-sm font-semibold">View cart</span>
    </Link>
  );
};

export default function SiteLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <CartSheet />
      <MobileCartBar />
      <AssistantWidget />
    </div>
  );
}
