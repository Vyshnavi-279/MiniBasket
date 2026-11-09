import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { ProductCard } from "@/components/store/ProductCard";

export const ProductRail = ({ title, products, link, testid }) => (
  <section data-testid={testid} className="max-w-[1280px] mx-auto px-4 lg:px-6 mt-12">
    <div className="flex items-end justify-between">
      <h2 className="text-xl md:text-2xl font-semibold tracking-tight">{title}</h2>
      {link && (
        <Link to={link} data-testid={`${testid}-see-all`} className="text-sm font-medium text-primary flex items-center gap-1 hover:underline">
          See all <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
    <div className="mt-4 flex gap-3 overflow-x-auto no-scrollbar pb-2">
      {(products || Array.from({ length: 6 })).map((p, i) =>
        p ? (
          <div key={p.id} className="w-40 sm:w-48 shrink-0"><ProductCard product={p} /></div>
        ) : (
          <div key={i} className="w-40 sm:w-48 shrink-0 h-72 rounded-lg bg-muted animate-pulse" />
        )
      )}
    </div>
  </section>
);
