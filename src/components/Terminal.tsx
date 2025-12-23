import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { Terminal as TerminalIcon } from "lucide-react";
import "xterm/css/xterm.css";

export function Terminal() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const lastOutputRef = useRef<string>("");
  
  const { terminalOutput, containerStatus } = useWorkspaceStore();

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

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
    
    xterm.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
      } catch {
        // Ignore resize errors
      }
    });
    resizeObserver.observe(terminalRef.current);

    return () => {
      resizeObserver.disconnect();
      xterm.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  // Write new output to terminal
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
    <div className="h-full flex flex-col bg-[#07070a]">
      {/* Header */}
      <div className="h-8 px-4 flex items-center justify-between border-b border-border/50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Terminal
          </span>
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
      <div ref={terminalRef} className="flex-1 p-2" />
    </div>
  );
}
