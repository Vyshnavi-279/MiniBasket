import { NavLink, Outlet } from "react-router-dom";
import { Bike, Boxes, ClipboardList, LayoutDashboard, Settings, Users } from "lucide-react";

const LINKS = [
  { to: "/admin", end: true, label: "Overview", icon: LayoutDashboard, id: "overview" },
  { to: "/admin/orders", label: "Orders", icon: ClipboardList, id: "orders" },
  { to: "/admin/products", label: "Products", icon: Boxes, id: "products" },
  { to: "/admin/partners", label: "Delivery partners", icon: Bike, id: "partners" },
  { to: "/admin/users", label: "Users & roles", icon: Users, id: "users" },
  { to: "/admin/settings", label: "Settings", icon: Settings, id: "settings" },
];

export default function AdminLayout() {
  return (
    <div data-testid="admin-layout" className="max-w-[1400px] mx-auto px-4 lg:px-6 py-6 lg:flex gap-6">
      <aside className="lg:w-56 shrink-0 lg:sticky lg:top-24 self-start">
        <p className="hidden lg:block text-xs font-medium text-muted-foreground px-3 mb-2">Admin console</p>
        <nav className="flex lg:flex-col gap-1 overflow-x-auto no-scrollbar pb-3 lg:pb-0">
          {LINKS.map(({ to, end, label, icon: Icon, id }) => (
            <NavLink key={id} to={to} end={end} data-testid={`admin-nav-${id}`}
              className={({ isActive }) => `whitespace-nowrap flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"}`}>
              <Icon className="h-4 w-4" /> {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <section className="flex-1 min-w-0"><Outlet /></section>
    </div>
  );
}

export const AdminHeader = ({ title, subtitle, children }) => (
  <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
    <div><h1 className="text-2xl font-semibold tracking-tight">{title}</h1>{subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}</div>
    <div className="flex items-center gap-2">{children}</div>
  </div>
);
