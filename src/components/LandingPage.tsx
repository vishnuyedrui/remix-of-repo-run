import { useState } from "react";
import { Github, Rocket, Settings, Zap, Code2, Terminal as TerminalIcon, Heart, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SettingsModal } from "./SettingsModal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import {
  parseGitHubUrl,
  fetchRepoTree,
  transformToNestedTree,
  buildFileSystemTree,
} from "@/utils/github";
import { detectProjectType } from "@/utils/projectDetection";
import { runFullWorkflow } from "@/utils/webcontainer";

export function LandingPage() {
  const [url, setUrl] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showDonate, setShowDonate] = useState(false);

  const handlePayment = () => {
    window.location.href = "https://rzp.io/rzp/bkbe8jK";
  };
  
  const {
    isLoadingRepo,
    loadingProgress,
    error,
    setRepoInfo,
    setProjectInfo,
    setFileTree,
    setFileSystemTree,
    setIsLoadingRepo,
    setLoadingProgress,
    setError,
    setView,
    setContainerStatus,
    appendTerminalOutput,
    clearTerminalOutput,
    setPreviewUrl,
  } = useWorkspaceStore();

  const handleLaunch = async () => {
    if (!url.trim()) {
      setError("Please enter a GitHub repository URL");
      return;
    }

    const parsed = parseGitHubUrl(url.trim());
    if (!parsed) {
      setError("Invalid GitHub URL. Please use format: https://github.com/owner/repo");
      return;
    }

    setError(null);
    setIsLoadingRepo(true);
    setLoadingProgress(null);
    clearTerminalOutput();

    try {
      // Fetch repository tree
      const files = await fetchRepoTree(parsed.owner, parsed.repo, parsed.branch);
      
      // Detect project type
      const projectInfo = detectProjectType(files);

      // Transform to nested tree for UI
      const nestedTree = transformToNestedTree(files);
      
      // Build file system tree for WebContainer
      const fsTree = await buildFileSystemTree(
        parsed.owner,
        parsed.repo,
        files,
        (current, total, fileName) => {
          setLoadingProgress({ current, total, fileName });
        }
      );

      // Update store
      setRepoInfo(parsed);
      setProjectInfo(projectInfo);
      setFileTree(nestedTree);
      setFileSystemTree(fsTree);
      setView("workspace");
      setIsLoadingRepo(false);
      setLoadingProgress(null);

      // Start WebContainer workflow with project type
      runFullWorkflow(fsTree, {
        onStatusChange: setContainerStatus,
        onOutput: appendTerminalOutput,
        onServerReady: setPreviewUrl,
        onError: (err) => setError(err),
      }, projectInfo.type);

    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load repository";
      setError(message);
      setIsLoadingRepo(false);
      setLoadingProgress(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 grid-background opacity-30" />
      <div className="absolute inset-0 gradient-radial" />
      
      {/* Header */}
      <header className="relative z-10 flex justify-between items-center p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center neon-border">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <span className="text-xl font-bold text-foreground">
            Instant<span className="text-primary">IDE</span>
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => setShowDonate(true)}
            className="glass-hover rounded-full flex items-center gap-2"
          >
            <Heart className="w-4 h-4 text-red-500" />
            <span className="hidden sm:inline">Donate</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSettings(true)}
            className="glass-hover rounded-full"
          >
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pb-20">
        <div className="max-w-2xl w-full text-center space-y-8">
          {/* Hero */}
          <div className="space-y-4 animate-fade-in">
            <h1 className="text-5xl md:text-6xl font-bold">
              Run any{" "}
              <span className="text-primary text-glow">GitHub repo</span>
              <br />
              in your browser
            </h1>
            <p className="text-lg text-muted-foreground max-w-lg mx-auto">
              Paste a link. Watch it build. No setup required.
              Powered by WebContainers.
            </p>
          </div>

          {/* Input */}
          <div className="space-y-4 animate-fade-in" style={{ animationDelay: "0.1s" }}>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Github className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !isLoadingRepo && handleLaunch()}
                  placeholder="https://github.com/owner/repo"
                  className="pl-12 h-14 glass text-base focus:neon-border"
                  disabled={isLoadingRepo}
                />
              </div>
              <Button
                onClick={handleLaunch}
                disabled={isLoadingRepo}
                className="h-14 px-8 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold neon-glow transition-all duration-300"
              >
                {isLoadingRepo ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Loading
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Rocket className="w-5 h-5" />
                    Launch
                  </div>
                )}
              </Button>
            </div>

            {/* Error message */}
            {error && (
              <p className="text-destructive text-sm bg-destructive/10 px-4 py-2 rounded-lg border border-destructive/20">
                {error}
              </p>
            )}

            {/* Loading progress */}
            {loadingProgress && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Downloading files...</span>
                  <span>{loadingProgress.current} / {loadingProgress.total}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{
                      width: `${(loadingProgress.current / loadingProgress.total) * 100}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {loadingProgress.fileName}
                </p>
              </div>
            )}
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-8 animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <FeatureCard
              icon={<Code2 className="w-6 h-6" />}
              title="Monaco Editor"
              description="VS Code-style code viewing with syntax highlighting"
            />
            <FeatureCard
              icon={<TerminalIcon className="w-6 h-6" />}
              title="Live Terminal"
              description="Full terminal with real-time npm output"
            />
            <FeatureCard
              icon={<Zap className="w-6 h-6" />}
              title="Instant Preview"
              description="Watch your app come to life in seconds"
            />
          </div>
        </div>
      </main>

      {/* Settings Modal */}
      <SettingsModal open={showSettings} onOpenChange={setShowSettings} />

      {/* Donate Modal */}
      <Dialog open={showDonate} onOpenChange={setShowDonate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-red-500" />
              Support InstantIDE
            </DialogTitle>
            <DialogDescription>
              Help us keep InstantIDE free and improve it for everyone. Your support means a lot!
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              InstantIDE is a free tool that lets you run GitHub repositories directly in your browser. 
              Your donations help cover hosting costs and enable us to add new features.
            </p>
            <Button 
              onClick={handlePayment} 
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Donate Now
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="glass-hover p-6 rounded-xl text-left">
      <div className="text-primary mb-3">{icon}</div>
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
