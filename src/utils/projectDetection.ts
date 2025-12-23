import type { GitHubFile } from "./github";

export type ProjectType = 
  | "nodejs"
  | "static" 
  | "python"
  | "rust"
  | "go"
  | "other";

export interface ProjectInfo {
  type: ProjectType;
  label: string;
  canRun: boolean;
  description: string;
}

const PROJECT_TYPE_INFO: Record<ProjectType, Omit<ProjectInfo, "type">> = {
  nodejs: {
    label: "Node.js",
    canRun: true,
    description: "Full execution with npm install and dev server",
  },
  static: {
    label: "Static Site",
    canRun: true,
    description: "Served via built-in static file server",
  },
  python: {
    label: "Python",
    canRun: false,
    description: "Code browsing only - Python runtime not supported",
  },
  rust: {
    label: "Rust",
    canRun: false,
    description: "Code browsing only - Rust runtime not supported",
  },
  go: {
    label: "Go",
    canRun: false,
    description: "Code browsing only - Go runtime not supported",
  },
  other: {
    label: "Repository",
    canRun: false,
    description: "Code browsing only",
  },
};

export function detectProjectType(files: GitHubFile[]): ProjectInfo {
  const filePaths = new Set(files.map((f) => f.path));
  
  // Check for Node.js (package.json)
  if (filePaths.has("package.json")) {
    return { type: "nodejs", ...PROJECT_TYPE_INFO.nodejs };
  }
  
  // Check for Python
  if (
    filePaths.has("requirements.txt") ||
    filePaths.has("setup.py") ||
    filePaths.has("pyproject.toml") ||
    filePaths.has("Pipfile")
  ) {
    return { type: "python", ...PROJECT_TYPE_INFO.python };
  }
  
  // Check for Rust
  if (filePaths.has("Cargo.toml")) {
    return { type: "rust", ...PROJECT_TYPE_INFO.rust };
  }
  
  // Check for Go
  if (filePaths.has("go.mod")) {
    return { type: "go", ...PROJECT_TYPE_INFO.go };
  }
  
  // Check for static HTML site (any .html file)
  const hasHtmlFile = files.some((f) => f.path.endsWith(".html"));
  if (hasHtmlFile) {
    return { type: "static", ...PROJECT_TYPE_INFO.static };
  }
  
  // Default to other
  return { type: "other", ...PROJECT_TYPE_INFO.other };
}

export function getProjectTypeInfo(type: ProjectType): Omit<ProjectInfo, "type"> {
  return PROJECT_TYPE_INFO[type];
}
