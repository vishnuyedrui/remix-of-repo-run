import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { Maximize2, Minimize2, Loader2, Monitor, RefreshCw, AlertTriangle, Copy, Check, Code2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { checkWebContainerSupport } from "@/utils/webcontainer";
import { cn } from "@/lib/utils";

export function Preview() {
  const { previewUrl, containerStatus, error, projectInfo } = useWorkspaceStore();
  const [key, setKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const isLoading = ["booting", "mounting", "installing", "running"].includes(containerStatus);
  const hasError = containerStatus === "error";
  const webContainerSupport = checkWebContainerSupport();
  const isWebContainerError = hasError && !webContainerSupport.supported;
  const isCodeBrowsingOnly = projectInfo && !projectInfo.canRun;

  const handleRefresh = () => {
    setKey((k) => k + 1);
  };

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };

  const containerClasses = cn(
    "flex flex-col bg-background",
    isFullscreen ? "fixed inset-0 z-50" : "h-full"
  );

  return (
    <div className={containerClasses}>
      {/* Header */}
      <div className="h-10 px-4 flex items-center justify-between border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Monitor className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Preview
          </span>
          {containerStatus === "ready" && (
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          )}
        </div>
        
        <div className="flex items-center gap-1">
          {previewUrl && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleRefresh}
                title="Refresh preview"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={toggleFullscreen}
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
              </Button>
            </>
          )}
          {isFullscreen && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsFullscreen(false)}
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 bg-background/50">
        {isLoading && (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <p className="text-sm font-medium">
              {containerStatus === "booting" && "Booting WebContainer..."}
              {containerStatus === "mounting" && "Mounting files..."}
              {containerStatus === "installing" && "Installing dependencies..."}
              {containerStatus === "running" && "Starting dev server..."}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              This may take a moment
            </p>
          </div>
        )}

        {hasError && !previewUrl && isWebContainerError && (
          <WebContainerUnavailable 
            reason={webContainerSupport.reason} 
            copied={copied}
            onCopy={() => {
              navigator.clipboard.writeText(deploymentInstructions);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          />
        )}

        {hasError && !previewUrl && !isWebContainerError && (
          <div className="h-full flex flex-col items-center justify-center text-destructive px-6">
            <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center mb-4">
              <span className="text-2xl">!</span>
            </div>
            <p className="text-sm font-medium">Failed to start preview</p>
            <p className="text-xs text-muted-foreground mt-1 text-center max-w-xs">
              {error || "Check the terminal for details"}
            </p>
          </div>
        )}

        {previewUrl && (
          <iframe
            key={key}
            src={previewUrl}
            className="w-full h-full border-0 bg-white"
            style={{ backgroundColor: '#ffffff' }}
            title="Preview"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            referrerPolicy="no-referrer-when-downgrade"
            allow="cross-origin-isolated"
          />
        )}

        {isCodeBrowsingOnly && containerStatus === "ready" && !previewUrl && (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground px-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Code2 className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Code Browsing Mode
            </h3>
            <p className="text-sm text-center max-w-md mb-2">
              {projectInfo?.description}
            </p>
            <p className="text-xs text-muted-foreground text-center">
              Browse the code in the file tree on the left. WebContainers only support Node.js runtime.
            </p>
          </div>
        )}

        {containerStatus === "idle" && (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
            <Monitor className="w-12 h-12 opacity-20 mb-4" />
            <p className="text-sm">Preview will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
}

const deploymentInstructions = `# Deploy with Cross-Origin Isolation Headers

To run WebContainers, your server needs these headers:

## Vercel (vercel.json)
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" },
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" }
      ]
    }
  ]
}

## Netlify (_headers file)
/*
  Cross-Origin-Embedder-Policy: require-corp
  Cross-Origin-Opener-Policy: same-origin

## Nginx
add_header Cross-Origin-Embedder-Policy "require-corp";
add_header Cross-Origin-Opener-Policy "same-origin";
`;

function WebContainerUnavailable({ 
  reason, 
  copied, 
  onCopy 
}: { 
  reason?: string; 
  copied: boolean; 
  onCopy: () => void;
}) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-muted-foreground px-6">
      <div className="w-16 h-16 rounded-full bg-warning/20 flex items-center justify-center mb-4">
        <AlertTriangle className="w-8 h-8 text-warning" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">
        WebContainers Not Available
      </h3>
      <p className="text-sm text-center max-w-md mb-4">
        {reason || "This environment doesn't support WebContainers."}
      </p>
      
      <div className="bg-muted/50 rounded-lg p-4 max-w-md w-full">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">
            To enable WebContainers, deploy with these headers:
          </span>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 px-2"
            onClick={onCopy}
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
        <code className="text-xs block bg-background/80 p-3 rounded border border-border overflow-x-auto">
          <span className="text-primary">Cross-Origin-Embedder-Policy:</span> require-corp<br />
          <span className="text-primary">Cross-Origin-Opener-Policy:</span> same-origin
        </code>
      </div>
      
      <p className="text-xs text-muted-foreground mt-4 text-center">
        Deploy to Vercel, Netlify, or any host with custom header support.
      </p>
    </div>
  );
}
