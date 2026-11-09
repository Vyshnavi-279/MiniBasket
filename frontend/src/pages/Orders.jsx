import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/orders/OrderStatus";
import { PageLoader, ErrorState } from "@/components/RoleGate";
import { useApi } from "@/lib/api";
import { fmtDate, inr } from "@/lib/format";

export default function Orders() {
  const api = useApi();
  const [orders, setOrders] = useState(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    setOrders(null);
    api.get("/orders").then((r) => setOrders(r.data)).catch(() => setOrders("error"));
  }, [api, reload]);

  if (!orders) return <PageLoader />;
  if (orders === "error") return <ErrorState onRetry={() => setReload((n) => n + 1)} text="We couldn't load your orders." />;

  return (
    <div data-testid="orders-page" className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">My orders</h1>
      {orders.length === 0 ? (
        <div data-testid="orders-empty" className="mt-6 text-center py-16 border rounded-xl bg-white">
          <Package className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="mt-3 font-medium">No orders yet</p>
          <p className="text-sm text-muted-foreground">Your paid orders will show up here.</p>
          <Button asChild className="mt-5"><Link to="/shop">Explore fresh produce</Link></Button>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {orders.map((o) => (
            <Link key={o.id} to={`/orders/${o.id}`} data-testid={`order-card-${o.order_number}`}
              className="block bg-white border rounded-xl p-4 hover:border-primary/50 transition-colors">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">#{o.order_number}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(o.created_at)}</p>
                </div>
                <StatusBadge status={o.status} />
              </div>
              <div className="mt-3 flex items-center gap-2">
                {o.items.slice(0, 5).map((i) => <img key={i.product_id} src={i.image} alt={i.name} className="h-10 w-10 rounded-md object-cover bg-muted" />)}
                {o.items.length > 5 && <span className="text-xs text-muted-foreground">+{o.items.length - 5}</span>}
                <span className="ml-auto text-sm font-semibold tnum">{inr(o.total)}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
