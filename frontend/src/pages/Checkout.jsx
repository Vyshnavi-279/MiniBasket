import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { toast } from "sonner";
import { Loader2, Lock, ShoppingBasket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddToCart } from "@/components/store/AddToCart";
import { AddressForm, EMPTY_ADDRESS, validateAddress } from "@/components/store/AddressForm";
import { PrepaidNotice, RazorpayBadge } from "@/components/store/PrepaidNotice";
import { useCart } from "@/context/CartContext";
import { useMe } from "@/context/MeContext";
import { errMsg, publicApi, useApi } from "@/lib/api";
import { feeLabel, inr } from "@/lib/format";

const loadRazorpay = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });

const useLiveLines = (items, version) => {
  const [live, setLive] = useState(null);
  const ids = items.map((i) => i.id).join(",");
  useEffect(() => {
    if (!ids) return;
    publicApi.get("/products", { params: { ids } }).then((r) => setLive(Object.fromEntries(r.data.map((p) => [p.id, p])))).catch(() => setLive(null));
  }, [ids, version]);
  return items.map((i) => (live ? (live[i.id] ? { ...i, ...live[i.id], qty: i.qty } : { ...i, unavailable: true }) : i));
};

const EmptyCart = () => (
  <div data-testid="checkout-empty" className="max-w-md mx-auto text-center py-24 px-4">
    <ShoppingBasket className="h-10 w-10 mx-auto text-muted-foreground" />
    <h1 className="mt-4 text-xl font-semibold">Your basket is empty</h1>
    <p className="mt-1 text-sm text-muted-foreground">Add fruits, vegetables and daily essentials to get started.</p>
    <Button asChild className="mt-6" data-testid="checkout-explore-button"><Link to="/shop">Explore fresh produce</Link></Button>
  </div>
);

