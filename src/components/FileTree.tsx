import { useCallback } from "react";
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  FileJson,
  FileCode,
  FileText,
  FileType,
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

function TreeNode({ node, depth }: TreeNodeProps) {
  const {
    expandedFolders,
    toggleFolder,
    selectedFile,
    setSelectedFile,
    setFileContent,
    setIsLoadingFile,
    repoInfo,
  } = useWorkspaceStore();

  const isExpanded = expandedFolders.has(node.path);
  const isSelected = selectedFile?.path === node.path;

  const handleClick = useCallback(async () => {
    if (node.type === "folder") {
      toggleFolder(node.path);
    } else {
      setSelectedFile(node);
      setIsLoadingFile(true);
      
      try {
        if (repoInfo && node.sha) {
          const content = await fetchFileContent(
            repoInfo.owner,
            repoInfo.repo,
            node.path,
            node.sha
          );
          // Content from editor should always be string (text files only)
          setFileContent(typeof content === 'string' ? content : '// Binary file');
        }
      } catch (error) {
        console.error("Failed to fetch file:", error);
        setFileContent("// Failed to load file content");
      } finally {
        setIsLoadingFile(false);
      }
    }
  }, [node, repoInfo, toggleFolder, setSelectedFile, setFileContent, setIsLoadingFile]);

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
}

export function FileTree() {
  const { fileTree } = useWorkspaceStore();

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
}
