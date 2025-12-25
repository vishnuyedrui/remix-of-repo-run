import { create } from "zustand";
import type { FileTreeNode, ParsedGitHubUrl, FileSystemTree } from "@/utils/github";
import type { ContainerStatus } from "@/utils/webcontainer";
import type { ProjectInfo } from "@/utils/projectDetection";

export type DeploymentMode = 'webcontainer' | 'railway';
export type RailwayStatus = 'idle' | 'creating' | 'deploying' | 'ready' | 'error';

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
  
  // File content cache (path -> content)
  fileContentCache: Map<string, string>;
  
  // WebContainer
  containerStatus: ContainerStatus;
  terminalOutput: string;
  previewUrl: string | null;
  fileSystemTree: FileSystemTree | null;
  
  // Railway deployment
  deploymentMode: DeploymentMode;
  railwayStatus: RailwayStatus;
  railwayUrl: string | null;
  railwayProjectId: string | null;
  railwayServiceId: string | null;
  railwayEnvironmentId: string | null;
  deploymentLogs: string[];
  
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
  setCachedFileContent: (path: string, content: string) => void;
  getCachedFileContent: (path: string) => string | undefined;
  setContainerStatus: (status: ContainerStatus) => void;
  appendTerminalOutput: (output: string) => void;
  clearTerminalOutput: () => void;
  setPreviewUrl: (url: string | null) => void;
  setFileSystemTree: (tree: FileSystemTree | null) => void;
  setIsLoadingRepo: (loading: boolean) => void;
  setLoadingProgress: (progress: { current: number; total: number; fileName: string } | null) => void;
  setError: (error: string | null) => void;
  setView: (view: "landing" | "workspace") => void;
  
  // Railway actions
  setDeploymentMode: (mode: DeploymentMode) => void;
  setRailwayStatus: (status: RailwayStatus) => void;
  setRailwayUrl: (url: string | null) => void;
  setRailwayProjectId: (id: string | null) => void;
  setRailwayServiceId: (id: string | null) => void;
  setRailwayEnvironmentId: (id: string | null) => void;
  appendDeploymentLog: (log: string) => void;
  clearDeploymentLogs: () => void;
  
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
  fileContentCache: new Map<string, string>(),
  containerStatus: "idle" as ContainerStatus,
  terminalOutput: "",
  previewUrl: null,
  fileSystemTree: null,
  
  // Railway initial state
  deploymentMode: "webcontainer" as DeploymentMode,
  railwayStatus: "idle" as RailwayStatus,
  railwayUrl: null,
  railwayProjectId: null,
  railwayServiceId: null,
  railwayEnvironmentId: null,
  deploymentLogs: [] as string[],
  
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
  
  setCachedFileContent: (path, content) =>
    set((state) => {
      const newCache = new Map(state.fileContentCache);
      newCache.set(path, content);
      return { fileContentCache: newCache };
    }),
  
  getCachedFileContent: (path) => {
    return useWorkspaceStore.getState().fileContentCache.get(path);
  },
  
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
  
  // Railway actions
  setDeploymentMode: (mode) => set({ deploymentMode: mode }),
  
  setRailwayStatus: (status) => set({ railwayStatus: status }),
  
  setRailwayUrl: (url) => set({ railwayUrl: url }),
  
  setRailwayProjectId: (id) => set({ railwayProjectId: id }),
  
  setRailwayServiceId: (id) => set({ railwayServiceId: id }),
  
  setRailwayEnvironmentId: (id) => set({ railwayEnvironmentId: id }),
  
  appendDeploymentLog: (log) =>
    set((state) => ({ deploymentLogs: [...state.deploymentLogs, log] })),
  
  clearDeploymentLogs: () => set({ deploymentLogs: [] }),
  
  reset: () => set({ 
    ...initialState, 
    expandedFolders: new Set(), 
    fileContentCache: new Map(),
    deploymentLogs: []
  }),
}));
