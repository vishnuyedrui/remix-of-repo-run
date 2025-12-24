import { WebContainer, FileSystemTree } from "@webcontainer/api";
import type { ProjectType } from "./projectDetection";

let webcontainerInstance: WebContainer | null = null;
let bootPromise: Promise<WebContainer> | null = null;

// Framework detection for proper configuration
type FrameworkType = 'vite' | 'next' | 'cra' | 'angular' | 'vue-cli' | 'nuxt' | 'remix' | 'astro' | 'express' | 'unknown';

interface PackageJsonInfo {
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  framework: FrameworkType;
}

// Check if WebContainers are supported in this environment
export function checkWebContainerSupport(): { supported: boolean; reason?: string } {
  // Check for SharedArrayBuffer (required for WebContainers)
  if (typeof SharedArrayBuffer === "undefined") {
    return {
      supported: false,
      reason: "SharedArrayBuffer is not available. This usually means the page is missing Cross-Origin-Isolation headers (COOP/COEP).",
    };
  }

  // Check for basic WebAssembly support
  if (typeof WebAssembly === "undefined") {
    return {
      supported: false,
      reason: "WebAssembly is not supported in this browser.",
    };
  }

  return { supported: true };
}

export type ContainerStatus = 
  | "idle"
  | "booting"
  | "mounting"
  | "installing"
  | "running"
  | "ready"
  | "error";

export interface ContainerCallbacks {
  onStatusChange?: (status: ContainerStatus) => void;
  onOutput?: (data: string) => void;
  onServerReady?: (url: string) => void;
  onError?: (error: string) => void;
}

export async function bootWebContainer(): Promise<WebContainer> {
  if (webcontainerInstance) {
    return webcontainerInstance;
  }
  
  if (bootPromise) {
    return bootPromise;
  }
  
  const attemptBoot = async (attempt: number = 1): Promise<WebContainer> => {
    try {
      // Race the boot against a 30-second timeout (increased from 6s for slower connections)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error("Boot timed out"));
        }, 30000);
      });
      
      const container = await Promise.race([
        WebContainer.boot(),
        timeoutPromise
      ]);
      
      return container;
    } catch (error) {
      // Retry once on timeout
      if (attempt < 2 && error instanceof Error && error.message.includes("timed out")) {
        console.log("WebContainer boot attempt", attempt, "failed, retrying...");
        return attemptBoot(attempt + 1);
      }
      throw new Error("Boot timed out. Please reload or check if your browser supports WebContainers (Chrome/Edge required).");
    }
  };
  
  try {
    bootPromise = attemptBoot();
    webcontainerInstance = await bootPromise;
    return webcontainerInstance;
  } catch (error) {
    bootPromise = null;
    throw error;
  }
}

export async function mountFiles(
  container: WebContainer,
  files: FileSystemTree
): Promise<void> {
  await container.mount(files);
}

export async function runCommand(
  container: WebContainer,
  command: string,
  args: string[],
  onOutput?: (data: string) => void
): Promise<number> {
  const process = await container.spawn(command, args);
  
  process.output.pipeTo(
    new WritableStream({
      write(data) {
        onOutput?.(data);
      },
    })
  );
  
  return process.exit;
}

