import { Link } from "react-router-dom";
import { AddToCart } from "@/components/store/AddToCart";
import { inr } from "@/lib/format";

export const ProductCard = ({ product }) => (
  <div data-testid={`product-card-${product.id}`} className="group bg-white border rounded-lg p-3 flex flex-col hover:border-primary/40 transition-colors">
    <Link to={`/product/${product.id}`} className="relative block aspect-square rounded-md overflow-hidden bg-muted">
      <img src={product.image} alt={product.name} loading="lazy"
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
      {product.discount_pct > 0 && (
        <span className="absolute top-2 left-2 rounded-md bg-[#c62828] text-white text-[11px] font-semibold px-1.5 py-0.5">{product.discount_pct}% OFF</span>
      )}
      {product.stock > 0 && product.stock < 10 && (
        <span className="absolute bottom-2 left-2 rounded-md bg-white/95 text-[11px] font-medium text-[#b45309] px-1.5 py-0.5">Only {product.stock} left</span>
      )}
    </Link>
    <span className="mt-3 self-start rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{product.unit}</span>
    <Link to={`/product/${product.id}`} className="mt-1.5 text-sm font-medium leading-snug line-clamp-2 min-h-[2.5rem] hover:text-primary">
      {product.name}
    </Link>
    <div className="mt-2 flex items-baseline gap-2">
      <span className="font-semibold tnum" data-testid={`product-${product.id}-price`}>{inr(product.price)}</span>
      {product.mrp > product.price && <span className="text-xs text-muted-foreground line-through tnum">{inr(product.mrp)}</span>}
    </div>
    <div className="mt-3"><AddToCart product={product} /></div>
  </div>
);

export const ProductGridSkeleton = ({ n = 10 }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
    {Array.from({ length: n }).map((_, i) => (
      <div key={i} className="bg-white border rounded-lg p-3 animate-pulse">
        <div className="aspect-square rounded-md bg-muted" />
        <div className="mt-3 h-3 w-1/3 bg-muted rounded" />
        <div className="mt-2 h-4 w-3/4 bg-muted rounded" />
        <div className="mt-3 h-9 bg-muted rounded" />
      </div>
    ))}
  </div>
);
