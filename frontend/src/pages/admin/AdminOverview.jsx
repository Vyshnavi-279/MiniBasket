import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle } from "lucide-react";
import { AdminHeader } from "@/pages/admin/AdminLayout";
import { AiInsights } from "@/pages/admin/AiInsights";
import { PageLoader } from "@/components/RoleGate";
import { useApi } from "@/lib/api";
import { inr } from "@/lib/format";

const Kpis = ({ s }) => {
  const items = [
    ["Revenue (paid)", inr(s.revenue), "kpi-revenue"],
    ["Orders", s.orders, "kpi-orders"],
    ["Orders today", s.orders_today, "kpi-orders-today"],
    ["Awaiting dispatch", s.pending_dispatch, "kpi-pending-dispatch"],
    ["Active riders", s.active_riders, "kpi-active-riders"],
    ["Low stock items", s.low_stock_count, "kpi-low-stock"],
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 border rounded-xl bg-white divide-x divide-y xl:divide-y-0">
      {items.map(([label, value, id]) => (
        <div key={id} className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold tnum" data-testid={id}>{value}</p></div>
      ))}
    </div>
  );
};

const RevenueChart = ({ data }) => (
  <section className="bg-white border rounded-xl p-5">
    <h2 className="font-semibold">Revenue — last 7 days</h2>
    <div className="h-56 mt-4" data-testid="revenue-chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data.map((d) => ({ ...d, day: new Date(d.date).toLocaleDateString("en-IN", { weekday: "short" }) }))}>
          <CartesianGrid vertical={false} stroke="#e9ecef" />
          <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis tickLine={false} axisLine={false} fontSize={12} width={50} tickFormatter={(v) => `₹${v}`} />
          <Tooltip formatter={(v) => inr(v)} cursor={{ fill: "#e8f5e9" }} />
          <Bar dataKey="revenue" fill="#2e7d32" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </section>
);

const LowStock = ({ items }) => (
  <section className="bg-white border rounded-xl p-5" data-testid="low-stock-panel">
    <div className="flex items-center justify-between"><h2 className="font-semibold flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-[#b45309]" /> Low stock</h2>
      <Link to="/admin/products" className="text-sm text-primary">Manage</Link></div>
    {items.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">All items are well stocked.</p> : (
      <ul className="mt-3 divide-y">{items.map((p) => (
        <li key={p.id} className="py-2 flex justify-between text-sm"><span>{p.name} <span className="text-muted-foreground">· {p.unit}</span></span><span className="font-semibold tnum text-[#b45309]">{p.stock} left</span></li>
      ))}</ul>
    )}
  </section>
);

export default function AdminOverview() {
  const api = useApi();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get("/admin/stats").then((r) => setStats(r.data)).catch(() => setStats(false));
  }, [api]);

  if (stats === null) return <PageLoader />;
  if (stats === false) return <p className="text-sm text-[#b71c1c]">Could not load store stats.</p>;

  return (
    <div data-testid="admin-overview" className="space-y-5">
      <AdminHeader title="Store overview" subtitle={`${stats.pending_applications} rider application(s) waiting · ${stats.in_transit} order(s) on the way`} />
      <Kpis s={stats} />
      <div className="grid xl:grid-cols-[1.4fr_1fr] gap-5">
        <RevenueChart data={stats.revenue_7d} />
        <LowStock items={stats.low_stock} />
      </div>
      <AiInsights />
    </div>
  );
}
