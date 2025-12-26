import { motion } from "motion/react";
import type { Easing } from "motion/react";
import { Folder, File, Monitor, Terminal as TerminalIcon, FileCode } from "lucide-react";

// Skeleton line component with shimmer effect
function SkeletonLine({ 
  width = "100%", 
  height = "h-4", 
  delay = 0 
}: { 
  width?: string; 
  height?: string; 
  delay?: number;
}) {
  return (
    <motion.div
      className={`${height} rounded bg-gradient-to-r from-muted via-muted-foreground/10 to-muted bg-[length:200%_100%]`}
      style={{ width }}
      initial={{ backgroundPosition: "-200% 0" }}
      animate={{ backgroundPosition: "200% 0" }}
      transition={{ 
        repeat: Infinity, 
        duration: 1.5, 
        ease: "linear" as Easing,
        delay 
      }}
    />
  );
}

// File Tree Skeleton
export function FileTreeSkeleton() {
  const items = [
    { type: "folder", indent: 0, width: "70%" },
    { type: "file", indent: 1, width: "60%" },
    { type: "file", indent: 1, width: "80%" },
    { type: "file", indent: 1, width: "55%" },
    { type: "folder", indent: 0, width: "65%" },
    { type: "file", indent: 1, width: "75%" },
    { type: "file", indent: 1, width: "50%" },
    { type: "folder", indent: 0, width: "60%" },
    { type: "file", indent: 1, width: "85%" },
    { type: "file", indent: 1, width: "45%" },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="h-10 px-4 flex items-center border-b border-border">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Explorer
        </span>
      </div>
      
      <div className="flex-1 py-2 px-2 space-y-1 overflow-hidden">
        {items.map((item, index) => (
          <motion.div
            key={index}
            className="flex items-center gap-2 py-1 px-2"
            style={{ paddingLeft: `${item.indent * 12 + 8}px` }}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05, duration: 0.3 }}
          >
            {item.type === "folder" ? (
              <Folder className="w-4 h-4 text-muted-foreground/30" />
            ) : (
              <File className="w-4 h-4 text-muted-foreground/20" />
            )}
            <SkeletonLine width={item.width} height="h-3" delay={index * 0.05} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// Code Editor Skeleton
export function CodeEditorSkeleton() {
  const codeLines = [
    { indent: 0, width: "40%" },
    { indent: 0, width: "60%" },
    { indent: 1, width: "75%" },
    { indent: 1, width: "55%" },
    { indent: 2, width: "80%" },
    { indent: 2, width: "45%" },
    { indent: 2, width: "90%" },
    { indent: 1, width: "30%" },
    { indent: 0, width: "20%" },
    { indent: 0, width: "0%" },
    { indent: 0, width: "50%" },
    { indent: 1, width: "65%" },
    { indent: 1, width: "85%" },
    { indent: 1, width: "40%" },
    { indent: 0, width: "25%" },
  ];

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Editor header skeleton */}
      <div className="h-10 px-4 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-muted-foreground/30" />
          <SkeletonLine width="120px" height="h-3" />
        </div>
      </div>
      
      {/* Line numbers + code */}
      <div className="flex-1 flex overflow-hidden">
        {/* Line numbers */}
        <div className="w-12 bg-muted/30 flex flex-col items-end py-4 pr-3 space-y-1">
          {codeLines.map((_, index) => (
            <motion.span
              key={index}
              className="text-xs text-muted-foreground/30 font-mono"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.3 }}
              transition={{ delay: index * 0.03 }}
            >
              {index + 1}
            </motion.span>
          ))}
        </div>
        
        {/* Code content */}
        <div className="flex-1 py-4 px-4 space-y-2">
          {codeLines.map((line, index) => (
            <motion.div
              key={index}
              style={{ paddingLeft: `${line.indent * 20}px` }}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.04, duration: 0.3 }}
            >
              {line.width !== "0%" && (
                <SkeletonLine width={line.width} height="h-4" delay={index * 0.03} />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Preview Skeleton
export function PreviewSkeleton() {
  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="h-10 px-4 flex items-center justify-between border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Monitor className="w-4 h-4 text-muted-foreground/30" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Preview
          </span>
        </div>
      </div>
      
      {/* Content skeleton - simulating a webpage */}
      <div className="flex-1 p-6 space-y-6 overflow-hidden">
        {/* Nav bar skeleton */}
        <motion.div 
          className="flex items-center justify-between"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <SkeletonLine width="100px" height="h-6" />
          <div className="flex gap-4">
            <SkeletonLine width="60px" height="h-4" delay={0.1} />
            <SkeletonLine width="60px" height="h-4" delay={0.15} />
            <SkeletonLine width="60px" height="h-4" delay={0.2} />
          </div>
        </motion.div>
        
        {/* Hero section skeleton */}
        <motion.div 
          className="space-y-4 py-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <SkeletonLine width="60%" height="h-10" delay={0.25} />
          <SkeletonLine width="80%" height="h-4" delay={0.3} />
          <SkeletonLine width="70%" height="h-4" delay={0.35} />
          <div className="flex gap-4 pt-4">
            <SkeletonLine width="120px" height="h-10" delay={0.4} />
            <SkeletonLine width="100px" height="h-10" delay={0.45} />
          </div>
        </motion.div>
        
        {/* Cards grid skeleton */}
        <motion.div 
          className="grid grid-cols-3 gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          {[0, 1, 2].map((i) => (
            <motion.div 
              key={i} 
              className="p-4 rounded-lg border border-border/50 space-y-3"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 + i * 0.1, duration: 0.3 }}
            >
              <SkeletonLine width="40px" height="h-8" delay={0.6 + i * 0.1} />
              <SkeletonLine width="80%" height="h-4" delay={0.65 + i * 0.1} />
              <SkeletonLine width="100%" height="h-3" delay={0.7 + i * 0.1} />
              <SkeletonLine width="60%" height="h-3" delay={0.75 + i * 0.1} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

// Terminal Skeleton
export function TerminalSkeleton() {
  const lines = [
    { prefix: "$", content: "npm install", width: "30%" },
    { prefix: "", content: "added 1245 packages", width: "45%" },
    { prefix: "", content: "audited 1246 packages in 3.245s", width: "60%" },
    { prefix: "$", content: "npm run dev", width: "25%" },
    { prefix: ">", content: "vite", width: "15%" },
  ];

  return (
    <div className="h-full flex flex-col bg-[#07070a]">
      <div className="h-8 px-4 flex items-center justify-between border-b border-border/50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-3.5 h-3.5 text-muted-foreground/50" />
          <span className="text-xs font-semibold text-muted-foreground/50 uppercase tracking-wide">
            Terminal
          </span>
        </div>
        <motion.div
          className="flex gap-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="w-2 h-2 rounded-full bg-red-500/30" />
          <div className="w-2 h-2 rounded-full bg-yellow-500/30" />
          <div className="w-2 h-2 rounded-full bg-green-500/30" />
        </motion.div>
      </div>
      
      <div className="flex-1 p-3 font-mono text-xs space-y-1 overflow-hidden">
        {lines.map((line, index) => (
          <motion.div
            key={index}
            className="flex items-center gap-2"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1, duration: 0.3 }}
          >
            {line.prefix && (
              <span className="text-green-500/50">{line.prefix}</span>
            )}
            <SkeletonLine width={line.width} height="h-3" delay={index * 0.1} />
          </motion.div>
        ))}
        
        {/* Blinking cursor */}
        <motion.div
          className="flex items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <span className="text-green-500/50">$</span>
          <motion.div
            className="w-2 h-4 bg-green-500/50"
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        </motion.div>
      </div>
    </div>
  );
}
