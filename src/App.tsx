import { lazy, Suspense, useState } from "react";
import { Login } from "./pages/Login";
import { InventoryProvider } from "./store";
const Workspace = lazy(() => import("./Workspace"));
export function App() {
  const [signedIn, setSignedIn] = useState(false);
  if (!signedIn) return <Login onLogin={() => setSignedIn(true)} />;
  return (
    <InventoryProvider>
      <Suspense
        fallback={
          <div className="workspace-loading" role="status">
            Opening your workspace…
          </div>
        }
      >
        <Workspace onLogout={() => setSignedIn(false)} />
      </Suspense>
    </InventoryProvider>
  );
}
