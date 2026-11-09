import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { AlertTriangle, Clock, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMe } from "@/context/MeContext";

export const PageLoader = () => (
  <div data-testid="page-loader" className="flex items-center justify-center py-24 text-muted-foreground">
    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
  </div>
);

export const ErrorState = ({ onRetry, text = "We couldn't load this right now." }) => (
  <div data-testid="load-error" className="max-w-md mx-auto text-center py-16 px-4">
    <AlertTriangle className="h-8 w-8 mx-auto text-[#b45309]" />
    <p className="mt-3 font-medium">{text}</p>
    <p className="mt-1 text-sm text-muted-foreground">Check your connection and try again.</p>
    {onRetry && <Button variant="outline" className="mt-4" onClick={onRetry} data-testid="load-error-retry-button">Try again</Button>}
  </div>
);

const NoAccess = ({ me, roles }) => {
  const pending = roles?.includes("delivery") && me?.application?.status === "pending";
  return (
    <div data-testid={pending ? "partner-pending-gate" : "no-access"} className="max-w-md mx-auto text-center py-24 px-4">
      {pending ? <Clock className="h-8 w-8 mx-auto text-[#b45309]" /> : <Lock className="h-8 w-8 mx-auto text-muted-foreground" />}
      <h1 className="mt-4 text-xl font-semibold">{pending ? "Your application is under review" : "You don't have access to this page"}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {pending ? "You'll see your deliveries here as soon as the admin approves your application." : "This area is only for approved staff. Contact the store admin if you think this is a mistake."}
      </p>
      {roles?.includes("delivery") && !pending && <Button asChild variant="outline" className="mt-5"><Link to="/partner">Become a delivery partner</Link></Button>}
    </div>
  );
};

export default function RoleGate({ roles, children }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { me, loading, error, refresh } = useMe();
  if (!isLoaded || (isSignedIn && loading)) return <PageLoader />;
  if (!isSignedIn) return <Navigate to="/sign-in" replace />;
  if (error && !me) return <ErrorState onRetry={refresh} text="We couldn't load your account." />;
  if (roles && !roles.includes(me?.role)) return <NoAccess me={me} roles={roles} />;
  return children;
}
