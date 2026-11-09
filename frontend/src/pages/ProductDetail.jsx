import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronRight, ShieldCheck, Truck } from "lucide-react";
import { AddToCart } from "@/components/store/AddToCart";
import { PrepaidNotice } from "@/components/store/PrepaidNotice";
import { ProductRail } from "@/components/store/ProductRail";
import { PageLoader } from "@/components/RoleGate";
import { publicApi } from "@/lib/api";
import { inr } from "@/lib/format";

export default function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    setProduct(null);
    setMissing(false);
    publicApi.get(`/products/${id}`).then((r) => {
      setProduct(r.data);
      return publicApi.get("/products", { params: { category: r.data.category, limit: 12 } });
    }).then((r) => setRelated(r.data.filter((p) => p.id !== id))).catch(() => setMissing(true));
  }, [id]);

  if (missing) {
    return <div data-testid="product-not-found" className="text-center py-24"><p className="font-medium">This product is not available.</p><Link to="/shop" className="text-primary text-sm">Back to shop</Link></div>;
  }
  if (!product) return <PageLoader />;

  return (
    <div data-testid="product-detail-page" className="pb-6">
      <div className="max-w-[1280px] mx-auto px-4 lg:px-6 py-6">
        <nav className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link to="/shop" className="hover:text-primary">Shop</Link><ChevronRight className="h-3.5 w-3.5" />
          <Link to={`/shop?category=${product.category}`} className="hover:text-primary">{product.category_name}</Link>
        </nav>
        <div className="mt-4 grid md:grid-cols-2 gap-8">
          <div className="rounded-2xl overflow-hidden border bg-white aspect-square">
            <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
          </div>
          <div className="flex flex-col">
            <span className="self-start rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{product.unit}</span>
            <h1 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight" data-testid="product-detail-name">{product.name}</h1>
            <p className="mt-3 text-muted-foreground">{product.description}</p>
            <div className="mt-6 flex items-baseline gap-3">
              <span className="text-3xl font-bold tnum" data-testid="product-detail-price">{inr(product.price)}</span>
              {product.mrp > product.price && (
                <>
                  <span className="text-muted-foreground line-through tnum">MRP {inr(product.mrp)}</span>
                  <span className="rounded-md bg-[#c62828] text-white text-xs font-semibold px-2 py-0.5">{product.discount_pct}% OFF</span>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Inclusive of all taxes</p>
            <p className={`mt-3 text-sm font-medium ${product.stock > 0 ? (product.stock < 10 ? "text-[#b45309]" : "text-primary") : "text-[#b71c1c]"}`} data-testid="product-detail-stock">
              {product.stock > 0 ? (product.stock < 10 ? `Hurry, only ${product.stock} left` : "In stock") : "Out of stock"}
            </p>
            <div className="mt-6 max-w-xs"><AddToCart product={product} testid="product-detail" /></div>
            <div className="mt-8 grid gap-3 max-w-md">
              <div className="flex items-center gap-3 text-sm"><Truck className="h-4 w-4 text-primary" /> Flat ₹40 delivery charge on your order</div>
              <div className="flex items-center gap-3 text-sm"><ShieldCheck className="h-4 w-4 text-primary" /> Delivered by a verified MiniBasket partner</div>
              <PrepaidNotice compact />
            </div>
          </div>
        </div>
      </div>
      {related?.length > 0 && <ProductRail title="You may also like" products={related} testid="related-rail" />}
    </div>
  );
}
