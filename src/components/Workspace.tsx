// import { useState } from "react";
// import { FileTree } from "./FileTree";
// import { CodeEditor } from "./CodeEditor";
// import { Preview } from "./Preview";
// import { Terminal } from "./Terminal";
// import { useWorkspaceStore } from "@/store/useWorkspaceStore";
// import { ArrowLeft, Github, Zap } from "lucide-react";
// import { Button } from "@/components/ui/button";
// import { Badge } from "@/components/ui/badge";
// import { teardownWebContainer } from "@/utils/webcontainer";

// export function Workspace() {
//   const [terminalHeight, setTerminalHeight] = useState(200);
//   const { repoInfo, projectInfo, reset, setView, setContainerStatus, clearTerminalOutput, setPreviewUrl, setProjectInfo } = useWorkspaceStore();

//   const handleBack = () => {
//     teardownWebContainer();
//     reset();
//     setContainerStatus("idle");
//     clearTerminalOutput();
//     setPreviewUrl(null);
//     setProjectInfo(null);
//     setView("landing");
//   };

//   return (
//     <div className="h-screen flex flex-col bg-background">
//       {/* Header */}
//       <header className="h-12 border-b border-border flex items-center justify-between px-4 flex-shrink-0">
//         <div className="flex items-center gap-3">
//           <Button
//             variant="ghost"
//             size="sm"
//             onClick={handleBack}
//             className="gap-2"
//           >
//             <ArrowLeft className="w-4 h-4" />
//             Back
//           </Button>
          
//           <div className="h-6 w-px bg-border" />
          
//           <div className="flex items-center gap-2">
//             <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center">
//               <Zap className="w-3 h-3 text-primary" />
//             </div>
//             <span className="font-semibold text-sm">
//               Instant<span className="text-primary">IDE</span>
//             </span>
//           </div>
//         </div>

//         {repoInfo && (
//           <div className="flex items-center gap-3">
//             {projectInfo && (
//               <Badge 
//                 variant={projectInfo.canRun ? "default" : "secondary"}
//                 className="text-xs"
//               >
//                 {projectInfo.label}
//               </Badge>
//             )}
//             <a
//               href={`https://github.com/${repoInfo.owner}/${repoInfo.repo}`}
//               target="_blank"
//               rel="noopener noreferrer"
//               className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
//             >
//               <Github className="w-4 h-4" />
//               {repoInfo.owner}/{repoInfo.repo}
//             </a>
//           </div>
//         )}
//       </header>

//       {/* Main content */}
//       <div className="flex-1 flex min-h-0">
//         {/* Left sidebar - File Tree */}
//         <div className="w-64 border-r border-border flex-shrink-0 overflow-hidden">
//           <FileTree />
//         </div>

//         {/* Center - Code Editor */}
//         <div className="flex-1 min-w-0 border-r border-border">
//           <CodeEditor />
//         </div>

//         {/* Right - Preview & Terminal */}
//         <div className="w-[500px] flex-shrink-0 flex flex-col">
//           {/* Preview */}
//           <div className="flex-1 min-h-0">
//             <Preview />
//           </div>
          
//           {/* Resize handle */}
//           <div
//             className="h-1 bg-border hover:bg-primary/50 cursor-ns-resize transition-colors"
//             onMouseDown={(e) => {
//               e.preventDefault();
//               const startY = e.clientY;
//               const startHeight = terminalHeight;
              
//               const onMouseMove = (moveEvent: MouseEvent) => {
//                 const delta = startY - moveEvent.clientY;
//                 setTerminalHeight(Math.max(100, Math.min(400, startHeight + delta)));
//               };
              
//               const onMouseUp = () => {
//                 document.removeEventListener("mousemove", onMouseMove);
//                 document.removeEventListener("mouseup", onMouseUp);
//               };
              
//               document.addEventListener("mousemove", onMouseMove);
//               document.addEventListener("mouseup", onMouseUp);
//             }}
//           />
          
//           {/* Terminal */}
//           <div style={{ height: terminalHeight }} className="flex-shrink-0">
//             <Terminal />
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }












import { FileTree } from "./FileTree";
import { CodeEditor } from "./CodeEditor";
import { Preview } from "./Preview";
import { Terminal } from "./Terminal";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { ArrowLeft, Github, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { teardownWebContainer } from "@/utils/webcontainer";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";

export function Workspace() {
  const { repoInfo, projectInfo, reset, setView, setContainerStatus, clearTerminalOutput, setPreviewUrl, setProjectInfo } = useWorkspaceStore();

  const handleBack = () => {
    teardownWebContainer();
    reset();
    setContainerStatus("idle");
    clearTerminalOutput();
    setPreviewUrl(null);
    setProjectInfo(null);
    setView("landing");
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="h-12 border-b border-border flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          
          <div className="h-6 w-px bg-border" />
          
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center">
              <Zap className="w-3 h-3 text-primary" />
            </div>
            <span className="font-semibold text-sm">
              Instant<span className="text-primary">IDE</span>
            </span>
          </div>
        </div>

        {repoInfo && (
          <div className="flex items-center gap-3">
            {projectInfo && (
              <Badge 
                variant={projectInfo.canRun ? "default" : "secondary"}
                className="text-xs"
              >
                {projectInfo.label}
              </Badge>
            )}
            <a
              href={`https://github.com/${repoInfo.owner}/${repoInfo.repo}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Github className="w-4 h-4" />
              {repoInfo.owner}/{repoInfo.repo}
            </a>
          </div>
        )}
      </header>

      {/* Main content */}
      <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
        {/* Left sidebar - File Tree */}
        <ResizablePanel defaultSize={20} minSize={15} className="border-r border-border overflow-hidden">
          <FileTree />
        </ResizablePanel>

        <ResizableHandle />

        {/* Center - Code Editor */}
        <ResizablePanel defaultSize={50} minSize={30} className="border-r border-border">
          <CodeEditor />
        </ResizablePanel>

        <ResizableHandle />

        {/* Right - Preview & Terminal */}
        <ResizablePanel defaultSize={30} minSize={20} className="flex flex-col">
          <ResizablePanelGroup direction="vertical" className="flex-1">
            {/* Preview */}
            <ResizablePanel defaultSize={70} minSize={30} className="min-h-0">
              <Preview />
            </ResizablePanel>

            <ResizableHandle />

            {/* Terminal */}
            <ResizablePanel defaultSize={30} minSize={20}>
              <Terminal />
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