// Read and parse package.json with framework detection
async function readPackageJson(container: WebContainer): Promise<PackageJsonInfo | null> {
  try {
    const packageJsonProcess = await container.spawn("cat", ["package.json"]);
    let packageJsonContent = "";
    
    await packageJsonProcess.output.pipeTo(
      new WritableStream({
        write(data) {
          packageJsonContent += data;
        },
      })
    );
    
    const exitCode = await packageJsonProcess.exit;
    if (exitCode !== 0) return null;
    
    const packageJson = JSON.parse(packageJsonContent);
    const scripts = packageJson.scripts || {};
    const dependencies = packageJson.dependencies || {};
    const devDependencies = packageJson.devDependencies || {};
    const allDeps = { ...dependencies, ...devDependencies };
    
    // Detect framework
    let framework: FrameworkType = 'unknown';
    if (allDeps['vite'] || allDeps['@vitejs/plugin-react'] || allDeps['@vitejs/plugin-vue']) {
      framework = 'vite';
    } else if (allDeps['next']) {
      framework = 'next';
    } else if (allDeps['react-scripts']) {
      framework = 'cra';
    } else if (allDeps['@angular/core'] || allDeps['@angular/cli']) {
      framework = 'angular';
    } else if (allDeps['@vue/cli-service']) {
      framework = 'vue-cli';
    } else if (allDeps['nuxt'] || allDeps['nuxt3']) {
      framework = 'nuxt';
    } else if (allDeps['@remix-run/react']) {
      framework = 'remix';
    } else if (allDeps['astro']) {
      framework = 'astro';
    } else if (allDeps['express'] || allDeps['koa'] || allDeps['fastify']) {
      framework = 'express';
    }
    
    return { scripts, dependencies, devDependencies, framework };
  } catch {
    return null;
  }
}

// Find the best dev script based on framework and available scripts
async function findDevScript(container: WebContainer): Promise<{ script: string; needsHostFlag: boolean; buildFirst: boolean } | null> {
  const pkgInfo = await readPackageJson(container);
  if (!pkgInfo) return null;
  
  const { scripts, framework } = pkgInfo;
  
  // Framework-specific preferences
  const frameworkScriptPriority: Record<FrameworkType, string[]> = {
    'vite': ['dev', 'start', 'serve', 'preview'],
    'next': ['dev', 'start'],
    'cra': ['start'],
    'angular': ['start', 'serve'],
    'vue-cli': ['serve', 'dev', 'start'],
    'nuxt': ['dev', 'start'],
    'remix': ['dev', 'start'],
    'astro': ['dev', 'start', 'preview'],
    'express': ['start', 'dev', 'serve', 'start:dev'],
    'unknown': ['dev', 'start', 'serve', 'develop', 'watch', 'start:dev', 'preview'],
  };
  
  // Check if this framework needs --host flag for WebContainer
  const needsHostFlag = ['vite', 'astro'].includes(framework);
  
  // Check if we need to build first (e.g., only preview script available)
  let buildFirst = false;
  const scriptPriority = frameworkScriptPriority[framework];
  
  for (const scriptName of scriptPriority) {
    if (scripts[scriptName]) {
      // Special case: if only 'preview' is available, we need to build first
      if (scriptName === 'preview' && scripts['build']) {
        buildFirst = true;
      }
      return { script: scriptName, needsHostFlag, buildFirst };
    }
  }
  
  // Fallback: check for build + preview combo
  if (scripts['build'] && scripts['preview']) {
    return { script: 'preview', needsHostFlag, buildFirst: true };
  }
  
  // Last resort: any script that might start a server
  for (const [name, cmd] of Object.entries(scripts)) {
    const cmdStr = String(cmd);
    if (cmdStr.includes('node') || cmdStr.includes('nodemon') || cmdStr.includes('ts-node')) {
      return { script: name, needsHostFlag: false, buildFirst: false };
    }
  }
  
  return null;
}

