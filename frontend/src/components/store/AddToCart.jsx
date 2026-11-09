import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/context/CartContext";

export const AddToCart = ({ product, size = "md", testid }) => {
  const { qtyOf, setQty } = useCart();
  const qty = qtyOf(product.id);
  const base = testid || `product-${product.id}`;
  const h = size === "sm" ? "h-8" : "h-9";
  if (product.stock <= 0) {
    return <Button disabled variant="outline" className={`${h} w-full`} data-testid={`${base}-out-of-stock`}>Out of stock</Button>;
  }
  if (qty === 0) {
    return (
      <Button data-testid={`${base}-add-button`} onClick={() => setQty(product, 1)} variant="outline"
        className={`${h} w-full border-primary text-primary hover:bg-primary hover:text-white font-semibold`}>
        Add
      </Button>
    );
  }
  const max = Math.min(20, product.stock);
  return (
    <div className={`${h} w-full flex items-center justify-between rounded-md bg-primary text-white`} data-testid={`${base}-stepper`}>
      <button aria-label="Decrease quantity" data-testid={`${base}-decrease-button`} onClick={() => setQty(product, qty - 1)}
        className="h-full px-3 hover:bg-black/10 rounded-l-md"><Minus className="h-4 w-4" /></button>
      <span className="text-sm font-semibold tnum" data-testid={`${base}-qty`}>{qty}</span>
      <button aria-label="Increase quantity" data-testid={`${base}-increase-button`} disabled={qty >= max} onClick={() => setQty(product, qty + 1)}
        className="h-full px-3 hover:bg-black/10 rounded-r-md disabled:opacity-50"><Plus className="h-4 w-4" /></button>
    </div>
  );
};
