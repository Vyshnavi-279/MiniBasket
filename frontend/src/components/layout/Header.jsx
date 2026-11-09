import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Show, UserButton } from "@clerk/react";
import { Search, ShoppingBasket, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/context/CartContext";
import { useMe } from "@/context/MeContext";
import { inr } from "@/lib/format";

const SearchBox = ({ testid }) => {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const submit = (e) => {
    e.preventDefault();
    navigate(q.trim() ? `/shop?q=${encodeURIComponent(q.trim())}` : "/shop");
  };
  return (
    <form onSubmit={submit} className="relative w-full" role="search">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <input
        data-testid={testid}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search for atta, dal, milk, fruits…"
        className="w-full h-10 pl-9 pr-3 rounded-lg border border-input bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </form>
  );
};

const NavItems = () => {
  const { role } = useMe();
  const links = [{ to: "/shop", label: "Shop", id: "shop" }];
  if (role) links.push({ to: "/orders", label: "My orders", id: "orders" });
  if (role === "delivery") links.push({ to: "/delivery", label: "Deliveries", id: "delivery" });
  if (role === "admin") links.push({ to: "/admin", label: "Admin", id: "admin" });
  if (!role || role === "customer") links.push({ to: "/partner", label: "Become a partner", id: "partner" });
  return links.map((l) => (
    <NavLink
      key={l.id}
      to={l.to}
      data-testid={`nav-${l.id}-link`}
      className={({ isActive }) =>
        `whitespace-nowrap px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`
      }
    >
      {l.label}
    </NavLink>
  ));
};

const CartButton = () => {
  const { count, subtotal, setOpen } = useCart();
  return (
    <Button data-testid="header-cart-button" onClick={() => setOpen(true)} className="h-10 gap-2">
      <ShoppingCart className="h-4 w-4" />
      <span className="tnum">{count > 0 ? `${count} · ${inr(subtotal)}` : "Cart"}</span>
    </Button>
  );
};

export const Header = () => (
  <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b">
    <div className="max-w-[1280px] mx-auto px-4 lg:px-6 h-16 flex items-center gap-3 lg:gap-6">
      <Link to="/" data-testid="brand-logo-link" className="flex items-center gap-2 shrink-0">
        <span className="h-9 w-9 rounded-lg bg-primary text-white grid place-items-center"><ShoppingBasket className="h-5 w-5" /></span>
        <span className="font-bold text-lg tracking-tight">Mini<span className="text-primary">Basket</span></span>
      </Link>
      <div className="hidden md:block flex-1 max-w-xl"><SearchBox testid="header-search-input" /></div>
      <nav className="hidden lg:flex items-center gap-1"><NavItems /></nav>
      <div className="ml-auto flex items-center gap-2">
        <CartButton />
        <Show when="signed-out">
          <Button asChild variant="outline" className="h-10" data-testid="header-sign-in-button"><Link to="/sign-in">Sign in</Link></Button>
        </Show>
        <Show when="signed-in"><div data-testid="header-user-button"><UserButton /></div></Show>
      </div>
    </div>
    <div className="md:hidden px-4 pb-3"><SearchBox testid="header-search-input-mobile" /></div>
    <nav className="lg:hidden border-t px-2 py-1 flex gap-1 overflow-x-auto no-scrollbar"><NavItems /></nav>
  </header>
);
