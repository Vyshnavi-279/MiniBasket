import { Navigate } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { Loader2, Lock } from "lucide-react";
import { useMe } from "@/context/MeContext";

export const PageLoader = () => (
  <div data-testid="page-loader" className="flex items-center justify-center py-24 text-muted-foreground">
    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
  </div>
);

const NoAccess = () => (
  <div data-testid="no-access" className="max-w-md mx-auto text-center py-24 px-4">
    <Lock className="h-8 w-8 mx-auto text-muted-foreground" />
    <h1 className="mt-4 text-xl font-semibold">You don't have access to this page</h1>
    <p className="mt-2 text-sm text-muted-foreground">This area is only for approved staff. Contact the store admin if you think this is a mistake.</p>
  </div>
);

export default function RoleGate({ roles, children }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { me, loading } = useMe();
  if (!isLoaded || (isSignedIn && loading)) return <PageLoader />;
  if (!isSignedIn) return <Navigate to="/sign-in" replace />;
  if (roles && !roles.includes(me?.role)) return <NoAccess />;
  return children;
}
