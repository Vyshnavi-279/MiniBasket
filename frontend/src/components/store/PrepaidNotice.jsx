import { Ban, CreditCard } from "lucide-react";

export const PrepaidNotice = ({ compact = false }) => (
  <div data-testid="prepaid-notice" className="rounded-lg border border-[#ffcdd2] bg-[#ffebee] text-[#b71c1c] p-3 text-sm flex gap-3">
    <Ban className="h-4 w-4 mt-0.5 shrink-0" />
    <div>
      <p className="font-semibold">Prepaid orders only</p>
      {!compact && (
        <p className="mt-0.5 text-[#b71c1c]/90">
          Cash on delivery is not available. Pay securely online with UPI, cards, netbanking or wallets via Razorpay.
        </p>
      )}
    </div>
  </div>
);

export const RazorpayBadge = () => (
  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
    <CreditCard className="h-3.5 w-3.5" /> Secured by Razorpay · UPI · Cards · Netbanking · Wallets
  </div>
);
