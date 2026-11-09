import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { errMsg } from "@/lib/api";

const BLANK = { name: "", category: "fruits-vegetables", unit: "", price: "", mrp: "", stock: "", image: "", description: "", is_active: true };

const validate = (f) => {
  const e = {};
  if (f.name.trim().length < 2) e.name = "Enter a product name";
  if (!f.unit.trim()) e.unit = "Enter a unit, e.g. 1 kg";
  if (!(Number(f.price) >= 1)) e.price = "Price must be at least ₹1";
  if (!(Number(f.mrp) >= Number(f.price))) e.mrp = "MRP must be ≥ price";
  if (!(Number(f.stock) >= 0) || f.stock === "") e.stock = "Enter stock (0 or more)";
  if (!/^(https?:\/\/|\/)\S+$/.test(f.image.trim())) e.image = "Enter an image URL starting with https://";
  return e;
};

export const ProductDialog = ({ open, product, categories, onClose, onSave }) => {
  const [f, setF] = useState(BLANK);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setF(product ? { ...BLANK, ...product, price: String(product.price), mrp: String(product.mrp), stock: String(product.stock) } : BLANK);
      setErrors({});
    }
  }, [open, product]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    const v = validate(f);
    setErrors(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    try {
      await onSave({ name: f.name.trim(), category: f.category, unit: f.unit.trim(), price: Math.round(Number(f.price)), mrp: Math.round(Number(f.mrp)),
        stock: Math.round(Number(f.stock)), image: f.image.trim(), description: f.description.trim(), is_active: f.is_active });
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const field = (k, label, props = {}) => (
    <div>
      <Label htmlFor={`pf-${k}`} className="text-xs text-muted-foreground">{label}</Label>
      <Input id={`pf-${k}`} data-testid={`product-form-${k}-input`} value={f[k]} onChange={set(k)} className="mt-1.5" {...props} />
      {errors[k] && <p className="mt-1 text-xs text-[#c62828]">{errors[k]}</p>}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="product-dialog">
        <DialogHeader><DialogTitle>{product ? "Edit product" : "Add product"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-2 gap-4">
          <div className="col-span-2">{field("name", "Product name", { maxLength: 80 })}</div>
          <div>
            <Label className="text-xs text-muted-foreground">Category</Label>
            <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
              <SelectTrigger className="mt-1.5" data-testid="product-form-category-select"><SelectValue /></SelectTrigger>
              <SelectContent>{categories.map((c) => <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {field("unit", "Unit (e.g. 1 kg, 500 ml)", { maxLength: 20 })}
          {field("price", "Selling price (₹)", { type: "number", min: 1 })}
          {field("mrp", "MRP (₹)", { type: "number", min: 1 })}
          {field("stock", "Stock quantity", { type: "number", min: 0 })}
          <div className="flex items-end gap-2 pb-2">
            <Switch id="pf-active" checked={f.is_active} onCheckedChange={(v) => setF({ ...f, is_active: v })} data-testid="product-form-active-switch" />
            <Label htmlFor="pf-active" className="text-sm">Visible in store</Label>
          </div>
          <div className="col-span-2">{field("image", "Image URL")}</div>
          <div className="col-span-2">
            <Label htmlFor="pf-desc" className="text-xs text-muted-foreground">Description</Label>
            <Textarea id="pf-desc" data-testid="product-form-description-input" value={f.description} onChange={set("description")} maxLength={600} className="mt-1.5" rows={3} />
          </div>
          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy} data-testid="product-form-save-button">{busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save product</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
