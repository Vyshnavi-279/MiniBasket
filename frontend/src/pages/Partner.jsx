import { useState } from "react";
import { Link } from "react-router-dom";
import { Show } from "@clerk/react";
import { toast } from "sonner";
import { BadgeCheck, Clock, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageLoader } from "@/components/RoleGate";
import { useMe } from "@/context/MeContext";
import { errMsg, useApi } from "@/lib/api";
import { PHONE_RE } from "@/lib/format";

const VEHICLES = [["bike", "Motorbike"], ["scooter", "Scooter"], ["electric", "Electric scooter"], ["bicycle", "Bicycle"]];

const ApplyForm = ({ me, onDone }) => {
  const api = useApi();
  const [f, setF] = useState({ full_name: me?.name || "", phone: me?.phone || "", vehicle_type: "bike", vehicle_number: "", area: "" });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const v = {};
    if (f.full_name.trim().length < 2) v.full_name = "Enter your full name";
    if (!PHONE_RE.test(f.phone.trim())) v.phone = "Enter a valid 10-digit mobile number";
    if (!/^[A-Za-z0-9 -]{4,15}$/.test(f.vehicle_number.trim())) v.vehicle_number = "Enter a valid vehicle number (e.g. KA01AB1234)";
    if (f.area.trim().length < 2) v.area = "Enter the area you want to deliver in";
    setErrors(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    try {
      await api.post("/delivery/apply", { ...f, full_name: f.full_name.trim(), phone: f.phone.trim(), vehicle_number: f.vehicle_number.trim(), area: f.area.trim() });
      toast.success("Application submitted. The admin will review it shortly.");
      onDone();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const field = (k, label, props = {}) => (
    <div>
      <Label htmlFor={`apply-${k}`} className="text-xs text-muted-foreground">{label}</Label>
      <Input id={`apply-${k}`} data-testid={`apply-${k}-input`} value={f[k]} onChange={set(k)} className="mt-1.5 bg-white" {...props} />
      {errors[k] && <p className="mt-1 text-xs text-[#c62828]">{errors[k]}</p>}
    </div>
  );

  return (
    <form onSubmit={submit} data-testid="apply-form" className="bg-white border rounded-xl p-6 grid sm:grid-cols-2 gap-4">
      {field("full_name", "Full name (as on ID)")}
      {field("phone", "Mobile number", { inputMode: "numeric", maxLength: 10 })}
      <div>
        <Label className="text-xs text-muted-foreground">Vehicle type</Label>
        <Select value={f.vehicle_type} onValueChange={(v) => setF({ ...f, vehicle_type: v })}>
          <SelectTrigger className="mt-1.5 bg-white" data-testid="apply-vehicle-type-select"><SelectValue /></SelectTrigger>
          <SelectContent>{VEHICLES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {field("vehicle_number", "Vehicle number", { maxLength: 15 })}
      <div className="sm:col-span-2">{field("area", "Preferred delivery area / locality", { maxLength: 80 })}</div>
      <Button type="submit" data-testid="apply-submit-button" disabled={busy} className="sm:col-span-2 h-11">
        {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Submit application
      </Button>
    </form>
  );
};

const StatusCard = ({ icon: Icon, tone, title, text, children, testid }) => (
  <div data-testid={testid} className={`border rounded-xl p-6 ${tone}`}>
    <Icon className="h-7 w-7" />
    <p className="mt-3 text-lg font-semibold">{title}</p>
    <p className="mt-1 text-sm opacity-90">{text}</p>
    {children}
  </div>
);

const PartnerState = () => {
  const { me, loading, refresh } = useMe();
  const [reapply, setReapply] = useState(false);
  if (loading) return <PageLoader />;
  const app = me?.application;
  if (me?.role === "delivery") {
    return <StatusCard testid="partner-approved" icon={BadgeCheck} tone="bg-[#e8f5e9] text-[#1b5e20] border-[#c8e6c9]" title="You're an approved delivery partner" text="Open your deliveries to see orders assigned to you.">
      <Button asChild className="mt-4" data-testid="partner-go-deliveries"><Link to="/delivery">Go to my deliveries</Link></Button>
    </StatusCard>;
  }
  if (me?.role === "admin") return <StatusCard testid="partner-admin" icon={BadgeCheck} tone="bg-white" title="You're signed in as admin" text="Review rider applications from the admin console." />;
  if (app?.status === "pending") return <StatusCard testid="partner-pending" icon={Clock} tone="bg-[#fff8e1] text-[#8a4b00] border-[#ffe082]" title="Application under review" text="Our admin is verifying your details. You'll get access to deliveries once approved." />;
  if (app?.status === "rejected" && !reapply) {
    return <StatusCard testid="partner-rejected" icon={XCircle} tone="bg-[#ffebee] text-[#b71c1c] border-[#ffcdd2]" title="Application not approved" text={app.note ? `Reason: ${app.note}` : "Your previous application was not approved."}>
      <Button variant="outline" className="mt-4 bg-white" onClick={() => setReapply(true)} data-testid="partner-reapply-button">Apply again</Button>
    </StatusCard>;
  }
  return <ApplyForm me={me} onDone={refresh} />;
};

export default function Partner() {
  return (
    <div data-testid="partner-page" className="max-w-[1100px] mx-auto px-4 lg:px-6 py-8 grid lg:grid-cols-[1fr_1.2fr] gap-8 items-start">
      <div>
        <p className="text-sm font-medium text-primary">Delivery partner program</p>
        <h1 className="mt-2 text-4xl sm:text-5xl font-bold tracking-tight">Deliver groceries with MiniBasket</h1>
        <p className="mt-4 text-muted-foreground">Create an account, submit your details, and start delivering once our admin approves you. All orders are prepaid, so you never handle cash.</p>
        <ul className="mt-6 space-y-3 text-sm">
          {["Sign up with your email", "Fill the short application", "Admin verifies and approves", "See assigned orders and update delivery status"].map((s, i) => (
            <li key={s} className="flex items-center gap-3"><span className="h-6 w-6 rounded-full bg-accent text-primary text-xs font-semibold grid place-items-center">{i + 1}</span>{s}</li>
          ))}
        </ul>
        <img src="/rider.jpg" alt="Delivery partner riding a scooter" className="mt-8 rounded-xl h-56 w-full object-cover hidden lg:block" />
      </div>
      <div>
        <Show when="signed-out">
          <div data-testid="partner-signed-out" className="bg-white border rounded-xl p-6">
            <p className="text-lg font-semibold">Create your account to apply</p>
            <p className="mt-1 text-sm text-muted-foreground">You'll get no access to orders until an admin approves your application.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild data-testid="partner-sign-up-button"><Link to="/sign-up">Create account</Link></Button>
              <Button asChild variant="outline" data-testid="partner-sign-in-button"><Link to="/sign-in">I already have an account</Link></Button>
            </div>
          </div>
        </Show>
        <Show when="signed-in"><PartnerState /></Show>
      </div>
    </div>
  );
}
