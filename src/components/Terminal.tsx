import { useEffect, useRef, useCallback } from "react";
import { Terminal as XTerm } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { useResizeObserver } from "@/hooks/useResizeObserver";
import { Terminal as TerminalIcon } from "lucide-react";
import { startShell, writeToShell, resizeShell, isShellActive } from "@/utils/webcontainer";
import "xterm/css/xterm.css";

export function Terminal() {
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const lastOutputRef = useRef<string>("");
  const shellStartedRef = useRef(false);
  
  const terminalOutput = useWorkspaceStore((s) => s.terminalOutput);
  const containerStatus = useWorkspaceStore((s) => s.containerStatus);

  // Callback for shell output - write directly to xterm
  const handleShellOutput = useCallback((data: string) => {
    if (xtermRef.current) {
      xtermRef.current.write(data);
    }
  }, []);

  // Use shared ResizeObserver for terminal fitting
  const resizeRef = useResizeObserver<HTMLDivElement>(() => {
    if (fitAddonRef.current && xtermRef.current) {
      try {
        fitAddonRef.current.fit();
        const { cols, rows } = xtermRef.current;
        resizeShell(cols, rows);
      } catch {
        // Ignore resize errors
      }
    }
  });

  // Initialize terminal
  useEffect(() => {
    if (!terminalContainerRef.current || xtermRef.current) return;

    const xterm = new XTerm({
      theme: {
        background: "#07070a",
        foreground: "#e4e4e7",
        cursor: "#00d4ff",
        cursorAccent: "#07070a",
        selectionBackground: "#00d4ff40",
        black: "#09090b",
        red: "#ef4444",
        green: "#22c55e",
        yellow: "#eab308",
        blue: "#3b82f6",
        magenta: "#a855f7",
        cyan: "#00d4ff",
        white: "#e4e4e7",
        brightBlack: "#3a3a4a",
        brightRed: "#f87171",
        brightGreen: "#4ade80",
        brightYellow: "#facc15",
        brightBlue: "#60a5fa",
        brightMagenta: "#c084fc",
        brightCyan: "#22d3ee",
        brightWhite: "#ffffff",
      },
      fontFamily: "JetBrains Mono, Fira Code, Monaco, Consolas, monospace",
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: "bar",
      scrollback: 10000,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    
    xterm.open(terminalContainerRef.current);
    fitAddon.fit();

    // Handle user input - send to shell
    xterm.onData((data) => {
      if (isShellActive()) {
        writeToShell(data);
      }
    });

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    return () => {
      xterm.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  // Start shell when container is ready
  useEffect(() => {
    if (containerStatus === "ready" && !shellStartedRef.current) {
      shellStartedRef.current = true;
      startShell(handleShellOutput).then((success) => {
        if (success && xtermRef.current) {
          xtermRef.current.write("\r\n\x1b[32m✓ Interactive shell ready. Type commands here.\x1b[0m\r\n\r\n");
        }
      });
    }
    
    // Reset shell flag when going back to idle
    if (containerStatus === "idle") {
      shellStartedRef.current = false;
    }
  }, [containerStatus, handleShellOutput]);

  // Write new output to terminal (for workflow logs)
  useEffect(() => {
    if (!xtermRef.current) return;

    // Only write the new content
    const newContent = terminalOutput.slice(lastOutputRef.current.length);
    if (newContent) {
      xtermRef.current.write(newContent);
      lastOutputRef.current = terminalOutput;
    }
  }, [terminalOutput]);

  // Clear terminal when output is cleared
  useEffect(() => {
    if (terminalOutput === "" && xtermRef.current) {
      xtermRef.current.clear();
      lastOutputRef.current = "";
    }
  }, [terminalOutput]);

  return (
    <div ref={resizeRef} className="h-full flex flex-col bg-[#07070a]">
      {/* Header */}
      <div className="h-8 px-4 flex items-center justify-between border-b border-border/50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Terminal
          </span>
          {containerStatus === "ready" && (
            <span className="text-xs text-muted-foreground/70">(interactive)</span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {containerStatus !== "idle" && containerStatus !== "ready" && containerStatus !== "error" && (
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-xs text-muted-foreground">
                {containerStatus}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Terminal content */}
      <div ref={terminalContainerRef} className="flex-1 p-2" />
    </div>
  );
}
