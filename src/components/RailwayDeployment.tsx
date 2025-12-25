import { useEffect, useRef } from "react";
import { Cloud, ExternalLink, Loader2, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { supabase } from "@/integrations/supabase/client";

export function RailwayDeployment() {
  const railwayStatus = useWorkspaceStore((s) => s.railwayStatus);
  const railwayUrl = useWorkspaceStore((s) => s.railwayUrl);
  const railwayProjectId = useWorkspaceStore((s) => s.railwayProjectId);
  const railwayServiceId = useWorkspaceStore((s) => s.railwayServiceId);
  const deploymentLogs = useWorkspaceStore((s) => s.deploymentLogs);
  const repoInfo = useWorkspaceStore((s) => s.repoInfo);
  
  const setRailwayStatus = useWorkspaceStore((s) => s.setRailwayStatus);
  const setRailwayUrl = useWorkspaceStore((s) => s.setRailwayUrl);
  const setRailwayProjectId = useWorkspaceStore((s) => s.setRailwayProjectId);
  const setRailwayServiceId = useWorkspaceStore((s) => s.setRailwayServiceId);
  const setRailwayEnvironmentId = useWorkspaceStore((s) => s.setRailwayEnvironmentId);
  const appendDeploymentLog = useWorkspaceStore((s) => s.appendDeploymentLog);
  const clearDeploymentLogs = useWorkspaceStore((s) => s.clearDeploymentLogs);
  const setError = useWorkspaceStore((s) => s.setError);
  
  const logsEndRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [deploymentLogs]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const startDeployment = async () => {
    if (!repoInfo) return;

    clearDeploymentLogs();
    setRailwayStatus("creating");
    setRailwayUrl(null);
    appendDeploymentLog(`🚀 Starting deployment for ${repoInfo.owner}/${repoInfo.repo}...`);

    try {
      // Create project and trigger deployment
      appendDeploymentLog("📦 Creating Railway project...");
      
      const { data, error } = await supabase.functions.invoke('railway-deploy', {
        body: {
          action: 'create',
          githubUrl: `https://github.com/${repoInfo.owner}/${repoInfo.repo}`
        }
      });

      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);

      const { projectId, serviceId, environmentId } = data;
      setRailwayProjectId(projectId);
      setRailwayServiceId(serviceId);
      setRailwayEnvironmentId(environmentId);

      appendDeploymentLog(`✅ Project created: ${projectId}`);
      appendDeploymentLog(`🔧 Service created: ${serviceId}`);
      appendDeploymentLog("⏳ Building and deploying...");
      
      setRailwayStatus("deploying");

      // Start polling for deployment status
      pollDeploymentStatus(projectId, serviceId);

    } catch (err) {
      const message = err instanceof Error ? err.message : "Deployment failed";
      appendDeploymentLog(`❌ Error: ${message}`);
      setRailwayStatus("error");
      setError(message);
    }
  };

  const pollDeploymentStatus = (projectId: string, serviceId: string) => {
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max

    pollingRef.current = setInterval(async () => {
      attempts++;

      try {
        const { data, error } = await supabase.functions.invoke('railway-deploy', {
          body: {
            action: 'status',
            projectId,
            serviceId
          }
        });

        if (error) throw new Error(error.message);

        const { status, domain } = data;
        
        if (status === 'SUCCESS' && domain) {
          appendDeploymentLog(`✅ Deployment successful!`);
          appendDeploymentLog(`🌐 URL: ${domain}`);
          setRailwayUrl(domain);
          setRailwayStatus("ready");
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
        } else if (status === 'FAILED' || status === 'CRASHED') {
          appendDeploymentLog(`❌ Deployment failed: ${status}`);
          setRailwayStatus("error");
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
        } else if (attempts >= maxAttempts) {
          appendDeploymentLog(`⚠️ Deployment timeout - check Railway dashboard`);
          setRailwayStatus("error");
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
        } else if (attempts % 6 === 0) {
          // Log progress every 30 seconds
          appendDeploymentLog(`⏳ Still deploying... (${Math.floor(attempts * 5 / 60)} min)`);
        }
      } catch (err) {
        console.error('Status check error:', err);
      }
    }, 5000); // Poll every 5 seconds
  };

  const retryDeployment = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    startDeployment();
  };

  const openDeployedSite = () => {
    if (railwayUrl) {
      window.open(railwayUrl, '_blank');
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="h-10 border-b border-border flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Cloud className="w-4 h-4 text-primary" />
          Railway Deployment
        </div>
        
        <div className="flex items-center gap-2">
          {railwayStatus === "idle" && (
            <Button size="sm" onClick={startDeployment}>
              Deploy
            </Button>
          )}
          {railwayStatus === "error" && (
            <Button size="sm" variant="outline" onClick={retryDeployment}>
              <RefreshCw className="w-3 h-3 mr-1" />
              Retry
            </Button>
          )}
          {railwayStatus === "ready" && railwayUrl && (
            <Button size="sm" variant="outline" onClick={openDeployedSite}>
              <ExternalLink className="w-3 h-3 mr-1" />
              Open
            </Button>
          )}
        </div>
      </div>

      {/* Status indicator */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          {railwayStatus === "idle" && (
            <>
              <div className="w-2 h-2 rounded-full bg-muted-foreground" />
              <span className="text-sm text-muted-foreground">Ready to deploy</span>
            </>
          )}
          {(railwayStatus === "creating" || railwayStatus === "deploying") && (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-sm text-primary">
                {railwayStatus === "creating" ? "Creating project..." : "Deploying..."}
              </span>
            </>
          )}
          {railwayStatus === "ready" && (
            <>
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm text-green-500">Deployed successfully</span>
            </>
          )}
          {railwayStatus === "error" && (
            <>
              <XCircle className="w-4 h-4 text-destructive" />
              <span className="text-sm text-destructive">Deployment failed</span>
            </>
          )}
        </div>
        
        {railwayUrl && (
          <a 
            href={railwayUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline mt-1 block truncate"
          >
            {railwayUrl}
          </a>
        )}
      </div>

      {/* Logs */}
      <ScrollArea className="flex-1 p-4">
        <div className="font-mono text-xs space-y-1">
          {deploymentLogs.length === 0 ? (
            <p className="text-muted-foreground">
              Click "Deploy" to deploy this repository to Railway cloud.
            </p>
          ) : (
            deploymentLogs.map((log, i) => (
              <div key={i} className="whitespace-pre-wrap text-foreground">
                {log}
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </ScrollArea>

      {/* Preview iframe when ready */}
      {railwayStatus === "ready" && railwayUrl && (
        <div className="flex-1 min-h-[200px] border-t border-border">
          <iframe
            src={railwayUrl}
            className="w-full h-full bg-white"
            title="Railway Preview"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </div>
      )}
    </div>
  );
}
