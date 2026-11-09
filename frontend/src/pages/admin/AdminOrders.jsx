import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Eye, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/orders/OrderStatus";
import { AddressBlock, OrderBill, OrderItems } from "@/pages/OrderDetail";
import { AdminHeader } from "@/pages/admin/AdminLayout";
import { errMsg, useApi } from "@/lib/api";
import { STATUS, fmtDate, inr } from "@/lib/format";

const FILTERS = ["all", "placed", "packed", "assigned", "out_for_delivery", "delivered", "cancelled", "pending_payment"];

const OrderActions = ({ order, riders, onAction }) => {
  const canAssign = ["placed", "packed", "assigned"].includes(order.status);
  return (
    <div className="flex items-center gap-2 justify-end">
      {canAssign && (
        <Select value={order.delivery_partner?.user_id || ""} onValueChange={(v) => onAction(order, "assign", v)}>
          <SelectTrigger className="h-8 w-40 bg-white text-xs" data-testid={`assign-rider-${order.order_number}`}><SelectValue placeholder="Assign rider" /></SelectTrigger>
          <SelectContent>
            {riders.length === 0 ? <div className="px-3 py-2 text-xs text-muted-foreground">No approved riders yet</div> :
              riders.map((r) => <SelectItem key={r.user_id} value={r.user_id}>{r.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      {order.status === "placed" && <Button size="sm" variant="outline" className="h-8" data-testid={`mark-packed-${order.order_number}`} onClick={() => onAction(order, "packed")}>Mark packed</Button>}
      {["placed", "packed", "assigned", "out_for_delivery"].includes(order.status) && (
        <Button size="sm" variant="ghost" className="h-8 text-[#c62828] hover:text-[#c62828]" data-testid={`cancel-order-${order.order_number}`} onClick={() => onAction(order, "cancelled")}>Cancel</Button>
      )}
    </div>
  );
};

const OrderDialog = ({ order, onClose }) => (
  <Dialog open={!!order} onOpenChange={(o) => !o && onClose()}>
    <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" data-testid="admin-order-dialog">
      {order && (
        <>
          <DialogHeader><DialogTitle>Order #{order.order_number}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2"><StatusBadge status={order.status} /><span className="text-xs text-muted-foreground">{fmtDate(order.created_at)}</span></div>
            <AddressBlock a={order.address} />
            <p className="text-xs text-muted-foreground">Customer email: {order.customer?.email || "—"} · Razorpay payment: {order.payment?.razorpay_payment_id || "—"}</p>
            {order.delivery_partner && <p className="text-sm">Rider: <span className="font-medium">{order.delivery_partner.name}</span> {order.delivery_partner.phone}</p>}
            <OrderItems order={order} />
            <OrderBill order={order} />
          </div>
        </>
      )}
    </DialogContent>
  </Dialog>
);

export default function AdminOrders() {
  const api = useApi();
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [orders, setOrders] = useState(null);
  const [riders, setRiders] = useState([]);
  const [view, setView] = useState(null);

  const load = useCallback(() => {
    api.get("/admin/orders", { params: { status, q: q || undefined } }).then((r) => setOrders(r.data)).catch(() => setOrders([]));
  }, [api, status, q]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api.get("/admin/riders").then((r) => setRiders(r.data)).catch(() => {});
  }, [api]);

  const onAction = async (order, action, riderId) => {
    if (action === "cancelled" && !window.confirm(`Cancel order #${order.order_number}? Refund it from your Razorpay dashboard.`)) return;
    try {
      const { data } = action === "assign"
        ? await api.post(`/admin/orders/${order.id}/assign`, { delivery_user_id: riderId })
        : await api.post(`/admin/orders/${order.id}/status`, { status: action });
      setOrders((list) => list.map((o) => (o.id === order.id ? data : o)));
      toast.success(action === "assign" ? "Rider assigned" : `Order ${STATUS[action].label.toLowerCase()}`);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div data-testid="admin-orders">
      <AdminHeader title="Orders" subtitle="Prepaid orders only. Assign a rider once packed." />
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input data-testid="admin-orders-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search order no."
            className="h-9 w-52 pl-9 pr-3 rounded-md border border-input bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-48 bg-white" data-testid="admin-orders-status-filter"><SelectValue /></SelectTrigger>
          <SelectContent>{FILTERS.map((f) => <SelectItem key={f} value={f}>{f === "all" ? "All paid orders" : STATUS[f].label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="bg-white border rounded-xl overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted">
            <TableRow><TableHead>Order</TableHead><TableHead>Customer</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead><TableHead>Rider</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {orders === null ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">Loading…</TableCell></TableRow> :
              orders.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10" data-testid="admin-orders-empty">No orders here yet. Paid customer orders will appear here.</TableCell></TableRow> :
              orders.map((o) => (
                <TableRow key={o.id} data-testid={`admin-order-row-${o.order_number}`}>
                  <TableCell><button className="font-medium hover:text-primary flex items-center gap-1" onClick={() => setView(o)} data-testid={`view-order-${o.order_number}`}>#{o.order_number} <Eye className="h-3.5 w-3.5" /></button><p className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(o.created_at)}</p></TableCell>
                  <TableCell><p className="text-sm">{o.address.full_name}</p><p className="text-xs text-muted-foreground">{o.address.city} · {o.items.length} items</p></TableCell>
                  <TableCell className="text-right tnum font-medium">{inr(o.total)}</TableCell>
                  <TableCell><StatusBadge status={o.status} testid={`admin-order-status-${o.order_number}`} /></TableCell>
                  <TableCell className="text-sm">{o.delivery_partner?.name || "—"}</TableCell>
                  <TableCell><OrderActions order={o} riders={riders} onAction={onAction} /></TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
      <OrderDialog order={view} onClose={() => setView(null)} />
    </div>
  );
}
