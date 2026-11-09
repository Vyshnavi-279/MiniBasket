import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PackageSearch, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProductCard, ProductGridSkeleton } from "@/components/store/ProductCard";
import { publicApi } from "@/lib/api";

const SORTS = [
  { value: "popular", label: "Popular" },
  { value: "discount", label: "Biggest discount" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "name", label: "Name A–Z" },
];

const CategoryList = ({ categories, active, onPick }) => (
  <>
    {[{ slug: "", name: "All items" }, ...categories].map((c) => (
      <button key={c.slug || "all"} data-testid={`shop-category-${c.slug || "all"}`} onClick={() => onPick(c.slug)}
        className={`whitespace-nowrap text-left rounded-md px-3 py-2 text-sm transition-colors ${active === c.slug ? "bg-accent text-accent-foreground font-semibold" : "text-muted-foreground hover:bg-muted"}`}>
        {c.name}
      </button>
    ))}
  </>
);

export default function Shop() {
  const [params, setParams] = useSearchParams();
  const category = params.get("category") || "";
  const q = params.get("q") || "";
  const sort = params.get("sort") || "popular";
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState(null);

  useEffect(() => {
    publicApi.get("/categories").then((r) => setCategories(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setProducts(null);
    publicApi.get("/products", { params: { category: category || undefined, q: q || undefined, sort, limit: 200 } })
      .then((r) => setProducts(r.data)).catch(() => setProducts([]));
  }, [category, q, sort]);

  const update = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next);
  };
  const title = categories.find((c) => c.slug === category)?.name || (q ? `Results for “${q}”` : "All groceries");

  return (
    <div data-testid="shop-page" className="max-w-[1280px] mx-auto px-4 lg:px-6 py-6 lg:flex gap-8">
      <aside className="hidden lg:flex flex-col gap-1 w-56 shrink-0 sticky top-24 self-start">
        <p className="text-xs font-medium text-muted-foreground px-3 mb-1">Categories</p>
        <CategoryList categories={categories} active={category} onPick={(s) => update("category", s)} />
      </aside>
      <div className="flex-1 min-w-0">
        <div className="lg:hidden flex gap-1 overflow-x-auto no-scrollbar -mx-1 pb-3">
          <CategoryList categories={categories} active={category} onPick={(s) => update("category", s)} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight" data-testid="shop-title">{title}</h1>
            <p className="text-sm text-muted-foreground">{products ? `${products.length} items` : "Loading…"}</p>
          </div>
          <div className="flex items-center gap-2">
            {q && (
              <button data-testid="shop-clear-search" onClick={() => update("q", "")} className="text-sm flex items-center gap-1 rounded-full border px-3 h-9 hover:bg-muted">
                “{q}” <X className="h-3.5 w-3.5" />
              </button>
            )}
            <Select value={sort} onValueChange={(v) => update("sort", v === "popular" ? "" : v)}>
              <SelectTrigger className="w-48 h-9 bg-white" data-testid="shop-sort-select"><SelectValue /></SelectTrigger>
              <SelectContent>{SORTS.map((s) => <SelectItem key={s.value} value={s.value} data-testid={`shop-sort-${s.value}`}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-5">
          {!products ? <ProductGridSkeleton /> : products.length === 0 ? (
            <div data-testid="shop-empty" className="text-center py-20 border rounded-xl bg-white">
              <PackageSearch className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="mt-3 font-medium">No items found</p>
              <p className="text-sm text-muted-foreground">Try a different search or browse another category.</p>
            </div>
          ) : (
            <div data-testid="shop-product-grid" className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {products.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
