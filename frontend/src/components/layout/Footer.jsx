import { Link } from "react-router-dom";
import { CreditCard, ShieldCheck, ShoppingBasket, Truck } from "lucide-react";

export const Footer = () => (
  <footer data-testid="site-footer" className="border-t bg-white mt-16">
    <div className="max-w-[1280px] mx-auto px-4 lg:px-6 py-10 grid gap-8 md:grid-cols-4 text-sm">
      <div className="md:col-span-2">
        <div className="flex items-center gap-2 font-bold text-lg">
          <ShoppingBasket className="h-5 w-5 text-primary" /> MiniBasket
        </div>
        <p className="mt-3 text-muted-foreground max-w-sm">
          Daily groceries, fresh fruits and household essentials delivered to your door for a flat ₹40.
        </p>
        <ul className="mt-4 space-y-2 text-muted-foreground">
          <li className="flex items-center gap-2"><Truck className="h-4 w-4 text-primary" /> Flat ₹40 delivery on every order</li>
          <li className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-primary" /> Prepaid only via Razorpay — no cash on delivery</li>
          <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Verified, admin-approved delivery partners</li>
        </ul>
      </div>
      <div>
        <h3 className="font-semibold">Shop</h3>
        <ul className="mt-3 space-y-2 text-muted-foreground">
          <li><Link to="/shop?category=fruits-vegetables" className="hover:text-primary">Fruits & Vegetables</Link></li>
          <li><Link to="/shop?category=dairy-bakery" className="hover:text-primary">Dairy & Bakery</Link></li>
          <li><Link to="/shop?category=staples" className="hover:text-primary">Atta, Rice & Dal</Link></li>
          <li><Link to="/shop?sort=discount" className="hover:text-primary">Best deals</Link></li>
        </ul>
      </div>
      <div>
        <h3 className="font-semibold">Company</h3>
        <ul className="mt-3 space-y-2 text-muted-foreground">
          <li><Link to="/partner" className="hover:text-primary">Become a delivery partner</Link></li>
          <li><Link to="/orders" className="hover:text-primary">Track my order</Link></li>
          <li>Support: [support email]</li>
          <li>Store address: [your store address]</li>
        </ul>
      </div>
    </div>
    <div className="border-t py-4 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} MiniBasket. All prices in Indian Rupees (₹).</div>
  </footer>
);