export async function startDevServer(
  container: WebContainer,
  callbacks: ContainerCallbacks
): Promise<void> {
  const { onStatusChange, onOutput, onServerReady, onError } = callbacks;
  
  let serverReadyFired = false;
  let serverReadyTimeout: ReturnType<typeof setTimeout> | null = null;
  let portReadyTimeout: ReturnType<typeof setTimeout> | null = null;
  
  const handleServerReady = (url: string, port?: number) => {
    if (serverReadyFired) return;
    serverReadyFired = true;
    if (serverReadyTimeout) clearTimeout(serverReadyTimeout);
    if (portReadyTimeout) clearTimeout(portReadyTimeout);
    onOutput?.(`\n\x1b[32m✓ Server ready at ${url}${port ? ` (port ${port})` : ''}\x1b[0m\n`);
    onServerReady?.(url);
    onStatusChange?.("ready");
  };
  
  // Register WebContainer port/server-ready listeners BEFORE starting the server
  // This is the PRIMARY and ONLY reliable way to get a valid preview URL
  const unsubscribeServerReady = container.on("server-ready", (port, url) => {
    onOutput?.(`\n\x1b[36mℹ WebContainer server-ready event: port=${port}, url=${url}\x1b[0m\n`);
    handleServerReady(url, port);
  });
  
  // Also listen for port events as backup
  const unsubscribePort = container.on("port", (port, type, url) => {
    if (type === "open" && url) {
      onOutput?.(`\n\x1b[36mℹ WebContainer port event: port=${port}, type=${type}, url=${url}\x1b[0m\n`);
      // Give server-ready event priority, wait a bit before using port event
      if (portReadyTimeout) clearTimeout(portReadyTimeout);
      portReadyTimeout = setTimeout(() => {
        if (!serverReadyFired) {
          handleServerReady(url, port);
        }
      }, 2000);
    }
  });
  
  try {
    // Read package.json for framework detection and debugging
    const pkgInfo = await readPackageJson(container);
    if (pkgInfo) {
      onOutput?.(`\x1b[33m  Framework detected: ${pkgInfo.framework}\x1b[0m\n`);
      onOutput?.(`\x1b[33m  Available scripts: ${Object.keys(pkgInfo.scripts).join(', ')}\x1b[0m\n\n`);
    }
    
    // Install dependencies
    onStatusChange?.("installing");
    onOutput?.("\x1b[36m➜ Running npm install...\x1b[0m\n\n");
    
    const installExitCode = await runCommand(
      container,
      "npm",
      ["install"],
      onOutput
    );
    
    if (installExitCode !== 0) {
      onError?.("npm install failed. Check the terminal output for details.");
      onStatusChange?.("error");
      return;
    }
    
    onOutput?.("\n\x1b[32m✓ Dependencies installed successfully!\x1b[0m\n\n");
    
    // Find the right dev script with framework-aware configuration
    const devScriptInfo = await findDevScript(container);
    
    if (!devScriptInfo) {
      onError?.("No dev/start script found in package.json. The project needs a 'dev', 'start', or 'serve' script.");
      onStatusChange?.("error");
      return;
    }
    
    const { script: devScript, needsHostFlag, buildFirst } = devScriptInfo;
    
    // Run build first if needed (e.g., for preview-only projects)
    if (buildFirst) {
      onOutput?.("\x1b[36m➜ Building project first...\x1b[0m\n\n");
      const buildExitCode = await runCommand(container, "npm", ["run", "build"], onOutput);
      if (buildExitCode !== 0) {
        onError?.("Build failed. Check the terminal output for details.");
        onStatusChange?.("error");
        return;
      }
      onOutput?.("\n\x1b[32m✓ Build completed!\x1b[0m\n\n");
    }
    
    // Start dev server
    onStatusChange?.("running");
    
    // Build command args based on framework needs
    let npmArgs: string[];
    if (needsHostFlag) {
      // For Vite and similar frameworks that need --host for WebContainer binding
      npmArgs = ["run", devScript, "--", "--host", "0.0.0.0"];
      onOutput?.(`\x1b[36m➜ Running npm run ${devScript} -- --host 0.0.0.0\x1b[0m\n`);
      onOutput?.(`\x1b[33m  (Added --host flag for WebContainer compatibility)\x1b[0m\n\n`);
    } else {
      npmArgs = ["run", devScript];
      onOutput?.(`\x1b[36m➜ Running npm run ${devScript}...\x1b[0m\n\n`);
    }
    
    // Spawn with HOST=0.0.0.0 env var to ensure server binds to all interfaces
    const serverProcess = await container.spawn("npm", npmArgs, {
      env: {
        HOST: "0.0.0.0",
        // Some frameworks use HOSTNAME
        HOSTNAME: "0.0.0.0",
      },
    });
    
    // Log output for debugging - but DO NOT use output to set preview URL
    // The only valid preview URL comes from WebContainer events (server-ready/port)
    serverProcess.output.pipeTo(
      new WritableStream({
        write(data) {
          onOutput?.(data);
        },
      })
    );
    
    // Set a timeout - if server-ready hasn't fired in 90 seconds, show helpful message
    serverReadyTimeout = setTimeout(() => {
      if (!serverReadyFired) {
        onOutput?.("\n\x1b[33m════════════════════════════════════════════════════════\x1b[0m\n");
        onOutput?.("\x1b[33m⚠ Server process is running but no port was detected.\x1b[0m\n\n");
        onOutput?.("\x1b[33mPossible causes:\x1b[0m\n");
        onOutput?.("\x1b[33m  1. Server binds to localhost only (needs 0.0.0.0)\x1b[0m\n");
        onOutput?.("\x1b[33m  2. Server failed to start (check errors above)\x1b[0m\n");
        onOutput?.("\x1b[33m  3. Missing dependencies or configuration\x1b[0m\n\n");
        onOutput?.("\x1b[33mTo fix binding issues, ensure server listens on:\x1b[0m\n");
        onOutput?.("\x1b[33m  - Vite: vite --host 0.0.0.0\x1b[0m\n");
        onOutput?.("\x1b[33m  - Express: app.listen(port, '0.0.0.0')\x1b[0m\n");
        onOutput?.("\x1b[33m  - Next.js: should work automatically\x1b[0m\n");
        onOutput?.("\x1b[33m════════════════════════════════════════════════════════\x1b[0m\n");
      }
    }, 90000);
    
    // Handle server exit
    serverProcess.exit.then((code) => {
      if (serverReadyTimeout) clearTimeout(serverReadyTimeout);
      if (portReadyTimeout) clearTimeout(portReadyTimeout);
      if (code !== 0 && !serverReadyFired) {
        onError?.(`Dev server exited with code ${code}. Check terminal for details.`);
        onStatusChange?.("error");
      }
    });
    
  } catch (error) {
    if (serverReadyTimeout) clearTimeout(serverReadyTimeout);
    if (portReadyTimeout) clearTimeout(portReadyTimeout);
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    onError?.(message);
    onStatusChange?.("error");
  }
}

