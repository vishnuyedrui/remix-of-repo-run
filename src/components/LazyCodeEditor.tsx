import { Suspense, lazy } from "react";
import { Loader2, FileCode } from "lucide-react";

const CodeEditor = lazy(() => import("./CodeEditor").then(m => ({ default: m.CodeEditor })));

function EditorLoader() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
      <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
      <p className="text-sm">Loading editor...</p>
    </div>
  );
}

export function LazyCodeEditor() {
  return (
    <Suspense fallback={<EditorLoader />}>
      <CodeEditor />
    </Suspense>
  );
}
