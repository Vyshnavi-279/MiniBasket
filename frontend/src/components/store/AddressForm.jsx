import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PHONE_RE, PIN_RE } from "@/lib/format";

export const EMPTY_ADDRESS = { full_name: "", phone: "", line1: "", line2: "", city: "", pincode: "" };

export const validateAddress = (a) => {
  const e = {};
  if (a.full_name.trim().length < 2) e.full_name = "Enter the receiver's name";
  if (!PHONE_RE.test(a.phone.trim())) e.phone = "Enter a valid 10-digit mobile number";
  if (a.line1.trim().length < 5) e.line1 = "Enter house / flat number and street";
  if (a.city.trim().length < 2) e.city = "Enter your city";
  if (!PIN_RE.test(a.pincode.trim())) e.pincode = "Enter a valid 6-digit pincode";
  return e;
};

const FIELDS = [
  { key: "full_name", label: "Receiver's name", span: 1, auto: "name" },
  { key: "phone", label: "Mobile number", span: 1, auto: "tel", inputMode: "numeric", max: 10 },
  { key: "line1", label: "House / flat, street, area", span: 2, auto: "street-address" },
  { key: "line2", label: "Landmark (optional)", span: 2 },
  { key: "city", label: "City", span: 1, auto: "address-level2" },
  { key: "pincode", label: "Pincode", span: 1, auto: "postal-code", inputMode: "numeric", max: 6 },
];

export const AddressForm = ({ value, onChange, errors }) => (
  <div className="grid sm:grid-cols-2 gap-4" data-testid="address-form">
    {FIELDS.map((f) => (
      <div key={f.key} className={f.span === 2 ? "sm:col-span-2" : ""}>
        <Label htmlFor={`addr-${f.key}`} className="text-xs text-muted-foreground">{f.label}</Label>
        <Input id={`addr-${f.key}`} data-testid={`address-${f.key}-input`} value={value[f.key]} autoComplete={f.auto}
          inputMode={f.inputMode} maxLength={f.max || 120}
          onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
          className={`mt-1.5 bg-white ${errors[f.key] ? "border-[#c62828]" : ""}`} />
        {errors[f.key] && <p className="mt-1 text-xs text-[#c62828]" data-testid={`address-${f.key}-error`}>{errors[f.key]}</p>}
      </div>
    ))}
  </div>
);
