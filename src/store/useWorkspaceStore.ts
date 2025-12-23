import { create } from "zustand";
import type { FileTreeNode, ParsedGitHubUrl, FileSystemTree } from "@/utils/github";
import type { ContainerStatus } from "@/utils/webcontainer";
import type { ProjectInfo } from "@/utils/projectDetection";

interface WorkspaceState {
  // Repository info
  repoInfo: ParsedGitHubUrl | null;
  projectInfo: ProjectInfo | null;
  
  // File tree
  fileTree: FileTreeNode[];
  expandedFolders: Set<string>;
  
  // Editor
  selectedFile: FileTreeNode | null;
  fileContent: string;
  isLoadingFile: boolean;
  
  // WebContainer
  containerStatus: ContainerStatus;
  terminalOutput: string;
  previewUrl: string | null;
  fileSystemTree: FileSystemTree | null;
  
  // Loading states
  isLoadingRepo: boolean;
  loadingProgress: { current: number; total: number; fileName: string } | null;
  error: string | null;
  
  // View state
  view: "landing" | "workspace";
  
  // Actions
  setRepoInfo: (info: ParsedGitHubUrl | null) => void;
  setProjectInfo: (info: ProjectInfo | null) => void;
  setFileTree: (tree: FileTreeNode[]) => void;
  toggleFolder: (path: string) => void;
  setSelectedFile: (file: FileTreeNode | null) => void;
  setFileContent: (content: string) => void;
  setIsLoadingFile: (loading: boolean) => void;
  setContainerStatus: (status: ContainerStatus) => void;
  appendTerminalOutput: (output: string) => void;
  clearTerminalOutput: () => void;
  setPreviewUrl: (url: string | null) => void;
  setFileSystemTree: (tree: FileSystemTree | null) => void;
  setIsLoadingRepo: (loading: boolean) => void;
  setLoadingProgress: (progress: { current: number; total: number; fileName: string } | null) => void;
  setError: (error: string | null) => void;
  setView: (view: "landing" | "workspace") => void;
  reset: () => void;
}

const initialState = {
  repoInfo: null,
  projectInfo: null,
  fileTree: [],
  expandedFolders: new Set<string>(),
  selectedFile: null,
  fileContent: "",
  isLoadingFile: false,
  containerStatus: "idle" as ContainerStatus,
  terminalOutput: "",
  previewUrl: null,
  fileSystemTree: null,
  isLoadingRepo: false,
  loadingProgress: null,
  error: null,
  view: "landing" as const,
};

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  ...initialState,
  
  setRepoInfo: (info) => set({ repoInfo: info }),
  
  setProjectInfo: (info) => set({ projectInfo: info }),
  
  setFileTree: (tree) => set({ fileTree: tree }),
  
  toggleFolder: (path) =>
    set((state) => {
      const newExpanded = new Set(state.expandedFolders);
      if (newExpanded.has(path)) {
        newExpanded.delete(path);
      } else {
        newExpanded.add(path);
      }
      return { expandedFolders: newExpanded };
    }),
  
  setSelectedFile: (file) => set({ selectedFile: file }),
  
  setFileContent: (content) => set({ fileContent: content }),
  
  setIsLoadingFile: (loading) => set({ isLoadingFile: loading }),
  
  setContainerStatus: (status) => set({ containerStatus: status }),
  
  appendTerminalOutput: (output) =>
    set((state) => ({ terminalOutput: state.terminalOutput + output })),
  
  clearTerminalOutput: () => set({ terminalOutput: "" }),
  
  setPreviewUrl: (url) => set({ previewUrl: url }),
  
  setFileSystemTree: (tree) => set({ fileSystemTree: tree }),
  
  setIsLoadingRepo: (loading) => set({ isLoadingRepo: loading }),
  
  setLoadingProgress: (progress) => set({ loadingProgress: progress }),
  
  setError: (error) => set({ error: error }),
  
  setView: (view) => set({ view: view }),
  
  reset: () => set({ ...initialState, expandedFolders: new Set() }),
}));
