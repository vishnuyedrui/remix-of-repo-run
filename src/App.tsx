import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LandingPage } from "@/components/LandingPage";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

// Lazy load heavy Workspace component (contains Monaco, xterm, etc.)
const Workspace = lazy(() => import("@/components/Workspace").then(m => ({ default: m.Workspace })));

const queryClient = new QueryClient();

function WorkspaceLoader() {
  return (
    <motion.div 
      className="h-screen flex items-center justify-center bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
    </motion.div>
  );
}

function AppContent() {
  const view = useWorkspaceStore((s) => s.view);
  
  return (
    <AnimatePresence mode="wait">
      {view === "landing" ? (
        <motion.div
          key="landing"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.02, filter: "blur(10px)" }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          className="min-h-screen"
        >
          <LandingPage />
        </motion.div>
      ) : (
        <motion.div
          key="workspace"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          className="h-screen"
        >
          <Suspense fallback={<WorkspaceLoader />}>
            <Workspace />
          </Suspense>
        </motion.div>
      )}
    </AnimatePresence>
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
