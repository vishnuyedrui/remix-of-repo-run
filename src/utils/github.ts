import type { FileSystemTree } from "@webcontainer/api";

export interface GitHubFile {
  path: string;
  mode: string;
  type: "blob" | "tree";
  sha: string;
  size?: number;
  url: string;
}

export interface GitHubTreeResponse {
  sha: string;
  url: string;
  tree: GitHubFile[];
  truncated: boolean;
}

export interface ParsedGitHubUrl {
  owner: string;
  repo: string;
  branch: string;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: FileTreeNode[];
  content?: string;
  sha?: string;
}

export type { FileSystemTree };

const GITHUB_TOKEN_KEY = "github_pat";

export function getGitHubToken(): string | null {
  return localStorage.getItem(GITHUB_TOKEN_KEY);
}

export function setGitHubToken(token: string): void {
  localStorage.setItem(GITHUB_TOKEN_KEY, token);
}

export function removeGitHubToken(): void {
  localStorage.removeItem(GITHUB_TOKEN_KEY);
}

// Validate GitHub username/repo name format
// GitHub allows alphanumeric characters, hyphens, underscores, and periods
// Cannot start/end with period or hyphen, no consecutive periods
function isValidGitHubName(name: string): boolean {
  if (!name || name.length === 0 || name.length > 100) {
    return false;
  }
  // GitHub usernames and repo names: alphanumeric, hyphens, underscores, periods
  // Cannot start or end with hyphen or period
  const validPattern = /^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?$|^[a-zA-Z0-9]$/;
  if (!validPattern.test(name)) {
    return false;
  }
  // No consecutive periods
  if (name.includes('..')) {
    return false;
  }
  return true;
}

