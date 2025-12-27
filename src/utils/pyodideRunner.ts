// Pyodide-based Python runtime for browser execution
import type { PyodideInterface } from "pyodide";

let pyodideInstance: PyodideInterface | null = null;
let loadingPromise: Promise<PyodideInterface> | null = null;

export type PythonStatus = "idle" | "loading" | "ready" | "running" | "error";

export interface PythonCallbacks {
  onStatusChange?: (status: PythonStatus) => void;
  onOutput?: (data: string) => void;
  onError?: (error: string) => void;
  onPlot?: (imageData: string) => void;
}

// Check if Pyodide is supported
export function checkPyodideSupport(): { supported: boolean; reason?: string } {
  if (typeof WebAssembly === "undefined") {
    return { supported: false, reason: "WebAssembly is not supported in this browser" };
  }
  return { supported: true };
}

// Load Pyodide runtime
export async function loadPyodide(callbacks?: PythonCallbacks): Promise<PyodideInterface | null> {
  const { onStatusChange, onOutput, onError } = callbacks || {};

  // Return existing instance
  if (pyodideInstance) {
    onStatusChange?.("ready");
    return pyodideInstance;
  }

  // Return existing loading promise
  if (loadingPromise) {
    return loadingPromise;
  }

  const support = checkPyodideSupport();
  if (!support.supported) {
    onError?.(support.reason || "Pyodide not supported");
    onStatusChange?.("error");
    return null;
  }

  onStatusChange?.("loading");
  onOutput?.("\x1b[36m➜ Loading Python runtime (Pyodide)...\x1b[0m\n");
  onOutput?.("\x1b[33m  This may take a moment on first load...\x1b[0m\n\n");

  loadingPromise = (async () => {
    try {
      // Dynamic import to avoid bundling Pyodide
      const { loadPyodide: loadPyodideLib } = await import("pyodide");
      
      const pyodide = await loadPyodideLib({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/",
        stdout: (text: string) => onOutput?.(text + "\n"),
        stderr: (text: string) => onOutput?.(`\x1b[31m${text}\x1b[0m\n`),
      });

      onOutput?.("\x1b[32m✓ Python runtime loaded!\x1b[0m\n\n");
      
      // Pre-install common packages
      onOutput?.("\x1b[36m➜ Loading common packages (micropip)...\x1b[0m\n");
      await pyodide.loadPackage("micropip");
      
      onOutput?.("\x1b[32m✓ Python environment ready!\x1b[0m\n\n");
      
      pyodideInstance = pyodide;
      onStatusChange?.("ready");
      
      return pyodide;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load Python";
      onError?.(message);
      onOutput?.(`\x1b[31m✗ ${message}\x1b[0m\n`);
      onStatusChange?.("error");
      loadingPromise = null;
      return null;
    }
  })();

  return loadingPromise;
}

