import { WebContainer, FileSystemTree } from "@webcontainer/api";
import type { ProjectType } from "./projectDetection";

let webcontainerInstance: WebContainer | null = null;
let bootPromise: Promise<WebContainer> | null = null;
let supportCheckLogged = false;

// Check if WebContainers are supported in this environment
export function checkWebContainerSupport(): { supported: boolean; reason?: string } {
  const sharedArrayBufferAvailable = typeof SharedArrayBuffer !== "undefined";
  const webAssemblyAvailable = typeof WebAssembly !== "undefined";
  const coi = typeof crossOriginIsolated !== "undefined" ? crossOriginIsolated : undefined;

  // Avoid spamming the console on every render
  if (!supportCheckLogged) {
    supportCheckLogged = true;
    console.log("[WebContainer] Checking support...");
    console.log("[WebContainer] SharedArrayBuffer available:", sharedArrayBufferAvailable);
    console.log("[WebContainer] WebAssembly available:", webAssemblyAvailable);
    console.log("[WebContainer] crossOriginIsolated:", coi ?? "N/A");
  }

  // Check for SharedArrayBuffer (required for WebContainers)
  if (!sharedArrayBufferAvailable) {
    const reason =
      "SharedArrayBuffer is not available. This usually means the page is missing Cross-Origin-Isolation headers (COOP/COEP).";
    return {
      supported: false,
      reason,
    };
  }

  // Check for basic WebAssembly support
  if (!webAssemblyAvailable) {
    const reason = "WebAssembly is not supported in this browser.";
    return {
      supported: false,
      reason,
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
  console.log("[WebContainer] bootWebContainer called");
  
  if (webcontainerInstance) {
    console.log("[WebContainer] Returning existing instance");
    return webcontainerInstance;
  }
  
  if (bootPromise) {
    console.log("[WebContainer] Returning existing boot promise");
    return bootPromise;
  }
  
  const attemptBoot = async (attempt: number = 1): Promise<WebContainer> => {
    console.log(`[WebContainer] Boot attempt ${attempt} starting...`);
    try {
      // Race the boot against a 60-second timeout (WebContainer first boot can be slow)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error("Boot timed out"));
        }, 60000);
      });
      
      console.log("[WebContainer] Calling WebContainer.boot() with coep: credentialless...");
      const container = await Promise.race([
        WebContainer.boot({ coep: "credentialless" }),
        timeoutPromise
      ]);
      
      console.log("[WebContainer] Boot successful!");
      return container;
    } catch (error) {
      console.error(`[WebContainer] Boot attempt ${attempt} failed:`, error);
      // Retry up to 2 times on timeout
      if (attempt < 3 && error instanceof Error && error.message.includes("timed out")) {
        console.log(`[WebContainer] Retrying boot (attempt ${attempt + 1})...`);
        return attemptBoot(attempt + 1);
      }
      throw new Error("Boot timed out. Please reload or check if your browser supports WebContainers (Chrome/Edge required).");
    }
  };
  
  try {
    bootPromise = attemptBoot();
    webcontainerInstance = await bootPromise;
    console.log("[WebContainer] Instance stored successfully");
    return webcontainerInstance;
  } catch (error) {
    console.error("[WebContainer] Boot failed completely:", error);
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

// Helper: buffered output to avoid flooding the terminal
function createBufferedOutput(
  onOutput?: (data: string) => void,
  flushMs: number = 50
): { write: (chunk: string) => void; flush: () => void } {
  let buffer = "";
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!buffer) return;
    onOutput?.(buffer);
    buffer = "";
  };

  const write = (chunk: string) => {
    buffer += chunk;
    if (!timer) timer = setTimeout(flush, flushMs);
  };

  return { write, flush };
}

// Helper: check if a file exists in the container
async function fileExists(container: WebContainer, path: string): Promise<boolean> {
  try {
    const p = await container.spawn("test", ["-f", path]);
    return (await p.exit) === 0;
  } catch {
    return false;
  }
}