// Validate branch name - prevent path traversal and special characters
function isValidBranchName(branch: string): boolean {
  if (!branch || branch.length === 0 || branch.length > 250) {
    return false;
  }
  // Prevent path traversal attempts
  if (branch.includes('..') || branch.includes('//') || branch.startsWith('/') || branch.endsWith('/')) {
    return false;
  }
  // Only allow safe characters for branch names
  // Git branch names can contain alphanumeric, hyphens, underscores, periods, slashes
  const validBranchPattern = /^[a-zA-Z0-9][a-zA-Z0-9._\/-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/;
  return validBranchPattern.test(branch);
}

export function parseGitHubUrl(url: string): ParsedGitHubUrl | null {
  try {
    // Sanitize input - trim whitespace
    const sanitizedUrl = url.trim();
    
    if (!sanitizedUrl || sanitizedUrl.length > 500) {
      return null;
    }

    const patterns = [
      // https://github.com/owner/repo
      /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)\/?$/,
      // https://github.com/owner/repo/tree/branch
      /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)\/tree\/([^\/]+(?:\/[^\/]+)*)/,
      // owner/repo format
      /^([^\/]+)\/([^\/]+)$/,
    ];

    for (const pattern of patterns) {
      const match = sanitizedUrl.match(pattern);
      if (match) {
        const owner = match[1];
        const repo = match[2].replace(/\.git$/, "");
        const branch = match[3] || "main";
        
        // Validate owner and repo names
        if (!isValidGitHubName(owner) || !isValidGitHubName(repo)) {
          return null;
        }
        
        // Validate branch name
        if (!isValidBranchName(branch)) {
          return null;
        }
        
        return { owner, repo, branch };
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchWithAuth(url: string): Promise<Response> {
  const token = getGitHubToken();
  const headers: HeadersInit = {
    Accept: "application/vnd.github.v3+json",
  };
  
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
  try {
    const response = await fetch(url, { headers });
    return response;
  } catch (error) {
    // Network error or CORS issue
    throw new Error("Failed to connect to GitHub. Please check your internet connection and try again.");
  }
}

export async function getDefaultBranch(owner: string, repo: string): Promise<string> {
  const response = await fetchWithAuth(`https://api.github.com/repos/${owner}/${repo}`);
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Repository not found. Check the URL or make sure the repository is public.");
    }
    if (response.status === 403) {
      const rateLimitRemaining = response.headers.get("X-RateLimit-Remaining");
      if (rateLimitRemaining === "0") {
        throw new Error("GitHub API rate limit exceeded. Add a Personal Access Token in Settings to increase your limit.");
      }
    }
    throw new Error(`Failed to fetch repository info: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.default_branch;
}

export async function fetchRepoTree(
  owner: string,
  repo: string,
  branch: string
): Promise<GitHubFile[]> {
  // First, try with the provided branch
  let response = await fetchWithAuth(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`
  );
  
  // If branch not found, try getting the default branch
  if (response.status === 404) {
    const defaultBranch = await getDefaultBranch(owner, repo);
    response = await fetchWithAuth(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`
    );
  }
  
  if (!response.ok) {
    if (response.status === 403) {
      const rateLimitRemaining = response.headers.get("X-RateLimit-Remaining");
      if (rateLimitRemaining === "0") {
        throw new Error("GitHub API rate limit exceeded. Add a Personal Access Token in Settings to increase your limit.");
      }
    }
    throw new Error(`Failed to fetch repository tree: ${response.statusText}`);
  }
  
  const data: GitHubTreeResponse = await response.json();
  
  if (data.truncated) {
    console.warn("Repository tree was truncated due to size. Some files may be missing.");
  }
  
  return data.tree;
}

export async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  sha: string,
  options?: { asBinary?: boolean }
): Promise<string | Uint8Array> {
  const response = await fetchWithAuth(
    `https://api.github.com/repos/${owner}/${repo}/git/blobs/${sha}`
  );
  
  if (!response.ok) {
    throw new Error(`Failed to fetch file content: ${response.statusText}`);
  }
  
  const data = await response.json();
  
  // GitHub returns base64 encoded content
  if (data.encoding === "base64") {
    const base64Content = data.content.replace(/\n/g, "");
    
    if (options?.asBinary) {
      // Convert base64 to Uint8Array for binary files
      const binaryString = atob(base64Content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    }
    
    return atob(base64Content);
  }
  
  return data.content;
}

// File extensions we want to include in the editor (code files)
const CODE_EXTENSIONS = new Set([
  "js", "jsx", "ts", "tsx", "mjs", "cjs",
  "json", "html", "css", "scss", "sass", "less",
  "md", "mdx", "txt", "yaml", "yml", "toml",
  "xml", "svg", "sh", "bash", "zsh",
  "py", "rb", "go", "rs", "java", "kt", "swift",
  "c", "cpp", "h", "hpp", "cs",
  "php", "vue", "svelte", "astro",
  "graphql", "gql", "sql",
  "env", "gitignore", "dockerignore", "editorconfig",
  "prettierrc", "eslintrc", "babelrc",
  "lock", "config",
]);

// Binary asset extensions to include for runtime
const ASSET_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "avif", "ico", "bmp",
  "woff", "woff2", "ttf", "otf", "eot",
  "mp3", "wav", "ogg", "mp4", "webm",
  "pdf",
]);

// Files to always include even without extension
const ALWAYS_INCLUDE = new Set([
  "Dockerfile", "Makefile", "LICENSE", "README",
  ".gitignore", ".npmrc", ".nvmrc", ".env.example",
  "package.json", "tsconfig.json", "vite.config.ts",
]);

// Max size for binary assets (5MB)
const MAX_ASSET_SIZE = 5 * 1024 * 1024;

function shouldIncludeFile(path: string): boolean {
  const fileName = path.split("/").pop() || "";
  
  // Always include certain files
  if (ALWAYS_INCLUDE.has(fileName)) {
    return true;
  }
  
  // Check extension
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  if (CODE_EXTENSIONS.has(ext)) {
    return true;
  }
  
  // Include files that start with a dot and have a known extension
  if (fileName.startsWith(".") && fileName.length > 1) {
    const afterDot = fileName.slice(1);
    const extAfterDot = afterDot.split(".").pop()?.toLowerCase() || afterDot;
    return CODE_EXTENSIONS.has(extAfterDot);
  }
  
  return false;
}

// Check if file should be included for runtime (includes assets)
function shouldIncludeForRuntime(path: string, size?: number): boolean {
  // First check if it's a code file
  if (shouldIncludeFile(path)) {
    return true;
  }
  
  const fileName = path.split("/").pop() || "";
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  
  // Check if it's an asset file
  if (ASSET_EXTENSIONS.has(ext)) {
    // Skip files that are too large
    if (size && size > MAX_ASSET_SIZE) {
      console.warn(`Skipping large asset (${(size / 1024 / 1024).toFixed(1)}MB): ${path}`);
      return false;
    }
    return true;
  }
  
  return false;
}

// Check if a file is a binary asset
function isBinaryAsset(path: string): boolean {
  const fileName = path.split("/").pop() || "";
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  return ASSET_EXTENSIONS.has(ext);
}

export function transformToNestedTree(files: GitHubFile[]): FileTreeNode[] {
  const root: FileTreeNode[] = [];
  
  // Filter to only include relevant files
  const filteredFiles = files.filter(
    (f) => f.type === "tree" || (f.type === "blob" && shouldIncludeFile(f.path))
  );
  
  // Sort: folders first, then alphabetically
  filteredFiles.sort((a, b) => {
    if (a.type === "tree" && b.type === "blob") return -1;
    if (a.type === "blob" && b.type === "tree") return 1;
    return a.path.localeCompare(b.path);
  });
  
  for (const file of filteredFiles) {
    const parts = file.path.split("/");
    let current = root;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLastPart = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join("/");
      
      let existing = current.find((n) => n.name === part);
      
      if (!existing) {
        existing = {
          name: part,
          path: currentPath,
          type: isLastPart && file.type === "blob" ? "file" : "folder",
          sha: file.sha,
          children: isLastPart && file.type === "blob" ? undefined : [],
        };
        current.push(existing);
      }
      
      if (existing.children) {
        current = existing.children;
      }
    }
  }
  
  // Sort the final tree
  const sortTree = (nodes: FileTreeNode[]): void => {
    nodes.sort((a, b) => {
      if (a.type === "folder" && b.type === "file") return -1;
      if (a.type === "file" && b.type === "folder") return 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((node) => {
      if (node.children) {
        sortTree(node.children);
      }
    });
  };
  
  sortTree(root);
  return root;
}

export async function buildFileSystemTree(
  owner: string,
  repo: string,
  files: GitHubFile[],
  onProgress?: (current: number, total: number, fileName: string) => void
): Promise<FileSystemTree> {
  const tree: Record<string, any> = {};
  
  // Include both code files and binary assets for runtime
  const blobFiles = files.filter(
    (f) => f.type === "blob" && shouldIncludeForRuntime(f.path, f.size)
  );
  
  let completed = 0;
  const total = blobFiles.length;
  
  // Fetch files in parallel batches
  const batchSize = 10;
  for (let i = 0; i < blobFiles.length; i += batchSize) {
    const batch = blobFiles.slice(i, i + batchSize);
    
    await Promise.all(
      batch.map(async (file) => {
        try {
          const isBinary = isBinaryAsset(file.path);
          const content = await fetchFileContent(owner, repo, file.path, file.sha, { asBinary: isBinary });
          
          const parts = file.path.split("/");
          let current: Record<string, any> = tree;
          
          for (let j = 0; j < parts.length - 1; j++) {
            const part = parts[j];
            if (!current[part]) {
              current[part] = { directory: {} };
            }
            current = current[part].directory;
          }
          
          const fileName = parts[parts.length - 1];
          // WebContainer expects Uint8Array for binary files
          current[fileName] = { file: { contents: content } };
          
          completed++;
          onProgress?.(completed, total, file.path);
        } catch (error) {
          console.error(`Failed to fetch ${file.path}:`, error);
          completed++;
          onProgress?.(completed, total, file.path);
        }
      })
    );
  }
  
  return tree as FileSystemTree;
}