export default function Checkout() {
  const { items, clear, deliveryFee, feeError, refreshFee } = useCart();
  const { isSignedIn } = useAuth();
  const { me } = useMe();
  const api = useApi();
  const navigate = useNavigate();
  const [version, setVersion] = useState(0);
  const lines = useLiveLines(items, version);
  const [addr, setAddr] = useState(EMPTY_ADDRESS);
  const [errors, setErrors] = useState({});
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    refreshFee();
  }, [refreshFee]);

  useEffect(() => {
    if (me?.default_address) setAddr((a) => (a.full_name ? a : { ...EMPTY_ADDRESS, ...me.default_address }));
  }, [me]);

  if (items.length === 0) return <EmptyCart />;

  const valid = lines.filter((l) => !l.unavailable);
  const subtotal = valid.reduce((s, l) => s + l.price * l.qty, 0);
  const total = subtotal + (deliveryFee ?? 0);
  const blocked = lines.some((l) => l.unavailable || l.qty > l.stock);

  const pay = async () => {
    const v = validateAddress(addr);
    setErrors(v);
    if (Object.keys(v).length) return toast.error("Please complete your delivery address");
    if (blocked) return toast.error("Some items are unavailable or exceed stock. Please update your basket.");
    if (deliveryFee === null) return toast.error("Your bill is still loading. Please try again in a moment.");
    setPaying(true);
    if (!(await loadRazorpay())) {
      setPaying(false);
      return toast.error("Could not load Razorpay. Please check your internet connection.");
    }
    try {
      const { data } = await api.post("/orders/checkout", { items: valid.map((l) => ({ product_id: l.id, qty: l.qty })), address: addr, expected_total: total });
      const rzp = new window.Razorpay({
        key: data.key_id, amount: data.amount, currency: data.currency, order_id: data.razorpay_order_id,
        name: "MiniBasket", description: `Order ${data.order_number}`,
        prefill: { name: addr.full_name, contact: addr.phone, email: me?.email || "" },
        theme: { color: "#2e7d32" },
        handler: async (resp) => {
          try {
            const { data: result } = await api.post(`/orders/${data.order_id}/verify`, resp);
            if (result.status === "cancelled") {
              toast.error("Payment received, but an item went out of stock. The order was cancelled and a full refund is due.");
            } else {
              clear();
              toast.success("Payment successful — your order is placed!");
            }
            navigate(`/orders/${data.order_id}`);
          } catch (e) {
            toast.error(errMsg(e));
          } finally {
            setPaying(false);
          }
        },
        modal: {
          ondismiss: async () => {
            try {
              const { data: state } = await api.post(`/orders/${data.order_id}/abandon`);
              if (state.paid) {
                if (state.status !== "cancelled") clear();
                toast.success("Your payment went through — opening your order.");
                navigate(`/orders/${data.order_id}`);
                return;
              }
              toast("Payment cancelled. Your basket is saved.");
            } catch {
              toast("Payment window closed. If money was deducted, check My orders before paying again.");
            } finally {
              setPaying(false);
            }
          },
        },
        timeout: data.timeout_seconds,
      });
      rzp.on("payment.failed", (r) => toast.error(r?.error?.description || "Payment failed. Please try again."));
      rzp.open();
    } catch (e) {
      toast.error(errMsg(e));
      if (e?.response?.status === 409) {
        await refreshFee();
        setVersion((v) => v + 1);
      }
      setPaying(false);
    }
  };

  return (
    <div data-testid="checkout-page" className="max-w-[1280px] mx-auto px-4 lg:px-6 py-8">
      <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Checkout</h1>
      <div className="mt-6 grid lg:grid-cols-[1fr_380px] gap-6 items-start">
        <div className="space-y-6">
          <section className="bg-white border rounded-xl p-5">
            <h2 className="font-semibold">Items in your basket</h2>
            <div className="mt-3 divide-y">
              {lines.map((l) => (
                <div key={l.id} className="py-3 flex items-center gap-3" data-testid={`checkout-item-${l.id}`}>
                  <img src={l.image} alt={l.name} className="h-14 w-14 rounded-md object-cover bg-muted" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{l.name}</p>
                    <p className="text-xs text-muted-foreground">{l.unit} · {inr(l.price)} each</p>
                    {l.unavailable && <p className="text-xs text-[#c62828]">No longer available — please remove</p>}
                    {!l.unavailable && l.qty > l.stock && <p className="text-xs text-[#c62828]">Only {l.stock} in stock</p>}
                  </div>
                  <div className="w-28"><AddToCart product={{ ...l, stock: l.unavailable ? l.qty : Math.max(l.stock, l.qty) }} size="sm" testid={`checkout-${l.id}`} /></div>
                  <p className="w-20 text-right text-sm font-semibold tnum">{inr(l.price * l.qty)}</p>
                </div>
              ))}
            </div>
          </section>
          <section className="bg-white border rounded-xl p-5">
            <h2 className="font-semibold">Delivery address</h2>
            <p className="text-sm text-muted-foreground mb-4">We'll share this only with the delivery partner assigned to your order.</p>
            <AddressForm value={addr} onChange={setAddr} errors={errors} />
          </section>
        </div>
        <aside className="bg-white border rounded-xl p-5 lg:sticky lg:top-24 space-y-3" data-testid="bill-summary">
          <h2 className="font-semibold">Bill summary</h2>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Items total</span><span className="tnum" data-testid="checkout-subtotal">{inr(subtotal)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Delivery charge</span><span className="tnum" data-testid="checkout-delivery-fee">{feeLabel(deliveryFee)}</span></div>
          <div className="border-t pt-3 flex justify-between font-semibold text-lg"><span>To pay</span><span className="tnum" data-testid="checkout-total">{inr(total)}</span></div>
          {feeError && deliveryFee === null && (
            <p className="text-sm text-[#b71c1c]" data-testid="checkout-fee-error">
              Couldn't load the delivery charge. <button className="underline" onClick={refreshFee} data-testid="checkout-fee-retry">Try again</button>
            </p>
          )}
          <PrepaidNotice />
          {isSignedIn ? (
            <Button data-testid="checkout-pay-button" className="w-full h-12 text-base" disabled={paying || deliveryFee === null} onClick={pay}>
              {paying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
              Pay {inr(total)} with Razorpay
            </Button>
          ) : (
            <Button asChild data-testid="checkout-sign-in-button" className="w-full h-12 text-base"><Link to="/sign-in">Sign in to pay</Link></Button>
          )}
          <RazorpayBadge />
        </aside>
      </div>
    </div>
  );
}
