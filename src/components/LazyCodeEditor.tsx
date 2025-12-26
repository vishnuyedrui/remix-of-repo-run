import { Suspense, lazy } from "react";
import { CodeEditorSkeleton } from "./WorkspaceSkeletons";

const CodeEditor = lazy(() => import("./CodeEditor").then(m => ({ default: m.CodeEditor })));

export function LazyCodeEditor() {
  return (
    <Suspense fallback={<CodeEditorSkeleton />}>
      <CodeEditor />
    </Suspense>
  );
}
