import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LandingPage } from "@/components/LandingPage";
import { Workspace } from "@/components/Workspace";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";

const queryClient = new QueryClient();

function AppContent() {
  const { view } = useWorkspaceStore();
  
  return view === "landing" ? <LandingPage /> : <Workspace />;
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
