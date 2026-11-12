import { Link } from "react-router-dom";
import { SignIn, SignUp } from "@clerk/react";
import { BadgeCheck, CreditCard, ShoppingBasket, Truck } from "lucide-react";

const BrandPanel = () => (
  <div className="hidden lg:flex relative flex-col justify-between p-10 text-white overflow-hidden">
    <img src="/hero.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
    <div className="absolute inset-0 bg-[#1b5e20]/85" />
    <Link to="/" className="relative flex items-center gap-2 font-bold text-xl"><ShoppingBasket className="h-6 w-6" /> MiniBasket</Link>
    <div className="relative">
      <h2 className="text-4xl font-bold tracking-tight leading-tight">Fresh groceries,<br />delivered to your door.</h2>
      <ul className="mt-6 space-y-3 text-white/90">
        <li className="flex items-center gap-3"><Truck className="h-5 w-5" /> Doorstep delivery with live order tracking</li>
        <li className="flex items-center gap-3"><CreditCard className="h-5 w-5" /> Secure prepaid payments via Razorpay</li>
        <li className="flex items-center gap-3"><BadgeCheck className="h-5 w-5" /> Admin-verified delivery partners</li>
      </ul>
    </div>
    <p className="relative text-sm text-white/70">One account for shoppers, delivery partners and admins.</p>
  </div>
);

const AuthShell = ({ children, testid }) => (
  <div data-testid={testid} className="min-h-screen grid lg:grid-cols-2 bg-background">
    <BrandPanel />
    <div className="flex flex-col items-center justify-center py-10 px-4">
      <Link to="/" className="lg:hidden mb-6 flex items-center gap-2 font-bold text-xl"><ShoppingBasket className="h-6 w-6 text-primary" /> MiniBasket</Link>
      {children}
    </div>
  </div>
);

export const SignInPage = () => (
  <AuthShell testid="sign-in-page">
    <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" withSignUp />
  </AuthShell>
);

export const SignUpPage = () => (
  <AuthShell testid="sign-up-page">
    <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
  </AuthShell>
);
