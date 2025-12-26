import { Suspense, lazy } from "react";
import { TerminalSkeleton } from "./WorkspaceSkeletons";

const Terminal = lazy(() => import("./Terminal").then(m => ({ default: m.Terminal })));

export function LazyTerminal() {
  return (
    <Suspense fallback={<TerminalSkeleton />}>
      <Terminal />
    </Suspense>
  );
}
