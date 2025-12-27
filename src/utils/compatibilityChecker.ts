// Pre-flight compatibility checker for Node.js projects
import type { FileSystemTree, DirectoryNode, FileNode } from "@webcontainer/api";
import type { ProjectType } from "./projectDetection";

export interface CompatibilityReport {
  canRun: boolean;
  issues: string[];
  warnings: string[];
  suggestions: string[];
  nodeVersion?: string;
  hasNativeDeps: boolean;
  hasGitSshDeps: boolean;
  frameworkDetected?: string;
}

// Known packages that require native compilation (won't work in WebContainers)
const NATIVE_PACKAGES = new Set([
  "bcrypt",
  "sharp",
  "canvas",
  "sqlite3",
  "better-sqlite3",
  "node-sass",
  "node-gyp",
  "fsevents",
  "esbuild", // Usually has wasm fallback but can cause issues
  "swc",
  "@swc/core",
  "lightningcss",
  "bufferutil",
  "utf-8-validate",
  "cpu-features",
  "sse4_crc32",
  "farmhash",
  "xxhash",
  "argon2",
  "libsodium",
  "sodium-native",
  "leveldown",
  "rocksdb",
]);

// Packages that commonly cause peer dependency issues
const PEER_DEP_TROUBLEMAKERS = new Set([
  "react",
  "react-dom",
  "@types/react",
  "@types/react-dom",
  "webpack",
  "babel-core",
  "@babel/core",
  "eslint",
  "prettier",
  "typescript",
]);

// Framework detection patterns
const FRAMEWORK_PATTERNS: { name: string; deps: string[]; devScript?: string }[] = [
  { name: "Vite", deps: ["vite"], devScript: "vite" },
  { name: "Next.js", deps: ["next"], devScript: "next" },
  { name: "Create React App", deps: ["react-scripts"], devScript: "react-scripts" },
  { name: "Vue CLI", deps: ["@vue/cli-service"], devScript: "vue-cli-service" },
  { name: "Nuxt", deps: ["nuxt", "nuxt3"], devScript: "nuxt" },
  { name: "Angular CLI", deps: ["@angular/cli"], devScript: "ng" },
  { name: "SvelteKit", deps: ["@sveltejs/kit"], devScript: "svelte-kit" },
  { name: "Remix", deps: ["@remix-run/dev"], devScript: "remix" },
  { name: "Astro", deps: ["astro"], devScript: "astro" },
  { name: "Gatsby", deps: ["gatsby"], devScript: "gatsby" },
  { name: "Parcel", deps: ["parcel"], devScript: "parcel" },
  { name: "Webpack", deps: ["webpack", "webpack-cli"], devScript: "webpack" },
  { name: "Express", deps: ["express"] },
  { name: "Fastify", deps: ["fastify"] },
  { name: "Koa", deps: ["koa"] },
  { name: "NestJS", deps: ["@nestjs/core"], devScript: "nest" },
];

