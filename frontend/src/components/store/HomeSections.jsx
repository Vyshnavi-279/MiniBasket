import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, CreditCard, Sparkles, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Hero = () => (
  <section className="max-w-[1280px] mx-auto px-4 lg:px-6 pt-6 md:pt-10">
    <div className="grid lg:grid-cols-2 gap-6 items-stretch">
      <div className="rounded-2xl bg-[#1b5e20] text-white p-8 md:p-12 flex flex-col justify-center fade-up">
        <span className="self-start rounded-full bg-white/15 px-3 py-1 text-xs font-medium">Groceries · Fruits · Daily essentials</span>
        <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
          Your daily basket, delivered fresh.
        </h1>
        <p className="mt-4 text-base md:text-lg text-white/85 max-w-md">
          Fresh fruits, vegetables, staples and household essentials, delivered to your door. Secure prepaid checkout with Razorpay.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg" className="bg-white text-[#1b5e20] hover:bg-white/90 h-12 px-6" data-testid="hero-shop-now-button">
            <Link to="/shop">Start shopping <ArrowRight className="h-4 w-4 ml-1" /></Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-12 px-6 bg-transparent text-white border-white/40 hover:bg-white/10 hover:text-white" data-testid="hero-deals-button">
            <Link to="/shop?sort=discount">See today's deals</Link>
          </Button>
        </div>
      </div>
      <div className="relative rounded-2xl overflow-hidden min-h-[260px] lg:min-h-[440px]">
        <img src="/hero.jpg" alt="Fresh vegetables and fruits in baskets" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute bottom-4 left-4 right-4 sm:right-auto rounded-xl bg-white/95 px-4 py-3 shadow-md">
          <p className="text-xs text-muted-foreground">Everything for your kitchen</p>
          <p className="text-2xl font-bold text-primary">8 aisles</p>
          <p className="text-xs text-muted-foreground">Fruits, dairy, staples & household</p>
        </div>
      </div>
    </div>
  </section>
);

const TRUST = [
  { icon: Truck, title: "Doorstep delivery", text: "Track your order at every step" },
  { icon: CreditCard, title: "100% prepaid", text: "UPI, cards & netbanking via Razorpay" },
  { icon: BadgeCheck, title: "Verified partners", text: "Every rider approved by our admin" },
  { icon: Sparkles, title: "AI shopping help", text: "Ask Basket Buddy anything" },
];

export const TrustStrip = () => (
  <section className="max-w-[1280px] mx-auto px-4 lg:px-6 mt-6">
    <div data-testid="trust-strip" className="grid grid-cols-2 lg:grid-cols-4 border rounded-xl bg-white divide-y lg:divide-y-0 lg:divide-x">
      {TRUST.map(({ icon: Icon, title, text }) => (
        <div key={title} className="p-4 flex items-start gap-3">
          <Icon className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div><p className="text-sm font-semibold">{title}</p><p className="text-xs text-muted-foreground">{text}</p></div>
        </div>
      ))}
    </div>
  </section>
);

export const CategoryGrid = ({ categories }) => (
  <section className="max-w-[1280px] mx-auto px-4 lg:px-6 mt-12">
    <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Shop by category</h2>
    <div data-testid="category-grid" className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
      {(categories.length ? categories : Array.from({ length: 8 })).map((c, i) =>
        c ? (
          <Link key={c.slug} to={`/shop?category=${c.slug}`} data-testid={`category-tile-${c.slug}`}
            className="group relative rounded-xl overflow-hidden border bg-white flex items-center gap-3 p-3 hover:border-primary transition-colors">
            <img src={c.image} alt={c.name} className="h-16 w-16 rounded-lg object-cover transition-transform duration-300 group-hover:scale-105" />
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-snug">{c.name}</p>
              <p className="text-xs text-muted-foreground">{c.count} items</p>
            </div>
          </Link>
        ) : <div key={i} className="h-[90px] rounded-xl bg-muted animate-pulse" />
      )}
    </div>
  </section>
);

export const PartnerBand = () => (
  <section className="max-w-[1280px] mx-auto px-4 lg:px-6 mt-16">
    <div className="grid md:grid-cols-2 rounded-2xl overflow-hidden border bg-white">
      <img src="/rider.jpg" alt="Delivery partner on a scooter" className="h-56 md:h-full w-full object-cover" />
      <div className="p-8 md:p-10">
        <p className="text-sm font-medium text-primary">Delivery partners</p>
        <h2 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight">Ride with MiniBasket</h2>
        <p className="mt-3 text-muted-foreground">Apply in two minutes. Our admin team verifies every application before you can see and deliver orders.</p>
        <Button asChild className="mt-6 h-11" data-testid="partner-band-apply-button"><Link to="/partner">Apply to deliver</Link></Button>
      </div>
    </div>
  </section>
);