// Helper: read and parse a JSON file from the container
async function readJsonFile(container: WebContainer, path: string): Promise<any | null> {
  try {
    const proc = await container.spawn("cat", [path]);
    let content = "";

    await proc.output.pipeTo(
      new WritableStream({
        write(data) {
          content += data;
        },
      })
    );

    const code = await proc.exit;
    if (code !== 0) return null;
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// Helper: detect unsupported git+ssh dependencies
function hasGitSshDependencies(pkg: any): boolean {
  const sections = ["dependencies", "devDependencies", "optionalDependencies"];
  for (const section of sections) {
    const deps = pkg?.[section];
    if (!deps) continue;
    for (const value of Object.values(deps)) {
      if (typeof value !== "string") continue;
      if (value.startsWith("git+ssh://") || value.startsWith("ssh://") || value.includes("git@")) {
        return true;
      }
    }
  }
  return false;
}

// Helper: run a command with timeout and progress hints
async function runCommandWithTimeout(
  container: WebContainer,
  command: string,
  args: string[],
  onOutput?: (data: string) => void,
  options?: { timeoutMs?: number; label?: string; bufferMs?: number }
): Promise<number> {
  const label = options?.label ?? `${command} ${args.join(" ")}`;
  const timeoutMs = options?.timeoutMs ?? 5 * 60_000;
  const bufferMs = options?.bufferMs ?? 50;

  const buffered = createBufferedOutput(onOutput, bufferMs);
  const proc = await container.spawn(command, args);

  let outputSeen = false;
  let lastOutputAt = Date.now();

  proc.output
    .pipeTo(
      new WritableStream({
        write(data) {
          outputSeen = true;
          lastOutputAt = Date.now();
          buffered.write(data);
        },
      })
    )
    .catch(() => {
      // ignore output stream errors
    });

  const noOutputHintTimer = setTimeout(() => {
    if (!outputSeen) {
      buffered.write("\n\x1b[33m… still working (no output yet)\x1b[0m\n");
    }
  }, 15_000);

  const stallHintInterval = setInterval(() => {
    const idleMs = Date.now() - lastOutputAt;
    if (idleMs > 60_000) {
      buffered.write(
        `\n\x1b[33m… still running (${Math.round(idleMs / 1000)}s since last output)\x1b[0m\n`
      );
      lastOutputAt = Date.now();
    }
  }, 60_000);

  let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutTimer = setTimeout(() => {
      try {
        proc.kill();
      } catch {
        // ignore
      }
      buffered.flush();
      reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);
  });

  try {
    const exitCode = await Promise.race([proc.exit, timeoutPromise]);
    return exitCode;
  } finally {
    clearTimeout(noOutputHintTimer);
    clearInterval(stallHintInterval);
    if (timeoutTimer) clearTimeout(timeoutTimer);
    buffered.flush();
  }
}

async function findDevScript(container: WebContainer): Promise<string | null> {
  // Try to read package.json to find the right script
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
    
    // Check for common dev script names in order of preference
    const devScripts = ["dev", "start", "serve", "develop", "watch"];
    for (const script of devScripts) {
      if (scripts[script]) {
        return script;
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

export async function startDevServer(
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
    onOutput?.(`\n\x1b[32m✓ Server ready${port ? ` on port ${port}` : ''}\x1b[0m\n`);
    onServerReady?.(url);
    onStatusChange?.("ready");
  };
  
  try {
    const output = createBufferedOutput(onOutput);
    const print = (data: string) => output.write(data);

    // Preflight: package.json + common unsupported dependency patterns
    const pkg = await readJsonFile(container, "package.json");
    if (pkg && hasGitSshDependencies(pkg)) {
      onStatusChange?.("error");
      onError?.(
        "This project uses git+ssh dependencies (e.g. git@... or ssh://...). Those can’t be installed in the in-browser container."
      );
      print("\x1b[31m✗ Unsupported dependency source detected (git+ssh).\x1b[0m\n");
      output.flush();
      return;
    }

    // Install dependencies
    onStatusChange?.("installing");

    const hasPackageLock = await fileExists(container, "package-lock.json");
    const npmArgs = hasPackageLock ? ["ci"] : ["install"];
    npmArgs.push("--no-audit", "--no-fund");

    print(`\x1b[36m➜ Running npm ${hasPackageLock ? "ci" : "install"}...\x1b[0m\n\n`);

    const installExitCode = await runCommandWithTimeout(container, "npm", npmArgs, print, {
      label: "Dependency installation",
      timeoutMs: 5 * 60_000,
      bufferMs: 75,
    });

    if (installExitCode !== 0) {
      onError?.(`Dependency install failed (exit code ${installExitCode}). Check terminal for details.`);
      onStatusChange?.("error");
      output.flush();
      return;
    }

    print("\n\x1b[32m✓ Dependencies installed successfully!\x1b[0m\n\n");
    output.flush();
    
    // Find the right dev script
    const devScript = await findDevScript(container);
    
    if (!devScript) {
      onError?.("No dev/start script found in package.json. The project needs a 'dev', 'start', or 'serve' script.");
      onStatusChange?.("error");
      return;
    }
    
    // Start dev server
    onStatusChange?.("running");
    onOutput?.(`\x1b[36m➜ Running npm run ${devScript}...\x1b[0m\n\n`);
    
    const serverProcess = await container.spawn("npm", ["run", devScript]);
    
    // Patterns that indicate the server is ready (fallback detection)
    const readyPatterns = [
      /localhost:(\d+)/i,
      /127\.0\.0\.1:(\d+)/i,
      /listening on (?:port )?(\d+)/i,
      /server (?:is )?(?:running|started|ready)/i,
      /ready in \d+/i,
      /local:\s+http/i,
      /➜\s+local/i,
    ];
    
    const serverOutput = createBufferedOutput(onOutput);
    const serverPrint = (data: string) => serverOutput.write(data);

    serverProcess.output
      .pipeTo(
        new WritableStream({
          write(data) {
            serverPrint(data);
            
            // Fallback: detect server ready from output patterns
            if (!serverReadyFired) {
              for (const pattern of readyPatterns) {
                if (pattern.test(data)) {
                  // Extract port if present, construct a fallback URL
                  const portMatch = data.match(/(?:localhost|127\.0\.0\.1):(\d+)/i);
                  const port = portMatch ? parseInt(portMatch[1], 10) : 3000;
                  // Give the actual server-ready event a moment to fire
                  setTimeout(() => {
                    if (!serverReadyFired) {
                      serverPrint("\n\x1b[33m⚠ Detected server ready from output (fallback)\x1b[0m\n");
                      serverOutput.flush();
                      handleServerReady(`http://localhost:${port}`, port);
                    }
                  }, 1000);
                  break;
                }
              }
            }
          },
        })
      )
      .catch(() => {
        // ignore output pipe errors
      });
    
    // Listen for server ready event
    container.on("server-ready", (port, url) => {
      handleServerReady(url, port);
    });
    
    // Set a timeout - if server-ready hasn't fired in 60 seconds, show helpful message
    serverReadyTimeout = setTimeout(() => {
      if (!serverReadyFired) {
        onOutput?.("\n\x1b[33m⚠ Server is taking longer than expected...\x1b[0m\n");
        onOutput?.("\x1b[33m  Check the terminal output above for errors.\x1b[0m\n");
        onOutput?.("\x1b[33m  The dev server may need manual configuration.\x1b[0m\n");
      }
    }, 60000);
    
    // Handle server exit
    serverProcess.exit.then((code) => {
      if (serverReadyTimeout) clearTimeout(serverReadyTimeout);
      if (code !== 0 && !serverReadyFired) {
        onError?.(`Dev server exited with code ${code}. Check terminal for details.`);
        onStatusChange?.("error");
      }
    });
    
  } catch (error) {
    if (serverReadyTimeout) clearTimeout(serverReadyTimeout);
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
