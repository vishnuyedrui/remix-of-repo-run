import type { GitHubFile } from "./github";

export type ProjectType = 
  | "nodejs"
  | "static" 
  | "python"
  | "rust"
  | "go"
  | "java"
  | "php"
  | "ruby"
  | "dotnet"
  | "other";

export interface ProjectInfo {
  type: ProjectType;
  label: string;
  canRun: boolean;
  description: string;
  needsBackend?: boolean;
  backendHint?: string;
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
    canRun: true,
    description: "Runs in browser via Pyodide (WebAssembly) - some packages may not work",
  },
  rust: {
    label: "Rust",
    canRun: false,
    description: "Code browsing only - Rust runtime not supported in browser",
  },
  go: {
    label: "Go",
    canRun: false,
    description: "Code browsing only - Go runtime not supported in browser",
  },
  java: {
    label: "Java",
    canRun: false,
    description: "Code browsing only - Java/JVM runtime not supported in browser",
  },
  php: {
    label: "PHP",
    canRun: false,
    description: "Code browsing only - PHP runtime not supported in browser",
  },
  ruby: {
    label: "Ruby",
    canRun: false,
    description: "Code browsing only - Ruby runtime not supported in browser",
  },
  dotnet: {
    label: ".NET",
    canRun: false,
    description: "Code browsing only - .NET runtime not supported in browser",
  },
  other: {
    label: "Repository",
    canRun: false,
    description: "Code browsing only",
  },
};

export function detectProjectType(files: GitHubFile[]): ProjectInfo {
  const filePaths = new Set(files.map((f) => f.path));
  const fileNames = files.map((f) => f.path.split('/').pop() || '');
  
  // Check for Node.js (package.json)
  if (filePaths.has("package.json")) {
    // Try to detect if it needs an external backend
    const backendInfo = detectBackendRequirements(files);
    return { 
      type: "nodejs", 
      ...PROJECT_TYPE_INFO.nodejs,
      ...backendInfo
    };
  }
  
  // Check for Java (pom.xml, build.gradle, *.java files)
  if (
    filePaths.has("pom.xml") ||
    filePaths.has("build.gradle") ||
    filePaths.has("build.gradle.kts") ||
    filePaths.has("settings.gradle") ||
    filePaths.has("settings.gradle.kts") ||
    files.some((f) => f.path.endsWith(".java"))
  ) {
    return { type: "java", ...PROJECT_TYPE_INFO.java };
  }
  
  // Check for .NET (*.csproj, *.sln, *.fsproj)
  if (
    files.some((f) => f.path.endsWith(".csproj")) ||
    files.some((f) => f.path.endsWith(".sln")) ||
    files.some((f) => f.path.endsWith(".fsproj"))
  ) {
    return { type: "dotnet", ...PROJECT_TYPE_INFO.dotnet };
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
  
  // Check for PHP (composer.json, *.php files)
  if (
    filePaths.has("composer.json") ||
    files.some((f) => f.path.endsWith(".php"))
  ) {
    return { type: "php", ...PROJECT_TYPE_INFO.php };
  }
  
  // Check for Ruby (Gemfile, *.rb files)
  if (
    filePaths.has("Gemfile") ||
    filePaths.has("Rakefile") ||
    files.some((f) => f.path.endsWith(".rb"))
  ) {
    return { type: "ruby", ...PROJECT_TYPE_INFO.ruby };
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

// Detect if project likely needs an external backend API
function detectBackendRequirements(files: GitHubFile[]): { needsBackend?: boolean; backendHint?: string } {
  const filePaths = files.map(f => f.path.toLowerCase());
  const fileContents = new Set(filePaths);
  
  // Common patterns that indicate external backend requirements
  const backendIndicators: { pattern: RegExp | string[]; hint: string }[] = [
    {
      // Separate backend repo references in README or code
      pattern: /backend|api.*repo|server.*repo|api.*github|backend.*github/i,
      hint: "This project appears to need a separate backend API server"
    },
    {
      // Environment variable files suggesting API URLs
      pattern: ['.env.example', '.env.sample', '.env.template'],
      hint: "Check .env files for required API URLs and keys"
    },
  ];
  
  // Check for .env* files that might indicate backend config needed
  const envFiles = filePaths.filter(f => 
    f.includes('.env') && 
    !f.endsWith('.env') && // Skip actual .env file
    (f.endsWith('.example') || f.endsWith('.sample') || f.endsWith('.template') || f.endsWith('.local'))
  );
  
  if (envFiles.length > 0) {
    return {
      needsBackend: true,
      backendHint: "This project may need API configuration. Check .env files for required settings."
    };
  }
  
  // Check for common API service folders/patterns
  const hasApiConfig = filePaths.some(f => 
    f.includes('/api/') || 
    f.includes('/services/') || 
    f.includes('apiconfig') ||
    f.includes('api.js') ||
    f.includes('api.ts') ||
    f.includes('apiservice')
  );
  
  // Check for axios/fetch service files
  const hasHttpClient = filePaths.some(f =>
    f.includes('axios') ||
    f.includes('httpservice') ||
    f.includes('httpclient')
  );
  
  if (hasApiConfig || hasHttpClient) {
    return {
      needsBackend: true,
      backendHint: "This frontend may require a backend API to display content. If blank, the API may be unavailable."
    };
  }
  
  return {};
}