// Find the best directory to serve for static sites
async function findStaticRoot(container: WebContainer): Promise<string> {
  const possibleRoots = ["public", "dist", "build", "docs", "www", "static", "."];
  
  for (const dir of possibleRoots) {
    try {
      if (dir === ".") {
        // Check if root has index.html
        const result = await container.spawn("test", ["-f", "index.html"]);
        if (await result.exit === 0) {
          return ".";
        }
      } else {
        // Check if directory exists and has index.html
        const dirResult = await container.spawn("test", ["-d", dir]);
        if (await dirResult.exit === 0) {
          const indexResult = await container.spawn("test", ["-f", `${dir}/index.html`]);
          if (await indexResult.exit === 0) {
            return dir;
          }
        }
      }
    } catch {
      continue;
    }
  }
  
  // Fallback to root directory
  return ".";
}

// Generate an express-based static server with full MIME type support
function generateStaticServerScript(staticDirs: string[]): string {
  return `
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Comprehensive MIME type mappings for all common file types
const mimeTypes = {
  // Images
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.bmp': 'image/bmp',
  '.tiff': 'image/tiff',
  '.avif': 'image/avif',
  // Fonts
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  // Web
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.json': 'application/json',
  '.xml': 'application/xml',
  // Media
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogv': 'video/ogg',
  // Documents
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  // Data
  '.csv': 'text/csv',
  '.yaml': 'text/yaml',
  '.yml': 'text/yaml',
};

// Custom middleware to set correct MIME types
app.use((req, res, next) => {
  const ext = path.extname(req.path).toLowerCase();
  if (mimeTypes[ext]) {
    res.type(mimeTypes[ext]);
  }
  next();
});

// Enable CORS for all requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Serve static files from multiple directories with proper options
const staticOptions = {
  dotfiles: 'allow',
  etag: false,
  extensions: ['html', 'htm'],
  index: ['index.html', 'index.htm'],
  maxAge: 0,
  redirect: true,
  setHeaders: (res, filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    if (mimeTypes[ext]) {
      res.set('Content-Type', mimeTypes[ext]);
    }
    // Disable caching for development
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
};

// Serve from each directory
const dirs = ${JSON.stringify(staticDirs)};
dirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    console.log('Serving static files from:', dir);
    app.use(express.static(dir, staticOptions));
  }
});

// SPA fallback - serve index.html for any unmatched routes
app.use((req, res, next) => {
  // Only handle GET requests for HTML pages (not API calls or assets)
  if (req.method !== 'GET') return next();
  
  const ext = path.extname(req.path);
  // If there's an extension, it's likely an asset that wasn't found
  if (ext && ext !== '.html') {
    return res.status(404).send('Not found');
  }
  
  // Try to serve index.html from the first available directory
  for (const dir of dirs) {
    const indexPath = path.join(dir, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(path.resolve(indexPath));
    }
  }
  next();
});

// 404 handler
app.use((req, res) => {
  res.status(404).send('Not found: ' + req.path);
});

app.listen(PORT, () => {
  console.log('Static server available on http://localhost:' + PORT);
  console.log('Available on:');
  console.log('  http://localhost:' + PORT);
});
`;
}

