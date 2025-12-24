import { Suspense, lazy } from "react";
import { Loader2, Terminal as TerminalIcon } from "lucide-react";

const Terminal = lazy(() => import("./Terminal").then(m => ({ default: m.Terminal })));

function TerminalLoader() {
  return (
    <div className="h-full flex flex-col bg-[#07070a]">
      <div className="h-8 px-4 flex items-center justify-between border-b border-border/50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Terminal
          </span>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    </div>
  );
}

export function LazyTerminal() {
  return (
    <Suspense fallback={<TerminalLoader />}>
      <Terminal />
    </Suspense>
  );
}
