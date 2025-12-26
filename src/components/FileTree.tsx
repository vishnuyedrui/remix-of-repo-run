import { useCallback, memo } from "react";
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  FileJson,
  FileCode,
  FileText,
  Settings,
} from "lucide-react";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import type { FileTreeNode } from "@/utils/github";
import { fetchFileContent } from "@/utils/github";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

const FILE_ICONS: Record<string, React.ElementType> = {
  json: FileJson,
  ts: FileCode,
  tsx: FileCode,
  js: FileCode,
  jsx: FileCode,
  md: FileText,
  txt: FileText,
  config: Settings,
  toml: Settings,
  yaml: Settings,
  yml: Settings,
};

function getFileIcon(fileName: string): React.ElementType {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  return FILE_ICONS[ext] || File;
}

interface TreeNodeProps {
  node: FileTreeNode;
  depth: number;
}

const TreeNode = memo(function TreeNode({ node, depth }: TreeNodeProps) {
  const expandedFolders = useWorkspaceStore((s) => s.expandedFolders);
  const toggleFolder = useWorkspaceStore((s) => s.toggleFolder);
  const selectedFile = useWorkspaceStore((s) => s.selectedFile);
  const setSelectedFile = useWorkspaceStore((s) => s.setSelectedFile);
  const setFileContent = useWorkspaceStore((s) => s.setFileContent);
  const setIsLoadingFile = useWorkspaceStore((s) => s.setIsLoadingFile);
  const setCachedFileContent = useWorkspaceStore((s) => s.setCachedFileContent);
  const getCachedFileContent = useWorkspaceStore((s) => s.getCachedFileContent);
  const repoInfo = useWorkspaceStore((s) => s.repoInfo);

  const isExpanded = expandedFolders.has(node.path);
  const isSelected = selectedFile?.path === node.path;

  const handleClick = useCallback(async () => {
    if (node.type === "folder") {
      toggleFolder(node.path);
    } else {
      setSelectedFile(node);
      
      // Check cache first
      const cachedContent = getCachedFileContent(node.path);
      if (cachedContent !== undefined) {
        setFileContent(cachedContent);
        return;
      }
      
      setIsLoadingFile(true);
      
      try {
        if (repoInfo && node.sha) {
          const content = await fetchFileContent(
            repoInfo.owner,
            repoInfo.repo,
            node.path,
            node.sha
          );
          const textContent = typeof content === 'string' ? content : '// Binary file';
          setFileContent(textContent);
          // Cache the content
          setCachedFileContent(node.path, textContent);
        }
      } catch (error) {
        console.error("Failed to fetch file:", error);
        setFileContent("// Failed to load file content");
      } finally {
        setIsLoadingFile(false);
      }
    }
  }, [node, repoInfo, toggleFolder, setSelectedFile, setFileContent, setIsLoadingFile, getCachedFileContent, setCachedFileContent]);

  const Icon = node.type === "folder"
    ? (isExpanded ? FolderOpen : Folder)
    : getFileIcon(node.name);

  return (
    <div>
      <button
        onClick={handleClick}
        className={cn(
          "w-full flex items-center gap-1.5 py-1 px-2 text-sm text-left hover:bg-muted/50 transition-colors rounded-sm",
          isSelected && "bg-primary/20 text-primary"
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {node.type === "folder" ? (
          isExpanded ? (
            <ChevronDown className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
          )
        ) : (
          <span className="w-4" />
        )}
        <Icon
          className={cn(
            "w-4 h-4 flex-shrink-0",
            node.type === "folder" ? "text-primary" : "text-muted-foreground"
          )}
        />
        <span className="truncate">{node.name}</span>
      </button>

      {node.type === "folder" && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode key={child.path} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
});

export const FileTree = memo(function FileTree() {
  const fileTree = useWorkspaceStore((s) => s.fileTree);
  const isLoadingRepo = useWorkspaceStore((s) => s.isLoadingRepo);

  // Show skeleton while loading
  if (isLoadingRepo || fileTree.length === 0) {
    return <FileTreeSkeleton />;
  }

  return (
    <div className="h-full flex flex-col">
      <div className="h-10 px-4 flex items-center border-b border-border">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Explorer
        </span>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="py-2">
          {fileTree.map((node) => (
            <TreeNode key={node.path} node={node} depth={0} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
});

// Inline FileTree Skeleton to avoid circular imports
function FileTreeSkeleton() {
  const items = [
    { type: "folder", indent: 0, width: "70%" },
    { type: "file", indent: 1, width: "60%" },
    { type: "file", indent: 1, width: "80%" },
    { type: "file", indent: 1, width: "55%" },
    { type: "folder", indent: 0, width: "65%" },
    { type: "file", indent: 1, width: "75%" },
    { type: "file", indent: 1, width: "50%" },
    { type: "folder", indent: 0, width: "60%" },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="h-10 px-4 flex items-center border-b border-border">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Explorer
        </span>
      </div>
      
      <div className="flex-1 py-2 px-2 space-y-1 overflow-hidden">
        {items.map((item, index) => (
          <div
            key={index}
            className="flex items-center gap-2 py-1 px-2 animate-pulse"
            style={{ 
              paddingLeft: `${item.indent * 12 + 8}px`,
              animationDelay: `${index * 50}ms`
            }}
          >
            {item.type === "folder" ? (
              <Folder className="w-4 h-4 text-muted-foreground/30" />
            ) : (
              <File className="w-4 h-4 text-muted-foreground/20" />
            )}
            <div 
              className="h-3 rounded bg-muted animate-pulse"
              style={{ width: item.width }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
