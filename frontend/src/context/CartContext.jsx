import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const CartContext = createContext(null);
const KEY = "minibasket_cart_v1";
const MAX_QTY = 20;

const load = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export function CartProvider({ children }) {
  const [items, setItems] = useState(load);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(items));
  }, [items]);

  const setQty = useCallback((product, qty) => {
    setItems((prev) => {
      const limit = Math.min(MAX_QTY, product.stock ?? MAX_QTY);
      const next = Math.max(0, Math.min(qty, limit));
      const rest = prev.filter((i) => i.id !== product.id);
      if (next === 0) return rest;
      const snapshot = { id: product.id, name: product.name, price: product.price, mrp: product.mrp, unit: product.unit, image: product.image, stock: product.stock, qty: next };
      const idx = prev.findIndex((i) => i.id === product.id);
      if (idx === -1) return [...prev, snapshot];
      const copy = [...prev];
      copy[idx] = snapshot;
      return copy;
    });
  }, []);

  const qtyOf = useCallback((id) => items.find((i) => i.id === id)?.qty || 0, [items]);
  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(() => {
    const count = items.reduce((s, i) => s + i.qty, 0);
    const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
    return { items, setQty, qtyOf, clear, count, subtotal, open, setOpen };
  }, [items, setQty, qtyOf, clear, open]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
