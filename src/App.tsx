import { lazy, Suspense } from "react";
import { Login } from "./pages/Login";
import { AuthProvider, useAuth } from "./auth";
const Workspace = lazy(() => import("./Workspace"));
export function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}
function AuthenticatedApp() {
  const { session, member, loading, recovery, signOut } = useAuth();
  if (loading)
    return (
      <div className="workspace-loading" role="status">
        Checking IT access…
      </div>
    );
  if (!session || !member || recovery) return <Login />;
  return (
    <Suspense
      fallback={
        <div className="workspace-loading" role="status">
          Opening your workspace…
        </div>
      }
    >
      <Workspace key={session.user.id} onLogout={() => void signOut()} />
    </Suspense>
  );
}
