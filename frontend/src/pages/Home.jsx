import { useEffect, useState } from "react";
import { publicApi } from "@/lib/api";
import { CategoryGrid, Hero, PartnerBand, TrustStrip } from "@/components/store/HomeSections";
import { ProductRail } from "@/components/store/ProductRail";

const useProducts = (params) => {
  const [data, setData] = useState(null);
  const key = JSON.stringify(params);
  useEffect(() => {
    publicApi.get("/products", { params: JSON.parse(key) }).then((r) => setData(r.data)).catch(() => setData([]));
  }, [key]);
  return data;
};

export default function Home() {
  const [categories, setCategories] = useState([]);
  const deals = useProducts({ sort: "discount", limit: 12 });
  const fresh = useProducts({ category: "fruits-vegetables", limit: 12 });
  const dairy = useProducts({ category: "dairy-bakery", limit: 12 });

  useEffect(() => {
    publicApi.get("/categories").then((r) => setCategories(r.data)).catch(() => setCategories([]));
  }, []);

  return (
    <div data-testid="home-page" className="pb-6">
      <Hero />
      <TrustStrip />
      <CategoryGrid categories={categories} />
      <ProductRail title="Best deals today" products={deals} link="/shop?sort=discount" testid="deals-rail" />
      <ProductRail title="Fresh fruits & vegetables" products={fresh} link="/shop?category=fruits-vegetables" testid="fresh-rail" />
      <ProductRail title="Dairy & bakery" products={dairy} link="/shop?category=dairy-bakery" testid="dairy-rail" />
      <PartnerBand />
    </div>
  );
}
