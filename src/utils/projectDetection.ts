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
  warnings: string[];
  nodeVersion: string | null;
}

const PROJECT_TYPE_INFO: Record<ProjectType, Omit<ProjectInfo, "type" | "warnings" | "nodeVersion">> = {
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

// Detect compatibility warnings from package.json content
export function detectCompatibilityWarnings(packageJson: Record<string, unknown>): string[] {
  const warnings: string[] = [];
  
  const deps = {
    ...(packageJson.dependencies as Record<string, string> || {}),
    ...(packageJson.devDependencies as Record<string, string> || {}),
  };
  
  // Check for webpack < 5
  if (deps.webpack) {
    const versionMatch = deps.webpack.match(/(\d+)/);
    if (versionMatch && parseInt(versionMatch[1], 10) < 5) {
      warnings.push("Uses webpack version lower than 5");
    }
  }
  
  // Check for gulp
  if (deps.gulp) {
    warnings.push("Uses gulp task runner");
  }
  
  // Check for deprecated node-sass
  if (deps["node-sass"]) {
    warnings.push("Uses deprecated node-sass (consider dart-sass)");
  }
  
  // Check for bower
  if (deps.bower) {
    warnings.push("Uses deprecated bower package manager");
  }
  
  // Check for grunt
  if (deps.grunt) {
    warnings.push("Uses grunt task runner");
  }
  
  return warnings;
}

// Extract Node version from package.json engines field
export function extractNodeVersion(packageJson: Record<string, unknown>): string | null {
  const engines = packageJson.engines as Record<string, string> | undefined;
  if (engines?.node) {
    return engines.node;
  }
  return null;
}

export function detectProjectType(files: GitHubFile[]): ProjectInfo {
  const filePaths = new Set(files.map((f) => f.path));
  
  // Check for Node.js (package.json)
  if (filePaths.has("package.json")) {
    return { 
      type: "nodejs", 
      ...PROJECT_TYPE_INFO.nodejs,
      warnings: [],
      nodeVersion: null,
    };
  }
  
  // Check for Python
  if (
    filePaths.has("requirements.txt") ||
    filePaths.has("setup.py") ||
    filePaths.has("pyproject.toml") ||
    filePaths.has("Pipfile")
  ) {
    return { 
      type: "python", 
      ...PROJECT_TYPE_INFO.python,
      warnings: [],
      nodeVersion: null,
    };
  }
  
  // Check for Rust
  if (filePaths.has("Cargo.toml")) {
    return { 
      type: "rust", 
      ...PROJECT_TYPE_INFO.rust,
      warnings: [],
      nodeVersion: null,
    };
  }
  
  // Check for Go
  if (filePaths.has("go.mod")) {
    return { 
      type: "go", 
      ...PROJECT_TYPE_INFO.go,
      warnings: [],
      nodeVersion: null,
    };
  }
  
  // Check for static HTML site (any .html file)
  const hasHtmlFile = files.some((f) => f.path.endsWith(".html"));
  if (hasHtmlFile) {
    return { 
      type: "static", 
      ...PROJECT_TYPE_INFO.static,
      warnings: [],
      nodeVersion: null,
    };
  }
  
  // Default to other
  return { 
    type: "other", 
    ...PROJECT_TYPE_INFO.other,
    warnings: [],
    nodeVersion: null,
  };
}

export function getProjectTypeInfo(type: ProjectType): Omit<ProjectInfo, "type" | "warnings" | "nodeVersion"> {
  return PROJECT_TYPE_INFO[type];
}
