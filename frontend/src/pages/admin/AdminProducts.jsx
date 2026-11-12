import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminHeader } from "@/pages/admin/AdminLayout";
import { ProductDialog } from "@/pages/admin/ProductDialog";
import { errMsg, publicApi, useApi } from "@/lib/api";
import { inr } from "@/lib/format";

export default function AdminProducts() {
  const api = useApi();
  const [products, setProducts] = useState(null);
  const [categories, setCategories] = useState([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [dialog, setDialog] = useState({ open: false, product: null });

  const load = useCallback(() => {
    api.get("/admin/products").then((r) => setProducts(r.data)).catch(() => setProducts("error"));
  }, [api]);

  useEffect(() => {
    load();
    publicApi.get("/categories").then((r) => setCategories(r.data)).catch(() => {});
  }, [load]);

  const save = async (body) => {
    if (dialog.product) await api.put(`/admin/products/${dialog.product.id}`, { ...body, expected_stock: dialog.product.stock });
    else await api.post("/admin/products", body);
    toast.success(dialog.product ? "Product updated" : "Product added");
    setDialog({ open: false, product: null });
    load();
  };

  const remove = async (p) => {
    if (!window.confirm(`Remove “${p.name}” from the store?`)) return;
    try {
      await api.delete(`/admin/products/${p.id}`);
      toast.success("Product removed");
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const list = (Array.isArray(products) ? products : []).filter((p) => (cat === "all" || p.category === cat) && p.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div data-testid="admin-products">
      <AdminHeader title="Products" subtitle={Array.isArray(products) ? `${products.length} products in catalog` : ""}>
        <Button data-testid="add-product-button" onClick={() => setDialog({ open: true, product: null })}><Plus className="h-4 w-4 mr-1.5" /> Add product</Button>
      </AdminHeader>
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input data-testid="admin-products-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products"
            className="h-9 w-56 pl-9 pr-3 rounded-md border border-input bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="h-9 w-52 bg-white" data-testid="admin-products-category-filter"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All categories</SelectItem>{categories.map((c) => <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="bg-white border rounded-xl overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted">
            <TableRow><TableHead>Product</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Price</TableHead><TableHead className="text-right">MRP</TableHead><TableHead className="text-right">Stock</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {products === null ? <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Loading…</TableCell></TableRow> :
              products === "error" ? <TableRow><TableCell colSpan={7} className="text-center py-10" data-testid="admin-products-error">Couldn't load products. <button className="text-primary underline" onClick={() => { setProducts(null); load(); }}>Try again</button></TableCell></TableRow> :
              list.map((p) => (
                <TableRow key={p.id} data-testid={`admin-product-row-${p.id}`}>
                  <TableCell><div className="flex items-center gap-3"><img src={p.image} alt="" className="h-10 w-10 rounded object-cover bg-muted" /><div><p className="text-sm font-medium">{p.name}</p><p className="text-xs text-muted-foreground">{p.unit}</p></div></div></TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{p.category_name}</TableCell>
                  <TableCell className="text-right tnum">{inr(p.price)}</TableCell>
                  <TableCell className="text-right tnum text-muted-foreground">{inr(p.mrp)}</TableCell>
                  <TableCell className={`text-right tnum font-medium ${p.stock < 10 ? "text-[#b45309]" : ""}`}>{p.stock}</TableCell>
                  <TableCell><span className={`text-xs rounded-full px-2 py-0.5 whitespace-nowrap ${p.is_active ? "bg-[#e8f5e9] text-[#1b5e20]" : "bg-muted text-muted-foreground"}`}>{p.is_active ? "Visible" : "Hidden"}</span></TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Edit" data-testid={`edit-product-${p.id}`} onClick={() => setDialog({ open: true, product: p })}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-[#c62828] hover:text-[#c62828]" aria-label="Remove" data-testid={`delete-product-${p.id}`} onClick={() => remove(p)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
      <ProductDialog open={dialog.open} product={dialog.product} categories={categories} onClose={() => setDialog({ open: false, product: null })} onSave={save} />
    </div>
  );
}
