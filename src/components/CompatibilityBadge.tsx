import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Code2, 
  Terminal,
  Zap,
  Cloud
} from "lucide-react";
import type { ProjectInfo, ProjectType } from "@/utils/projectDetection";
import type { CompatibilityReport } from "@/utils/compatibilityChecker";
import { cn } from "@/lib/utils";

interface CompatibilityBadgeProps {
  projectInfo: ProjectInfo | null;
  compatibility?: CompatibilityReport | null;
  className?: string;
}

const PROJECT_ICONS: Record<ProjectType, React.ElementType> = {
  nodejs: Terminal,
  static: Zap,
  python: Code2,
  rust: Code2,
  go: Code2,
  java: Code2,
  php: Code2,
  ruby: Code2,
  dotnet: Code2,
  other: Code2,
};

export function CompatibilityBadge({ 
  projectInfo, 
  compatibility,
  className 
}: CompatibilityBadgeProps) {
  if (!projectInfo) return null;

  const Icon = PROJECT_ICONS[projectInfo.type] || Code2;
  const canRun = projectInfo.canRun;
  const isPython = projectInfo.type === "python";

  // Determine badge variant and status
  let variant: "default" | "secondary" | "destructive" | "outline" = "secondary";
  let StatusIcon = canRun ? CheckCircle : XCircle;
  let statusColor = canRun ? "text-green-500" : "text-muted-foreground";
  let label = projectInfo.label;

  if (canRun) {
    variant = "default";
    StatusIcon = CheckCircle;
    statusColor = "text-green-500";
  } else if (isPython) {
    // Python can run via Pyodide
    variant = "secondary";
    StatusIcon = Zap;
    statusColor = "text-yellow-500";
    label = "Python (Browser)";
  }

  // Check compatibility issues
  const hasIssues = compatibility && (
    compatibility.issues.length > 0 || 
    compatibility.warnings.length > 0
  );

  if (hasIssues && compatibility?.canRun === false) {
    variant = "destructive";
    StatusIcon = XCircle;
    statusColor = "text-destructive";
  } else if (hasIssues) {
    StatusIcon = AlertTriangle;
    statusColor = "text-warning";
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          variant={variant} 
          className={cn(
            "gap-1.5 cursor-help transition-colors",
            className
          )}
        >
          <Icon className="w-3 h-3" />
          <span>{label}</span>
          <StatusIcon className={cn("w-3 h-3", statusColor)} />
        </Badge>
      </TooltipTrigger>
      <TooltipContent 
        side="bottom" 
        className="max-w-xs"
      >
        <div className="space-y-2">
          <p className="font-medium">{projectInfo.label} Project</p>
          <p className="text-xs text-muted-foreground">
            {projectInfo.description}
          </p>
          
          {canRun && (
            <div className="flex items-center gap-1.5 text-xs text-green-500">
              <CheckCircle className="w-3 h-3" />
              <span>Runs in browser via WebContainer</span>
            </div>
          )}
          
          {isPython && !canRun && (
            <div className="flex items-center gap-1.5 text-xs text-yellow-500">
              <Zap className="w-3 h-3" />
              <span>Runs in browser via Pyodide (WebAssembly)</span>
            </div>
          )}
          
          {!canRun && !isPython && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Code2 className="w-3 h-3" />
                <span>Code browsing only</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-primary">
                <Cloud className="w-3 h-3" />
                <span>Deploy to cloud for full execution</span>
              </div>
            </div>
          )}
          
          {compatibility && compatibility.issues.length > 0 && (
            <div className="border-t border-border pt-2 mt-2">
              <p className="text-xs font-medium text-destructive mb-1">Issues:</p>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {compatibility.issues.slice(0, 3).map((issue, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <XCircle className="w-3 h-3 mt-0.5 shrink-0 text-destructive" />
                    <span>{issue}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {compatibility && compatibility.warnings.length > 0 && (
            <div className="border-t border-border pt-2 mt-2">
              <p className="text-xs font-medium text-warning mb-1">Warnings:</p>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {compatibility.warnings.slice(0, 3).map((warn, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0 text-warning" />
                    <span>{warn}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// Simple version for smaller spaces
export function CompatibilityIndicator({ 
  canRun, 
  projectType 
}: { 
  canRun: boolean; 
  projectType: ProjectType;
}) {
  const isPython = projectType === "python";
  
  if (canRun) {
    return (
      <Tooltip>
        <TooltipTrigger>
          <div className="flex items-center gap-1 text-green-500">
            <CheckCircle className="w-3.5 h-3.5" />
            <span className="text-xs">Runnable</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          This project can run in your browser
        </TooltipContent>
      </Tooltip>
    );
  }
  
  if (isPython) {
    return (
      <Tooltip>
        <TooltipTrigger>
          <div className="flex items-center gap-1 text-yellow-500">
            <Zap className="w-3.5 h-3.5" />
            <span className="text-xs">Python</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          Python runs via Pyodide (WebAssembly) - some packages may not work
        </TooltipContent>
      </Tooltip>
    );
  }
  
  return (
    <Tooltip>
      <TooltipTrigger>
        <div className="flex items-center gap-1 text-muted-foreground">
          <Code2 className="w-3.5 h-3.5" />
          <span className="text-xs">Browse</span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        Code browsing only - this language doesn't run in the browser
      </TooltipContent>
    </Tooltip>
  );
}
