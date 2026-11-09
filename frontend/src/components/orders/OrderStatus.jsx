import { Check } from "lucide-react";
import { FLOW, STATUS, fmtDate } from "@/lib/format";

export const StatusBadge = ({ status, testid }) => {
  const s = STATUS[status] || { label: status, cls: "bg-muted text-muted-foreground" };
  return <span data-testid={testid} className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>;
};

const shortTime = (iso) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export const OrderTimeline = ({ order }) => {
  if (order.status === "cancelled") {
    return (
      <div data-testid="order-cancelled-note" className="space-y-2 text-sm">
        <p className="text-[#b71c1c] font-medium">This order was cancelled. The amount paid will be refunded to your original payment method.</p>
        {order.cancel_reason && <p className="text-muted-foreground">{order.cancel_reason}</p>}
        <ul className="text-xs text-muted-foreground space-y-0.5">
          {(order.timeline || []).map((t, i) => <li key={i}>{STATUS[t.status]?.label || t.status} · {fmtDate(t.at)}</li>)}
        </ul>
      </div>
    );
  }
  const reached = FLOW.indexOf(order.status);
  const at = {};
  (order.timeline || []).forEach((t) => { at[t.status] = t.at; });
  return (
    <ol data-testid="order-timeline" className="grid grid-cols-5 gap-1">
      {FLOW.map((s, i) => {
        const done = i <= reached;
        return (
          <li key={s} className="flex flex-col items-center text-center">
            <div className="flex items-center w-full">
              <div className={`h-0.5 flex-1 ${i === 0 ? "invisible" : done ? "bg-primary" : "bg-border"}`} />
              <span className={`h-7 w-7 shrink-0 rounded-full grid place-items-center border-2 ${done ? "bg-primary border-primary text-white" : "bg-white border-border text-muted-foreground"}`}>
                {done ? <Check className="h-3.5 w-3.5" /> : <span className="text-[11px]">{i + 1}</span>}
              </span>
              <div className={`h-0.5 flex-1 ${i === FLOW.length - 1 ? "invisible" : i < reached ? "bg-primary" : "bg-border"}`} />
            </div>
            <span className={`mt-2 text-[11px] sm:text-xs font-medium ${done ? "text-foreground" : "text-muted-foreground"}`}>{STATUS[s].label}</span>
            {at[s] && <span className="text-[10px] sm:text-[11px] text-muted-foreground leading-tight">{shortTime(at[s])}</span>}
          </li>
        );
      })}
    </ol>
  );
};
