import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Bike, CheckCircle2, Loader2, MapPin, Phone, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/orders/OrderStatus";
import { PageLoader, ErrorState } from "@/components/RoleGate";
import { errMsg, useApi } from "@/lib/api";
import { fmtDate, inr } from "@/lib/format";

const NEXT = {
  assigned: { status: "out_for_delivery", label: "Picked up — start delivery", icon: Bike },
  out_for_delivery: { status: "delivered", label: "Mark as delivered", icon: CheckCircle2 },
};

const RiderOrderCard = ({ order, onUpdate }) => {
  const [busy, setBusy] = useState(false);
  const next = NEXT[order.status];
  const a = order.address;
  const act = async () => {
    setBusy(true);
    await onUpdate(order.id, next.status);
    setBusy(false);
  };
  return (
    <div data-testid={`rider-order-${order.order_number}`} className="bg-white border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div><p className="font-semibold">#{order.order_number}</p><p className="text-xs text-muted-foreground">{fmtDate(order.updated_at)}</p></div>
        <StatusBadge status={order.status} />
      </div>
      <div className="text-sm flex gap-2"><MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <p><span className="font-medium">{a.full_name}</span> — {a.line1}{a.line2 ? `, ${a.line2}` : ""}, {a.city} {a.pincode}</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <a href={`tel:${a.phone}`} className="flex items-center gap-1.5 text-primary font-medium" data-testid={`rider-call-${order.order_number}`}><Phone className="h-4 w-4" /> {a.phone}</a>
        <span className="text-muted-foreground">{order.items.reduce((s, i) => s + i.qty, 0)} items · <span className="tnum">{inr(order.total)}</span></span>
      </div>
      <p className="text-xs rounded-md bg-[#e8f5e9] text-[#1b5e20] px-2.5 py-1.5">Already paid online. Do not collect cash.</p>
      {next && (
        <Button data-testid={`rider-action-${order.order_number}`} onClick={act} disabled={busy} className="w-full h-12 text-base">
          {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <next.icon className="h-4 w-4 mr-2" />} {next.label}
        </Button>
      )}
    </div>
  );
};

export default function DeliveryDashboard() {
  const api = useApi();
  const [orders, setOrders] = useState(null);
  const [tab, setTab] = useState("active");

  const load = useCallback(() => {
    api.get("/delivery/orders").then((r) => setOrders(r.data)).catch(() => setOrders((prev) => (Array.isArray(prev) ? prev : "error")));
  }, [api]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load]);

  const update = async (id, status) => {
    try {
      const { data } = await api.post(`/delivery/orders/${id}/status`, { status });
      setOrders((list) => list.map((o) => (o.id === id ? data : o)));
      toast.success(status === "delivered" ? "Marked as delivered" : "Delivery started");
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  if (!orders) return <PageLoader />;
  if (orders === "error") return <ErrorState onRetry={() => { setOrders(null); load(); }} text="We couldn't load your deliveries." />;
  const active = orders.filter((o) => ["assigned", "out_for_delivery"].includes(o.status));
  const done = orders.filter((o) => ["delivered", "cancelled"].includes(o.status));
  const list = tab === "active" ? active : done;
  const isToday = (iso) => iso && new Date(iso).toDateString() === new Date().toDateString();

  return (
    <div data-testid="delivery-dashboard" className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">My deliveries</h1>
        <Button variant="outline" size="sm" onClick={load} data-testid="delivery-refresh-button"><RefreshCw className="h-4 w-4 mr-1.5" /> Refresh</Button>
      </div>
      <div className="mt-5 grid grid-cols-3 border rounded-xl bg-white divide-x">
        {[["To deliver", active.length, "delivery-stat-active"], ["Delivered today", done.filter((o) => o.status === "delivered" && isToday(o.updated_at)).length, "delivery-stat-today"], ["All delivered", done.filter((o) => o.status === "delivered").length, "delivery-stat-total"]].map(([l, v, t]) => (
          <div key={l} className="p-4"><p className="text-xs text-muted-foreground">{l}</p><p className="text-2xl font-semibold tnum" data-testid={t}>{v}</p></div>
        ))}
      </div>
      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList>
          <TabsTrigger value="active" data-testid="delivery-tab-active">Active ({active.length})</TabsTrigger>
          <TabsTrigger value="done" data-testid="delivery-tab-done">Completed ({done.length})</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="mt-4 space-y-3">
        {list.length === 0 ? (
          <div data-testid="delivery-empty" className="text-center py-14 border rounded-xl bg-white text-sm text-muted-foreground">
            {tab === "active" ? "No orders assigned to you right now. New assignments from the admin will appear here." : "Completed deliveries will appear here."}
          </div>
        ) : list.map((o) => <RiderOrderCard key={o.id} order={o} onUpdate={update} />)}
      </div>
    </div>
  );
}
