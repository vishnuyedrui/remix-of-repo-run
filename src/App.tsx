import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LandingPage } from "@/components/LandingPage";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";

// Lazy load heavy Workspace component (contains Monaco, xterm, etc.)
const Workspace = lazy(() => import("@/components/Workspace").then(m => ({ default: m.Workspace })));

const queryClient = new QueryClient();

function WorkspaceLoader() {
  return (
    <div className="h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
    </div>
  );
}

function AppContent() {
  const view = useWorkspaceStore((s) => s.view);
  
  return view === "landing" ? (
    <LandingPage />
  ) : (
    <Suspense fallback={<WorkspaceLoader />}>
      <Workspace />
    </Suspense>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <div className="dark">
        <AppContent />
      </div>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