// Extract package.json from FileSystemTree
function extractPackageJson(tree: FileSystemTree): Record<string, unknown> | null {
  const pkgNode = tree["package.json"];
  if (!pkgNode || !("file" in pkgNode)) return null;
  
  const fileNode = pkgNode as FileNode;
  const contents = fileNode.file.contents;
  
  try {
    const content = typeof contents === "string" 
      ? contents 
      : new TextDecoder().decode(contents as Uint8Array);
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// Check for .nvmrc or engines field
function extractNodeVersion(
  tree: FileSystemTree, 
  pkg: Record<string, unknown>
): string | undefined {
  // Check engines field
  const engines = pkg.engines as Record<string, string> | undefined;
  if (engines?.node) {
    return engines.node;
  }
  
  // Check .nvmrc
  const nvmrcNode = tree[".nvmrc"];
  if (nvmrcNode && "file" in nvmrcNode) {
    const contents = (nvmrcNode as FileNode).file.contents;
    const version = typeof contents === "string" 
      ? contents.trim() 
      : new TextDecoder().decode(contents as Uint8Array).trim();
    return version;
  }
  
  return undefined;
}

// Analyze dependencies for compatibility issues
function analyzeDependencies(
  pkg: Record<string, unknown>
): { 
  native: string[]; 
  peerTrouble: string[]; 
  gitSsh: string[];
  allDeps: string[];
} {
  const native: string[] = [];
  const peerTrouble: string[] = [];
  const gitSsh: string[] = [];
  const allDeps: string[] = [];
  
  const sections = ["dependencies", "devDependencies", "optionalDependencies"];
  
  for (const section of sections) {
    const deps = pkg[section] as Record<string, string> | undefined;
    if (!deps) continue;
    
    for (const [name, version] of Object.entries(deps)) {
      allDeps.push(name);
      
      // Check for native packages
      if (NATIVE_PACKAGES.has(name)) {
        native.push(name);
      }
      
      // Check for peer dep troublemakers
      if (PEER_DEP_TROUBLEMAKERS.has(name)) {
        peerTrouble.push(name);
      }
      
      // Check for git+ssh dependencies
      if (
        version.startsWith("git+ssh://") || 
        version.startsWith("ssh://") || 
        version.includes("git@")
      ) {
        gitSsh.push(name);
      }
    }
  }
  
  return { native, peerTrouble, gitSsh, allDeps };
}

// Detect framework from package.json
function detectFramework(
  pkg: Record<string, unknown>,
  allDeps: string[]
): string | undefined {
  const depSet = new Set(allDeps);
  
  for (const framework of FRAMEWORK_PATTERNS) {
    if (framework.deps.some(dep => depSet.has(dep))) {
      return framework.name;
    }
  }
  
  return undefined;
}

// Parse Node.js version requirement
function parseNodeVersionRequirement(version: string): { 
  minMajor?: number; 
  maxMajor?: number;
  exact?: number;
} {
  // Handle common patterns
  const exactMatch = version.match(/^v?(\d+)(?:\.\d+)?(?:\.\d+)?$/);
  if (exactMatch) {
    return { exact: parseInt(exactMatch[1], 10) };
  }
  
  const rangeMatch = version.match(/^>=?\s*v?(\d+)/);
  if (rangeMatch) {
    return { minMajor: parseInt(rangeMatch[1], 10) };
  }
  
  const ltMatch = version.match(/^<\s*v?(\d+)/);
  if (ltMatch) {
    return { maxMajor: parseInt(ltMatch[1], 10) - 1 };
  }
  
  return {};
}

// Main compatibility check function
export function checkCompatibility(
  tree: FileSystemTree,
  projectType: ProjectType
): CompatibilityReport {
  const report: CompatibilityReport = {
    canRun: true,
    issues: [],
    warnings: [],
    suggestions: [],
    hasNativeDeps: false,
    hasGitSshDeps: false,
  };
  
  // Only check Node.js projects in detail
  if (projectType !== "nodejs") {
    if (projectType === "static") {
      report.suggestions.push("Static site will be served with Express");
    } else {
      report.canRun = false;
      report.issues.push(`${projectType} projects cannot run in WebContainers`);
      report.suggestions.push("Use cloud deployment for full execution");
    }
    return report;
  }
  
  const pkg = extractPackageJson(tree);
  if (!pkg) {
    report.warnings.push("No package.json found - may not be a Node.js project");
    return report;
  }
  
  // Check Node.js version requirements
  report.nodeVersion = extractNodeVersion(tree, pkg);
  if (report.nodeVersion) {
    const { minMajor, exact } = parseNodeVersionRequirement(report.nodeVersion);
    const webContainerNodeVersion = 18; // WebContainers typically run Node 18
    
    if (minMajor && minMajor > webContainerNodeVersion) {
      report.warnings.push(
        `Project requires Node.js ${report.nodeVersion}, WebContainers run Node 18`
      );
    }
    if (exact && exact > webContainerNodeVersion) {
      report.warnings.push(
        `Project targets Node.js ${exact}, WebContainers run Node 18`
      );
    }
    if (exact && exact < 14) {
      report.warnings.push(
        `Project targets old Node.js ${exact} - some APIs may differ`
      );
    }
  }
  
  // Analyze dependencies
  const { native, peerTrouble, gitSsh, allDeps } = analyzeDependencies(pkg);
  
  // Native dependencies
  if (native.length > 0) {
    report.hasNativeDeps = true;
    report.warnings.push(
      `Native packages detected: ${native.slice(0, 3).join(", ")}${native.length > 3 ? "..." : ""}`
    );
    report.suggestions.push(
      "Some packages may not work - they require native compilation"
    );
  }
  
  // Git SSH dependencies
  if (gitSsh.length > 0) {
    report.hasGitSshDeps = true;
    report.canRun = false;
    report.issues.push(
      `Git+SSH dependencies not supported: ${gitSsh.join(", ")}`
    );
    report.suggestions.push(
      "Replace git+ssh dependencies with npm packages or HTTPS URLs"
    );
  }
  
  // Peer dependency warnings
  if (peerTrouble.length >= 3) {
    report.suggestions.push(
      "May need --legacy-peer-deps if install fails"
    );
  }
  
  // Detect framework
  report.frameworkDetected = detectFramework(pkg, allDeps);
  
  // Check for scripts
  const scripts = pkg.scripts as Record<string, string> | undefined;
  if (!scripts) {
    report.warnings.push("No scripts in package.json");
    report.suggestions.push("Add a 'dev' or 'start' script to run the project");
  } else {
    const hasDevScript = ["dev", "start", "serve", "develop"].some(
      s => scripts[s]
    );
    if (!hasDevScript) {
      report.warnings.push("No dev/start script found");
      report.suggestions.push("Add a 'dev' or 'start' script to package.json");
    }
  }
  
  return report;
}

// Quick check for common blockers
export function quickCompatibilityCheck(
  tree: FileSystemTree
): { blocked: boolean; reason?: string } {
  const pkg = extractPackageJson(tree);
  if (!pkg) {
    return { blocked: false };
  }
  
  const { gitSsh } = analyzeDependencies(pkg);
  if (gitSsh.length > 0) {
    return { 
      blocked: true, 
      reason: `Git+SSH dependencies not supported: ${gitSsh[0]}`
    };
  }
  
  return { blocked: false };
}

// Get install strategy based on compatibility
export function getInstallStrategy(
  report: CompatibilityReport
): {
  args: string[];
  env?: Record<string, string>;
  retryWithLegacy: boolean;
} {
  const baseArgs = ["--no-audit", "--no-fund"];
  
  // If native deps detected, add ignore-scripts
  if (report.hasNativeDeps) {
    return {
      args: ["install", ...baseArgs, "--ignore-scripts"],
      retryWithLegacy: true,
    };
  }
  
  return {
    args: ["install", ...baseArgs],
    retryWithLegacy: true,
  };
}

// Get dev server configuration based on framework
export function getDevServerConfig(
  framework?: string
): {
  args: string[];
  env?: Record<string, string>;
} {
  switch (framework) {
    case "Vite":
      return { args: ["run", "dev", "--", "--host", "0.0.0.0"] };
    
    case "Create React App":
      return { 
        args: ["run", "start"],
        env: { HOST: "0.0.0.0", PORT: "3000", BROWSER: "none" }
      };
    
    case "Next.js":
      return { 
        args: ["run", "dev", "--", "-H", "0.0.0.0"],
        env: { NEXT_TELEMETRY_DISABLED: "1" }
      };
    
    case "Vue CLI":
      return { args: ["run", "serve", "--", "--host", "0.0.0.0"] };
    
    case "Angular CLI":
      return { args: ["run", "start", "--", "--host", "0.0.0.0"] };
    
    case "Nuxt":
      return { 
        args: ["run", "dev", "--", "--host", "0.0.0.0"],
        env: { NUXT_TELEMETRY_DISABLED: "1" }
      };
    
    case "SvelteKit":
      return { args: ["run", "dev", "--", "--host", "0.0.0.0"] };
    
    case "Remix":
      return { args: ["run", "dev"] };
    
    case "Astro":
      return { args: ["run", "dev", "--", "--host", "0.0.0.0"] };
    
    case "Gatsby":
      return { 
        args: ["run", "develop", "--", "-H", "0.0.0.0"],
        env: { GATSBY_TELEMETRY_DISABLED: "1" }
      };
    
    default:
      // Generic - try with host flag
      return { args: ["run", "dev"] };
  }
}