// Serve static files using express for proper MIME type handling
async function serveStaticSite(
  container: WebContainer,
  callbacks: ContainerCallbacks
): Promise<void> {
  const { onStatusChange, onOutput, onServerReady, onError } = callbacks;

  let serverReadyFired = false;
  let serverReadyTimeout: ReturnType<typeof setTimeout> | null = null;

  const handleServerReady = (url: string, port?: number) => {
    if (serverReadyFired) return;
    serverReadyFired = true;
    if (serverReadyTimeout) clearTimeout(serverReadyTimeout);
    onOutput?.(`\n\x1b[32m✓ Static server ready${port ? ` on port ${port}` : ''}\x1b[0m\n`);
    onServerReady?.(url);
    onStatusChange?.("ready");
  };

  try {
    // Find all potential static directories
    const possibleDirs = [".", "public", "dist", "build", "static", "assets", "www", "docs"];
    const existingDirs: string[] = [];
    
    for (const dir of possibleDirs) {
      try {
        const result = await container.spawn("test", ["-d", dir]);
        if (await result.exit === 0) {
          existingDirs.push(dir);
        }
      } catch {
        continue;
      }
    }
    
    // Find the primary root (with index.html)
    const staticRoot = await findStaticRoot(container);
    
    // Build ordered list: primary root first, then others
    const orderedDirs = [staticRoot, ...existingDirs.filter(d => d !== staticRoot)];
    const uniqueDirs = [...new Set(orderedDirs)];
    
    onStatusChange?.("installing");
    onOutput?.("\x1b[36m➜ Setting up enhanced static file server...\x1b[0m\n\n");
    onOutput?.(`\x1b[33m  Serving from: ${uniqueDirs.join(", ")}\x1b[0m\n\n`);

    // Create package.json with express
    await container.fs.writeFile(
      "package.json",
      JSON.stringify(
        {
          name: "static-server",
          type: "commonjs",
          scripts: {
            start: "node server.js",
          },
          dependencies: {
            express: "^4.18.2",
          },
        },
        null,
        2
      )
    );

    // Create the server script with proper MIME handling
    await container.fs.writeFile("server.js", generateStaticServerScript(uniqueDirs));

    // Install express
    const installExitCode = await runCommand(
      container,
      "npm",
      ["install"],
      onOutput
    );

    if (installExitCode !== 0) {
      onError?.("Failed to install static server dependencies.");
      onStatusChange?.("error");
      return;
    }

    onOutput?.("\n\x1b[32m✓ Static server configured!\x1b[0m\n\n");

    // Start server
    onStatusChange?.("running");
    onOutput?.("\x1b[36m➜ Starting static file server with full MIME support...\x1b[0m\n\n");

    const serverProcess = await container.spawn("npm", ["run", "start"]);

    serverProcess.output.pipeTo(
      new WritableStream({
        write(data) {
          onOutput?.(data);
          
          // Detect server ready from output
          if (!serverReadyFired && /available on|listening/i.test(data)) {
            setTimeout(() => {
              if (!serverReadyFired) {
                handleServerReady("http://localhost:3000", 3000);
              }
            }, 500);
          }
        },
      })
    );

    // Listen for server ready
    container.on("server-ready", (port, url) => {
      handleServerReady(url, port);
    });

    // Timeout for static server
    serverReadyTimeout = setTimeout(() => {
      if (!serverReadyFired) {
        onOutput?.("\n\x1b[33m⚠ Static server taking longer than expected...\x1b[0m\n");
      }
    }, 30000);

    serverProcess.exit.then((code) => {
      if (serverReadyTimeout) clearTimeout(serverReadyTimeout);
      if (code !== 0 && !serverReadyFired) {
        onError?.(`Static server exited with code ${code}.`);
        onStatusChange?.("error");
      }
    });
  } catch (error) {
    if (serverReadyTimeout) clearTimeout(serverReadyTimeout);
    const message = error instanceof Error ? error.message : "Unknown error";
    onError?.(message);
    onStatusChange?.("error");
  }
}

