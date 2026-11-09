export const DELIVERY_FEE = 40;

export const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })
    : "—";

export const STATUS = {
  pending_payment: { label: "Payment pending", cls: "bg-slate-100 text-slate-700" },
  placed: { label: "Placed", cls: "bg-[#e3f2fd] text-[#0d47a1]" },
  packed: { label: "Packed", cls: "bg-[#fff8e1] text-[#b45309]" },
  assigned: { label: "Rider assigned", cls: "bg-[#fff8e1] text-[#b45309]" },
  out_for_delivery: { label: "Out for delivery", cls: "bg-[#ffe0b2] text-[#7c2d12]" },
  delivered: { label: "Delivered", cls: "bg-[#e8f5e9] text-[#1b5e20]" },
  cancelled: { label: "Cancelled", cls: "bg-[#ffebee] text-[#b71c1c]" },
};

export const FLOW = ["placed", "packed", "assigned", "out_for_delivery", "delivered"];

export const PHONE_RE = /^[6-9]\d{9}$/;
export const PIN_RE = /^\d{6}$/;
