import { memo } from "react";
import Editor from "@monaco-editor/react";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { FileCode, Loader2 } from "lucide-react";

const LANGUAGE_MAP: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  json: "json",
  html: "html",
  css: "css",
  scss: "scss",
  sass: "scss",
  less: "less",
  md: "markdown",
  mdx: "markdown",
  yaml: "yaml",
  yml: "yaml",
  xml: "xml",
  svg: "xml",
  py: "python",
  rb: "ruby",
  go: "go",
  rs: "rust",
  java: "java",
  kt: "kotlin",
  swift: "swift",
  c: "c",
  cpp: "cpp",
  h: "c",
  hpp: "cpp",
  cs: "csharp",
  php: "php",
  vue: "vue",
  svelte: "svelte",
  graphql: "graphql",
  gql: "graphql",
  sql: "sql",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  dockerfile: "dockerfile",
  toml: "toml",
};

function getLanguage(fileName: string): string {
  const lowerName = fileName.toLowerCase();
  
  // Special file names
  if (lowerName === "dockerfile") return "dockerfile";
  if (lowerName === "makefile") return "makefile";
  if (lowerName.endsWith(".d.ts")) return "typescript";
  
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  return LANGUAGE_MAP[ext] || "plaintext";
}

export const CodeEditor = memo(function CodeEditor() {
  const selectedFile = useWorkspaceStore((s) => s.selectedFile);
  const fileContent = useWorkspaceStore((s) => s.fileContent);
  const isLoadingFile = useWorkspaceStore((s) => s.isLoadingFile);

  if (!selectedFile) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
        <FileCode className="w-16 h-16 mb-4 opacity-20" />
        <p className="text-sm">Select a file to view its contents</p>
      </div>
    );
  }

  const language = getLanguage(selectedFile.name);

  return (
    <div className="h-full flex flex-col">
      {/* File tab */}
      <div className="h-10 px-4 flex items-center border-b border-border bg-muted/30">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-background rounded-t border border-b-0 border-border text-sm">
          <FileCode className="w-4 h-4 text-primary" />
          <span className="font-medium">{selectedFile.name}</span>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 relative">
        {isLoadingFile && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        )}
        
        <Editor
          height="100%"
          language={language}
          value={fileContent}
          theme="vs-dark"
          options={{
            readOnly: true,
            minimap: { enabled: true },
            fontSize: 14,
            fontFamily: "JetBrains Mono, Fira Code, Monaco, Consolas, monospace",
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            wordWrap: "on",
            padding: { top: 16 },
            renderLineHighlight: "gutter",
            cursorStyle: "line",
            automaticLayout: true,
          }}
          beforeMount={(monaco) => {
            monaco.editor.defineTheme("cyberpunk", {
              base: "vs-dark",
              inherit: true,
              rules: [
                { token: "comment", foreground: "6272a4", fontStyle: "italic" },
                { token: "keyword", foreground: "00d4ff" },
                { token: "string", foreground: "bd00ff" },
                { token: "number", foreground: "00d4ff" },
                { token: "type", foreground: "00d4ff" },
              ],
              colors: {
                "editor.background": "#0a0a0f",
                "editor.foreground": "#f8f8f2",
                "editorLineNumber.foreground": "#3a3a4a",
                "editorLineNumber.activeForeground": "#00d4ff",
                "editor.selectionBackground": "#00d4ff30",
                "editor.lineHighlightBackground": "#1a1a2e",
                "editorCursor.foreground": "#00d4ff",
                "editorIndentGuide.background": "#1a1a2e",
                "editorIndentGuide.activeBackground": "#3a3a4a",
              },
            });
          }}
          onMount={(editor, monaco) => {
            monaco.editor.setTheme("cyberpunk");
          }}
        />
      </div>
    </div>
  );
});
