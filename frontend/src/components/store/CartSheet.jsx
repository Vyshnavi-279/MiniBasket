import { useNavigate } from "react-router-dom";
import { ShoppingBasket } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AddToCart } from "@/components/store/AddToCart";
import { PrepaidNotice } from "@/components/store/PrepaidNotice";
import { useCart } from "@/context/CartContext";
import { feeLabel, inr } from "@/lib/format";

const BillRow = ({ label, value, strong, testid }) => (
  <div className={`flex justify-between ${strong ? "font-semibold text-base" : "text-sm text-muted-foreground"}`}>
    <span>{label}</span><span className="tnum" data-testid={testid}>{value}</span>
  </div>
);

export const CartSheet = () => {
  const { items, subtotal, count, open, setOpen, deliveryFee } = useCart();
  const navigate = useNavigate();
  const go = (path) => { setOpen(false); navigate(path); };
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent data-testid="cart-sheet" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-5 pt-5 pb-3 border-b text-left">
          <SheetTitle>My basket ({count})</SheetTitle>
          <SheetDescription>Review your items before checkout</SheetDescription>
        </SheetHeader>
        {items.length === 0 ? (
          <div data-testid="cart-empty" className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <ShoppingBasket className="h-10 w-10 text-muted-foreground" />
            <p className="mt-3 font-medium">Your basket is empty</p>
            <p className="text-sm text-muted-foreground mt-1">Fresh produce, dairy and daily essentials are waiting.</p>
            <Button data-testid="cart-explore-button" className="mt-5" onClick={() => go("/shop")}>Explore fresh produce</Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-3 divide-y">
              {items.map((i) => (
                <div key={i.id} className="py-3 flex gap-3" data-testid={`cart-item-${i.id}`}>
                  <img src={i.image} alt={i.name} className="h-16 w-16 rounded-md object-cover bg-muted" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-snug">{i.name}</p>
                    <p className="text-xs text-muted-foreground">{i.unit}</p>
                    <p className="text-sm font-semibold tnum mt-1">{inr(i.price * i.qty)}</p>
                  </div>
                  <div className="w-28 self-center"><AddToCart product={i} size="sm" testid={`cart-${i.id}`} /></div>
                </div>
              ))}
            </div>
            <div className="border-t px-5 py-4 space-y-2 bg-muted/40">
              <BillRow label="Items total" value={inr(subtotal)} testid="cart-subtotal" />
              <BillRow label="Delivery charge" value={feeLabel(deliveryFee)} testid="cart-delivery-fee" />
              <BillRow label="To pay" value={inr(subtotal + (deliveryFee ?? 0))} strong testid="cart-total" />
              <PrepaidNotice compact />
              <Button data-testid="cart-checkout-button" className="w-full h-11 mt-1" onClick={() => go("/cart")}>Proceed to checkout</Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};
