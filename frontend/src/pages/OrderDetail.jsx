import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Bike, CreditCard, MapPin, Phone } from "lucide-react";
import { OrderTimeline, StatusBadge } from "@/components/orders/OrderStatus";
import { PageLoader, ErrorState } from "@/components/RoleGate";
import { useApi } from "@/lib/api";
import { feeLabel, fmtDate, inr } from "@/lib/format";

export const OrderItems = ({ order }) => (
  <div className="divide-y">
    {order.items.map((i) => (
      <div key={i.product_id} className="py-2.5 flex items-center gap-3">
        <img src={i.image} alt={i.name} className="h-11 w-11 rounded-md object-cover bg-muted" />
        <div className="flex-1 min-w-0"><p className="text-sm font-medium">{i.name}</p><p className="text-xs text-muted-foreground">{i.unit} · {i.qty} × {inr(i.price)}</p></div>
        <p className="text-sm font-semibold tnum">{inr(i.line_total)}</p>
      </div>
    ))}
  </div>
);

export const OrderBill = ({ order }) => (
  <div className="space-y-1.5 text-sm">
    <div className="flex justify-between"><span className="text-muted-foreground">Items total</span><span className="tnum">{inr(order.subtotal)}</span></div>
    <div className="flex justify-between"><span className="text-muted-foreground">Delivery charge</span><span className="tnum">{feeLabel(order.delivery_fee)}</span></div>
    <div className="flex justify-between font-semibold text-base pt-1.5 border-t"><span>Total paid</span><span className="tnum" data-testid="order-total">{inr(order.total)}</span></div>
  </div>
);

export const AddressBlock = ({ a }) => (
  <p className="text-sm leading-relaxed">
    <span className="font-medium">{a.full_name}</span><br />{a.line1}{a.line2 ? `, ${a.line2}` : ""}<br />{a.city} – {a.pincode}<br />
    <span className="text-muted-foreground">{a.phone}</span>
  </p>
);

export default function OrderDetail() {
  const { id } = useParams();
  const api = useApi();
  const [order, setOrder] = useState(null);
  const [missing, setMissing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    const load = () => api.get(`/orders/${id}`).then((r) => {
      if (active) { setOrder(r.data); setFailed(false); }
    }).catch((e) => {
      if (!active) return;
      if (e?.response?.status === 404) setMissing(true); else setFailed(true);
    });
    load();
    const timer = setInterval(load, 30000);
    return () => { active = false; clearInterval(timer); };
  }, [api, id, reload]);

  if (missing) return <div data-testid="order-not-found" className="text-center py-24"><p className="font-medium">Order not found.</p><Link to="/orders" className="text-primary text-sm">Back to my orders</Link></div>;
  if (!order) return failed ? <ErrorState onRetry={() => { setFailed(false); setReload((n) => n + 1); }} text="We couldn't load this order." /> : <PageLoader />;
  const rider = order.delivery_partner;

  return (
    <div data-testid="order-detail-page" className="max-w-3xl mx-auto px-4 py-8 space-y-5">
      <Link to="/orders" className="text-sm text-muted-foreground flex items-center gap-1 hover:text-primary"><ArrowLeft className="h-4 w-4" /> My orders</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="order-detail-number">Order #{order.order_number}</h1>
          <p className="text-sm text-muted-foreground">Placed {fmtDate(order.created_at)} · updates automatically</p>
        </div>
        <StatusBadge status={order.status} testid="order-detail-status" />
      </div>
      <section className="bg-white border rounded-xl p-5"><OrderTimeline order={order} /></section>
      {rider && (
        <section data-testid="order-rider" className="bg-white border rounded-xl p-5 flex items-center gap-3">
          <span className="h-10 w-10 rounded-full bg-accent text-primary grid place-items-center"><Bike className="h-5 w-5" /></span>
          <div className="flex-1"><p className="text-xs text-muted-foreground">Your delivery partner</p><p className="font-medium">{rider.name}</p></div>
          {rider.phone && <a href={`tel:${rider.phone}`} className="text-sm text-primary flex items-center gap-1"><Phone className="h-4 w-4" /> {rider.phone}</a>}
        </section>
      )}
      <div className="grid md:grid-cols-2 gap-5">
        <section className="bg-white border rounded-xl p-5">
          <h2 className="font-semibold flex items-center gap-2 mb-2"><MapPin className="h-4 w-4 text-primary" /> Delivery address</h2>
          <AddressBlock a={order.address} />
        </section>
        <section className="bg-white border rounded-xl p-5">
          <h2 className="font-semibold flex items-center gap-2 mb-2"><CreditCard className="h-4 w-4 text-primary" /> Payment</h2>
          <p className="text-sm">Prepaid via Razorpay</p>
          <p className="text-xs text-muted-foreground break-all">Payment ID: {order.payment?.razorpay_payment_id || "—"}</p>
        </section>
      </div>
      <section className="bg-white border rounded-xl p-5 space-y-3">
        <h2 className="font-semibold">Items ({order.items.length})</h2>
        <OrderItems order={order} />
        <OrderBill order={order} />
      </section>
    </div>
  );
}