// Install Python packages using micropip
export async function installPackages(
  packages: string[],
  callbacks?: PythonCallbacks
): Promise<boolean> {
  const { onOutput, onError } = callbacks || {};
  
  if (!pyodideInstance) {
    onError?.("Python runtime not loaded");
    return false;
  }

  try {
    onOutput?.(`\x1b[36m➜ Installing packages: ${packages.join(", ")}...\x1b[0m\n`);
    
    const micropip = pyodideInstance.pyimport("micropip");
    
    for (const pkg of packages) {
      try {
        await micropip.install(pkg);
        onOutput?.(`\x1b[32m  ✓ ${pkg}\x1b[0m\n`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Check if it's a pure Python package issue
        if (msg.includes("pure Python")) {
          onOutput?.(`\x1b[33m  ⚠ ${pkg}: requires native code (not available in browser)\x1b[0m\n`);
        } else {
          onOutput?.(`\x1b[31m  ✗ ${pkg}: ${msg}\x1b[0m\n`);
        }
      }
    }
    
    onOutput?.("\n");
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to install packages";
    onError?.(message);
    return false;
  }
}

// Run Python code
export async function runPython(
  code: string,
  callbacks?: PythonCallbacks
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  const { onStatusChange, onOutput, onError } = callbacks || {};

  if (!pyodideInstance) {
    const loaded = await loadPyodide(callbacks);
    if (!loaded) {
      return { success: false, error: "Failed to load Python runtime" };
    }
  }

  onStatusChange?.("running");

  try {
    // Set up output capture
    await pyodideInstance!.runPythonAsync(`
import sys
from io import StringIO

class OutputCapture:
    def __init__(self):
        self.buffer = StringIO()
    def write(self, text):
        sys.stdout.write(text)
        self.buffer.write(text)
    def flush(self):
        pass
    def getvalue(self):
        return self.buffer.getvalue()

_output_capture = OutputCapture()
sys.stdout = _output_capture
sys.stderr = _output_capture
`);

    const result = await pyodideInstance!.runPythonAsync(code);

    onStatusChange?.("ready");
    
    return { 
      success: true, 
      result: result?.toJs ? result.toJs() : result 
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    onError?.(message);
    onOutput?.(`\x1b[31m${message}\x1b[0m\n`);
    onStatusChange?.("ready");
    return { success: false, error: message };
  }
}

// Run a Python file from content
export async function runPythonFile(
  filename: string,
  content: string,
  callbacks?: PythonCallbacks
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  const { onOutput } = callbacks || {};
  
  onOutput?.(`\x1b[36m➜ Running ${filename}...\x1b[0m\n\n`);
  
  return runPython(content, callbacks);
}

// Parse requirements.txt and return package list
export function parseRequirements(content: string): string[] {
  const packages: string[] = [];
  
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith("#")) continue;
    
    // Skip -r (recursive includes), -e (editable installs), etc.
    if (trimmed.startsWith("-")) continue;
    
    // Extract package name (before any version specifier)
    const match = trimmed.match(/^([a-zA-Z0-9_-]+)/);
    if (match) {
      packages.push(match[1].toLowerCase());
    }
  }
  
  return packages;
}

// Get Pyodide instance
export function getPyodideInstance(): PyodideInterface | null {
  return pyodideInstance;
}

// Teardown Python runtime
export function teardownPyodide(): void {
  pyodideInstance = null;
  loadingPromise = null;
}

// List of packages that work well with Pyodide
export const PYODIDE_COMPATIBLE_PACKAGES = new Set([
  // Data science
  "numpy",
  "pandas",
  "scipy",
  "scikit-learn",
  "statsmodels",
  
  // Visualization (matplotlib generates base64 images)
  "matplotlib",
  "seaborn",
  "plotly",
  
  // Utilities
  "requests",
  "beautifulsoup4",
  "lxml",
  "pyyaml",
  "toml",
  "jsonschema",
  
  // Math/Science
  "sympy",
  "networkx",
  
  // Text processing
  "regex",
  "pyparsing",
  
  // Dates
  "python-dateutil",
  "pytz",
]);

// Packages that won't work (require native code compilation)
export const INCOMPATIBLE_PACKAGES = new Set([
  "tensorflow",
  "torch",
  "pytorch",
  "opencv-python",
  "cv2",
  "psycopg2",
  "mysqlclient",
  "cryptography",
  "bcrypt",
  "pillow", // Use pillow-heif instead
  "grpcio",
  "uvloop",
]);

// Check package compatibility
export function checkPackageCompatibility(packages: string[]): {
  compatible: string[];
  incompatible: string[];
  unknown: string[];
} {
  const compatible: string[] = [];
  const incompatible: string[] = [];
  const unknown: string[] = [];
  
  for (const pkg of packages) {
    const lower = pkg.toLowerCase();
    if (PYODIDE_COMPATIBLE_PACKAGES.has(lower)) {
      compatible.push(pkg);
    } else if (INCOMPATIBLE_PACKAGES.has(lower)) {
      incompatible.push(pkg);
    } else {
      unknown.push(pkg);
    }
  }
  
  return { compatible, incompatible, unknown };
}