export async function runFullWorkflow(
  files: FileSystemTree,
  callbacks: ContainerCallbacks,
  projectType: ProjectType = "nodejs"
): Promise<void> {
  const { onStatusChange, onOutput, onError } = callbacks;

  // For non-runnable projects, just mount files
  if (projectType !== "nodejs" && projectType !== "static") {
    try {
      onStatusChange?.("booting");
      onOutput?.("\x1b[36m➜ Booting WebContainer for code browsing...\x1b[0m\n\n");

      const container = await bootWebContainer();
      onOutput?.("\x1b[32m✓ WebContainer booted!\x1b[0m\n\n");

      onStatusChange?.("mounting");
      onOutput?.("\x1b[36m➜ Mounting files...\x1b[0m\n");

      await mountFiles(container, files);
      onOutput?.("\x1b[32m✓ Files mounted!\x1b[0m\n\n");

      onOutput?.("\x1b[33m⚠ This project type cannot be executed in the browser.\x1b[0m\n");
      onOutput?.("\x1b[33m  Code browsing is available in the file tree.\x1b[0m\n");
      
      onStatusChange?.("ready");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      onError?.(message);
      onStatusChange?.("error");
    }
    return;
  }
  
  try {
    // Boot
    onStatusChange?.("booting");
    onOutput?.("\x1b[36m➜ Booting WebContainer...\x1b[0m\n");
    onOutput?.("\x1b[33m  (This requires Cross-Origin-Isolation headers)\x1b[0m\n\n");
    
    const container = await bootWebContainer();
    onOutput?.("\x1b[32m✓ WebContainer booted successfully!\x1b[0m\n\n");
    
    // Mount
    onStatusChange?.("mounting");
    onOutput?.("\x1b[36m➜ Mounting files to virtual filesystem...\x1b[0m\n");
    
    await mountFiles(container, files);
    onOutput?.("\x1b[32m✓ Files mounted!\x1b[0m\n\n");
    
    // Start appropriate server based on project type
    if (projectType === "static") {
      await serveStaticSite(container, callbacks);
    } else {
      await startDevServer(container, callbacks);
    }
    
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    
    // Provide more helpful error messages
    if (message.includes("SharedArrayBuffer")) {
      onError?.("WebContainers require Cross-Origin-Isolation headers. Please ensure the server is configured correctly.");
    } else if (message.includes("boot")) {
      onError?.("Failed to boot WebContainer. This feature requires a modern browser with WebAssembly support.");
    } else {
      onError?.(message);
    }
    
    onStatusChange?.("error");
  }
}

export function teardownWebContainer(): void {
  if (webcontainerInstance) {
    webcontainerInstance.teardown();
    webcontainerInstance = null;
    bootPromise = null;
  }
}
