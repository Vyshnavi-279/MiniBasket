import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminHeader } from "@/pages/admin/AdminLayout";
import { useCart } from "@/context/CartContext";
import { errMsg, useApi } from "@/lib/api";
import { feeLabel } from "@/lib/format";

export default function AdminSettings() {
  const api = useApi();
  const { deliveryFee, refreshFee } = useCart();
  const [fee, setFee] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (deliveryFee !== null) setFee(String(deliveryFee));
  }, [deliveryFee]);

  const save = async (e) => {
    e.preventDefault();
    const n = Number(fee);
    if (fee === "" || !Number.isInteger(n) || n < 0 || n > 1000) return toast.error("Enter a whole rupee amount between ₹0 and ₹1000");
    setBusy(true);
    try {
      await api.put("/admin/settings", { delivery_fee: n });
      await refreshFee();
      toast.success(n === 0 ? "Delivery is now free" : `Delivery charge set to ₹${n}`);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="admin-settings">
      <AdminHeader title="Store settings" subtitle="Control what customers are billed." />
      <form onSubmit={save} className="bg-white border rounded-xl p-6 max-w-lg space-y-4">
        <div className="flex items-center gap-2"><Truck className="h-4 w-4 text-primary" /><h2 className="font-semibold">Delivery charge</h2></div>
        <p className="text-sm text-muted-foreground">
          Added to every order's bill. Customers only see it in their bill at checkout. Set 0 for free delivery.
          Changes apply to new orders; existing orders keep the charge they were billed.
        </p>
        <p className="text-sm">Current charge: <span className="font-semibold tnum" data-testid="settings-current-fee">{feeLabel(deliveryFee)}</span></p>
        <div>
          <Label htmlFor="delivery-fee" className="text-xs text-muted-foreground">Delivery charge per order (₹)</Label>
          <Input id="delivery-fee" data-testid="settings-delivery-fee-input" type="number" min={0} max={1000} step={1}
            value={fee} onChange={(e) => setFee(e.target.value)} className="mt-1.5 max-w-[180px]" />
        </div>
        <Button type="submit" disabled={busy} data-testid="settings-save-button">
          {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save delivery charge
        </Button>
      </form>
    </div>
  );
}
