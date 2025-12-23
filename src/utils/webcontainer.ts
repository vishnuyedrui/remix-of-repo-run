import { WebContainer, FileSystemTree } from "@webcontainer/api";
import type { ProjectType } from "./projectDetection";

let webcontainerInstance: WebContainer | null = null;
let bootPromise: Promise<WebContainer> | null = null;

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
  
  try {
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
    
    serverProcess.output.pipeTo(
      new WritableStream({
        write(data) {
          onOutput?.(data);
        },
      })
    );
    
    // Listen for server ready
    container.on("server-ready", (port, url) => {
      onOutput?.(`\n\x1b[32m✓ Server ready on port ${port}\x1b[0m\n`);
      onServerReady?.(url);
      onStatusChange?.("ready");
    });
    
    // Handle server exit
    serverProcess.exit.then((code) => {
      if (code !== 0) {
        onError?.(`Dev server exited with code ${code}. Check terminal for details.`);
        onStatusChange?.("error");
      }
    });
    
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    onError?.(message);
    onStatusChange?.("error");
  }
}

// Serve static files using a simple server
async function serveStaticSite(
  container: WebContainer,
  callbacks: ContainerCallbacks
): Promise<void> {
  const { onStatusChange, onOutput, onServerReady, onError } = callbacks;

  try {
    // Create a minimal package.json for serve
    onStatusChange?.("installing");
    onOutput?.("\x1b[36m➜ Setting up static file server...\x1b[0m\n\n");

    await container.fs.writeFile(
      "package.json",
      JSON.stringify(
        {
          name: "static-server",
          type: "module",
          scripts: {
            start: "npx http-server . -p 3000 -c-1 --no-icons",
          },
        },
        null,
        2
      )
    );

    // Install http-server
    const installExitCode = await runCommand(
      container,
      "npm",
      ["install", "http-server"],
      onOutput
    );

    if (installExitCode !== 0) {
      onError?.("Failed to install static server.");
      onStatusChange?.("error");
      return;
    }

    onOutput?.("\n\x1b[32m✓ Static server ready!\x1b[0m\n\n");

    // Start server
    onStatusChange?.("running");
    onOutput?.("\x1b[36m➜ Starting static file server...\x1b[0m\n\n");

    const serverProcess = await container.spawn("npm", ["run", "start"]);

    serverProcess.output.pipeTo(
      new WritableStream({
        write(data) {
          onOutput?.(data);
        },
      })
    );

    // Listen for server ready
    container.on("server-ready", (port, url) => {
      onOutput?.(`\n\x1b[32m✓ Static server ready on port ${port}\x1b[0m\n`);
      onServerReady?.(url);
      onStatusChange?.("ready");
    });

    serverProcess.exit.then((code) => {
      if (code !== 0) {
        onError?.(`Static server exited with code ${code}.`);
        onStatusChange?.("error");
      }
    });
  } catch (error) {
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
